import { supabase } from '@/lib/supabase';
import type { BusinessConstraint } from '@/lib/supabase';

export const businessConstraintsApi = {
  async getConstraintsForDate(date: string): Promise<BusinessConstraint[]> {
    const { data, error } = await supabase
      .from('business_constraints')
      .select('*')
      .eq('date', date)
      .order('start_time');
    if (error) throw error;
    return (data || []) as BusinessConstraint[];
  },

  async getConstraintsInRange(startDate: string, endDate: string): Promise<BusinessConstraint[]> {
    const { data, error } = await supabase
      .from('business_constraints')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('start_time');
    if (error) throw error;
    return (data || []) as BusinessConstraint[];
  },

  async createConstraints(entries: Array<Omit<BusinessConstraint, 'id' | 'created_at' | 'updated_at'>>): Promise<number> {
    if (!entries || entries.length === 0) return 0;
    const { data, error } = await supabase
      .from('business_constraints')
      .insert(entries)
      .select('id');
    if (error) throw error;
    return (data?.length || 0);
  },

  async deleteConstraint(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('business_constraints')
      .delete()
      .eq('id', id);
    return !error;
  },
};


