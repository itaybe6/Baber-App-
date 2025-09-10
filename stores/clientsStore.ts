import { create } from 'zustand';
import { Client } from '@/lib/supabase';
import { clientsApi } from '@/lib/api/clients';

interface ClientsState {
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchClients: () => Promise<void>;
  getClientById: (id: string) => Client | undefined;
  searchClients: (query: string) => Promise<Client[]>;
  createClient: (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<Client | null>;
  updateClient: (id: string, clientData: Partial<Client>) => Promise<Client | null>;
}

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  isLoading: false,
  error: null,

  fetchClients: async () => {
    set({ isLoading: true, error: null });
    try {
      const clients = await clientsApi.getAllClients();
      set({ clients, isLoading: false });
    } catch (error) {
      set({ error: 'שגיאה בטעינת הלקוחות', isLoading: false });
      console.error('Error fetching clients:', error);
    }
  },

  getClientById: (id: string) => {
    const { clients } = get();
    return clients.find(client => client.id === id);
  },

  searchClients: async (query: string) => {
    try {
      return await clientsApi.searchClients(query);
    } catch (error) {
      console.error('Error searching clients:', error);
      return [];
    }
  },

  createClient: async (clientData) => {
    set({ isLoading: true, error: null });
    try {
      const newClient = await clientsApi.createClient(clientData);
      if (newClient) {
        const { clients } = get();
        set({ clients: [...clients, newClient], isLoading: false });
      }
      return newClient;
    } catch (error) {
      set({ error: 'שגיאה ביצירת הלקוח', isLoading: false });
      console.error('Error creating client:', error);
      return null;
    }
  },

  updateClient: async (id: string, clientData) => {
    set({ isLoading: true, error: null });
    try {
      const updatedClient = await clientsApi.updateClient(id, clientData);
      if (updatedClient) {
        const { clients } = get();
        const updatedClients = clients.map(client => 
          client.id === id ? updatedClient : client
        );
        set({ clients: updatedClients, isLoading: false });
      }
      return updatedClient;
    } catch (error) {
      set({ error: 'שגיאה בעדכון הלקוח', isLoading: false });
      console.error('Error updating client:', error);
      return null;
    }
  }
}));