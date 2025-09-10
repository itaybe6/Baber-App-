import { create } from 'zustand';
import { Notification } from '@/lib/supabase';
import { notificationsApi } from '@/lib/api/notifications';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchNotifications: (userPhone: string) => Promise<void>;
  fetchUnreadCount: (userPhone: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  clearNotifications: () => void;
  addNotification: (notification: Notification) => void;
  updateNotification: (notificationId: string, updates: Partial<Notification>) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async (userPhone: string) => {
    set({ isLoading: true, error: null });
    try {
      const notifications = await notificationsApi.getUserNotifications(userPhone);
      set({ notifications, isLoading: false });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      set({ 
        error: 'אירעה שגיאה בטעינת ההתראות', 
        isLoading: false 
      });
    }
  },

  fetchUnreadCount: async (userPhone: string) => {
    try {
      const count = await notificationsApi.getUnreadCount(userPhone);
      set({ unreadCount: count });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      set({ unreadCount: 0 });
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      
      // Update local state
      set(state => ({
        notifications: state.notifications.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0, error: null });
  },

  addNotification: (notification: Notification) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.is_read ? state.unreadCount : state.unreadCount + 1
    }));
  },

  updateNotification: (notificationId: string, updates: Partial<Notification>) => {
    set(state => ({
      notifications: state.notifications.map(n => 
        n.id === notificationId ? { ...n, ...updates } : n
      )
    }));
  },
})); 