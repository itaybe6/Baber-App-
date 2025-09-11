import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  Animated,
  TouchableOpacity,
  View,
  Modal,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import Colors from '@/constants/colors';
import DaySelector from '@/components/DaySelector';
import { AvailableTimeSlot, supabase } from '@/lib/supabase';
import { businessHoursApi } from '@/lib/api/businessHours';
import { Ionicons } from '@expo/vector-icons';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '@/stores/authStore';

// Press feedback: scale-on-press animated touchable
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
type PressableScaleProps = {
  onPress: () => void;
  style?: any;
  disabled?: boolean;
  hitSlop?: any;
  pressRetentionOffset?: any;
  accessibilityLabel?: string;
  children?: React.ReactNode;
};
const PressableScale = ({ onPress, style, children, disabled, hitSlop, pressRetentionOffset, accessibilityLabel }: PressableScaleProps) => {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = React.useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      stiffness: 300,
      damping: 22,
      mass: 0.6,
    }).start();
  }, [scale]);

  const handlePressOut = React.useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 300,
      damping: 22,
      mass: 0.6,
    }).start();
  }, [scale]);

  return (
    <AnimatedTouchable
      activeOpacity={0.8}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      delayPressIn={0}
      delayPressOut={0}
      pressRetentionOffset={pressRetentionOffset || { top: 24, bottom: 24, left: 24, right: 24 }}
      hitSlop={hitSlop || { top: 24, bottom: 24, left: 24, right: 24 }}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
};

export default function AdminAppointmentsScreen() {
  const user = useAuthStore((state) => state.user);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [appointments, setAppointments] = useState<AvailableTimeSlot[]>([]);
  const [dayStart, setDayStart] = useState<string>('07:00');
  const [dayEnd, setDayEnd] = useState<string>('21:00');
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AvailableTimeSlot | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [showActionsModal, setShowActionsModal] = useState<boolean>(false);
  const [actionsAppointment, setActionsAppointment] = useState<AvailableTimeSlot | null>(null);


  const scrollRef = useRef<ScrollView | null>(null);

  const selectedDateStr = useMemo(() => {
    // Build YYYY-MM-DD in local time to avoid UTC shift
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const loadAppointmentsForDate = useCallback(async (dateString: string, isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Ensure slots exist for the day (idempotent and will not override booked ones)
      await businessHoursApi.generateTimeSlotsForDate(dateString);

      let query = supabase
        .from('appointments')
        .select('*')
        .eq('slot_date', dateString)
        .eq('is_available', false); // booked only

      // סינון לפי המשתמש הנוכחי - רק תורים שהוא יצר
      if (user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('slot_time', { ascending: true });

      if (error) {
        console.error('Error loading appointments for date:', error);
        setAppointments([]);
      } else {
        setAppointments((data as unknown as AvailableTimeSlot[]) || []);
      }
    } catch (e) {
      console.error('Error in loadAppointmentsForDate:', e);
      setAppointments([]);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Load business hours for selected day to drive the grid
    const loadBH = async () => {
      try {
        const dow = selectedDate.getDay();
        const { data } = await supabase
          .from('business_hours')
          .select('start_time,end_time,is_active')
          .eq('day_of_week', dow)
          .maybeSingle();
        if (data && data.is_active) {
          setDayStart(data.start_time || '07:00');
          setDayEnd(data.end_time || '21:00');
        } else {
          setDayStart('07:00');
          setDayEnd('21:00');
        }
      } catch (e) {
        setDayStart('07:00');
        setDayEnd('21:00');
      }
    };
    loadBH();
    loadAppointmentsForDate(selectedDateStr);
  }, [selectedDate, selectedDateStr, loadAppointmentsForDate]);

  // Load marked dates (days with at least one booked appointment) for the current month
  useEffect(() => {
    const loadMonthMarks = async () => {
      try {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstOfMonth = new Date(year, month, 1);
        firstOfMonth.setHours(0, 0, 0, 0);
        const firstOfNextMonth = new Date(year, month + 1, 1);
        firstOfNextMonth.setHours(0, 0, 0, 0);

        const fmt = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const da = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${da}`;
        };

        const { data, error } = await supabase
          .from('appointments')
          .select('slot_date')
          .eq('is_available', false)
          .gte('slot_date', fmt(firstOfMonth))
          .lt('slot_date', fmt(firstOfNextMonth));

        if (error) {
          console.error('Error loading month marks:', error);
          setMarkedDates(new Set());
          return;
        }

        const unique = new Set<string>((data as any[] | null)?.map((r: any) => r.slot_date) || []);
        setMarkedDates(unique);
      } catch (e) {
        console.error('Error in loadMonthMarks:', e);
        setMarkedDates(new Set());
      }
    };
    loadMonthMarks();
  }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

  // Scroll to morning by default for convenience
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedDateStr, dayStart]);

  const onRefresh = useCallback(() => {
    loadAppointmentsForDate(selectedDateStr, true);
  }, [loadAppointmentsForDate, selectedDateStr]);

  // Helpers for the time grid
  const minutesFromMidnight = (time?: string | null): number => {
    if (!time) return 0;
    const parts = String(time).split(':');
    const hh = parseInt(parts[0] || '0', 10);
    const mm = parseInt(parts[1] || '0', 10);
    return hh * 60 + mm;
  };

  const formatTime = (time?: string | null): string => {
    if (!time) return '';
    const [hh = '00', mm = '00'] = String(time).split(':');
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
  };

  const addMinutes = (hhmm: string, minutes: number): string => {
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    const total = h * 60 + m + minutes;
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const compareTimes = (a: string, b: string) => a.localeCompare(b);

  const halfHourLabels = useMemo(() => {
    const labels: string[] = [];
    let t = dayStart;
    while (compareTimes(t, dayEnd) < 0) {
      labels.push(formatTime(t));
      t = addMinutes(t, 30);
    }
    return labels;
  }, [dayStart, dayEnd]);

  // Actions
  const startPhoneCall = useCallback(async (rawPhone?: string | null) => {
    if (!rawPhone) {
      Alert.alert('אין מספר טלפון', 'לא נמצא מספר טלפון תקין ללקוח.');
      return;
    }
    // Sanitize phone: keep + and digits
    const phone = rawPhone.trim().replace(/[^+\d]/g, '');
    if (!phone) {
      Alert.alert('אין מספר טלפון', 'לא נמצא מספר טלפון תקין ללקוח.');
      return;
    }

    const iosUrl = `tel:${phone}`; // iOS handles confirmation UI
    const androidUrl = `tel:${phone}`;
    const url = Platform.OS === 'android' ? androidUrl : iosUrl;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('שגיאה', 'לא ניתן לפתוח חיוג במכשיר זה.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      console.error('Failed to initiate phone call:', e);
      Alert.alert('שגיאה', 'אירעה שגיאה במהלך פתיחת החייגן.');
    }
  }, []);

  const askCancelAppointment = useCallback((apt: AvailableTimeSlot) => {
    // Ensure immediate responsiveness between consecutive presses
    setSelectedAppointment(apt);
    setShowCancelModal(true);
  }, []);

  const openActionsMenu = useCallback((apt: AvailableTimeSlot) => {
    setActionsAppointment(apt);
    setShowActionsModal(true);
  }, []);

  const closeActionsMenu = useCallback(() => {
    setShowActionsModal(false);
    setActionsAppointment(null);
  }, []);

  const confirmCancelAppointment = useCallback(async () => {
    if (!selectedAppointment) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          is_available: true,
          client_name: null,
          client_phone: null,
          service_name: null,
          appointment_id: null,
        })
        .eq('id', selectedAppointment.id)
        .eq('is_available', false);

      if (error) {
        console.error('Error canceling appointment:', error);
      } else {
        setAppointments((prev) => prev.filter((a) => a.id !== selectedAppointment.id));
        setShowCancelModal(false);
        setSelectedAppointment(null);
      }
    } catch (e) {
      console.error('Error in confirmCancelAppointment:', e);
    } finally {
      setIsCancelling(false);
    }
  }, [selectedAppointment]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>יומן תורים</Text>
        <View style={styles.monthSwitcher}>
          <TouchableOpacity onPress={() => {
            const d = new Date(selectedDate);
            d.setDate(1);
            d.setMonth(d.getMonth() - 1);
            d.setHours(0,0,0,0);
            setSelectedDate(d);
          }} style={styles.monthNavBtn} activeOpacity={0.7}>
            <ChevronRight size={16} color={'#1C1C1E'} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{(() => {
            const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
            return `${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
          })()}</Text>
          <TouchableOpacity onPress={() => {
            const d = new Date(selectedDate);
            d.setDate(1);
            d.setMonth(d.getMonth() + 1);
            d.setHours(0,0,0,0);
            setSelectedDate(d);
          }} style={styles.monthNavBtn} activeOpacity={0.7}>
            <ChevronLeft size={16} color={'#1C1C1E'} />
          </TouchableOpacity>
        </View>
      </View>

      <DaySelector selectedDate={selectedDate} onSelectDate={setSelectedDate} mode={'month'} markedDates={markedDates} />

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.text} />
          <Text style={styles.loadingText}>טוען תורים ל-{selectedDateStr}...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"

          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.text]}
              tintColor={Colors.text}
              title="מעדכן..."
              titleColor={Colors.text}
            />
          }
        >
          <View style={styles.timelineContainer}>
            {/* Grid rows for each 30 minutes */}
            {halfHourLabels.map((label, idx) => (
              <View key={idx} style={[styles.gridRow, { height: HALF_HOUR_BLOCK_HEIGHT }]}> 
                <Text style={styles.timeLabel}>{label}</Text>
                <View style={styles.gridLine} />
              </View>
            ))}

            {/* Appointments overlay */}
            <View
              pointerEvents="box-none"
              style={[styles.overlayContainer, { height: halfHourLabels.length * HALF_HOUR_BLOCK_HEIGHT }]}
            >
              {appointments.map((apt) => {
                // Align precisely on the grid: subtract dayStart and anchor to the top of the first row
                const offsetMinutes = minutesFromMidnight(formatTime(apt.slot_time)) - minutesFromMidnight(dayStart);
                const top = Math.max(0, (offsetMinutes / 60) * HOUR_BLOCK_HEIGHT + 20);
                const proportionalHeight = (apt.duration_minutes || 60) / 60 * HOUR_BLOCK_HEIGHT;
                const cardHeight = Math.max(64, proportionalHeight);
                const startTime = formatTime(apt.slot_time);
                const endTime = addMinutes(startTime, apt.duration_minutes || 60);
                return (
                  <View key={`${apt.id}-${apt.slot_time}`} style={[styles.appointmentCard, { top, height: cardHeight, paddingTop: 16 }]}> 
                    <View style={styles.appointmentActions}>
                      <PressableScale
                        onPress={() => openActionsMenu(apt)}
                        style={styles.moreButton}
                        accessibilityLabel="אפשרויות"
                        hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
                        pressRetentionOffset={{ top: 24, bottom: 24, left: 24, right: 24 }}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color="#FFFFFF" />
                      </PressableScale>
                    </View>
                    <Text style={styles.appointmentTime}>{`${startTime} - ${endTime}`}</Text>
                    <Text numberOfLines={1} style={styles.appointmentTitle}>{apt.service_name || 'שירות'}</Text>
                    {!!apt.client_name && (
                      <Text numberOfLines={1} style={styles.appointmentClient}>{apt.client_name}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {appointments.length === 0 && (
            <View style={styles.emptyState}> 
              <Text style={styles.emptyTitle}>אין תורים ליום זה</Text>
              <Text style={styles.emptySubtitle}>בחר יום אחר מהפס העליון</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Actions menu modal */}
      <Modal
        visible={showActionsModal}
        transparent
        animationType="fade"
        onRequestClose={closeActionsMenu}
      >
        <View style={styles.actionsOverlay}>
          <View style={styles.actionsSheet}>
            <Text style={styles.actionsTitle}>בחר פעולה</Text>
            {!!actionsAppointment?.client_phone && (
              <PressableScale
                style={styles.actionsOption}
                accessibilityLabel="התקשר ללקוח"
                onPress={async () => {
                  const phone = actionsAppointment?.client_phone;
                  closeActionsMenu();
                  if (phone) await startPhoneCall(phone);
                }}
              >
                <View style={[styles.actionsIconCircle, { backgroundColor: '#E8F0FF' }]}>
                  <Ionicons name="call" size={18} color="#0A84FF" />
                </View>
                <Text style={styles.actionsOptionText}>התקשר ללקוח</Text>
              </PressableScale>
            )}
            <View style={styles.actionsDivider} />
            <PressableScale
              style={styles.actionsOption}
              accessibilityLabel="בטל תור"
              onPress={() => {
                if (actionsAppointment) {
                  askCancelAppointment(actionsAppointment);
                }
                closeActionsMenu();
              }}
            >
              <View style={[styles.actionsIconCircle, { backgroundColor: '#FFECEC' }]}>
                <Ionicons name="close" size={18} color="#FF3B30" />
              </View>
              <Text style={[styles.actionsOptionText, { color: Colors.error }]}>בטל תור</Text>
            </PressableScale>
            <PressableScale
              style={styles.actionsCancelButton}
              accessibilityLabel="סגור"
              onPress={closeActionsMenu}
            >
              <Text style={styles.actionsCancelText}>סגור</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      {/* iOS-style confirmation modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCancelModal(false);
          setSelectedAppointment(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.iosAlertContainer}>
            <Text style={styles.iosAlertTitle}>לבטל את התור?</Text>
            <Text style={styles.iosAlertMessage}>
              פעולה זו תשחרר את השעה ותמחק את פרטי הלקוח עבור התור הנבחר.
            </Text>
            <View style={styles.iosAlertButtonsRow}>
              <TouchableOpacity
                style={styles.iosAlertButton}
                activeOpacity={0.8}
                onPress={() => {
                  setShowCancelModal(false);
                  setSelectedAppointment(null);
                }}
                disabled={isCancelling}
              >
                <Text style={styles.iosAlertButtonDefaultText}>ביטול</Text>
              </TouchableOpacity>
              <View style={styles.iosAlertButtonDivider} />
              <TouchableOpacity
                style={styles.iosAlertButton}
                activeOpacity={0.8}
                onPress={confirmCancelAppointment}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#FF3B30" />
                ) : (
                  <Text style={styles.iosAlertButtonDestructiveText}>אישור</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Layout constants for the time grid
const HOUR_BLOCK_HEIGHT = 120; // px per hour (expanded spacing)
const HALF_HOUR_BLOCK_HEIGHT = HOUR_BLOCK_HEIGHT / 2; // 30-min rows
const LABELS_WIDTH = 64; // left column width for time labels

// Labels are built dynamically from business hours per selected day

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  monthSwitcher: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  monthText: {
    color: '#1C1C1E',
    fontWeight: '700',
    fontSize: 14,
  },
  monthNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  pickDayBtn: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  pickDayText: {
    color: '#1C1C1E',
    fontWeight: '700',
    fontSize: 14,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.subtext,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  timelineContainer: {
    marginTop: 8,
    marginHorizontal: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  gridRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  timeLabel: {
    width: LABELS_WIDTH,
    textAlign: 'right',
    paddingRight: 8,
    color: Colors.subtext,
  },
  gridLine: {
    height: 1,
    backgroundColor: '#E5E5EA',
    flex: 1,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingLeft: 12,
    paddingRight: LABELS_WIDTH + 6,
  },
  appointmentCard: {
    position: 'absolute',
    left: 12,
    right: LABELS_WIDTH + 6,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5EA',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'flex-start',
  },
  appointmentActions: {
    position: 'absolute',
    top: 6,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
    elevation: 20,
  },
  phoneButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cancelButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentTime: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'right',
  },
  appointmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },
  appointmentClient: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.subtext,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 24,
  },
  actionsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  actionsSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: Colors.white,
    paddingTop: 12,
    paddingBottom: 26,
    paddingHorizontal: 16,
  },
  actionsTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  actionsOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  actionsOptionText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  actionsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginHorizontal: -16,
  },
  actionsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsCancelButton: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  actionsCancelText: {
    fontSize: 16,
    color: '#0A84FF',
    fontWeight: '800',
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosAlertContainer: {
    width: 300,
    borderRadius: 14,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    paddingTop: 16,
  },
  iosAlertTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  iosAlertMessage: {
    fontSize: 13,
    color: Colors.subtext,
    textAlign: 'center',
    paddingHorizontal: 22,
    marginBottom: 12,
  },
  iosAlertButtonsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D1D6',
  },
  iosAlertButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  iosAlertButtonDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D1D6',
  },
  iosAlertButtonDefaultText: {
    fontSize: 17,
    color: '#0A84FF',
    fontWeight: '600',
  },
  iosAlertButtonDestructiveText: {
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '700',
  },
});


