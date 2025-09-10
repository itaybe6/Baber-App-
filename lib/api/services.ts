import { supabase, Service } from '../supabase';

export const servicesApi = {
  // Get all services
  async getAllServices(): Promise<Service[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching services:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    }
  },

  // Get services by category
  async getServicesByCategory(category: string): Promise<Service[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching services:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    }
  },

  // Get service by ID
  async getServiceById(id: string): Promise<Service | null> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching service:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching service:', error);
      return null;
    }
  }
};

// service categories removed; using static constants

// Update service details
export async function updateService(
  id: string,
  updates: Partial<Omit<Service, 'id' | 'created_at' | 'updated_at'>>
): Promise<Service | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating service:', error);
      return null;
    }

    return data as Service;
  } catch (error) {
    console.error('Error updating service:', error);
    return null;
  }
}

// Create a new service
export async function createService(
  payload: Partial<Omit<Service, 'id' | 'created_at' | 'updated_at'>>
): Promise<Service | null> {
  try {
    const defaults: Partial<Service> = {
      name: 'שירות חדש',
      price: 0,
      // avoid FK violation by not setting category unless provided
      is_active: true,
    };

    const insertPayload = { ...defaults, ...payload } as any;

    const { data, error } = await supabase
      .from('services')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating service:', error);
      return null;
    }

    return data as Service;
  } catch (error) {
    console.error('Error creating service:', error);
    return null;
  }
}

// Delete a service
export async function deleteService(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting service:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting service:', error);
    return false;
  }
}