import { create } from 'zustand';
import { Design } from '@/lib/supabase';
import { designsApi } from '@/lib/api/designs';

interface DesignsState {
  designs: Design[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchDesigns: () => Promise<void>;
  getDesignsByCategory: (category: string) => Design[];
  getFeaturedDesigns: () => Design[];
  searchDesigns: (query: string) => Promise<Design[]>;
  getDesignById: (id: string) => Design | undefined;
  createDesign: (payload: {
    name: string;
    image_url: string;
    image_urls?: string[];
    categories?: string[];
    popularity?: number;
    description?: string;
    price_modifier?: number;
    is_featured?: boolean;
  }) => Promise<Design | null>;
  updateDesign: (id: string, updates: {
    name?: string;
    image_url?: string;
    image_urls?: string[];
    categories?: string[];
    popularity?: number;
    description?: string;
    price_modifier?: number;
    is_featured?: boolean;
  }) => Promise<Design | null>;
  deleteDesign: (id: string) => Promise<boolean>;
}

export const useDesignsStore = create<DesignsState>((set, get) => ({
  designs: [],
  isLoading: false,
  error: null,

  fetchDesigns: async () => {
    set({ isLoading: true, error: null });
    try {
      const designs = await designsApi.getAllDesigns();
      set({ designs, isLoading: false });
    } catch (error) {
      set({ error: 'שגיאה בטעינת העיצובים', isLoading: false });
      console.error('Error fetching designs:', error);
    }
  },

  getDesignsByCategory: (category: string) => {
    const { designs } = get();
    return designs.filter(design => design.categories.includes(category));
  },

  getFeaturedDesigns: () => {
    const { designs } = get();
    return designs.filter(design => design.is_featured);
  },

  searchDesigns: async (query: string) => {
    try {
      return await designsApi.searchDesigns(query);
    } catch (error) {
      console.error('Error searching designs:', error);
      return [];
    }
  },

  getDesignById: (id: string) => {
    const { designs } = get();
    return designs.find(design => design.id === id);
  },

  createDesign: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const created = await designsApi.createDesign(payload);
      if (created) {
        set((state) => ({ designs: [created, ...state.designs], isLoading: false }));
      } else {
        set({ isLoading: false });
      }
      return created;
    } catch (error) {
      set({ error: 'שגיאה ביצירת העיצוב', isLoading: false });
      console.error('Error creating design:', error);
      return null;
    }
  },

  updateDesign: async (id: string, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await designsApi.updateDesign(id, updates);
      if (updated) {
        set((state) => ({ 
          designs: state.designs.map(d => d.id === id ? updated : d), 
          isLoading: false 
        }));
      } else {
        set({ isLoading: false });
      }
      return updated;
    } catch (error) {
      set({ error: 'שגיאה בעדכון העיצוב', isLoading: false });
      console.error('Error updating design:', error);
      return null;
    }
  },

  deleteDesign: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const ok = await designsApi.deleteDesign(id);
      if (ok) {
        set((state) => ({ designs: state.designs.filter(d => d.id !== id), isLoading: false }));
      } else {
        set({ isLoading: false });
      }
      return ok;
    } catch (error) {
      set({ error: 'שגיאה במחיקת העיצוב', isLoading: false });
      console.error('Error deleting design:', error);
      return false;
    }
  }
}));