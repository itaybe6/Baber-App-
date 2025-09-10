import { supabase } from '@/lib/supabase';
import type { BusinessProfile } from '@/lib/supabase';

export const businessProfileApi = {
  async getProfile(): Promise<BusinessProfile | null> {
    try {
      const { data, error } = await supabase
        .from('business_profile')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching business profile:', error);
        return null;
      }

      return (data as BusinessProfile) || null;
    } catch (err) {
      console.error('Error in getProfile:', err);
      return null;
    }
  },

  async upsertProfile(updates: Partial<BusinessProfile>): Promise<BusinessProfile | null> {
    try {
      const existing = await this.getProfile();
      if (existing?.id) {
        const { data, error } = await supabase
          .from('business_profile')
          .update({
            display_name: updates.display_name,
            description: (updates as any).description,
            address: updates.address,
            instagram_url: updates.instagram_url,
            facebook_url: updates.facebook_url,
            tiktok_url: (updates as any).tiktok_url,
            break: (updates as any).break,
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (error) {
          console.error('Error updating business profile:', error);
          return null;
        }
        return data as BusinessProfile;
      }

      const { data, error } = await supabase
        .from('business_profile')
        .insert({
          display_name: updates.display_name,
          description: (updates as any).description,
          address: updates.address,
          instagram_url: updates.instagram_url,
          facebook_url: updates.facebook_url,
          tiktok_url: (updates as any).tiktok_url,
          break: (updates as any).break,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating business profile:', error);
        return null;
      }
      return data as BusinessProfile;
    } catch (err) {
      console.error('Error in upsertProfile:', err);
      return null;
    }
  },
};



