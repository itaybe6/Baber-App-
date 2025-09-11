import { supabase } from '@/lib/supabase';

export interface RecurringAppointment {
  id: string;
  client_name: string;
  client_phone: string;
  day_of_week: number; // 0-6
  slot_time: string; // HH:MM[:SS]
  service_name: string;
  repeat_interval_weeks?: number; // 1-4, default 1
  start_date?: string | null; // YYYY-MM-DD
  end_date?: string | null;   // YYYY-MM-DD
  // User (barber) association - enables multiple barbers to have separate recurring appointments
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const recurringAppointmentsApi = {
  async create(payload: Omit<RecurringAppointment, 'id' | 'created_at' | 'updated_at'> & { start_date?: string | null; end_date?: string | null }): Promise<RecurringAppointment | null> {
    try {
      // Guard: prevent conflicts with other recurring rules and already-booked slots on the nearest occurrence
      const toDateString = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split('T')[0];
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const currentDow = start.getDay();
      const delta = (payload.day_of_week - currentDow + 7) % 7; // 0..6
      const first = new Date(start);
      first.setDate(start.getDate() + delta);
      const firstDateStr = toDateString(first);

      // 1) Existing recurring rule with same day/time for the same barber
      const { data: existingRecurring, error: existingRecurringErr } = await supabase
        .from('recurring_appointments')
        .select('id')
        .eq('day_of_week', payload.day_of_week)
        .eq('slot_time', payload.slot_time)
        .eq('user_id', payload.user_id)
        .limit(1)
        .maybeSingle();
      if (existingRecurringErr) {
        console.error('Error checking existing recurring rules:', existingRecurringErr);
      }
      if (existingRecurring) {
        console.warn('Recurring conflict: rule already exists for same day/time');
        return null;
      }

      // 2) Concrete slot already booked on the nearest occurrence date for the same barber
      const { data: bookedSlot, error: bookedErr } = await supabase
        .from('appointments')
        .select('id, is_available')
        .eq('slot_date', firstDateStr)
        .eq('slot_time', payload.slot_time)
        .eq('user_id', payload.user_id)
        .eq('is_available', false)
        .maybeSingle();
      if (bookedErr) {
        console.error('Error checking booked slots for nearest occurrence:', bookedErr);
      }
      if (bookedSlot) {
        console.warn('Recurring conflict: nearest occurrence already booked');
        return null;
      }

      // Default repeat interval and start_date anchor (first upcoming occurrence)
      const repeatInterval = payload.repeat_interval_weeks && payload.repeat_interval_weeks > 0 ? payload.repeat_interval_weeks : 1;
      const startDateToStore = payload.start_date ?? firstDateStr;

      const { data, error } = await supabase
        .from('recurring_appointments')
        .insert({ ...payload, repeat_interval_weeks: repeatInterval, start_date: startDateToStore })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating recurring request:', error);
        return null;
      }

      const created = data as RecurringAppointment;

      // Seed concrete appointments in appointments for the next weeks (no duplicates)
      // Seed only the nearest upcoming occurrence (this week)
      await recurringAppointmentsApi.seedUpcomingOccurrences(created, 1);

      return created;
    } catch (e) {
      console.error('Error in requestRecurring:', e);
      return null;
    }
  },

  async getApprovedByDay(dayOfWeek: number): Promise<RecurringAppointment[]> {
    const { data, error } = await supabase
      .from('recurring_appointments')
      .select('*')
      .eq('day_of_week', dayOfWeek);
    if (error) {
      console.error('Error fetching approved recurring for day:', error);
      return [];
    }
    return (data || []) as RecurringAppointment[];
  },

  async listAll(userId?: string): Promise<RecurringAppointment[]> {
    let query = supabase
      .from('recurring_appointments')
      .select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query
      .order('day_of_week', { ascending: true })
      .order('slot_time', { ascending: true })
      .order('client_name', { ascending: true });
    if (error) {
      console.error('Error listing recurring appointments:', error);
      return [];
    }
    return (data || []) as RecurringAppointment[];
  },

  // Get recurring appointments for a specific user (barber)
  async getByUser(userId: string): Promise<RecurringAppointment[]> {
    return this.listAll(userId);
  },

  async update(id: string, updates: Partial<Omit<RecurringAppointment, 'id' | 'created_at' | 'updated_at'>>): Promise<RecurringAppointment | null> {
    const { data, error } = await supabase
      .from('recurring_appointments')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      console.error('Error updating recurring appointment:', error);
      return null;
    }
    return data as RecurringAppointment;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('recurring_appointments')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting recurring appointment:', error);
      return false;
    }
    return true;
  },

  // Create or book concrete slots for the next `weeks` occurrences (default 1 = only this week)
  async seedUpcomingOccurrences(rule: RecurringAppointment, weeks: number = 1): Promise<void> {
    try {
      const today = new Date();
      // Normalize to local today date (strip time)
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // Compute first occurrence date on/after today for the specified weekday
      const currentDow = start.getDay();
      const delta = (rule.day_of_week - currentDow + 7) % 7; // 0..6
      const first = new Date(start);
      first.setDate(start.getDate() + delta);

      const toDateString = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split('T')[0];

      const withinRange = (d: Date) => {
        const ds = toDateString(d);
        const startOk = !rule.start_date || rule.start_date <= ds;
        const endOk = !rule.end_date || rule.end_date >= ds;
        return startOk && endOk;
      };

      const interval = Math.max(1, rule.repeat_interval_weeks || 1);
      for (let i = 0; i < weeks; i++) {
        const occ = new Date(first);
        occ.setDate(first.getDate() + i * 7);
        // Respect start/end range and repeat interval (skip weeks not aligned with interval)
        if (!withinRange(occ)) continue;
        const anchor = rule.start_date ? new Date(rule.start_date + 'T00:00:00') : first;
        const weeksFromAnchor = Math.floor((occ.getTime() - new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()).getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksFromAnchor % interval !== 0) continue;
        const dateStr = toDateString(occ);

        // Check if a slot exists
        const { data: slot } = await supabase
          .from('appointments')
          .select('id, is_available, client_phone')
          .eq('slot_date', dateStr)
          .eq('slot_time', rule.slot_time)
          .maybeSingle();

        if (!slot) {
          // Insert as booked for this client
          await supabase
            .from('appointments')
            .insert({
              slot_date: dateStr,
              slot_time: rule.slot_time,
              is_available: false,
              client_name: rule.client_name,
              client_phone: rule.client_phone,
              service_name: rule.service_name,
              user_id: rule.user_id,
            });
        } else if (slot.is_available === true) {
          // Book the existing available slot for this client
          await supabase
            .from('appointments')
            .update({
              is_available: false,
              client_name: rule.client_name,
              client_phone: rule.client_phone,
              service_name: rule.service_name,
              user_id: rule.user_id,
            })
            .eq('id', slot.id)
            .eq('is_available', true);
        } else {
          // Already booked; leave as-is (no duplicates)
        }
      }
    } catch (e) {
      console.error('Error seeding upcoming recurring occurrences:', e);
    }
  },
};


