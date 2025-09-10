import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { ChevronRight } from 'lucide-react-native';
import NotificationButton from './NotificationButton';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showNotifications?: boolean;
  onNotificationsPress?: () => void;
  rightComponent?: React.ReactNode;
  transparent?: boolean;
}

export default function Header({
  title,
  showBack = false,
  showNotifications = false,
  onNotificationsPress,
  rightComponent,
  transparent = false,
}: HeaderProps) {
  const router = useRouter();
  
  return (
    <View style={[
      styles.container,
      transparent && styles.transparentContainer
    ]}>
      <View style={styles.leftContainer}>
        {showBack && (
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ChevronRight size={24} color={transparent ? Colors.white : Colors.text} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.titleContainer}>
        <Text style={[
          styles.title,
          transparent && styles.transparentTitle
        ]}>
          {title}
        </Text>
      </View>
      <View style={styles.rightContainer}>
        {rightComponent}
        {showNotifications && (
          <NotificationButton 
            color={transparent ? Colors.white : Colors.text}
            style={styles.notificationButton}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  transparentContainer: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rightContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  transparentTitle: {
    color: Colors.white,
  },
  backButton: {
    padding: 4,
  },
  notificationButton: {
    padding: 4,
  },
});