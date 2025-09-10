import { supabase, Client } from '../supabase';

export const clientsApi = {
  // Get all clients
  async getAllClients(): Promise<Client[]> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching clients:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching clients:', error);
      return [];
    }
  },

  // Get client by ID
  async getClientById(id: string): Promise<Client | null> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching client:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching client:', error);
      return null;
    }
  },

  // Create new client
  async createClient(clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client | null> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();

      if (error) {
        console.error('Error creating client:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating client:', error);
      return null;
    }
  },

  // Update client
  async updateClient(id: string, clientData: Partial<Client>): Promise<Client | null> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({ ...clientData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating client:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating client:', error);
      return null;
    }
  },

  // Search clients
  async searchClients(query: string): Promise<Client[]> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .order('name');

      if (error) {
        console.error('Error searching clients:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error searching clients:', error);
      return [];
    }
  }
};