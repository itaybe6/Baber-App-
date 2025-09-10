import { create } from 'zustand';
import { Service } from '@/lib/supabase';
import { servicesApi } from '@/lib/api/services';

interface ServicesState {
  services: Service[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchServices: () => Promise<void>;
  getServiceById: (id: string) => Service | undefined;
}

export const useServicesStore = create<ServicesState>((set, get) => ({
  services: [],
  isLoading: false,
  error: null,

  fetchServices: async () => {
    set({ isLoading: true, error: null });
    try {
      const services = await servicesApi.getAllServices();
      set({ services, isLoading: false });
    } catch (error) {
      set({ error: 'שגיאה בטעינת השירותים', isLoading: false });
      console.error('Error fetching services:', error);
    }
  },

  getServiceById: (id: string) => {
    const { services } = get();
    return services.find(service => service.id === id);
  }
}));