import React from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

// Custom floating button component
const FloatingCalendarButton = ({ onPress, focused }: { onPress: () => void; focused: boolean }) => (
  <TouchableOpacity 
    style={styles.floatingButton} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <LinearGradient
      colors={['#7B61FF', '#7B61FF']}
      style={styles.floatingGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      <View style={[styles.floatingIcon, focused && styles.floatingIconFocused]}>
        <Ionicons 
          name="calendar" 
          size={28} 
          color="#FFFFFF" 
          style={{ 
            transform: [{ scale: focused ? 1.1 : 1 }],
            fontWeight: '700'
          }} 
        />
      </View>
    </LinearGradient>
    {/* Floating shadow effect */}
    <View style={styles.floatingShadow} />
  </TouchableOpacity>
);

export default function TabsLayout() {
  const router = useRouter();
  
  // RTL debug removed; rely on explicit layout directions



  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, size, focused }) => {
          const iconSize = focused ? 26 : 24;
          const iconColor = focused ? '#2C2C2E' : '#3A3A3C';
          
          let iconName;
          switch (route.name) {
            case 'index':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'waitlist':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            case 'business-hours':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'appointments':
              return null;
            default:
              return null;
          }
          return (
            <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
              <Ionicons 
                name={iconName as any} 
                size={iconSize} 
                color={iconColor}
                style={{ fontWeight: focused ? '700' : '400' }}
              />
            </View>
          );
        },
        tabBarActiveTintColor: '#2C2C2E',
        tabBarInactiveTintColor: '#3A3A3C',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          textAlign: 'center',
          marginTop: 4,
          letterSpacing: -0.1,
        },
        tabBarItemStyle: route.name === 'appointments' ? styles.centerTabItem : styles.regularTabItem,
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: route.name === 'appointments' ? '' : getTabLabel(route.name),
        tabBarContentContainerStyle: {
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: 'row'
        },
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderTopWidth: 0,
          height: 88,
          paddingTop: 8,
          paddingBottom: 20,
          paddingHorizontal: 0,
          position: 'absolute',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.08,
          shadowRadius: 24,
          elevation: 20,
          flexDirection: 'row'
        },
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            <View style={styles.tabBarBlur} />
          </View>
        ),
        headerShown: false,
      })}
    >
      <Tabs.Screen 
        name="index" 
        options={{
          title: 'דף בית',
        }}
      />
      <Tabs.Screen 
        name="waitlist" 
        options={{
          title: 'ממתינים',
        }}
      />
      <Tabs.Screen 
        name="appointments" 
        options={{
          title: 'יומן',
          tabBarButton: () => (
            <TouchableOpacity style={styles.centerTabItem}>
              <FloatingCalendarButton 
                onPress={() => router.push('/(tabs)/appointments')}
                focused={false}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen 
        name="business-hours" 
        options={{
          title: 'שעות',
        }}
      />
      <Tabs.Screen 
        name="settings" 
        options={{
          title: 'הגדרות',
        }}
      />
      <Tabs.Screen 
        name="gallery" 
        options={{
          title: 'גלריה',
          href: null
        }}
      />
      
      <Tabs.Screen 
        name="client-notifications" 
        options={{
          title: 'התראות',
          href: null
        }}
      />
           <Tabs.Screen 
        name="notifications" 
        options={{
          title: 'התראות',
          href: null
        }}
      />
      <Tabs.Screen 
        name="edit-gallery" 
        options={{
          title: 'עריכת גלריה',
          href: null
        }}
      />
    </Tabs>
  );
}

// Helper function to get tab labels
function getTabLabel(routeName: string): string {
  switch (routeName) {
    case 'index':
      return 'דף בית';
    case 'waitlist':
      return 'ממתינים';
    case 'appointments':
      return 'יומן';
    case 'settings':
      return 'הגדרות';
    case 'business-hours':
      return 'שעות';
    default:
      return routeName;
  }
}

const styles = StyleSheet.create({
  // Regular tab items
  regularTabItem: {
    marginTop: 0,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    maxWidth: '20%',
  },
  
  // Center tab item (floating button)
  centerTabItem: {
    marginTop: -10,
    marginBottom: 8,
    flex: 0,
    width: 72,
    alignItems: 'center',
    marginHorizontal: 8,
    zIndex: 1000,
  },
  
  // Icon containers with subtle effects
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  
  iconContainerFocused: {
    backgroundColor: 'transparent',
    transform: [{ scale: 1.1 }],
  },
  
  // Floating button styles
  floatingButton: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    marginBottom: 8,
    zIndex: 1000,
  },
  
  floatingGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F472B6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  
  floatingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  
  floatingIconFocused: {
    transform: [{ scale: 1.05 }],
  },
  
  floatingShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 26,
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
    shadowColor: '#F472B6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    zIndex: -1,
  },
  
  // Tab bar background with blur effect
  tabBarBackground: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 20,
  },
  
  tabBarBlur: {
    flex: 1,
    backgroundColor: 'rgba(248, 248, 248, 0.8)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backdropFilter: 'blur(20px)',
  },
});