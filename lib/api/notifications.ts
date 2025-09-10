import { supabase } from '@/lib/supabase';
import { Notification } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationsApi = {
  // Push sending moved to server (Supabase Edge Function)
  // Get user's notifications
  async getUserNotifications(userPhone: string): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_phone', userPhone)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user notifications:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserNotifications:', error);
      throw error;
    }
  },

  // Create a new notification
  async createNotification(notificationData: Omit<Notification, 'id' | 'created_at' | 'is_read'>): Promise<Notification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createNotification:', error);
      return null;
    }
  },

  // Create a notification to all admins (studio managers)
  async createAdminNotification(title: string, content: string, type: Notification['type'] = 'system'): Promise<boolean> {
    try {
      const { data: admins, error: adminsError } = await supabase
        .from('users')
        .select('name, phone')
        .eq('user_type', 'admin')
        .not('phone', 'is', null)
        .neq('phone', '');

      if (adminsError) {
        console.error('Error fetching admins for notification:', adminsError);
        return false;
      }

      if (!admins || admins.length === 0) {
        return false;
      }

      const notifications = admins.map((admin) => ({
        title,
        content,
        type,
        recipient_name: admin.name || 'מנהל',
        recipient_phone: (admin.phone || '').trim(),
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting admin notifications:', insertError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createAdminNotification:', error);
      return false;
    }
  },

  // Send notification to all clients
  async sendNotificationToAllClients(title: string, content: string, type: Notification['type'] = 'general'): Promise<boolean> {
    try {
      // Get all clients with valid phone numbers
      const { data: clients, error: clientsError } = await supabase
        .from('users')
        .select('name, phone')
        .eq('user_type', 'client')
        .not('phone', 'is', null)
        .neq('phone', '');

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return false;
      }

      if (!clients || clients.length === 0) {
        return false;
      }

      // Filter out clients with null or empty phone numbers
      const validClients = clients.filter(client => 
        client.phone && 
        client.phone.trim() !== '' && 
        client.phone !== null
      );

      if (validClients.length === 0) {
        return false;
      }

      // Create notifications for all clients with valid phone numbers
      const notifications = validClients.map(client => ({
        title,
        content,
        type,
        recipient_name: client.name || 'לקוח',
        recipient_phone: client.phone.trim(),
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in sendNotificationToAllClients:', error);
      return false;
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAsRead:', error);
      return false;
    }
  },

  // Mark all notifications as read for a specific user
  async markAllAsReadForUser(userPhone: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('recipient_phone', userPhone)
        .eq('is_read', false)
        .select('id');

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return 0;
      }

      return (data?.length as number) || 0;
    } catch (error) {
      console.error('Error in markAllAsReadForUser:', error);
      return 0;
    }
  },

  // Get unread notifications count
  async getUnreadCount(userPhone: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_phone', userPhone)
        .eq('is_read', false);

      if (error) {
        console.error('Error getting unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  },

  // Register push token for user (disabled for now)
  async registerPushToken(userPhone: string, pushToken: string): Promise<boolean> {
    try {
      if (!userPhone || !pushToken) return false;
      const { error } = await supabase
        .from('users')
        .update({ push_token: pushToken })
        .eq('phone', userPhone);
      if (error) {
        console.error('Error saving push token:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in registerPushToken:', error);
      return false;
    }
  },

  // Clear push token for user (disable push notifications server-side)
  async clearPushToken(userPhone: string): Promise<boolean> {
    try {
      if (!userPhone) return false;
      const { error } = await supabase
        .from('users')
        .update({ push_token: null })
        .eq('phone', userPhone);
      if (error) {
        console.error('Error clearing push token:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in clearPushToken:', error);
      return false;
    }
  },

  // Request notification permissions and get token
  async requestNotificationPermissions(): Promise<string | null> {
    try {
      // Skip remote push token requests in Expo Go on Android (SDK 53+)
      if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
        console.warn('Skipping push token request in Expo Go. Use a development build to enable push notifications.');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return null;
      }

      // Try to resolve projectId from env or app.json extra.eas.projectId
      const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID || process.env.EAS_PROJECT_ID;
      const configProjectId = (Constants?.expoConfig as any)?.extra?.eas?.projectId;
      const projectId = envProjectId || configProjectId || undefined;

      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined as any
      );

      return token.data;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return null;
    }
  },

  // Get all notifications (for debugging)
  async getAllNotifications(): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all notifications:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllNotifications:', error);
      throw error;
    }
  },
}; 