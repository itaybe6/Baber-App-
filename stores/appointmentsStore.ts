import { create } from 'zustand';
import { Appointment } from '@/lib/supabase';

interface AppointmentsState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchAppointments: () => Promise<void>;
  fetchUpcomingAppointments: () => Promise<void>;
  fetchPastAppointments: () => Promise<void>;
  getAppointmentsByServiceName: (serviceName: string) => Appointment[];
  createAppointment: (appointmentData: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => Promise<Appointment | null>;
  updateAppointment: (id: string, appointmentData: Partial<Appointment>) => Promise<Appointment | null>;
  cancelAppointment: (id: string) => Promise<Appointment | null>;
  confirmAppointment: (id: string) => Promise<Appointment | null>;
  completeAppointment: (id: string) => Promise<Appointment | null>;
  deleteAppointment: (id: string) => Promise<boolean>;
}

export const useAppointmentsStore = create<AppointmentsState>((set, get) => ({
  appointments: [],
  isLoading: false,
  error: null,

  fetchAppointments: async () => {
    set({ isLoading: true, error: null });
    try {
      // Logic to fetch appointments from available_time_slots or other source
      set({ appointments: [], isLoading: false });
    } catch (error) {
      set({ error: 'שגיאה בטעינת התורים', isLoading: false });
      console.error('Error fetching appointments:', error);
    }
  },

  fetchUpcomingAppointments: async () => {
    set({ isLoading: true, error: null });
    try {
      // Logic to fetch upcoming appointments from available_time_slots or other source
      set({ appointments: [], isLoading: false });
    } catch (error) {
      set({ error: 'שגיאה בטעינת התורים הקרובים', isLoading: false });
      console.error('Error fetching upcoming appointments:', error);
    }
  },

  fetchPastAppointments: async () => {
    set({ isLoading: true, error: null });
    try {
      // Logic to fetch past appointments from available_time_slots or other source
      set({ appointments: [], isLoading: false });
    } catch (error) {
      set({ error: 'שגיאה בטעינת היסטוריית התורים', isLoading: false });
      console.error('Error fetching past appointments:', error);
    }
  },

  getAppointmentsByServiceName: (serviceName: string) => {
    const { appointments } = get();
    return appointments.filter(appointment => appointment.service_name === serviceName);
  },

  createAppointment: async (appointmentData) => {
    set({ isLoading: true, error: null });
    try {
      // Logic to create appointment in available_time_slots or other source
      const newAppointment = null; // Replace with actual logic
      if (newAppointment) {
        const { appointments } = get();
        set({ appointments: [...appointments, newAppointment], isLoading: false });
      }
      return newAppointment;
    } catch (error) {
      set({ error: 'שגיאה ביצירת התור', isLoading: false });
      console.error('Error creating appointment:', error);
      return null;
    }
  },

  updateAppointment: async (id: string, appointmentData) => {
    set({ isLoading: true, error: null });
    try {
      // Logic to update appointment in available_time_slots or other source
      const updatedAppointment = null; // Replace with actual logic
      if (updatedAppointment) {
        const { appointments } = get();
        const updatedAppointments = appointments.map(appointment => 
          appointment.id === id ? updatedAppointment : appointment
        );
        set({ appointments: updatedAppointments, isLoading: false });
      }
      return updatedAppointment;
    } catch (error) {
      set({ error: 'שגיאה בעדכון התור', isLoading: false });
      console.error('Error updating appointment:', error);
      return null;
    }
  },

  cancelAppointment: async (id: string) => {
    return get().updateAppointment(id, { status: 'cancelled' });
  },

  confirmAppointment: async (id: string) => {
    return get().updateAppointment(id, { status: 'confirmed' });
  },

  completeAppointment: async (id: string) => {
    return get().updateAppointment(id, { status: 'completed' });
  },

  deleteAppointment: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // Logic to delete appointment from available_time_slots or other source
      const success = false; // Replace with actual logic
      if (success) {
        const { appointments } = get();
        const filteredAppointments = appointments.filter(appointment => appointment.id !== id);
        set({ appointments: filteredAppointments, isLoading: false });
      }
      return success;
    } catch (error) {
      set({ error: 'שגיאה במחיקת התור', isLoading: false });
      console.error('Error deleting appointment:', error);
      return false;
    }
  }
}));