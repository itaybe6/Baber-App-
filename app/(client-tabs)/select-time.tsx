import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { businessProfileApi } from '@/lib/api/businessProfile';
import { useAuthStore } from '@/stores/authStore';
import { notificationsApi } from '@/lib/api/notifications';

export default function SelectTimeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{
    serviceName?: string;
    durationMinutes?: string;
    price?: string;
    selectedDate?: string;
  }>();

  const serviceName = params.serviceName || '';
  const durationMinutes = useMemo(() => {
    const n = Number(params.durationMinutes);
    return Number.isFinite(n) && n > 0 ? n : 60;
  }, [params.durationMinutes]);
  const selectedDate = params.selectedDate || '';

  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [checkingSameDay, setCheckingSameDay] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [existingAppointment, setExistingAppointment] = useState<any | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [globalBreakMinutes, setGlobalBreakMinutes] = useState<number>(0);

  // Load global break (minutes) from business_profile on mount
  useEffect(() => {
    const loadBreak = async () => {
      try {
        const p = await businessProfileApi.getProfile();
        const br = Math.max(0, Math.min(180, Number((p as any)?.break ?? 0)));
        setGlobalBreakMinutes(br);
      } catch {}
    };
    loadBreak();
  }, []);

  const reloadTimes = async () => {
    if (!selectedDate) return;
    setLoading(true);
    let isStaleLocal = false;
    try {
      // fetch existing appointments for that date
      const { data: slots } = await supabase
        .from('appointments')
        .select('*')
        .eq('slot_date', selectedDate)
        .order('slot_time');

      // Build busy intervals from booked appointments (respecting their duration)
      type Busy = { startMin: number; endMin: number };
      const toMinutes = (time: string) => {
        const [h, m] = String(time).split(':');
        return (parseInt(h || '0', 10) * 60) + parseInt(m || '0', 10);
      };
      const busyIntervals: Busy[] = (slots || [])
        .filter(s => s.is_available === false)
        .map(s => {
          const startMin = toMinutes(String(s.slot_time));
          const dur = typeof (s as any).duration_minutes === 'number' ? (s as any).duration_minutes : 60;
          return { startMin, endMin: startMin + dur } as Busy;
        })
        .sort((a, b) => a.startMin - b.startMin);

      // business hours for that date's day-of-week
      const dt = new Date(selectedDate);
      const dow = dt.getDay();
      const { data: bhRow } = await supabase
        .from('business_hours')
        .select('*')
        .eq('day_of_week', dow)
        .eq('is_active', true)
        .maybeSingle();

      const toHHMM = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      const windowsBase = bhRow
        ? [{ start: bhRow.start_time as string, end: bhRow.end_time as string }]
        : [{ start: '09:00', end: '17:00' }];
      const brks: Array<{ start_time: string; end_time: string }> = (bhRow as any)?.breaks || [];
      const singleBreak = (bhRow && (bhRow as any).break_start_time && (bhRow as any).break_end_time)
        ? [{ start_time: (bhRow as any).break_start_time, end_time: (bhRow as any).break_end_time }]
        : [];
      const allBreaks = [...brks, ...singleBreak];
      let windows = windowsBase as Array<{ start: string; end: string }>;
      for (const b of allBreaks) {
        const next: Array<{ start: string; end: string }> = [];
        for (const w of windows) {
          if (b.end_time <= w.start || b.start_time >= w.end) { next.push(w); continue; }
          if (w.start < b.start_time) next.push({ start: w.start, end: b.start_time });
          if (b.end_time < w.end) next.push({ start: b.end_time, end: w.end });
        }
        windows = next.filter(w => w.start < w.end);
      }

      // Subtract date-specific constraints
      const { data: constraintsRows } = await supabase
        .from('business_constraints')
        .select('start_time, end_time')
        .eq('date', selectedDate)
        .order('start_time');

      let windowsAfterConstraints = windows as Array<{ start: string; end: string }>;
      for (const c of (constraintsRows || []) as Array<{ start_time: string; end_time: string }>) {
        const next: Array<{ start: string; end: string }> = [];
        for (const w of windowsAfterConstraints) {
          if (c.end_time <= w.start || c.start_time >= w.end) { next.push(w); continue; }
          if (w.start < c.start_time) next.push({ start: w.start, end: c.start_time });
          if (c.end_time < w.end) next.push({ start: c.end_time, end: w.end });
        }
        windowsAfterConstraints = next.filter(w => w.start < w.end);
      }

      const normalized = windowsAfterConstraints
        .map(w => ({ startMin: toMinutes(w.start), endMin: toMinutes(w.end) }))
        .filter(w => w.startMin < w.endMin)
        .sort((a, b) => a.startMin - b.startMin);

      const times: string[] = [];
      const overlapsBusy = (startMin: number, endMin: number) => {
        return busyIntervals.some(b => Math.max(b.startMin, startMin) < Math.min(b.endMin, endMin));
      };
      const findPrevBusyEnd = (startMin: number) => {
        let prevEnd = -1;
        for (const b of busyIntervals) {
          if (b.endMin <= startMin && b.endMin > prevEnd) prevEnd = b.endMin;
        }
        return prevEnd; // -1 if none
      };
      const findNextBusyStart = (startMin: number) => {
        let nextStart = Number.POSITIVE_INFINITY;
        for (const b of busyIntervals) {
          if (b.startMin >= startMin && b.startMin < nextStart) nextStart = b.startMin;
        }
        return Number.isFinite(nextStart) ? nextStart : -1;
      };

      for (const w of normalized) {
        let tMin = w.startMin;
        while (tMin + durationMinutes <= w.endMin) {
          // Enforce break after the previous busy interval
          const prevEnd = findPrevBusyEnd(tMin);
          if (prevEnd >= 0) {
            const requiredStart = prevEnd + globalBreakMinutes;
            if (tMin < requiredStart) {
              tMin = requiredStart;
              continue;
            }
          }

          const endMin = tMin + durationMinutes;
          // Skip if overlaps an existing busy slot; jump to end of overlap to make progress
          if (overlapsBusy(tMin, endMin)) {
            const overlapped = busyIntervals.find(b => Math.max(b.startMin, tMin) < Math.min(b.endMin, endMin));
            if (overlapped) {
              tMin = overlapped.endMin;
              continue;
            }
          }

          // Enforce break before the next busy interval starts
          const nextStart = findNextBusyStart(tMin);
          if (nextStart >= 0 && (endMin + globalBreakMinutes) > nextStart) {
            tMin = nextStart + globalBreakMinutes;
            continue;
          }

          // Candidate is valid
          const tStr = toHHMM(tMin);
          times.push(tStr);
          tMin += durationMinutes;
        }
      }

      // filter past times if today
      const now = new Date();
      const isToday = new Date(selectedDate).toDateString() === now.toDateString();
      const filtered = isToday
        ? times.filter(t => {
            const [hh, mm] = t.split(':').map(n => parseInt(n, 10));
            const dt2 = new Date(selectedDate);
            dt2.setHours(hh, mm, 0, 0);
            return dt2.getTime() >= now.getTime();
          })
        : times;

      if (!isStaleLocal) setAvailableTimes(filtered);
    } catch (e) {
      setAvailableTimes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadTimes();
  }, [selectedDate, durationMinutes, globalBreakMinutes]);

  useFocusEffect(
    React.useCallback(() => {
      reloadTimes();
      return () => {};
    }, [selectedDate, durationMinutes])
  );

  const footerBottom = Math.max(insets.bottom, 16) + 80;
  const canBook = !!selectedTime && !booking;

  // Build phone variants (0XXXXXXXXX <-> +972XXXXXXXXX)
  const buildPhoneVariants = (phoneRaw: string) => {
    const variants = new Set<string>();
    const onlyDigits = phoneRaw.replace(/[^+\d]/g, '');
    if (onlyDigits) {
      variants.add(onlyDigits);
      if (onlyDigits.startsWith('0')) variants.add(`+972${onlyDigits.slice(1)}`);
      if (onlyDigits.startsWith('+972')) {
        const rest = onlyDigits.slice(4);
        if (rest && !rest.startsWith('0')) variants.add(`0${rest}`);
      }
    }
    return Array.from(variants);
  };

  // Find same-day existing appointment for this user
  const findSameDayAppointment = async (): Promise<any | null> => {
    try {
      const phone = (user?.phone || '').trim();
      const name = (user?.name || '').trim();
      const variants = buildPhoneVariants(phone);
      if (variants.length > 0) {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('slot_date', selectedDate)
          .eq('is_available', false)
          .in('client_phone', variants)
          .order('slot_time');
        if (error) return null;
        return (data && data.length > 0) ? data[0] : null;
      }
      if (name) {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('slot_date', selectedDate)
          .eq('is_available', false)
          .ilike('client_name', `%${name}%`)
          .order('slot_time');
        if (error) return null;
        return (data && data.length > 0) ? data[0] : null;
      }
      return null;
    } catch {
      return null;
    }
  };

  const cancelExistingAppointment = async (appointmentId: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({
        is_available: true,
        client_name: null,
        client_phone: null,
        service_name: null,
        appointment_id: null,
      })
      .eq('id', appointmentId);
    return !error;
  };

  const handleBook = async () => {
    if (!selectedTime) return;
    try {
      setBooking(true);
      // Try update existing free slot at date+time
      const { data: updated, error: updateError } = await supabase
        .from('appointments')
        .update({
          is_available: false,
          client_name: user?.name || 'לקוח',
          client_phone: user?.phone || '',
          service_name: serviceName,
          duration_minutes: durationMinutes,
        })
        .eq('slot_date', selectedDate)
        .eq('slot_time', selectedTime)
        .eq('is_available', true)
        .select()
        .maybeSingle();

      let success = updated;
      if (!updateError && !updated) {
        // Ensure no conflicting row exists
        const { data: existing } = await supabase
          .from('appointments')
          .select('id')
          .eq('slot_date', selectedDate)
          .eq('slot_time', selectedTime);
        if (!existing || existing.length === 0) {
          const { data: inserted } = await supabase
            .from('appointments')
            .insert([
              {
                slot_date: selectedDate,
                slot_time: selectedTime,
                is_available: false,
                client_name: user?.name || 'לקוח',
                client_phone: user?.phone || '',
                service_name: serviceName,
                duration_minutes: durationMinutes,
              },
            ])
            .select()
            .single();
          success = inserted;
        }
      }

      if (success) {
        const policyNote = '\n\nלתשומת לבך: אי אפשר לבטל את התור 48 שעות לפני מועד התור. ביטול בתקופה זו יחויב בתשלום על התור.';
        const message = `התור שלך ל"${serviceName}" נקבע ליום ${selectedDate} בשעה ${selectedTime}${policyNote}`;
        setSuccessMessage(message);
        setShowSuccessModal(true);
        try {
          const title = 'נקבע תור חדש';
          const content = `${user?.name || 'לקוח'} (${user?.phone || ''}) קבע/ה תור ל"${serviceName}" בתאריך ${selectedDate} בשעה ${selectedTime}`;
          notificationsApi.createAdminNotification(title, content, 'system').catch(() => {});
        } catch {}
        // Navigate safely without relying on multiple back actions
        // ניווט יקרה לאחר אישור חלון ההצלחה
      } else {
        Alert.alert('שגיאה', 'קביעת התור נכשלה. אנא נסה שוב.');
      }
    } catch (e) {
      Alert.alert('שגיאה', 'קביעת התור נכשלה. אנא נסה שוב.');
    } finally {
      setBooking(false);
    }
  };

  const onPressBook = async () => {
    if (!selectedTime) return;
    setCheckingSameDay(true);
    try {
      const existing = await findSameDayAppointment();
      if (existing) {
        setExistingAppointment(existing);
        setShowReplaceModal(true);
        return;
      }
      await handleBook();
    } finally {
      setCheckingSameDay(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={{ width: 22 }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>קביעת תור</Text>
            <Text style={styles.headerSubtitle}>בחר/י שירות, יום ושעה</Text>
          </View>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <View style={styles.contentWrapper}>
        <ScrollView contentContainerStyle={{ paddingBottom: footerBottom + 80 }}>
          <View style={styles.sectionHeaderRow}>
            <TouchableOpacity
              onPress={() => router.replace({ pathname: '/(client-tabs)/book-appointment' as any, params: { goto: 'dates', serviceName, selectedDate } as any } as any)}
              style={styles.backCircle}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward" size={18} color="#000000" />
            </TouchableOpacity>
            <Text style={[styles.sectionTitle, styles.sectionTitleCentered]}>בחירת שעה</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.timesList}>
            {loading ? (
              <View style={styles.loadingContainer}><Text style={styles.loadingText}>טוען שעות זמינות...</Text></View>
            ) : availableTimes.length > 0 ? (
              availableTimes.map((t) => {
                const isSel = selectedTime === t;
                return (
                  <TouchableOpacity key={t} style={[styles.timePill, isSel && styles.timePillSelected]} onPress={() => setSelectedTime(isSel ? null : t)} activeOpacity={0.9}>
                    <Text style={[styles.timePillLabel, isSel && styles.timePillLabelSelected]}>{t}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.loadingContainer}><Text style={styles.loadingText}>אין שעות פנויות ביום זה</Text></View>
            )}
          </View>
        </ScrollView>
      </View>

      <View style={[styles.footer, { bottom: Math.max(insets.bottom, 16) + 80 }]}>
        <TouchableOpacity
          style={[styles.bookBtn, (!canBook || checkingSameDay) && styles.bookBtnDisabled]}
          disabled={!canBook || checkingSameDay}
          onPress={onPressBook}
        >
          <Text style={styles.bookBtnText}>{booking ? 'קובע תור...' : (checkingSameDay ? 'בודק תור קיים...' : `קבע תור - ₪${params.price || 0}`)}</Text>
        </TouchableOpacity>
      </View>

      {existingAppointment && showReplaceModal && (
        <Modal
          visible={showReplaceModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowReplaceModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>יש לך תור קיים</Text>
              <Text style={styles.modalMessage} numberOfLines={0} allowFontScaling={false}>
                יש לך תור קיים ליום {existingAppointment?.slot_date ? new Date(existingAppointment.slot_date).toLocaleDateString('he-IL', { weekday: 'long', month: 'long', day: 'numeric' }) : 'לא ידוע'} בשעה {existingAppointment?.slot_time || 'לא ידוע'} לשירות {existingAppointment?.service_name || 'לא מוגדר'}.
                {'\n'}
                {'\n'}
                האם להחליף את התור הקיים ולקבוע את התור החדש לשעה {selectedTime} או לקבוע תור נוסף?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowReplaceModal(false)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.modalButtonCancelText}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonReplace]}
                  onPress={async () => {
                    setShowReplaceModal(false);
                    if (existingAppointment?.id) {
                      const ok = await cancelExistingAppointment(existingAppointment.id);
                      if (!ok) {
                        Alert.alert('שגיאה', 'ביטול התור הקיים נכשל');
                        return;
                      }
                    }
                    await handleBook();
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.modalButtonText}>החלף תור</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonBookAdditional]}
                  onPress={async () => {
                    setShowReplaceModal(false);
                    await handleBook();
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.modalButtonText}>קבע תור נוסף</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {showSuccessModal && (
        <Modal
          visible={showSuccessModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>תור נקבע בהצלחה!</Text>
              <Text style={styles.modalMessage} numberOfLines={0} allowFontScaling={false}>
                {successMessage}
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonReplace]}
                  onPress={() => {
                    setShowSuccessModal(false);
                    try {
                      (router as any).replace?.('/(client-tabs)/appointments');
                    } catch {
                      (router as any).push?.('/(client-tabs)/appointments');
                    }
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.modalButtonText}>הבנתי</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 104,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142,142,147,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 0,
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  sectionTitleCentered: {
    textAlign: 'center',
  },
  timesList: {
    gap: 14,
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  timePill: {
    alignSelf: 'center',
    width: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)'
  },
  timePillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timePillLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '800',
  },
  timePillLabelSelected: {
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  bookBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '88%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  bookBtnDisabled: {
    backgroundColor: '#8E8E93',
    shadowOpacity: 0,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  // Apple-like modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '86%',
    maxWidth: 440,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  modalMessage: {
    fontSize: 16,
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  modalButtonCancel: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalButtonReplace: {
    backgroundColor: '#FF9500',
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  modalButtonBookAdditional: {
    backgroundColor: '#34C759',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  modalButtonCancelText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});


