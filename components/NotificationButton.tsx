import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { notificationsApi } from '@/lib/api/notifications';

interface NotificationButtonProps {
  style?: any;
  size?: number;
  color?: string;
  showBadge?: boolean;
}

export default function NotificationButton({ 
  style, 
  size = 24, 
  color = "#1C1C1E",
  showBadge = true 
}: NotificationButtonProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [unreadCount, setUnreadCount] = React.useState(0);

  const fetchUnreadCount = React.useCallback(async () => {
    if (!user?.phone) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await notificationsApi.getUnreadCount(user.phone);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
      setUnreadCount(0);
    }
  }, [user?.phone]);

  React.useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  return (
    <TouchableOpacity 
      style={[styles.notificationButton, style]}
      onPress={() => {
        // Optimistically clear the badge and mark all as read
        if (user?.phone) {
          setUnreadCount(0);
          notificationsApi.markAllAsReadForUser(user.phone).catch(() => {});
        }
        router.push('/(client-tabs)/notifications');
      }}
      activeOpacity={0.8}
    >
      <Ionicons name="notifications-outline" size={size} color={color} />
      {showBadge && unreadCount > 0 && (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 