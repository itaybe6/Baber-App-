import React from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Animated, Easing, Alert, Text as RNText } from 'react-native';
import Colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import LoginRequiredModal from '@/components/LoginRequiredModal';

// Custom floating button component
const FloatingBookButton = ({ onPress, focused }: { onPress: () => void; focused: boolean }) => {
  // Distinct animation: wobble (rotate) + bob (translateY) + brief pop (scale) with pauses
  const wobble = React.useRef(new Animated.Value(0)).current; // -1 .. 1
  const bob = React.useRef(new Animated.Value(0)).current;    // -1 .. 1
  const pop = React.useRef(new Animated.Value(0)).current;    // 0 .. 1

  React.useEffect(() => {
    const sequence = Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        // wobble
        Animated.sequence([
          Animated.timing(wobble, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(wobble, { toValue: -1, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(wobble, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        // bob
        Animated.sequence([
          Animated.timing(bob, { toValue: -1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        // pop
        Animated.sequence([
          Animated.timing(pop, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(pop, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(1100),
    ]);
    const loop = Animated.loop(sequence);
    loop.start();
    return () => {
      loop.stop();
    };
  }, [wobble, bob, pop]);

  const motionStyle = {
    transform: [
      { translateY: bob.interpolate({ inputRange: [-1, 0, 1], outputRange: [-4, 0, -2] }) },
      { rotate: wobble.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-14deg', '0deg', '14deg'] }) },
      { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
    ],
  } as const;

  return (
    <TouchableOpacity 
      style={styles.floatingButton} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={motionStyle}>
        <LinearGradient
          colors={['#7B61FF', '#7B61FF']}
          style={styles.floatingGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={[styles.floatingIcon, focused && styles.floatingIconFocused]}>
            <Ionicons 
              name="add" 
              size={28} 
              color="#FFFFFF" 
              style={{ 
                transform: [{ scale: focused ? 1.1 : 1 }],
                fontWeight: '700'
              }} 
            />
          </View>
        </LinearGradient>
      </Animated.View>
      {/* Floating shadow effect */}
      <View style={styles.floatingShadow} />
    </TouchableOpacity>
  );
};

export default function ClientTabsLayout() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBlocked = Boolean((user as any)?.block);
  
  const [loginModal, setLoginModal] = React.useState<{ visible: boolean; title?: string; message?: string }>({ visible: false });
  
  // RTL debug removed; rely on explicit layout directions



  return (
    <>
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
            case 'gallery':
              iconName = focused ? 'images' : 'images-outline';
              break;
            case 'appointments':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'book-appointment':
              return (
                <FloatingBookButton 
                  onPress={() => {
                    if (!isAuthenticated) {
                      setLoginModal({
                        visible: true,
                        title: 'נדרש להתחבר',
                        message: 'כדי לקבוע תור יש להתחבר לחשבון שלך',
                      });
                      return;
                    }
                    if (isBlocked) {
                      // Keep Alert for blocked users as it's a different use case
                      Alert.alert('חשבון חסום', 'החשבון שלך חסום ואין אפשרות לקבוע תור.');
                      return;
                    }
                    router.push('/(client-tabs)/book-appointment');
                  }}
                  focused={focused}
                />
              );
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
        tabBarButton: (props: any) => {
          // Intercept presses for specific routes to enforce auth
          const originalOnPress = props.onPress;
          return (
            <TouchableOpacity
              {...(props as any)}
              onPress={() => {
                const name = (props as any).accessibilityState?.label || (props as any).toString?.() || '';
                // Fallback using route key from props if available
                const target = (props as any).accessibilityLabel || '';
                // We cannot reliably detect here; rely on options below per screen where possible
                originalOnPress?.({} as any);
              }}
            />
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
        tabBarItemStyle: route.name === 'book-appointment' ? styles.centerTabItem : styles.regularTabItem,
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: route.name === 'book-appointment' ? '' : getTabLabel(route.name),
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
        name="gallery" 
        options={{
          title: 'גלריה',
        }}
      />
      <Tabs.Screen 
        name="book-appointment" 
        options={{
          title: 'קביעת תור',
          tabBarButton: (props: any) => (
            <TouchableOpacity
              {...props}
              onPress={() => {
                if (!isAuthenticated) {
                  setLoginModal({
                    visible: true,
                    title: 'נדרש להתחבר',
                    message: 'כדי לקבוע תור יש להתחבר לחשבון שלך',
                  });
                  return;
                }
                if (isBlocked) {
                  Alert.alert('חשבון חסום', 'החשבון שלך חסום ואין אפשרות לקבוע תור.');
                  return;
                }
                router.push('/(client-tabs)/book-appointment');
              }}
              style={styles.centerTabItem}
            >
              <FloatingBookButton 
                onPress={() => {
                  if (!isAuthenticated) {
                    setLoginModal({
                      visible: true,
                      title: 'נדרש להתחבר',
                      message: 'כדי לקבוע תור יש להתחבר לחשבון שלך',
                    });
                    return;
                  }
                  if (isBlocked) {
                    Alert.alert('חשבון חסום', 'החשבון שלך חסום ואין אפשרות לקבוע תור.');
                    return;
                  }
                  router.push('/(client-tabs)/book-appointment');
                }}
                focused={false}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen 
        name="appointments" 
        options={{
          title: 'התורים שלי',
          tabBarButton: (props: any) => {
            const isFocused = props?.accessibilityState?.selected;
            const color = isFocused ? '#2C2C2E' : '#3A3A3C';
            return (
              <TouchableOpacity
                {...props}
              onPress={() => {
                if (!isAuthenticated) {
                  setLoginModal({
                    visible: true,
                    title: 'נדרש להתחבר',
                    message: 'כדי לצפות בתורים שלך יש להתחבר לחשבון שלך',
                  });
                  return;
                }
                router.push('/(client-tabs)/appointments');
              }}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name={'calendar-outline' as any} size={24} color={color} />
                </View>
                <RNText style={[styles.manualTabLabel, { color }]}>{getTabLabel('appointments')}</RNText>
              </TouchableOpacity>
            );
          },
        }}
      />
      <Tabs.Screen 
        name="profile" 
        options={{
          title: 'פרופיל',
          tabBarButton: (props: any) => {
            const isFocused = props?.accessibilityState?.selected;
            const color = isFocused ? '#2C2C2E' : '#3A3A3C';
            return (
              <TouchableOpacity
                {...props}
              onPress={() => {
                if (!isAuthenticated) {
                  setLoginModal({
                    visible: true,
                    title: 'נדרש להתחבר',
                    message: 'כדי לגשת לפרופיל יש להתחבר לחשבון שלך',
                  });
                  return;
                }
                router.push('/(client-tabs)/profile');
              }}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name={'person-outline' as any} size={24} color={color} />
                </View>
                <RNText style={[styles.manualTabLabel, { color }]}>{getTabLabel('profile')}</RNText>
              </TouchableOpacity>
            );
          },
        }}
      />
      <Tabs.Screen 
        name="waitlist" 
        options={{
          title: 'Waitlist',
          href: null
        }}
      />

<Tabs.Screen 
        name="notifications" 
        options={{
          title: 'notifications',
          href: null
        }}
      />
      <Tabs.Screen 
        name="select-time" 
        options={{
          href: null
        }}
      />
    </Tabs>
    
    {/* Login required modal */}
    <LoginRequiredModal
      visible={loginModal.visible}
      title={loginModal.title}
      message={loginModal.message}
      onClose={() => setLoginModal({ visible: false })}
      onLogin={() => {
        setLoginModal({ visible: false });
        router.push('/login');
      }}
    />
    </>
  );
}

// Helper function to get tab labels
function getTabLabel(routeName: string): string {
  switch (routeName) {
    case 'index':
      return 'דף בית';
    case 'gallery':
      return 'גלריה';
    case 'appointments':
      return 'התורים שלי';
    case 'profile':
      return 'פרופיל';
    case 'book-appointment':
      return 'קביעת תור';
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

  // (removed) previous pulse styles
  
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
  
  // Manual label style for custom tab buttons (matches tabBarLabelStyle)
  manualTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: -0.1,
  },
});
