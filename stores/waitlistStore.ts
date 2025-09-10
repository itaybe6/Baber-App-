import { create } from 'zustand';
import { WaitlistEntry, supabase } from '@/lib/supabase';
import { notificationsApi } from '@/lib/api/notifications';

interface WaitlistStore {
  // State
  clientWaitlistEntries: WaitlistEntry[];
  isLoading: boolean;
  error: string | null;

  // Actions
  addToWaitlist: (
    clientName: string,
    clientPhone: string,
    serviceName: string,
    requestedDate: string,
    timePeriod: 'morning' | 'afternoon' | 'evening' | 'any'
  ) => Promise<boolean>;
  
  getClientWaitlistEntries: (clientPhone: string) => Promise<void>;
  removeFromWaitlist: (entryId: string) => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}

export const useWaitlistStore = create<WaitlistStore>((set, get) => ({
  // Initial state
  clientWaitlistEntries: [],
  isLoading: false,
  error: null,

  // Add client to waitlist
  addToWaitlist: async (
    clientName: string,
    clientPhone: string,
    serviceName: string,
    requestedDate: string,
    timePeriod: 'morning' | 'afternoon' | 'evening' | 'any'
  ) => {
    set({ isLoading: true, error: null });
    
    try {
      // Check if client is already on waitlist for this date
      const { data: existingEntry } = await supabase
        .from('waitlist_entries')
        .select('*')
        .eq('client_phone', clientPhone)
        .eq('requested_date', requestedDate)
        .eq('status', 'waiting')
        .single();

      if (existingEntry) {
        set({ error: 'את כבר ברשימת המתנה לתאריך זה', isLoading: false });
        return false;
      }

      const { data, error } = await supabase
        .from('waitlist_entries')
        .insert({
          client_name: clientName,
          client_phone: clientPhone,
          service_name: serviceName,
          requested_date: requestedDate,
          time_period: timePeriod,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding to waitlist:', error);
        set({ error: 'אירעה שגיאה בהוספה לרשימת המתנה', isLoading: false });
        return false;
      }

      if (data) {
        // Add to local state
        set(state => ({
          clientWaitlistEntries: [...state.clientWaitlistEntries, data],
          isLoading: false,
        }));
        try {
          const periodLabel: Record<'morning' | 'afternoon' | 'evening' | 'any', string> = {
            morning: 'בוקר',
            afternoon: 'צהריים',
            evening: 'ערב',
            any: 'כל שעה',
          };
          const title = 'לקוח חדש הצטרף לרשימת המתנה';
          const content = `${clientName} (${clientPhone}) הצטרף/ה לרשימת המתנה לשירות "${serviceName}" בתאריך ${requestedDate} לטווח ${periodLabel[timePeriod]}.`;
          notificationsApi.createAdminNotification(title, content, 'system').catch(() => {});
        } catch {}
        return true;
      }
      
      set({ isLoading: false });
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'אירעה שגיאה בהוספה לרשימת המתנה';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  // Get client's waitlist entries
  getClientWaitlistEntries: async (clientPhone: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('*')
        .eq('client_phone', clientPhone)
        .order('requested_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching client waitlist entries:', error);
        set({ error: 'אירעה שגיאה בטעינת רשימת המתנה', isLoading: false });
        return;
      }

      set({ clientWaitlistEntries: data || [], isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'אירעה שגיאה בטעינת רשימת המתנה';
      set({ error: errorMessage, isLoading: false });
    }
  },

  // Remove from waitlist
  removeFromWaitlist: async (entryId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('waitlist_entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        console.error('Error removing from waitlist:', error);
        set({ error: 'אירעה שגיאה בהסרה מרשימת המתנה', isLoading: false });
        return false;
      }

      // Remove from local state
      set(state => ({
        clientWaitlistEntries: state.clientWaitlistEntries.filter(entry => entry.id !== entryId),
        isLoading: false,
      }));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'אירעה שגיאה בהסרה מרשימת המתנה';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Reset store
  reset: () => {
    set({
      clientWaitlistEntries: [],
      isLoading: false,
      error: null,
    });
  },
})); 