import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Linking, Alert, Animated, Easing, InteractionManager, AppState, Dimensions, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MovingBorderCard from '@/components/MovingBorderCard';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import LoginRequiredModal from '@/components/LoginRequiredModal';
import { AvailableTimeSlot } from '@/lib/supabase';
import { notificationsApi } from '@/lib/api/notifications';
import { businessProfileApi } from '@/lib/api/businessProfile';
import type { BusinessProfile } from '@/lib/supabase';
import DesignCarousel from '@/components/DesignCarousel';
import { useDesignsStore } from '@/stores/designsStore';


// API functions for client home
const clientHomeApi = {
  // Get user appointments for multiple dates (most efficient for user appointments)
  async getUserAppointmentsForMultipleDates(dates: string[], userName?: string, userPhone?: string): Promise<AvailableTimeSlot[]> {
    try {
      let query = supabase
        .from('appointments')
        .select('*')
        .in('slot_date', dates)
        .eq('is_available', false) // Only booked appointments
        .order('slot_date')
        .order('slot_time');

      // Filter by user if provided
      if (userName || userPhone) {
        const conditions = [];
        if (userName) {
          conditions.push(`client_name.ilike.%${userName.trim()}%`);
        }
        if (userPhone) {
          conditions.push(`client_phone.eq.${userPhone.trim()}`);
        }
        
        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching user appointments for multiple dates:', error);
        throw error;
      }

      // Additional client-side filtering for exact matches
      let filteredData = data || [];
      if (userName || userPhone) {
        filteredData = filteredData.filter(slot => {
          const nameMatch = userName && slot.client_name && 
            slot.client_name.trim().toLowerCase() === userName.trim().toLowerCase();
          const phoneMatch = userPhone && slot.client_phone && 
            slot.client_phone.trim() === userPhone.trim();
          
          return nameMatch || phoneMatch;
        });
      }

      return filteredData;
    } catch (error) {
      console.error('Error in getUserAppointmentsForMultipleDates:', error);
      throw error;
    }
  },

  // Get user waitlist entries
  async getUserWaitlistEntries(userPhone: string): Promise<any[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('*')
        .eq('client_phone', userPhone)
        .gte('requested_date', today.toISOString().split('T')[0])
        .eq('status', 'waiting')
        .order('requested_date')
        .order('created_at');

      if (error) {
        console.error('Error fetching user waitlist entries:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserWaitlistEntries:', error);
      throw error;
    }
  },

  // Remove user from waitlist
  async removeFromWaitlist(entryId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('waitlist_entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        console.error('Error removing from waitlist:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in removeFromWaitlist:', error);
      throw error;
    }
  },

};

export default function ClientHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBlocked = Boolean((user as any)?.block);
  
  const [nextAppointment, setNextAppointment] = useState<AvailableTimeSlot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([]);
  const [isLoadingWaitlist, setIsLoadingWaitlist] = useState(false);
  const [isRemovingFromWaitlist, setIsRemovingFromWaitlist] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [managerPhone, setManagerPhone] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Designs store
  const { designs, isLoading: isLoadingDesigns, fetchDesigns } = useDesignsStore();

  const requireAuth = (actionDescription: string, onAuthed: () => void) => {
    if (!isAuthenticated) {
      setLoginModal({
        visible: true,
        title: 'נדרש להתחבר',
        message: `כדי ${actionDescription} יש להתחבר לחשבון שלך`,
      });
      return;
    }
    onAuthed();
  };

  const [loginModal, setLoginModal] = useState<{ visible: boolean; title?: string; message?: string }>({ visible: false });

  const SCREEN_W = Dimensions.get('window').width;
  const EMPTY_CARD_WIDTH = Math.max(280, SCREEN_W - 48); // 24px padding on both sides
  const EMPTY_CARD_HEIGHT = 260; // increased to avoid clipping content
  

  // Animated pulse for approved status dot
  const statusPulseAnim = React.useRef(new Animated.Value(0)).current;
  const statusLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const statusDotAnimatedStyle = {
    opacity: statusPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  } as const;

  // Calendar icon background pulse (infinite)
  const iconPulseAnim = React.useRef(new Animated.Value(0)).current;
  const iconPulseLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const iconPulseAnimatedStyle = {
    opacity: iconPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] }),
    transform: [
      {
        scale: iconPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }),
      },
    ],
  } as const;

  // Ensure pulse animation keeps running when navigating away and back
  useFocusEffect(
    React.useCallback(() => {
      statusLoopRef.current?.stop();
      statusPulseAnim.stopAnimation?.(() => {});
      statusPulseAnim.setValue(0);

      const start = () => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(statusPulseAnim, {
              toValue: 1,
              duration: 900,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(statusPulseAnim, {
              toValue: 0,
              duration: 900,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        );
        statusLoopRef.current = loop;
        loop.start();
      };

      const interactionHandle = InteractionManager.runAfterInteractions(() => start());
      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          statusLoopRef.current?.stop();
          statusPulseAnim.stopAnimation?.(() => {});
          statusPulseAnim.setValue(0);
          start();
        }
      });

      return () => {
        interactionHandle && typeof interactionHandle.cancel === 'function' && interactionHandle.cancel();
        appStateSub.remove();
        statusLoopRef.current?.stop();
      };
    }, [])
  );

  // Run icon pulse continuously while this screen is mounted (not tied to focus)
  useEffect(() => {
    iconPulseLoopRef.current?.stop();
    iconPulseAnim.stopAnimation?.(() => {});
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(iconPulseAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    iconPulseLoopRef.current = loop;
    const handle = InteractionManager.runAfterInteractions(() => loop.start());
    return () => {
      typeof handle?.cancel === 'function' && handle.cancel();
      iconPulseLoopRef.current?.stop();
    };
  }, []);



  // (removed) animated border loop

  // Welcome header animation removed

  // (removed) old perimeter animation

  const fetchUserAppointments = useCallback(async () => {
    if (!user?.name && !user?.phone) {
      setNextAppointment(null);
      return;
    }

    setIsLoading(true);
    const today = new Date();
    const dates: string[] = [];
    
    // Fetch appointments for the next 14 days
    for (let i = 0; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      dates.push(dateString);
    }
    
    try {
      const userAppointments = await clientHomeApi.getUserAppointmentsForMultipleDates(
        dates, 
        user?.name, 
        user?.phone
      );
      
      const upcomingAppointments = userAppointments
        .filter((apt: AvailableTimeSlot) => {
          const appointmentDate = new Date(apt.slot_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Show appointments from today onwards
          const isUpcoming = appointmentDate >= today;
          
          return isUpcoming;
        })
        .sort((a: AvailableTimeSlot, b: AvailableTimeSlot) => {
          const dateA = new Date(a.slot_date);
          const dateB = new Date(b.slot_date);
          if (dateA.getTime() === dateB.getTime()) {
            // If same date, sort by time
            return a.slot_time.localeCompare(b.slot_time);
          }
          return dateA.getTime() - dateB.getTime();
        });
      
      if (upcomingAppointments.length > 0) {
        setNextAppointment(upcomingAppointments[0]);
      } else {
        setNextAppointment(null);
      }
    } catch (error) {
      console.error('Error fetching user appointments:', error);
      setNextAppointment(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.name, user?.phone]);

  // Fetch waitlist entries
  const fetchWaitlistEntries = useCallback(async () => {
    if (!user?.phone) {
      setWaitlistEntries([]);
      return;
    }

    setIsLoadingWaitlist(true);
    try {
      const entries = await clientHomeApi.getUserWaitlistEntries(user.phone);
      setWaitlistEntries(entries);
    } catch (error) {
      console.error('Error fetching waitlist entries:', error);
      setWaitlistEntries([]);
    } finally {
      setIsLoadingWaitlist(false);
    }
  }, [user?.phone]);

  // Fetch unread notifications count
  const fetchUnreadNotificationsCount = useCallback(async () => {
    if (!user?.phone) {
      setUnreadNotificationsCount(0);
      return;
    }

    try {
      const count = await notificationsApi.getUnreadCount(user.phone);
      setUnreadNotificationsCount(count);
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
      setUnreadNotificationsCount(0);
    }
  }, [user?.phone]);

  // Handle removing from waitlist
  const handleRemoveFromWaitlist = async (entryId: string) => {
    setIsRemovingFromWaitlist(true);
    try {
      const success = await clientHomeApi.removeFromWaitlist(entryId);
      if (success) {
        // Remove from local state
        setWaitlistEntries(prev => prev.filter(entry => entry.id !== entryId));
        Alert.alert('הוסר מרשימת המתנה', 'הוסרת בהצלחה מרשימת המתנה');
      }
    } catch (error) {
      console.error('Error removing from waitlist:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בהסרה מרשימת המתנה');
    } finally {
      setIsRemovingFromWaitlist(false);
    }
  };

  // Fetch appointments when component mounts
  useEffect(() => {
    fetchUserAppointments();
  }, [fetchUserAppointments]);

  // Fetch waitlist entries when component mounts
  useEffect(() => {
    fetchWaitlistEntries();
  }, [fetchWaitlistEntries]);

  // Fetch unread notifications count when component mounts
  useEffect(() => {
    fetchUnreadNotificationsCount();
  }, [fetchUnreadNotificationsCount]);


  // Fetch designs on mount
  useEffect(() => {
    fetchDesigns();
  }, [fetchDesigns]);

  // Load business profile (address and social links)
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const p = await businessProfileApi.getProfile();
        setBusinessProfile(p);
      } catch (error) {
        console.error('Error loading business profile:', error);
        setBusinessProfile(null);
      }
    };
    loadProfile();
  }, []);

  // Load manager phone (first admin user)
  useEffect(() => {
    const loadManagerPhone = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('phone')
          .eq('user_type', 'admin')
          .not('phone', 'is', null)
          .neq('phone', '')
          .limit(1)
          .maybeSingle();
        if (!error && data?.phone) {
          const numeric = (data.phone as string).replace(/\D/g, '');
          let normalized = numeric;
          if (numeric.startsWith('0') && numeric.length >= 9) {
            normalized = `972${numeric.slice(1)}`;
          } else if (!numeric.startsWith('972')) {
            normalized = numeric; // leave as is; wa.me accepts many formats if country code included
          }
          setManagerPhone(normalized);
        }
      } catch (e) {
        setManagerPhone(null);
      }
    };
    loadManagerPhone();
  }, []);

  // Fetch appointments when screen comes into focus (e.g., after booking an appointment)
  useFocusEffect(
    useCallback(() => {
      fetchUserAppointments();
      fetchWaitlistEntries();
      fetchUnreadNotificationsCount();
    }, [fetchUserAppointments, fetchWaitlistEntries, fetchUnreadNotificationsCount])
  );

  // Pull-to-refresh handler to reload dashboard data
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
        await Promise.all([
        fetchUserAppointments(),
        fetchWaitlistEntries(),
        fetchUnreadNotificationsCount(),
        fetchDesigns(),
        (async () => {
          try {
            const p = await businessProfileApi.getProfile();
            setBusinessProfile(p);
          } catch { setBusinessProfile(null); }
        })(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserAppointments, fetchWaitlistEntries, fetchUnreadNotificationsCount, fetchDesigns]);

  // Show all services in a horizontal scroll
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long'
    });
  };
  
  const formatWaitlistDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };
  
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const parts = timeString.split(':');
    if (parts.length >= 2) {
      const [hours, minutes] = parts;
      return `${hours}:${minutes}`;
    }
    return timeString;
  };
  
  const socialLinks = [
    businessProfile?.instagram_url ? { name: 'Instagram', icon: 'logo-instagram', color: '#E4405F', url: businessProfile.instagram_url } : null,
    businessProfile?.facebook_url ? { name: 'Facebook', icon: 'logo-facebook', color: '#1877F2', url: businessProfile.facebook_url } : null,
    businessProfile?.tiktok_url ? { name: 'TikTok', icon: 'logo-tiktok', color: '#000000', url: businessProfile.tiktok_url } : null,
  ].filter(Boolean) as Array<{ name: string; icon: any; color: string; url: string }>;

  // Animated stripe around empty card - dynamic layout and animated positions
  // (removed) stripeThickness/stripePad — using MovingBorderCard now
  // SVG stroke-dash animation will follow the exact rounded rect

  return (
    <View style={styles.container}>
      {/* Full Screen Hero with Overlay Header */}
      <View style={styles.fullScreenHero}>
        <Image 
          source={require('@/assets/images/1homePage.jpg')} 
          style={styles.fullScreenHeroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fullScreenHeroOverlay}
        />
        
        {/* Header Overlay */}
        <SafeAreaView edges={["top"]} style={styles.overlayHeader}>
          <View style={styles.overlayHeaderContent}>
            <View style={styles.headerSide}>
              <TouchableOpacity
                style={styles.overlayButton}
                onPress={() => requireAuth('לגשׁת לפרופיל והגדרות', () => router.push('/(client-tabs)/profile'))}
                activeOpacity={0.85}
                accessibilityLabel="הגדרות ופרופיל"
              >
                <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerCenter}>
              <Image source={require('@/assets/images/logo-03.png')} style={styles.overlayLogo} resizeMode="contain" />
            </View>
            <View style={styles.headerSide}>
              <TouchableOpacity 
                style={styles.overlayButton}
                onPress={async () => {
                  return requireAuth('לצפות בהתראות', async () => {
                    await router.push('/(client-tabs)/notifications');
                    setUnreadNotificationsCount(0);
                  });
                }}
                activeOpacity={0.85}
                accessibilityLabel="התראות"
              >
                <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
                {unreadNotificationsCount > 0 && (
                  <View style={styles.overlayNotificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Hero Text Content */}
        <View style={styles.fullScreenHeroContent}>
          <View style={styles.heroTextContainer}>
            <BlurView 
              intensity={30} 
              tint="light"
              style={styles.heroTextBlurContainer}
            >
              <Text style={styles.heroWelcome}>ברוכים הבאים</Text>
              <Text style={styles.heroTitle}>{user?.name || 'לקוח יקר'}</Text>
            </BlurView>
          </View>
        </View>

      </View>

      {/* Content Section with Rounded Top */}
      <SafeAreaView edges={["left","right","bottom"]} style={{ flex: 1 }}>
        <View style={styles.contentWrapper}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
            showsVerticalScrollIndicator={false}
          >

        {/* Waitlist Section - Top Priority */}
        {waitlistEntries.length > 0 && (
          <View style={styles.waitlistTopSection}>
            <View style={styles.waitlistTopCard}>
              <View style={styles.waitlistTopContent}>
                <View style={styles.waitlistTopIconContainer}>
                  <Ionicons name="time" size={28} color="#FFFFFF" />
                </View>
                <View style={styles.waitlistTopInfo}>
                  <Text style={styles.waitlistTopTitle}>אתה ברשימת המתנה</Text>
                  <Text style={styles.waitlistTopSubtitle}>
                    {waitlistEntries.length === 1 
                      ? `ממתין לתור ל${waitlistEntries[0].service_name}`
                      : `ממתין ל${waitlistEntries.length} תורים`
                    }
                  </Text>
                  <View style={styles.waitlistTimePeriodContainer}>
                    {waitlistEntries.slice(0, 3).map((entry, index) => (
                      <View key={entry.id} style={styles.waitlistTimePeriodItem}>
                        <Ionicons 
                          name={
                            entry.time_period === 'morning' ? 'sunny' :
                            entry.time_period === 'afternoon' ? 'partly-sunny' :
                            entry.time_period === 'evening' ? 'moon' : 'time'
                          } 
                          size={16} 
                          color="rgba(255, 255, 255, 0.9)" 
                        />
                        <Text style={styles.waitlistTimePeriodText}>
                          {entry.time_period === 'morning' ? 'בוקר' :
                           entry.time_period === 'afternoon' ? 'צהריים' :
                           entry.time_period === 'evening' ? 'ערב' : 'כל זמן'}
                        </Text>
                      </View>
                    ))}
                    {waitlistEntries.length > 3 && (
                      <View style={styles.waitlistTimePeriodItem}>
                        <Text style={styles.waitlistTimePeriodText}>
                          +{waitlistEntries.length - 3}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.waitlistTopButton}
                onPress={() => {
                  Alert.alert(
                    'יציאה מרשימת המתנה',
                    'האם אתה בטוח שאתה רוצה לצאת מרשימת המתנה?',
                    [
                      {
                        text: 'ביטול',
                        style: 'cancel',
                      },
                      {
                        text: 'אישור',
                        style: 'destructive',
                        onPress: () => {
                          // Remove all waitlist entries
                          waitlistEntries.forEach(entry => {
                            handleRemoveFromWaitlist(entry.id);
                          });
                        },
                      },
                    ]
                  );
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.waitlistTopButtonText}>הסר מרשימת המתנה</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Appointments Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderModern}>
            <View style={styles.headerDecorationLeft}>
              <View style={[styles.decorationDot, { opacity: 0.3 }]} />
              <View style={[styles.decorationDot, { opacity: 0.2 }]} />
              <View style={[styles.decorationDot, { opacity: 0.1 }]} />
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.modernTitle}>תורים</Text>
            </View>
            <View style={styles.headerDecorationRight}>
              <View style={[styles.decorationDot, { opacity: 0.1 }]} />
              <View style={[styles.decorationDot, { opacity: 0.2 }]} />
              <View style={[styles.decorationDot, { opacity: 0.3 }]} />
            </View>
          </View>

          {/* Next Appointment */}
          {isLoading ? (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingText}>טוען תורים...</Text>
            </View>
          ) : nextAppointment ? (
            <View style={styles.appointmentCardWrapper}>
              <View style={styles.appointmentCard} onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
              <View style={styles.appointmentHeader}>
                <View style={styles.appointmentStatus}>
                  <Animated.View style={[styles.statusDot, statusDotAnimatedStyle]} />
                  <Text style={styles.appointmentStatusText}>
                    {'מאושר'}
                  </Text>
                </View>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.appointmentLabel}>התור הבא שלך</Text>
                  <Text style={styles.appointmentService}>{nextAppointment.service_name || 'שירות'}</Text>
                  <Text style={styles.appointmentSubtext}>התור נקבע לתאריך ושעה:</Text>
                  <View style={[styles.appointmentDetails, styles.appointmentDetailsPill]}>
                    <View style={styles.appointmentDetail}>
                      <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                      <Text style={styles.appointmentDetailText}>{formatDate(nextAppointment.slot_date)}</Text>
                    </View>
                    <View style={styles.detailsDivider} />
                    <View style={styles.appointmentDetail}>
                      <Ionicons name="time-outline" size={16} color="#8E8E93" />
                      <Text style={styles.appointmentDetailText}>{formatTime(nextAppointment.slot_time)}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.appointmentAction}>
                <View style={styles.appointmentActionsRow}>
                  <TouchableOpacity
                    style={styles.appointmentActionButton}
                    activeOpacity={0.9}
                    onPress={() => requireAuth('לצפות בתורים שלך', () => router.push('/(client-tabs)/appointments'))}
                  >
                    <LinearGradient
                      colors={[ '#000000', '#000000' ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.appointmentActionGradient}
                    >
                      <Text style={styles.appointmentActionButtonText}>צפייה בפרטים</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
              {/* removed animated border overlay */}
              </View>
            </View>
          ) : (
            <View style={styles.bookAppointmentContainer}>
              <Image 
                source={require('@/assets/images/bookApp.jpg')} 
                style={styles.bookAppointmentImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.bookAppointmentOverlay}
              />
              <View style={styles.bookAppointmentLogoWrapper}>
                <BlurView
                  intensity={24}
                  tint="light"
                  style={styles.bookAppointmentLogoBlur}
                >
                  <Image
                    source={require('@/assets/images/logo-03.png')}
                    style={styles.bookAppointmentLogo}
                    resizeMode="contain"
                  />
                </BlurView>
              </View>
              {businessProfile?.display_name && (
                <View style={styles.bookAppointmentBadgeWrapper}>
                  <BlurView
                    intensity={24}
                    tint="light"
                    style={styles.bookAppointmentBadgeBlur}
                  >
                    <Text style={styles.bookAppointmentBadgeText}>
                      {businessProfile.display_name}
                    </Text>
                  </BlurView>
                </View>
              )}
              
              {/* Content with blur background */}
              <View style={styles.bookAppointmentContent}>
                {/* Book Appointment Button */}
                <TouchableOpacity
                  style={[styles.bookAppointmentButton, isBlocked && { opacity: 0.5 }]}
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
                  activeOpacity={0.8}
                  disabled={isBlocked}
                >
                  <BlurView 
                    intensity={30} 
                    tint="light"
                    style={styles.bookAppointmentButtonBlur}
                  >
                    <View style={styles.bookAppointmentButtonContent}>
                      <Text style={styles.bookAppointmentButtonText}>קבע תור עכשיו</Text>
                      <View style={styles.bookAppointmentIconCircle}>
                        <MaterialCommunityIcons name="arrow-top-left" size={20} color="#1C1C1E" />
                      </View>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Design Carousel */}
        {designs && designs.length > 0 && (
          <DesignCarousel
            designs={designs}
            onDesignPress={(design) => {
              // Handle design press - could navigate to gallery or booking
              if (!isAuthenticated) {
                setLoginModal({
                  visible: true,
                  title: 'נדרש להתחבר',
                  message: 'כדי לצפות בעיצובים מלאים יש להתחבר לחשבון שלך',
                });
                return;
              }
              router.push('/(client-tabs)/gallery');
            }}
          />
        )}

 


        {/* Social Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderModern}>
            <View style={styles.headerDecorationLeft}>
              <View style={[styles.decorationDot, { opacity: 0.3 }]} />
              <View style={[styles.decorationDot, { opacity: 0.2 }]} />
              <View style={[styles.decorationDot, { opacity: 0.1 }]} />
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.modernTitle}>עקבו אחרינו</Text>
            </View>
            <View style={styles.headerDecorationRight}>
              <View style={[styles.decorationDot, { opacity: 0.1 }]} />
              <View style={[styles.decorationDot, { opacity: 0.2 }]} />
              <View style={[styles.decorationDot, { opacity: 0.3 }]} />
            </View>
          </View>

          {/* Location + Social icons in one row */}
          <View style={styles.socialContainer}>
            {socialLinks.map((social) => (
              <TouchableOpacity
                key={social.name}
                style={[styles.socialButton, { backgroundColor: social.color }]}
                onPress={() => Linking.openURL(social.url)}
                activeOpacity={0.8}
              >
                <Ionicons name={social.icon as any} size={social.name === 'Instagram' ? 28 : 24} color="#FFFFFF" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.socialButton, styles.locationCircleButton]}
              onPress={async () => {
                const address = businessProfile?.address || 'תל אביב, רחוב הרצל 123';
                const appUrl = `waze://?q=${encodeURIComponent(address)}&navigate=yes`;
                const webUrl = `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
                try {
                  const canOpen = await Linking.canOpenURL(appUrl);
                  if (canOpen) {
                    await Linking.openURL(appUrl);
                  } else {
                    await Linking.openURL(webUrl);
                  }
                } catch (e) {
                  Alert.alert('שגיאה', 'לא ניתן לפתוח את Waze במכשיר זה');
                }
              }}
              activeOpacity={0.8}
              accessibilityLabel="נווט עם Waze"
            >
              <MaterialCommunityIcons name="waze" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialButton, styles.whatsappCircleButton]}
              onPress={async () => {
                if (!managerPhone) return;
                const message = 'היי 😊%0Aאשמח לדבר לגבי פרטים נוספים';
                const appUrl = `whatsapp://send?phone=${managerPhone}&text=${message}`;
                const webUrl = `https://wa.me/${managerPhone}?text=${message}`;
                try {
                  const canOpen = await Linking.canOpenURL(appUrl);
                  if (canOpen) {
                    await Linking.openURL(appUrl);
                  } else {
                    await Linking.openURL(webUrl);
                  }
                } catch (e) {
                  Alert.alert('שגיאה', 'לא ניתן לפתוח את וואטסאפ במכשיר זה');
                }
              }}
              activeOpacity={0.8}
              accessibilityLabel="צרו קשר בוואטסאפ"
            >
              <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Social section merged above with Location */}
        {/* Footer: Developer logo with link */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://bcode.co.il/')}
            activeOpacity={0.8}
            accessibilityLabel="מעבר לאתר BCODE"
          >
            <Image
              source={require('../../assets/images/bcode black-13.png')}
              style={styles.footerLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
          </ScrollView>
        </View>

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

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Full Screen Hero Styles
  fullScreenHero: {
    position: 'relative',
    height: '45%', // Takes up 45% of screen height
    width: '100%',
  },
  fullScreenHeroImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenHeroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  overlayHeaderContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  overlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  overlayLogo: {
    width: 170,
    height: 60,
    tintColor: '#FFFFFF',
  },
  overlayNotificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fullScreenHeroContent: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    alignItems: 'flex-end',
    zIndex: 5,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  welcomeSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  welcomeText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: -0.2,
    textAlign: 'right',
  },
  userName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 4,
    letterSpacing: -0.8,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 8,
    letterSpacing: -0.2,
    textAlign: 'right',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#000000',
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
  // Admin-like header structure
  headerSide: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Grey rounded container like admin home
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20, // Overlap with hero image
    paddingTop: 36, // Extra padding to account for overlap
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    width: 160,
    height: 60,
    alignSelf: 'center',
  },
  quickActionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  primaryAction: {
    marginBottom: 20,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryActionText: {
    color: '#1C1C1E',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  singleSecondaryAction: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minWidth: 200,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryActionText: {
    fontSize: 14,
    color: '#1C1C1E',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTopSpacer: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 20,
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  // Hero Section Styles
  heroSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  heroImageContainer: {
    position: 'relative',
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 28,
    alignItems: 'flex-end',
  },
  heroTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  heroTextBlurContainer: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  heroWelcome: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 8,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    textAlign: 'right',
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  greetingContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: -4,
    textAlign: 'right',
    letterSpacing: -0.2,
    fontWeight: '500',
  },
  sectionTitleCompact: {
    marginBottom: 4,
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    overflow: 'hidden',
  },
  appointmentCardWrapper: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  appointmentAccent: {
    display: 'none',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  serviceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.12)',
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    textAlign: 'right',
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  appointmentService: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  appointmentSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'right',
    letterSpacing: -0.2,
    marginTop: -6,
    marginBottom: 6,
  },
  appointmentDetails: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  appointmentDetailsPill: {
    backgroundColor: '#F7F7FA',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  appointmentDetail: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  detailsDivider: {
    width: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 4,
  },
  appointmentDetailText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  appointmentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  appointmentStatusContainer: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  appointmentStatusText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  appointmentAction: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  appointmentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appointmentActionButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  appointmentActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  appointmentActionButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  
  emptyAppointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  emptyAppointmentText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptyAppointmentSubtext: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  emptyAppointmentAction: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyAppointmentActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  locationButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  locationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  locationTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  locationButtonTitle: {
    fontSize: 18,
    color: '#1C1C1E',
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  locationButtonSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  // Removed socialText as per new design (no caption under icons)
  locationCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCircleButton: {
    backgroundColor: '#33CCFF',
  },
  whatsappCircleButton: {
    backgroundColor: '#25D366',
  },
  // Footer developer logo
  footerContainer: {
    alignItems: 'center',
    marginTop: -20,
    paddingTop: 0,
    paddingBottom: 26,
  },
  footerLogo: {
    width: 160,
    height: 32,
    opacity: 0.9,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  // New Waitlist Top Styles
  waitlistTopSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  waitlistTopCard: {
    backgroundColor: '#7B61FF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#7B61FF',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  waitlistTopContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  waitlistTopIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitlistTopInfo: {
    flex: 1,
    marginRight: 16,
    alignItems: 'flex-end',
  },
  waitlistTopTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'right',
  },
  waitlistTopSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    textAlign: 'right',
  },
  waitlistTimePeriodContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  waitlistTimePeriodItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  waitlistTimePeriodText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  waitlistTopButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  waitlistTopButtonText: {
    color: '#7B61FF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  // Book Appointment Styles
  bookAppointmentContainer: {
    position: 'relative',
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    marginHorizontal: 4,
  },
  bookAppointmentImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  bookAppointmentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  bookAppointmentBadgeWrapper: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 5,
  },
  bookAppointmentLogoWrapper: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 5,
  },
  bookAppointmentLogoBlur: {
    borderRadius: 12,
    paddingVertical: 1,
    paddingHorizontal: -10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  bookAppointmentLogo: {
    width: 120,
    height: 50,
    tintColor: '#FFFFFF',
    opacity: 0.95,
  },
  bookAppointmentBadgeBlur: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  bookAppointmentBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bookAppointmentContent: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    alignItems: 'flex-end',
  },
  bookAppointmentButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  bookAppointmentButtonBlur: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  bookAppointmentButtonContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  bookAppointmentButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'right',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bookAppointmentIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)'
  },
  // Modern Section Headers
  sectionHeaderModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  headerDecorationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
    paddingRight: 16,
  },
  headerDecorationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-start',
    paddingLeft: 16,
  },
  decorationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1C1C1E',
  },
  headerTitleContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modernTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});

