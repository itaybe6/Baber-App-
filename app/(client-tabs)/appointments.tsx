import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, RefreshControl, Linking } from 'react-native';
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

type TabType = 'upcoming' | 'past';

// API functions for client appointments
const clientAppointmentsApi = {
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
    loadManagerPhone();
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
    if (!user?.name && !user?.phone) {
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
      // Fetch only user appointments directly from API
      const appointments = await clientAppointmentsApi.getUserAppointmentsForMultipleDates(
        dates, 
        user.name, 
        user.phone
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
    if (!user?.name && !user?.phone) {
      return [];
    }
    
    // Double-check that all appointments belong to the current user
    const filteredAppointments = userAppointments.filter(slot => {
      const nameMatch = slot.client_name && user?.name && 
        slot.client_name.trim().toLowerCase() === user.name.trim().toLowerCase();
      const phoneMatch = slot.client_phone && user?.phone && 
        slot.client_phone.trim() === user.phone.trim();
      
      return nameMatch || phoneMatch;
    });
    
    return filteredAppointments;
  }, [userAppointments, user?.name, user?.phone]);
  
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

  // Hero card component for the next appointment so it can be embedded in scrollable content
  const NextAppointmentHero: React.FC = React.useCallback(() => {
    if (!(activeTab === 'upcoming' && nextAppointment)) return null;
    return (
      <View style={styles.nextCardWrapper}>
        <LinearGradient
          colors={["#FFFFFF", "#FFFFFF"]}
          style={styles.nextCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.nextCardHeaderRow}>
            <View style={styles.nextBadge}>
              <Ionicons name="sparkles" size={14} color="#7B61FF" />
              <Text style={styles.nextBadgeText}>התור הקרוב שלך</Text>
            </View>
          </View>

          <Text style={styles.nextServiceName}>{nextAppointment!.service_name || 'שירות'}</Text>

          <View style={styles.nextInfoRows}>
            {/* Date */}
            <View style={styles.nextInfoRow}>
              <Text style={styles.nextInfoText}>{formatDate(nextAppointment!.slot_date)}</Text>
              <View style={styles.nextIconCircle}><Ionicons name="calendar" size={14} color="#7B61FF" /></View>
            </View>
            {/* Location */}
            <View style={styles.nextInfoRow}>
              <Text style={styles.nextInfoText}>נעמה נייל סטודיו</Text>
              <View style={styles.nextIconCircle}><Ionicons name="location" size={14} color="#7B61FF" /></View>
            </View>
            {/* Time */}
            <View style={styles.nextInfoRow}>
              <Text style={styles.nextInfoText}>{formatTime(nextAppointment!.slot_time)}</Text>
              <View style={styles.nextIconCircle}><Ionicons name="time-outline" size={14} color="#7B61FF" /></View>
            </View>
          </View>

          <View style={styles.nextFooterRow}>
            <TouchableOpacity
              style={styles.nextCancelButton}
              onPress={() => handleCancelAppointment(nextAppointment!)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color="#FF3B30" />
              <Text style={styles.nextCancelText}>ביטול</Text>
            </TouchableOpacity>
            <View style={styles.nextStatusRow}>
              <View style={styles.nextStatusDot} />
              <Text style={styles.nextStatusText}>מאושר</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }, [activeTab, nextAppointment, formatDate, formatTime, handleCancelAppointment]);

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
        <View style={styles.appointmentCard}>
          <LinearGradient
            colors={["#FFFFFF", "#FFFFFF"]}
            style={styles.nextCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.nextCardHeaderRow}>
              <View style={styles.nextBadge}>
                <Ionicons name="time-outline" size={14} color="#7B61FF" />
                <Text style={styles.nextBadgeText}>תור קודם</Text>
              </View>
            </View>

            <Text style={styles.nextServiceName}>{item.service_name || 'שירות'}</Text>

            <View style={styles.nextInfoRows}>
              <View style={styles.nextInfoRow}>
                <Text style={styles.nextInfoText}>{formatDate(item.slot_date)}</Text>
                <View style={styles.nextIconCircle}><Ionicons name="calendar" size={14} color="#7B61FF" /></View>
              </View>
              <View style={styles.nextInfoRow}>
                <Text style={styles.nextInfoText}>נעמה נייל סטודיו</Text>
                <View style={styles.nextIconCircle}><Ionicons name="location" size={14} color="#7B61FF" /></View>
              </View>
              <View style={styles.nextInfoRow}>
                <Text style={styles.nextInfoText}>{formatTime(item.slot_time)}</Text>
                <View style={styles.nextIconCircle}><Ionicons name="time-outline" size={14} color="#7B61FF" /></View>
              </View>
            </View>

            <View style={styles.nextFooterRow}>
              <View />
              <View style={styles.nextStatusRow}>
                <View style={styles.nextStatusDot} />
                <Text style={styles.nextStatusText}>הושלם</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      );
    }

    // Upcoming appointments: use the new hero-style card for ALL items
    return (
      <View style={styles.nextCardWrapper}>
        <LinearGradient
          colors={["#FFFFFF", "#FFFFFF"]}
          style={styles.nextCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Keep header row for spacing (no "next" badge for non-first items) */}
          <View style={styles.nextCardHeaderRow} />

          <Text style={styles.nextServiceName}>{item.service_name || 'שירות'}</Text>

          <View style={styles.nextInfoRows}>
            <View style={styles.nextInfoRow}>
              <Text style={styles.nextInfoText}>{formatDate(item.slot_date)}</Text>
              <View style={styles.nextIconCircle}><Ionicons name="calendar" size={14} color="#7B61FF" /></View>
            </View>
            <View style={styles.nextInfoRow}>
              <Text style={styles.nextInfoText}>נעמה נייל סטודיו</Text>
              <View style={styles.nextIconCircle}><Ionicons name="location" size={14} color="#7B61FF" /></View>
            </View>
            <View style={styles.nextInfoRow}>
              <Text style={styles.nextInfoText}>{formatTime(item.slot_time)}</Text>
              <View style={styles.nextIconCircle}><Ionicons name="time-outline" size={14} color="#7B61FF" /></View>
            </View>
          </View>

          <View style={styles.nextFooterRow}>
            <TouchableOpacity
              style={styles.nextCancelButton}
              onPress={() => handleCancelAppointment(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color="#FF3B30" />
              <Text style={styles.nextCancelText}>ביטול</Text>
            </TouchableOpacity>
            <View style={styles.nextStatusRow}>
              <View style={styles.nextStatusDot} />
              <Text style={styles.nextStatusText}>מאושר</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }, [formatDate, formatTime, activeTab, handleCancelAppointment]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={{ width: 22 }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>התורים שלי</Text>
            <Text style={styles.headerSubtitle}>הקרובים והקודמים שלך</Text>
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
                { backgroundColor: activeTab === 'upcoming' ? 'rgba(255,255,255,0.3)' : '#7B61FF' }
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
                { backgroundColor: activeTab === 'past' ? 'rgba(255,255,255,0.3)' : '#7B61FF' }
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
            <Text style={styles.loadingText}>טוען התורים שלך...</Text>
            <Text style={styles.loadingSubtext}>
              {user?.name ? `מחפש תורים עבור ${user.name}` : 'מחפש תורים...'}
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
          <ScrollView
            contentContainerStyle={activeTab === 'upcoming' && nextAppointment ? styles.emptyStateWithHero : styles.emptyState}
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
            <View style={styles.afterHeroSpacer} />
            <Ionicons 
              name="calendar-outline" 
              size={64} 
              color={Colors.subtext} 
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'upcoming' 
                ? (nextAppointment ? 'אין תורים נוספים' : 'אין תורים קרובים')
                : 'אין תורים קודמים'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'upcoming' 
                ? (nextAppointment ? 'אין תורים נוספים להצגה' : 'התורים הקרובים שלך יופיעו כאן')
                : 'התורים הקודמים שלך יופיעו כאן'}
            </Text>
          </ScrollView>
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
                    <Ionicons name="calendar" size={14} color="#7B61FF" style={styles.chipIcon} />
                    <Text style={styles.chipText}>{formatDate(selectedAppointment.slot_date)}</Text>
                  </View>
                  {Boolean(selectedAppointment.slot_time) && (
                    <View style={styles.chip}>
                      <Ionicons name="time-outline" size={14} color="#7B61FF" style={styles.chipIcon} />
                      <Text style={styles.chipText}>{formatTime(selectedAppointment.slot_time)}</Text>
                    </View>
                  )}
                  {Boolean(selectedAppointment.service_name) && (
                    <View style={styles.chip}>
                      <Ionicons name="pricetag" size={14} color="#7B61FF" style={styles.chipIcon} />
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
    backgroundColor: '#7B61FF',
    shadowColor: '#7B61FF',
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
    // Next (upcoming) appointment hero card
    nextCardWrapper: {
      width: '100%',
      paddingHorizontal: 16,
      paddingTop: 0,
      paddingBottom: 0,
      marginTop: 14,
    },
    nextCard: {
      borderRadius: 24,
      paddingVertical: 10,
      paddingHorizontal: 16,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
    nextCardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 6,
    },
    nextBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(123,97,255,0.10)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 14,
    },
    nextBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#7B61FF',
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
    nextServiceName: {
      fontSize: 19,
      fontWeight: '800',
      color: '#1C1C1E',
      textAlign: 'right',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    nextInfoRows: {
      gap: 6,
      marginBottom: 4,
    },
    nextInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    nextIconCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    nextInfoText: {
      fontSize: 13,
      color: '#1C1C1E',
      fontWeight: '600',
      textAlign: 'right',
      letterSpacing: -0.2,
    },
    nextFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 0,
    },
    nextStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    nextStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#34C759',
    },
    nextStatusText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#34C759',
    },
  loadMoreButton: {
    marginTop: 20,
    backgroundColor: '#7B61FF',
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
    gap: 12,
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
    backgroundColor: 'rgba(123,97,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  policyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7B61FF',
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
});