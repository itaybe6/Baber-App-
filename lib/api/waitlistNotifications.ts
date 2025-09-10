import { supabase } from '@/lib/supabase';
import { AvailableTimeSlot } from '@/lib/supabase';
import { notificationsApi } from './notifications';

// Helper: convert HH:MM[:SS] to minutes
const toMinutes = (time: string) => {
  const parts = String(time).split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
};

// Helper: compute working windows after subtracting breaks
const computeWorkingWindows = (start: string, end: string, breaks: Array<{ start_time: string; end_time: string }>) => {
  type Window = { start: string; end: string };
  let windows: Window[] = [{ start, end }];
  for (const b of breaks) {
    const next: Window[] = [];
    for (const w of windows) {
      if (b.end_time <= w.start || b.start_time >= w.end) { next.push(w); continue; }
      if (w.start < b.start_time) next.push({ start: w.start, end: b.start_time });
      if (b.end_time < w.end) next.push({ start: b.end_time, end: w.end });
    }
    windows = next.filter(w => w.start < w.end);
  }
  return windows
    .map(w => ({ startMin: toMinutes(w.start), endMin: toMinutes(w.end) }))
    .filter(w => w.startMin < w.endMin)
    .sort((a, b) => a.startMin - b.startMin);
};

// Helper: map time period to minute ranges
const timePeriodToRange = (period: 'morning' | 'afternoon' | 'evening' | 'any'): { startMin: number; endMin: number } => {
  if (period === 'morning') return { startMin: 7 * 60, endMin: 12 * 60 };
  if (period === 'afternoon') return { startMin: 12 * 60, endMin: 16 * 60 };
  if (period === 'evening') return { startMin: 16 * 60, endMin: 20 * 60 };
  return { startMin: 7 * 60, endMin: 20 * 60 };
};

// Helper: check overlap between a window and a range
const hasOverlap = (a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }) => {
  return Math.max(a.startMin, b.startMin) < Math.min(a.endMin, b.endMin);
};

// Notify waitlist clients when business hours update may open new availability
export const notifyWaitlistOnBusinessHoursUpdate = async (
  dayOfWeek: number,
  updated: { start_time: string; end_time: string; breaks?: Array<{ start_time: string; end_time: string }>; is_active?: boolean }
) => {
  try {
    if (updated.is_active === false) {
      // Closed day, nothing to notify
      return;
    }

    const windows = computeWorkingWindows(
      updated.start_time,
      updated.end_time,
      (updated.breaks || [])
    );

    if (windows.length === 0) {
      return;
    }

    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];

    // Fetch future waitlist entries still waiting
    const { data: entries, error } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('status', 'waiting')
      .gte('requested_date', todayIso)
      .order('requested_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching waitlist entries for BH update:', error);
      return;
    }

    const matches = (entries || []).filter((e: any) => {
      const reqDate = new Date(e.requested_date);
      if (reqDate.getDay() !== dayOfWeek) return false;
      const periodRange = timePeriodToRange(e.time_period);
      return windows.some(w => hasOverlap(w, periodRange));
    });

    if (matches.length === 0) return;

    const notifications = matches.map((e: any) => ({
      title: 'שעות חדשות נוספו',
      content: `שלום ${e.client_name}! נוספו שעות פעילות בתאריך ${formatDateForNotification(e.requested_date)} שמתאימות להעדפה שלך עבור ${e.service_name}. ניתן לנסות לקבוע תור עכשיו.`,
      type: 'appointment_reminder' as const,
      recipient_name: e.client_name,
      recipient_phone: e.client_phone,
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('❌ Error inserting BH update notifications:', insertError);
      return;
    }

    // Mark entries as contacted to avoid duplicate alerts
    const ids = matches.map((e: any) => e.id);
    if (ids.length > 0) {
      const { error: updErr } = await supabase
        .from('waitlist_entries')
        .update({ status: 'contacted' })
        .in('id', ids);
      if (updErr) {
        console.error('❌ Error updating waitlist status after BH notifications:', updErr);
      }
    }
  } catch (err) {
    console.error('❌ Error in notifyWaitlistOnBusinessHoursUpdate:', err);
  }
};

// Function to check waitlist and notify waiting clients for the same date
export const checkWaitlistAndNotify = async (cancelledAppointment: AvailableTimeSlot) => {
  try {
    console.log('🔍 Checking waitlist for cancelled appointment:', cancelledAppointment);
    
    // Get the time period for the cancelled appointment
    const appointmentTime = new Date(`2000-01-01T${cancelledAppointment.slot_time}`);
    const hour = appointmentTime.getHours();
    
    let timePeriod: 'morning' | 'afternoon' | 'evening' | 'any';
    if (hour >= 7 && hour < 12) {
      timePeriod = 'morning';
    } else if (hour >= 12 && hour < 16) {
      timePeriod = 'afternoon';
    } else if (hour >= 16 && hour < 20) {
      timePeriod = 'evening';
    } else {
      timePeriod = 'any';
    }
    
    console.log('⏰ Appointment time period:', timePeriod, 'for hour:', hour);
    
    // Find waitlist entries for the same date and time period
    // Include both specific time period and 'any' time period
    // Also include entries for the same service regardless of time period
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('requested_date', cancelledAppointment.slot_date)
      .eq('status', 'waiting')
      .or(`time_period.eq.${timePeriod},time_period.eq.any,service_name.eq.${cancelledAppointment.service_name}`)
      .order('created_at', { ascending: true });

    if (waitlistError) {
      console.error('❌ Error fetching waitlist entries:', waitlistError);
      return;
    }

    console.log('📋 Found waitlist entries:', waitlistEntries?.length || 0);
    
    if (!waitlistEntries || waitlistEntries.length === 0) {
      console.log('ℹ️ No waitlist entries found for this date and time period');
      return;
    }

    // Filter entries to avoid duplicates and ensure relevance
    const relevantEntries = waitlistEntries.filter(entry => {
      // Include if same time period or 'any' time period
      const timeMatch = entry.time_period === timePeriod || entry.time_period === 'any';
      // Include if same service
      const serviceMatch = entry.service_name === cancelledAppointment.service_name;
      
      return timeMatch || serviceMatch;
    });

    console.log('📋 Relevant waitlist entries after filtering:', relevantEntries.length);

    // Log found entries for debugging
    relevantEntries.forEach((entry, index) => {
      console.log(`📝 Entry ${index + 1}: ${entry.client_name} (${entry.client_phone}) - ${entry.service_name} - ${entry.time_period}`);
    });

    // Get user data for notification
    const clientPhones = relevantEntries.map(entry => entry.client_phone);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('name, phone')
      .in('phone', clientPhones);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    // Create a map of phone to user data
    const userMap = new Map();
    users?.forEach(user => {
      userMap.set(user.phone, user);
    });

    // Create notifications for waiting clients
    const notifications = [];
    const notifiedEntryIds: string[] = [];
    
    for (const entry of relevantEntries) {
      const user = userMap.get(entry.client_phone);
      if (!user) {
        console.log(`⚠️ User not found for phone: ${entry.client_phone}`);
        continue;
      }

      const notificationTitle = '🎉 מקום התפנה!';
      const notificationContent = `שלום ${entry.client_name}! מקום התפנה עבור ${entry.service_name} בתאריך ${formatDateForNotification(cancelledAppointment.slot_date)} בשעה ${cancelledAppointment.slot_time}. מהרי להזמין תור!`;

      notifications.push({
        title: notificationTitle,
        content: notificationContent,
        type: 'appointment_reminder' as const,
        recipient_name: entry.client_name,
        recipient_phone: entry.client_phone,
      });

      notifiedEntryIds.push(entry.id);
      console.log(`📱 Prepared notification for: ${entry.client_name} (${entry.client_phone})`);
    }

    console.log('📱 Creating notifications for', notifications.length, 'clients');

    // Insert notifications into database
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error inserting notifications:', insertError);
        return;
      }

      console.log('✅ Successfully created notifications for waitlist clients');

      // Update waitlist entry status to 'contacted' to prevent duplicate notifications
      if (notifiedEntryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('waitlist_entries')
          .update({ status: 'contacted' })
          .in('id', notifiedEntryIds);

        if (updateError) {
          console.error('❌ Error updating waitlist entry status:', updateError);
        } else {
          console.log('✅ Updated waitlist entry status to "contacted" for', notifiedEntryIds.length, 'entries');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error in checkWaitlistAndNotify:', error);
  }
};

// Function to notify clients waiting for the same service on any future date
export const notifyServiceWaitlistClients = async (cancelledAppointment: AvailableTimeSlot) => {
  try {
    console.log('🔍 Checking service waitlist for cancelled appointment:', cancelledAppointment);
    
    // Find waitlist entries for the same service on any future date
    const today = new Date().toISOString().split('T')[0];
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('service_name', cancelledAppointment.service_name)
      .eq('status', 'waiting')
      .gte('requested_date', today)
      .order('requested_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (waitlistError) {
      console.error('❌ Error fetching service waitlist entries:', waitlistError);
      return;
    }

    console.log('📋 Found service waitlist entries:', waitlistEntries?.length || 0);
    
    if (!waitlistEntries || waitlistEntries.length === 0) {
      console.log('ℹ️ No service waitlist entries found');
      return;
    }

    // Log found entries for debugging
    waitlistEntries.forEach((entry, index) => {
      console.log(`📝 Service Entry ${index + 1}: ${entry.client_name} (${entry.client_phone}) - ${entry.service_name} - ${entry.requested_date} - ${entry.time_period}`);
    });

    // Get user data for notification
    const clientPhones = waitlistEntries.map(entry => entry.client_phone);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('name, phone')
      .in('phone', clientPhones);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    // Create a map of phone to user data
    const userMap = new Map();
    users?.forEach(user => {
      userMap.set(user.phone, user);
    });

    // Create notifications for waiting clients
    const notifications = [];
    const notifiedEntryIds: string[] = [];
    
    for (const entry of waitlistEntries) {
      const user = userMap.get(entry.client_phone);
      if (!user) {
        console.log(`⚠️ User not found for phone: ${entry.client_phone}`);
        continue;
      }

      const notificationTitle = '🎉 מקום התפנה!';
      const notificationContent = `שלום ${entry.client_name}! מקום התפנה עבור ${entry.service_name} בתאריך ${formatDateForNotification(cancelledAppointment.slot_date)} בשעה ${cancelledAppointment.slot_time}. מהרי להזמין תור!`;

      notifications.push({
        title: notificationTitle,
        content: notificationContent,
        type: 'appointment_reminder' as const,
        recipient_name: entry.client_name,
        recipient_phone: entry.client_phone,
      });

      notifiedEntryIds.push(entry.id);
      console.log(`📱 Prepared service notification for: ${entry.client_name} (${entry.client_phone})`);
    }

    console.log('📱 Creating service notifications for', notifications.length, 'clients');

    // Insert notifications into database
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error inserting service notifications:', insertError);
        return;
      }

      console.log('✅ Successfully created service notifications for waitlist clients');

      // Update waitlist entry status to 'contacted' to prevent duplicate notifications
      if (notifiedEntryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('waitlist_entries')
          .update({ status: 'contacted' })
          .in('id', notifiedEntryIds);

        if (updateError) {
          console.error('❌ Error updating service waitlist entry status:', updateError);
        } else {
          console.log('✅ Updated service waitlist entry status to "contacted" for', notifiedEntryIds.length, 'entries');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error in notifyServiceWaitlistClients:', error);
  }
};

// Function to notify all waitlist clients for any future date (general availability)
export const notifyAllWaitlistClients = async (cancelledAppointment: AvailableTimeSlot) => {
  try {
    console.log('🔍 Checking all waitlist clients for general availability notification');
    
    // Find all waitlist entries for any future date
    const today = new Date().toISOString().split('T')[0];
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('status', 'waiting')
      .gte('requested_date', today)
      .order('requested_date', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50); // Limit to prevent spam

    if (waitlistError) {
      console.error('❌ Error fetching all waitlist entries:', waitlistError);
      return;
    }

    console.log('📋 Found all waitlist entries:', waitlistEntries?.length || 0);
    
    if (!waitlistEntries || waitlistEntries.length === 0) {
      console.log('ℹ️ No waitlist entries found');
      return;
    }

    // Log found entries for debugging
    waitlistEntries.forEach((entry, index) => {
      console.log(`📝 All Entry ${index + 1}: ${entry.client_name} (${entry.client_phone}) - ${entry.service_name} - ${entry.requested_date} - ${entry.time_period}`);
    });

    // Get user data for notification
    const clientPhones = waitlistEntries.map(entry => entry.client_phone);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('name, phone')
      .in('phone', clientPhones);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    // Create a map of phone to user data
    const userMap = new Map();
    users?.forEach(user => {
      userMap.set(user.phone, user);
    });

    // Create notifications for waiting clients
    const notifications = [];
    const notifiedEntryIds: string[] = [];
    
    for (const entry of waitlistEntries) {
      const user = userMap.get(entry.client_phone);
      if (!user) {
        console.log(`⚠️ User not found for phone: ${entry.client_phone}`);
        continue;
      }

      const notificationTitle = '🎉 מקום התפנה!';
      const notificationContent = `שלום ${entry.client_name}! מקום התפנה עבור ${cancelledAppointment.service_name} בתאריך ${formatDateForNotification(cancelledAppointment.slot_date)} בשעה ${cancelledAppointment.slot_time}. מהרי להזמין תור!`;

      notifications.push({
        title: notificationTitle,
        content: notificationContent,
        type: 'appointment_reminder' as const,
        recipient_name: entry.client_name,
        recipient_phone: entry.client_phone,
      });

      notifiedEntryIds.push(entry.id);
      console.log(`📱 Prepared general notification for: ${entry.client_name} (${entry.client_phone})`);
    }

    console.log('📱 Creating general notifications for', notifications.length, 'clients');

    // Insert notifications into database
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error inserting general notifications:', insertError);
        return;
      }

      console.log('✅ Successfully created general notifications for waitlist clients');

      // Update waitlist entry status to 'contacted' to prevent duplicate notifications
      if (notifiedEntryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('waitlist_entries')
          .update({ status: 'contacted' })
          .in('id', notifiedEntryIds);

        if (updateError) {
          console.error('❌ Error updating general waitlist entry status:', updateError);
        } else {
          console.log('✅ Updated general waitlist entry status to "contacted" for', notifiedEntryIds.length, 'entries');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error in notifyAllWaitlistClients:', error);
  }
};

// Helper function to format date for notification
const formatDateForNotification = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}; 