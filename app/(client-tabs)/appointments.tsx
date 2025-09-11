import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, RefreshControl, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { AvailableTimeSlot } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { checkWaitlistAndNotify, notifyServiceWaitlistClients } from '@/lib/api/waitlistNotifications';
import { notificationsApi } from '@/lib/api/notifications';
import { businessProfileApi } from '@/lib/api/businessProfile';
import { usersApi } from '@/lib/api/users';

type TabType = 'upcoming' | 'past';

// API functions for client appointments
const clientAppointmentsApi = {
  // Get user appointments for multiple dates (most efficient for user appointments)
  async getUserAppointmentsForMultipleDates(dates: string[], userName?: string, userPhone?: string, currentUserId?: string): Promise<AvailableTimeSlot[]> {
    try {
      let query = supabase
        .from('appointments')
        .select('*')
        .in('slot_date', dates)
        .eq('is_available', false); // Only booked appointments

      // If this is an admin user (barber), filter by their user_id
      if (currentUserId) {
        query = query.eq('user_id', currentUserId);
      }

      query = query.order('slot_date').order('slot_time');

      // Filter by user if provided (for client view)
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

      // Additional client-side filtering for exact matches (for client view)
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

  // Cancel appointment
  async cancelAppointment(slotId: string): Promise<boolean> {
    try {
      // First, get the appointment details before cancelling
      const { data: appointmentData, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', slotId)
        .single();

      if (fetchError) {
        console.error('Error fetching appointment before cancellation:', fetchError);
        return false;
      }

      // Cancel the appointment
      const { error } = await supabase
        .from('appointments')
        .update({
          is_available: true,
          client_name: null,
          client_phone: null,
          service_name: null,
        })
        .eq('id', slotId)
        .eq('is_available', false);

      if (error) {
        console.error('Error canceling appointment:', error);
        return false;
      }

      // Check waitlist and notify waiting clients
      if (appointmentData) {
        // Notify clients waiting for the same date and time period
        await checkWaitlistAndNotify(appointmentData);
        
        // Also notify clients waiting for the same service on any future date
        await notifyServiceWaitlistClients(appointmentData);
      }

      return true;
    } catch (error) {
      console.error('Error in cancelAppointment:', error);
      return false;
    }
  },
};

export default function ClientAppointmentsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userAppointments, setUserAppointments] = useState<AvailableTimeSlot[]>([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AvailableTimeSlot | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showLateCancelModal, setShowLateCancelModal] = useState(false);
  const [managerPhone, setManagerPhone] = useState<string | null>(null);
  const [businessAddress, setBusinessAddress] = useState<string>('');
  const [barberImages, setBarberImages] = useState<Record<string, string>>({});
  const { user } = useAuthStore();

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
            normalized = numeric;
          }
          setManagerPhone(normalized);
        }
      } catch (e) {
        setManagerPhone(null);
      }
    };
    
    const loadBusinessAddress = async () => {
      try {
        const profile = await businessProfileApi.getProfile();
        console.log('Business profile:', profile);
        if (profile?.address) {
          console.log('Setting address:', profile.address);
          setBusinessAddress(String(profile.address));
        } else {
          console.log('No address found in profile');
        }
      } catch (error) {
        console.error('Error loading business address:', error);
      }
    };
    
    loadManagerPhone();
    loadBusinessAddress();
  }, []);

  // Helper to check if appointment is within 48 hours from now
  const isWithin48Hours = useCallback((appointment: AvailableTimeSlot) => {
    if (!appointment?.slot_date) return false;
    const time = appointment.slot_time ? String(appointment.slot_time) : '00:00';
    const [hh = '00', mm = '00'] = time.split(':');
    const dateTime = new Date(`${appointment.slot_date}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`);
    const diffMs = dateTime.getTime() - Date.now();
    const hours = diffMs / (1000 * 60 * 60);
    return hours < 48;
  }, []);

  // Open WhatsApp chat with manager
  const contactManagerOnWhatsApp = useCallback(async (message: string) => {
    if (!managerPhone) {
      Alert.alert('שגיאה', 'מספר המנהל לא זמין כרגע');
      return;
    }
    const encoded = encodeURIComponent(message);
    const appUrl = `whatsapp://send?phone=${managerPhone}&text=${encoded}`;
    const webUrl = `https://wa.me/${managerPhone}?text=${encoded}`;
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
  }, [managerPhone]);

  const loadUserAppointments = useCallback(async (isRefresh = false) => {
    const isAdminUser = user?.user_type === 'admin';
    
    // For admin users, we need user ID. For clients, we need name or phone.
    if (isAdminUser && !user?.id) {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
      return;
    }
    
    if (!isAdminUser && !user?.name && !user?.phone) {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const today = new Date();
    const dates: string[] = [];
    
    // Load past 7 days and next 14 days
    for (let i = -7; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      dates.push(dateString);
    }
    
    try {
      // For admin users (barbers), pass their user ID to filter appointments
      // For clients, pass their name/phone for filtering
      const isAdminUser = user?.user_type === 'admin';
      const appointments = await clientAppointmentsApi.getUserAppointmentsForMultipleDates(
        dates, 
        isAdminUser ? undefined : user.name, // Only use name/phone for client filtering
        isAdminUser ? undefined : user.phone, // Only use name/phone for client filtering
        isAdminUser ? user.id : undefined // Pass user ID for admin filtering
      );
      
      setUserAppointments(appointments);
    } catch (error) {
      console.error('Error loading user appointments:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [user?.name, user?.phone]);

  useEffect(() => {
    loadUserAppointments();
  }, [loadUserAppointments]);

  const onRefresh = useCallback(() => {
    loadUserAppointments(true);
  }, [loadUserAppointments]);

  const formatDate = React.useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  const formatTime = React.useCallback((timeString: string) => {
    if (!timeString) return '';
    // Normalize time to HH:MM
    const parts = String(timeString).split(':');
    if (parts.length >= 2) {
      const hh = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      return `${hh}:${mm}`;
    }
    return timeString;
  }, []);

  // Memoize date calculations for better performance
  const today = React.useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  
  // Double-check that all appointments belong to the current user
  const verifiedUserAppointments = React.useMemo(() => {
    if (!user?.id) {
      return [];
    }
    
    const isAdminUser = user?.user_type === 'admin';
    
    if (isAdminUser) {
      // For admin users (barbers), check that appointments have their user_id
      const filteredAppointments = userAppointments.filter(slot => {
        return slot.user_id === user.id;
      });
      return filteredAppointments;
    } else {
      // For clients, check name/phone match as before
      if (!user?.name && !user?.phone) {
        return [];
      }
      
      const filteredAppointments = userAppointments.filter(slot => {
        const nameMatch = slot.client_name && user?.name && 
          slot.client_name.trim().toLowerCase() === user.name.trim().toLowerCase();
        const phoneMatch = slot.client_phone && user?.phone && 
          slot.client_phone.trim() === user.phone.trim();
        
        return nameMatch || phoneMatch;
      });
      
      return filteredAppointments;
    }
  }, [userAppointments, user?.id, user?.name, user?.phone, user?.user_type]);

  // Load barber images for appointments
  useEffect(() => {
    const loadBarberImages = async () => {
      const userIds = Array.from(new Set(verifiedUserAppointments.map(apt => apt.user_id).filter(Boolean)));
      if (userIds.length === 0) return;

      const images: Record<string, string> = {};
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            const userData = await usersApi.getUserById(userId);
            if (userData?.image_url) {
              images[userId] = userData.image_url;
            }
          } catch (error) {
            console.error('Error loading barber image:', error);
          }
        })
      );
      setBarberImages(images);
    };

    loadBarberImages();
  }, [verifiedUserAppointments]);
  
  const upcomingAppointments = React.useMemo(() => {
    return verifiedUserAppointments.filter(slot => {
      const appointmentDate = new Date(slot.slot_date);
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate >= today;
    });
  }, [verifiedUserAppointments, today]);
  
  const pastAppointments = React.useMemo(() => {
    return verifiedUserAppointments.filter(slot => {
      const appointmentDate = new Date(slot.slot_date);
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate < today;
    });
  }, [verifiedUserAppointments, today]);

  // Determine next (closest) upcoming appointment
  const nextAppointment = React.useMemo(() => {
    if (upcomingAppointments.length === 0) return null;
    const withDateTime = upcomingAppointments.map(a => ({
      item: a,
      dateTime: new Date(`${a.slot_date}T${(a.slot_time || '00:00')}`),
    }));
    withDateTime.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
    return withDateTime[0].item;
  }, [upcomingAppointments]);

  // Exclude next appointment from the list to avoid duplication in the card + list
  const displayedUpcomingAppointments = React.useMemo(() => {
    if (!nextAppointment) return upcomingAppointments;
    return upcomingAppointments.filter(a => a.id !== nextAppointment.id);
  }, [upcomingAppointments, nextAppointment]);

  const currentAppointments = activeTab === 'upcoming' ? displayedUpcomingAppointments : pastAppointments;

  // Barber Avatar Component
  const BarberAvatar: React.FC<{ userId?: string; size?: number }> = React.useCallback(({ userId, size = 36 }) => {
    if (!userId) return null;
    
    const imageUrl = barberImages[userId];
    
    return (
      <View style={[styles.barberAvatarContainer, { width: size, height: size }]}>
        <LinearGradient
          colors={["#000000", "#333333"]}
          style={[styles.barberAvatarGradient, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View style={[styles.barberAvatar, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}>
            {imageUrl ? (
              <Image 
                source={{ uri: imageUrl }} 
                style={[styles.barberAvatarImage, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]} 
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={size * 0.5} color="#666" />
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }, [barberImages]);

  // Hero card component for the next appointment so it can be embedded in scrollable content
  const NextAppointmentHero: React.FC = React.useCallback(() => {
    if (!(activeTab === 'upcoming' && nextAppointment)) return null;
    return (
      <View style={styles.heroCardContainer}>
        <LinearGradient
          colors={["#FFFFFF", "#FAFAFA"]}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroCardOverlay} />
          
          <View style={styles.heroContent}>
            {/* Barber Avatar in top right corner */}
            <View style={styles.heroBarberAvatarContainer}>
              <BarberAvatar userId={nextAppointment!.user_id} size={48} />
            </View>
            
            {/* Cancel button in top left corner */}
            <TouchableOpacity
              style={styles.heroCancelButtonTopLeft}
              onPress={() => handleCancelAppointment(nextAppointment!)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#FF3B30" />
              <Text style={styles.heroCancelButtonText}>ביטול</Text>
            </TouchableOpacity>

            <Text style={styles.heroServiceNameNext}>{nextAppointment!.service_name || 'שירות'}</Text>
            
            {/* Show client info for admin users (barbers) */}
            {user?.user_type === 'admin' && nextAppointment!.client_name && (
              <View style={styles.heroLocationRow}>
                <Text style={styles.heroLocationText}>
                  {nextAppointment!.client_name}
                  {nextAppointment!.client_phone && ` • ${nextAppointment!.client_phone}`}
                </Text>
                <View style={styles.heroLocationIcon}>
                  <Ionicons name="person" size={12} color="#000000" />
                </View>
              </View>
            )}
            
            {/* Show business address for clients */}
            {user?.user_type !== 'admin' && businessAddress ? (
              <View style={styles.heroLocationRow}>
                <Text style={styles.heroLocationText}>{businessAddress}</Text>
                <View style={styles.heroLocationIcon}>
                  <Ionicons name="location" size={12} color="#000000" />
                </View>
              </View>
            ) : null}

            <View style={styles.heroDetailsContainer}>
              <View style={styles.heroDetailCard}>
                <Ionicons name="calendar" size={16} color="#000000" />
                <Text style={styles.heroDetailValue}>{formatDate(nextAppointment!.slot_date)}</Text>
              </View>

              <View style={styles.heroDetailCard}>
                <Ionicons name="time" size={16} color="#000000" />
                <Text style={styles.heroDetailValue}>{formatTime(nextAppointment!.slot_time)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }, [activeTab, nextAppointment, formatDate, formatTime, handleCancelAppointment, businessAddress]);

  // Handle cancel appointment
  function handleCancelAppointment(appointment: AvailableTimeSlot) {
    setSelectedAppointment(appointment);
    if (isWithin48Hours(appointment)) {
      setShowLateCancelModal(true);
      return;
    }
    setShowCancelModal(true);
  }

  const confirmCancelAppointment = async () => {
    if (!selectedAppointment) return;

    setIsCanceling(true);
    try {
      const success = await clientAppointmentsApi.cancelAppointment(selectedAppointment.id);
      if (success) {
        // Remove the canceled appointment from the list
        setUserAppointments(prev => prev.filter(apt => apt.id !== selectedAppointment.id));
        setShowCancelModal(false);
        setSelectedAppointment(null);

        // Create admin notification about the cancellation
        const canceledBy = user?.name || selectedAppointment.client_name || 'לקוח';
        const canceledPhone = user?.phone || selectedAppointment.client_phone || '';
        const serviceName = selectedAppointment.service_name || 'שירות';
        const date = selectedAppointment.slot_date;
        const time = selectedAppointment.slot_time;
        const title = 'ביטול תור';
        const content = `${canceledBy} (${canceledPhone}) ביטל/ה תור ל"${serviceName}" בתאריך ${date} בשעה ${time}`;
        // Ignore result; best-effort
        notificationsApi.createAdminNotification(title, content, 'system').catch(() => {});
      } else {
        Alert.alert('שגיאה', 'לא ניתן היה לבטל את התור. אנא נסה שוב.');
      }
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בביטול התור. אנא נסה שוב.');
    } finally {
      setIsCanceling(false);
    }
  };

  const renderAppointment = React.useCallback(({ item }: { item: AvailableTimeSlot }) => {
    if (activeTab === 'past') {
      return (
        <View style={styles.heroCardContainer}>
          <LinearGradient
            colors={["#FFFFFF", "#FAFAFA"]}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroCardOverlay} />
            
            <View style={styles.heroContent}>
              <View style={styles.regularHeader}>
                <View style={styles.pastBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.pastBadgeText}>הושלם</Text>
                </View>
                <View style={styles.regularHeaderRight}>
                  <BarberAvatar userId={item.user_id} size={44} />
                </View>
              </View>

              <Text style={styles.heroServiceName}>{item.service_name || 'שירות'}</Text>
              
              {/* Show client info for admin users (barbers) */}
              {user?.user_type === 'admin' && item.client_name && (
                <View style={styles.heroLocationRow}>
                  <Text style={styles.heroLocationText}>
                    {item.client_name}
                    {item.client_phone && ` • ${item.client_phone}`}
                  </Text>
                  <View style={styles.heroLocationIcon}>
                    <Ionicons name="person" size={12} color="#000000" />
                  </View>
                </View>
              )}
              
              {/* Show business address for clients */}
              {user?.user_type !== 'admin' && businessAddress ? (
                <View style={styles.heroLocationRow}>
                  <Text style={styles.heroLocationText}>{businessAddress}</Text>
                  <View style={styles.heroLocationIcon}>
                    <Ionicons name="location" size={12} color="#000000" />
                  </View>
                </View>
              ) : null}

              <View style={styles.heroDetailsContainer}>
                <View style={styles.heroDetailCard}>
                  <Ionicons name="calendar" size={16} color="#000000" />
                  <Text style={styles.heroDetailValue}>{formatDate(item.slot_date)}</Text>
                </View>
                <View style={styles.heroDetailCard}>
                  <Ionicons name="time" size={16} color="#000000" />
                  <Text style={styles.heroDetailValue}>{formatTime(item.slot_time)}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      );
    }

    // Upcoming appointments: modern card design
    return (
      <View style={styles.heroCardContainer}>
        <LinearGradient
          colors={["#FFFFFF", "#FAFAFA"]}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroCardOverlay} />
          
          <View style={styles.heroContent}>
            {/* Barber Avatar in top right corner */}
            <View style={styles.heroBarberAvatarContainer}>
              <BarberAvatar userId={item.user_id} size={48} />
            </View>
            
            {/* Cancel button in top left corner */}
            <TouchableOpacity
              style={styles.heroCancelButtonTopLeft}
              onPress={() => handleCancelAppointment(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#FF3B30" />
              <Text style={styles.heroCancelButtonText}>ביטול</Text>
            </TouchableOpacity>

            <Text style={styles.heroServiceNameNext}>{item.service_name || 'שירות'}</Text>
            
            {/* Show client info for admin users (barbers) */}
            {user?.user_type === 'admin' && item.client_name && (
              <View style={styles.heroLocationRow}>
                <Text style={styles.heroLocationText}>
                  {item.client_name}
                  {item.client_phone && ` • ${item.client_phone}`}
                </Text>
                <View style={styles.heroLocationIcon}>
                  <Ionicons name="person" size={12} color="#000000" />
                </View>
              </View>
            )}
            
            {/* Show business address for clients */}
            {user?.user_type !== 'admin' && businessAddress ? (
              <View style={styles.heroLocationRow}>
                <Text style={styles.heroLocationText}>{businessAddress}</Text>
                <View style={styles.heroLocationIcon}>
                  <Ionicons name="location" size={12} color="#000000" />
                </View>
              </View>
            ) : null}

            <View style={styles.heroDetailsContainer}>
              <View style={styles.heroDetailCard}>
                <Ionicons name="calendar" size={16} color="#000000" />
                <Text style={styles.heroDetailValue}>{formatDate(item.slot_date)}</Text>
              </View>
              <View style={styles.heroDetailCard}>
                <Ionicons name="time" size={16} color="#000000" />
                <Text style={styles.heroDetailValue}>{formatTime(item.slot_time)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }, [formatDate, formatTime, activeTab, handleCancelAppointment, businessAddress]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={{ width: 22 }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>
              {user?.user_type === 'admin' ? 'הלוז שלי' : 'התורים שלי'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {user?.user_type === 'admin' ? 'התורים שלך כספר' : 'הקרובים והקודמים שלך'}
            </Text>
          </View>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <View style={styles.container}>
        <View style={styles.toggleContainer}>
          <View style={styles.toggleWrapper}>
            <TouchableOpacity 
              style={[
                styles.toggleBtn,
                activeTab === 'upcoming' && styles.toggleBtnActive
              ]}
              onPress={() => setActiveTab('upcoming')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.toggleBadge,
                { backgroundColor: activeTab === 'upcoming' ? 'rgba(255,255,255,0.3)' : '#000000' }
              ]}>
                <Text style={[
                  styles.toggleBadgeText,
                  { color: '#FFFFFF' }
                ]}>
                  {upcomingAppointments.length}
                </Text>
              </View>
              <Text style={[
                styles.toggleText, 
                activeTab === 'upcoming' && styles.toggleTextActive
              ]}>
                קרובים
              </Text>
              <Ionicons 
                name="calendar-outline" 
                size={18} 
                color={activeTab === 'upcoming' ? '#FFFFFF' : '#8E8E93'} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.toggleBtn,
                activeTab === 'past' && styles.toggleBtnActive
              ]}
              onPress={() => setActiveTab('past')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.toggleBadge,
                { backgroundColor: activeTab === 'past' ? 'rgba(255,255,255,0.3)' : '#000000' }
              ]}>
                <Text style={[
                  styles.toggleBadgeText,
                  { color: '#FFFFFF' }
                ]}>
                  {pastAppointments.length}
                </Text>
              </View>
              <Text style={[
                styles.toggleText, 
                activeTab === 'past' && styles.toggleTextActive
              ]}>
                היסטוריה
              </Text>
              <Ionicons 
                name="checkmark-done-circle-outline" 
                size={18} 
                color={activeTab === 'past' ? '#FFFFFF' : '#8E8E93'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Include the hero card within refreshable content (below) */}

        {isLoading ? (
          <ScrollView
            contentContainerStyle={activeTab === 'upcoming' && nextAppointment ? styles.loadingContainerWithHero : styles.loadingContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
                title="מעדכן התורים..."
                titleColor={Colors.primary}
              />
            }
          >
            <NextAppointmentHero />
            <ActivityIndicator size="large" color={Colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={styles.loadingText}>
              {user?.user_type === 'admin' ? 'טוען את הלוז שלך...' : 'טוען התורים שלך...'}
            </Text>
            <Text style={styles.loadingSubtext}>
              {user?.user_type === 'admin' 
                ? (user?.name ? `טוען תורים עבור הספר ${user.name}` : 'טוען תורים...')
                : (user?.name ? `מחפש תורים עבור ${user.name}` : 'מחפש תורים...')
              }
            </Text>
          </ScrollView>
        ) : currentAppointments.length > 0 ? (
          <FlatList
            data={currentAppointments}
            renderItem={renderAppointment}
            keyExtractor={(item) => `${item.id}-${item.slot_date}-${item.slot_time}`}
            contentContainerStyle={styles.appointmentsList}
            ListHeaderComponent={<NextAppointmentHero />}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={3}
            windowSize={3}
            initialNumToRender={2}
            updateCellsBatchingPeriod={100}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
                title="מעדכן התורים..."
                titleColor={Colors.primary}
              />
            }
          />
        ) : (
          activeTab === 'upcoming' && nextAppointment ? (
            <ScrollView
              contentContainerStyle={styles.emptyStateWithHero}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[Colors.primary]}
                  tintColor={Colors.primary}
                  title="מעדכן התורים..."
                  titleColor={Colors.primary}
                />
              }
            >
              <NextAppointmentHero />
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.emptyState}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[Colors.primary]}
                  tintColor={Colors.primary}
                  title="מעדכן התורים..."
                  titleColor={Colors.primary}
                />
              }
            >
              <Ionicons 
                name="calendar-outline" 
                size={64} 
                color={Colors.subtext} 
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'upcoming' 
                  ? (user?.user_type === 'admin' ? 'אין תורים קרובים' : 'אין תורים קרובים')
                  : (user?.user_type === 'admin' ? 'אין תורים קודמים' : 'אין תורים קודמים')}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'upcoming' 
                  ? (user?.user_type === 'admin' ? 'התורים הקרובים שלך יופיעו כאן' : 'התורים הקרובים שלך יופיעו כאן')
                  : (user?.user_type === 'admin' ? 'התורים שטיפלת בהם יופיעו כאן' : 'התורים הקודמים שלך יופיעו כאן')}
              </Text>
            </ScrollView>
          )
        )}
      </View>

      {/* Cancel Appointment Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCancelModal}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModal}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={48} color="#FF9500" />
              <Text style={styles.modalTitle}>ביטול תור</Text>
              <Text style={styles.modalMessage}>
                האם ברצונך לבטל את התור שלך?
              </Text>
              {selectedAppointment && (
                <View style={styles.appointmentSummary}>
                  <Text style={styles.summaryText}>
                    {selectedAppointment.service_name} - {formatDate(selectedAppointment.slot_date)} {formatTime(selectedAppointment.slot_time)}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setShowCancelModal(false)}
                disabled={isCanceling}
              >
                <Text style={styles.cancelModalButtonText}>ביטול</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmModalButton]}
                onPress={confirmCancelAppointment}
                disabled={isCanceling}
              >
                {isCanceling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmModalButtonText}>אישור</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Late-cancel blocked Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLateCancelModal}
        onRequestClose={() => setShowLateCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.iosModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.policyBadge}>
                <Text style={styles.policyBadgeText}>מדיניות ביטולים</Text>
              </View>
              <View style={styles.modalIconCircle}>
                <Ionicons name="alert" size={28} color="#FF3B30" />
              </View>
              <Text style={styles.modalTitle}>לא ניתן לבטל תור</Text>
              <Text style={styles.modalMessage}>
                ניתן לבטל תור עד 48 שעות לפני המועד. לביטול בטווח קצר יש ליצור קשר עם המנהל/ת.
              </Text>
              {selectedAppointment && (
                <View style={styles.appointmentChips}>
                  <View style={styles.chip}>
                    <Ionicons name="calendar" size={14} color="#000000" style={styles.chipIcon} />
                    <Text style={styles.chipText}>{formatDate(selectedAppointment.slot_date)}</Text>
                  </View>
                  {Boolean(selectedAppointment.slot_time) && (
                    <View style={styles.chip}>
                      <Ionicons name="time-outline" size={14} color="#000000" style={styles.chipIcon} />
                      <Text style={styles.chipText}>{formatTime(selectedAppointment.slot_time)}</Text>
                    </View>
                  )}
                  {Boolean(selectedAppointment.service_name) && (
                    <View style={styles.chip}>
                      <Ionicons name="pricetag" size={14} color="#000000" style={styles.chipIcon} />
                      <Text style={styles.chipText}>{selectedAppointment.service_name}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setShowLateCancelModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelModalButtonText}>סגור</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.whatsappButton]}
                onPress={() => {
                  const apt = selectedAppointment;
                  const msg = apt
                    ? `היי, אני רוצה לבטל תור שנקבע ל-${formatDate(apt.slot_date)} בשעה ${formatTime(apt.slot_time)} עבור \"${apt.service_name || 'שירות'}\". האם אפשר לעזור?`
                    : 'היי, אשמח לעזרה בביטול תור בטווח קצר.';
                  contactManagerOnWhatsApp(msg);
                  setShowLateCancelModal(false);
                }}
                activeOpacity={0.9}
              >
                <View style={styles.whatsappButtonRow}>
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={styles.whatsappButtonIcon} />
                  <Text style={styles.whatsappButtonText}>שליחת הודעה</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  header: {
    height: 104,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.white,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.subtext,
    marginTop: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingContainerWithHero: {
    flexGrow: 1,
    alignItems: 'stretch',
  },
  loadingText: {
    fontSize: 17,
    color: '#8E8E93',
    marginTop: 16,
    fontWeight: '400',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    fontWeight: '400',
  },
  toggleContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    borderRadius: 25,
    padding: 4,
    width: '85%',
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 21,
    gap: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: -0.3,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  toggleBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  toggleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  appointmentsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  appointmentCard: {
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  cardGradient: {
    borderRadius: 24,
  },
  cardContent: {
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  serviceInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  serviceName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'right',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  appointmentDetails: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  detailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '600',
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  cardFooter: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  priorityIndicator: {
    width: 60,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },

  emptyState: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateWithHero: {
    flexGrow: 1,
    alignItems: 'stretch',
  },
    afterHeroSpacer: {
      height: 16,
    },
  emptyIcon: {
    marginTop: 20,
    marginBottom: 10,
    opacity: 0.6,
    alignSelf: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  // Hero card styles (next appointment)
  heroCardContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    marginTop: 14,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroCardOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 50,
    transform: [{ translateX: 30 }, { translateY: -30 }],
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
  },
  heroHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  heroTypeIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    marginRight: -6,
  },
  heroTypeIndicatorAbsolute: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  heroCancelButtonTopLeft: {
    position: 'absolute',
    top: -6,
    left: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  heroCancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3B30',
  },
    nextCancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,59,48,0.08)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 14,
    },
    nextCancelText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FF3B30',
    },
  heroServiceName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'right',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroServiceNameNext: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'right',
    letterSpacing: -0.4,
    marginBottom: 4,
    marginTop: 50,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 16,
    gap: 6,
  },
  heroLocationIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLocationText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'right',
  },
  heroDetailsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    gap: 16,
  },
  heroDetailCard: {
    flexShrink: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  heroDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'right',
  },

  // Regular appointment card styles
  regularHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upcomingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  pastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pastBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34C759',
  },
  regularTypeIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regularCancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regularFooter: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  regularStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  regularStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  regularStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34C759',
  },
  loadMoreButton: {
    marginTop: 20,
    backgroundColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Cancel button styles
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iosModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  policyBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  policyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  modalIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,59,48,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipIcon: {
    marginLeft: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cancelModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  appointmentSummary: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#1C1C1E',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  confirmModalButton: {
    backgroundColor: '#FF3B30',
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  confirmModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  whatsappButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  whatsappButtonIcon: {
    marginTop: 1,
  },
  whatsappButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Barber Avatar Styles
  barberAvatarContainer: {
    position: 'relative',
  },
  barberAvatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  barberAvatar: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  barberAvatarImage: {
    width: '100%',
    height: '100%',
  },
  heroBarberAvatarContainer: {
    position: 'absolute',
    top: -12,
    right: -12,
    zIndex: 3,
  },
  regularHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
});