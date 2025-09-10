import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, Modal, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { Service } from '@/lib/supabase';
import { servicesApi } from '@/lib/api/services';
import { supabase } from '@/lib/supabase';
import { AvailableTimeSlot } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { notificationsApi } from '@/lib/api/notifications';
import { businessProfileApi } from '@/lib/api/businessProfile';


// API functions for booking appointments
const bookingApi = {
  // Get available time slots for a specific date
  async getAvailableSlots(date: string): Promise<AvailableTimeSlot[]> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('slot_date', date)
        .order('slot_time');

      if (error) {
        console.error('Error fetching available slots:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAvailableSlots:', error);
      throw error;
    }
  },

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

  // Book a time slot
  async bookTimeSlot(
    slotId: string, 
    clientName: string, 
    clientPhone: string, 
    serviceName: string,
    durationMinutes?: number
  ): Promise<AvailableTimeSlot | null> {
    try {
      const { data, error } = await supabase
            .from('appointments')
            .update({
                is_available: false,
                client_name: clientName,
                client_phone: clientPhone,
                service_name: serviceName,
                ...(typeof durationMinutes === 'number' ? { duration_minutes: durationMinutes } : {}),
            })
            .eq('id', slotId)
            .eq('is_available', true) // Only book if still available
            .select()
            .single();

        if (error || !data) {
            console.error('Error booking time slot:', error || 'No data returned');
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in bookTimeSlot:', error);
        throw error;
    }
  },

  // Book by date+time (creates a new row if no available row exists)
  async bookByDateTime(
    slotDate: string,
    slotTime: string,
    clientName: string,
    clientPhone: string,
    serviceName: string,
    durationMinutes?: number
  ): Promise<AvailableTimeSlot | null> {
    try {
      // First try to update an existing available row for this date/time
      const { data: updated, error: updateError } = await supabase
        .from('appointments')
        .update({
          is_available: false,
          client_name: clientName,
          client_phone: clientPhone,
          service_name: serviceName,
          ...(typeof durationMinutes === 'number' ? { duration_minutes: durationMinutes } : {}),
        })
        .eq('slot_date', slotDate)
        .eq('slot_time', slotTime)
        .eq('is_available', true)
        .select()
        .maybeSingle();

      if (!updateError && updated) {
        return updated as any;
      }

      // Ensure no conflicting booked row already exists
      const { data: existing } = await supabase
        .from('appointments')
        .select('id, is_available')
        .eq('slot_date', slotDate)
        .eq('slot_time', slotTime);

      if (existing && existing.length > 0) {
        // If there is already any row (booked or not available), prevent double-booking
        return null;
      }

      // Insert a new booked slot
      const { data: inserted, error: insertError } = await supabase
        .from('appointments')
        .insert([
          {
            slot_date: slotDate,
            slot_time: slotTime,
            is_available: false,
            client_name: clientName,
            client_phone: clientPhone,
            service_name: serviceName,
            duration_minutes: (typeof durationMinutes === 'number' ? durationMinutes : await (async () => {
              // Infer duration from services table if not provided
              const svc = (await supabase
                .from('services')
                .select('duration_minutes')
                .eq('name', serviceName)
                .maybeSingle()).data as any;
              return (svc && typeof svc.duration_minutes === 'number') ? svc.duration_minutes : 60;
            })()),
          },
        ])
        .select()
        .single();

      if (insertError || !inserted) {
        console.error('Error inserting time slot:', insertError);
        return null;
      }

      return inserted as any;
    } catch (error) {
      console.error('Error in bookByDateTime:', error);
      throw error;
    }
  },

  // Cancel a time slot booking
  async cancelTimeSlot(slotId: string): Promise<AvailableTimeSlot | null> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({
          is_available: true,
          client_name: null,
          client_phone: null,
          service_name: null,
          appointment_id: null,
        })
        .eq('id', slotId)
        .select()
        .single();

      if (error) {
        console.error('Error canceling time slot:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in cancelTimeSlot:', error);
      throw error;
    }
  },
};

// Generate next 7 days with Hebrew day names
const getNext7Days = () => {
  const today = new Date();
  const days = [];
  const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      date: date.getDate(),
      dayName: hebrewDays[date.getDay()],
      fullDate: date,
    });
  }
  
  return days;
};

export default function BookAppointment() {
  const router = useRouter();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const footerBottom = Math.max(insets.bottom, 16) + 80;
  const params = (router as any).useLocalSearchParams?.() || {};
  
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isCheckingAppointments, setIsCheckingAppointments] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [existingAppointment, setExistingAppointment] = useState<any>(null);
  const [modalType, setModalType] = useState<'confirm' | 'replace'>('confirm');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [dayAvailability, setDayAvailability] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [globalBreakMinutes, setGlobalBreakMinutes] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  // Reset all local state when the screen gains focus so each visit starts fresh
  useFocusEffect(
    React.useCallback(() => {
      const preserve = (globalThis as any).__preserve_booking_state_on_focus__ === true;
      if (preserve) {
        // Coming back from select-time → keep selections and show day step
        setCurrentStep(2);
        (globalThis as any).__preserve_booking_state_on_focus__ = false;
        return () => {};
      }

      setCurrentStep(1);
      setSelectedService(null);
      setSelectedDay(null);
      setSelectedTime(null);
      setAvailableSlots([]);
      setIsLoadingSlots(false);
      setShowConfirmModal(false);
      setShowReplaceModal(false);
      setExistingAppointment(null);
      setDayAvailability({});
      return () => {};
    }, [])
  );
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



  const days = getNext7Days();
  const selectedDate = selectedDay !== null ? days[selectedDay]?.fullDate : null;
  const footerVisible =
    (currentStep === 1 && !!selectedService) ||
    (currentStep === 2 && selectedDay !== null) ||
    currentStep === 3;
  const buttonHeight = 56;
  const contentBottomPadding = footerVisible
    ? footerBottom + buttonHeight + 12
    : 96;
  
  // Compute available start times dynamically for the selected service and date using business_hours
  const getAvailableTimeSlotsForDate = () => {
    if (!selectedDate) return [];
    const serviceDuration = selectedService?.duration_minutes || 60;
    const dateStr = selectedDate.toISOString().split('T')[0];
    const dow = selectedDate.getDay(); // 0..6

    // Gather busy intervals (start/end minutes) for that date
    type Busy = { startMin: number; endMin: number };
    const busyIntervals: Busy[] = (() => {
      const toMinutes = (time: string) => {
        const parts = String(time).split(':');
        const h = parseInt(parts[0] || '0', 10);
        const m = parseInt(parts[1] || '0', 10);
        return h * 60 + m;
      };
      return (availableSlots || [])
        .filter(s => String(s.slot_date) === dateStr && s.is_available === false)
        .map(s => {
          const startMin = toMinutes(String(s.slot_time));
          const dur = typeof s.duration_minutes === 'number' ? s.duration_minutes : 60;
          return { startMin, endMin: startMin + dur } as Busy;
        })
        .sort((a, b) => a.startMin - b.startMin);
    })();

    // Business hour windows for the selected day of week
    const dayWindows = (globalThis as any).__bh_windows__?.[dow] as Array<{ start: string; end: string }> | undefined;
    const windows = (dayWindows && dayWindows.length > 0)
      ? dayWindows
      : [{ start: '09:00', end: '17:00' }];

    // Robust time helpers (support HH:MM or HH:MM:SS; compare numerically; never wrap over midnight)
    const toMinutes = (time: string) => {
      const parts = String(time).split(':');
      const h = parseInt(parts[0] || '0', 10);
      const m = parseInt(parts[1] || '0', 10);
      return h * 60 + m;
    };
    const toHHMM = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Sort windows by start time in minutes
    const normalizedWindows = windows
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

    for (const w of normalizedWindows) {
      let tMin = w.startMin;
      while (tMin + serviceDuration <= w.endMin) {
        // Enforce break after the previous busy interval
        const prevEnd = findPrevBusyEnd(tMin);
        if (prevEnd >= 0) {
          const requiredStart = prevEnd + globalBreakMinutes;
          if (tMin < requiredStart) {
            tMin = requiredStart;
            continue;
          }
        }

        const endMin = tMin + serviceDuration;
        // Skip if overlaps an existing busy slot
        if (overlapsBusy(tMin, endMin)) {
          // Jump to the end of the overlapping interval to avoid small steps
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
        tMin += serviceDuration;
      }
    }

    // Filter-out past times if today
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    const filtered = isToday
      ? times.filter(t => {
          const [hh, mm] = t.split(':').map((x) => parseInt(x, 10));
          const dt = new Date(selectedDate);
          dt.setHours(hh, mm, 0, 0);
          return dt.getTime() >= now.getTime();
        })
      : times;
    return filtered;
  };
  
  const availableTimeSlots = getAvailableTimeSlotsForDate();

  // Check if user has any booked appointment on a specific date (match by phone variants; fallback to name)
  const checkUserAppointmentsOnDate = async (dateString: string) => {
    try {
      const phoneRaw = (user?.phone || '').trim();
      const nameRaw = (user?.name || '').trim();

      const phoneVariants = (() => {
        if (!phoneRaw) return [] as string[];
        const variants = new Set<string>();
        const onlyDigits = phoneRaw.replace(/[^+\d]/g, '');
        variants.add(onlyDigits);
        // 0XXXXXXXXX ↔ +972XXXXXXXXX conversion (Israel)
        if (onlyDigits.startsWith('0')) {
          variants.add(`+972${onlyDigits.slice(1)}`);
        }
        if (onlyDigits.startsWith('+972')) {
          const rest = onlyDigits.slice(4);
          if (rest && !rest.startsWith('0')) variants.add(`0${rest}`);
        }
        return Array.from(variants);
      })();

      let data: any[] | null = null;
      let error: any = null;

      if (phoneVariants.length > 0) {
        const res = await supabase
          .from('appointments')
          .select('*')
          .eq('slot_date', dateString)
          .eq('is_available', false)
          .in('client_phone', phoneVariants)
          .order('slot_time');
        data = res.data as any[] | null;
        error = res.error;
      } else if (nameRaw) {
        const res = await supabase
          .from('appointments')
          .select('*')
          .eq('slot_date', dateString)
          .eq('is_available', false)
          .ilike('client_name', `%${nameRaw}%`)
          .order('slot_time');
        data = res.data as any[] | null;
        error = res.error;
      } else {
        // Fallback: fetch none
        data = [];
      }

      if (error) {
        console.error('Error checking appointments for date:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error checking appointments for date:', error);
      return [];
    }
  };

  // Fetch booked slots WHEN date changes and also load business hours windows for that day
  useEffect(() => {
    let isStale = false;
    const fetchSlots = async () => {
      if (selectedDay === null) return;
      setIsLoadingSlots(true);
      try {
        const date = days[selectedDay].fullDate;
        const dateString = date.toISOString().split('T')[0];
        const slots = await bookingApi.getAvailableSlots(dateString);
        // Load business hours for DOW and cache time windows on global for this session
        const dayOfWeek = date.getDay();
        const { data: bhRow } = await supabase
          .from('business_hours')
          .select('*')
          .eq('day_of_week', dayOfWeek)
          .eq('is_active', true)
          .maybeSingle();
        if (!isStale && bhRow) {
          type Window = { start: string; end: string };
          const base: Window[] = [{ start: bhRow.start_time, end: bhRow.end_time }];
          const brks: Array<{ start_time: string; end_time: string }> = (bhRow as any).breaks || [];
          const singleBreak = (bhRow.break_start_time && bhRow.break_end_time)
            ? [{ start_time: bhRow.break_start_time, end_time: bhRow.break_end_time }]
            : [];
          const allBreaks = [...brks, ...singleBreak];
          let windows: Window[] = base;
          for (const b of allBreaks) {
            const next: Window[] = [];
            for (const w of windows) {
              if (b.end_time <= w.start || b.start_time >= w.end) { next.push(w); continue; }
              if (w.start < b.start_time) next.push({ start: w.start, end: b.start_time });
              if (b.end_time < w.end) next.push({ start: b.end_time, end: w.end });
            }
            windows = next.filter(w => w.start < w.end);
          }
          // Subtract date-specific constraints
          try {
            const { data: constraintsRows } = await supabase
              .from('business_constraints')
              .select('start_time, end_time')
              .eq('date', dateString)
              .order('start_time');
            for (const c of (constraintsRows || []) as Array<{ start_time: string; end_time: string }>) {
              const next: Window[] = [];
              for (const w of windows) {
                if (c.end_time <= w.start || c.start_time >= w.end) { next.push(w); continue; }
                if (w.start < c.start_time) next.push({ start: w.start, end: c.start_time });
                if (c.end_time < w.end) next.push({ start: c.end_time, end: w.end });
              }
              windows = next.filter(w => w.start < w.end);
            }
          } catch {}
          (globalThis as any).__bh_windows__ = (globalThis as any).__bh_windows__ || {};
          (globalThis as any).__bh_windows__[dayOfWeek] = windows;
        }
        if (!isStale) {
          setAvailableSlots(slots);
        }
      } catch (error) {
        console.error('Error fetching slots:', error);
      } finally {
        if (!isStale) {
          setIsLoadingSlots(false);
        }
      }
    };
    if (selectedDay !== null) {
      fetchSlots();
    } else {
      setAvailableSlots([]);
      setIsLoadingSlots(false);
    }
    return () => { isStale = true; };
  }, [selectedDay]);

  // When service changes, reset selected day and time
  useEffect(() => {
    setSelectedDay(null);
    setSelectedTime(null);
    setAvailableSlots([]);
    setIsLoadingSlots(false);
    setShowConfirmModal(false);
    setShowReplaceModal(false);
    setExistingAppointment(null);
    setCurrentStep(1);
  }, [selectedService?.id]);

  // If navigated back from select-time asking to open dates screen
  useEffect(() => {
    try {
      const goto = (params as any)?.goto;
      if (goto === 'dates') {
        setCurrentStep(2);
      }
    } catch {}
  }, [params]);

  // Fetch services from Supabase
  const loadServices = async () => {
    setIsLoadingServices(true);
    try {
      const list = await servicesApi.getAllServices();
      setAvailableServices(list);
    } catch (e) {
      setAvailableServices([]);
    } finally {
      setIsLoadingServices(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  // Prefetch availability for next 7 days when entering day selection
  useEffect(() => {
    let isStale = false;
    const prefetch = async () => {
      if (currentStep !== 2 || !selectedService) return;
      try {
        const toMinutes = (time: string) => {
          const [h, m] = String(time).split(':');
          return (parseInt(h || '0', 10) * 60) + parseInt(m || '0', 10);
        };
        const toHHMM = (mins: number) => {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        const checks = await Promise.all(days.map(async (d) => {
          const dateStr = d.fullDate.toISOString().split('T')[0];
          // fetch existing appointments for that date
          const slots = await bookingApi.getAvailableSlots(dateStr);
          const busyIntervals: { startMin: number; endMin: number }[] = (() => {
            const toMinutes = (time: string) => {
              const parts = String(time).split(':');
              const h = parseInt(parts[0] || '0', 10);
              const m = parseInt(parts[1] || '0', 10);
              return h * 60 + m;
            };
            return (slots || [])
              .filter(s => s.is_available === false)
              .map(s => {
                const startMin = toMinutes(String(s.slot_time));
                const dur = typeof (s as any).duration_minutes === 'number' ? (s as any).duration_minutes : 60;
                return { startMin, endMin: startMin + dur };
              })
              .sort((a, b) => a.startMin - b.startMin);
          })();
          // fetch business hours for that day of week
          const dow = d.fullDate.getDay();
          const { data: bhRow } = await supabase
            .from('business_hours')
            .select('*')
            .eq('day_of_week', dow)
            .eq('is_active', true)
            .maybeSingle();
          if (!bhRow) return [dateStr, 0] as const;
          type Window = { start: string; end: string };
          const base: Window[] = [{ start: bhRow.start_time, end: bhRow.end_time }];
          const brks: Array<{ start_time: string; end_time: string }> = (bhRow as any).breaks || [];
          const singleBreak = (bhRow.break_start_time && bhRow.break_end_time)
            ? [{ start_time: bhRow.break_start_time, end_time: bhRow.break_end_time }]
            : [];
          const allBreaks = [...brks, ...singleBreak];
          let windows: Window[] = base;
          for (const b of allBreaks) {
            const next: Window[] = [];
            for (const w of windows) {
              if (b.end_time <= w.start || b.start_time >= w.end) { next.push(w); continue; }
              if (w.start < b.start_time) next.push({ start: w.start, end: b.start_time });
              if (b.end_time < w.end) next.push({ start: b.end_time, end: w.end });
            }
            windows = next.filter(w => w.start < w.end);
          }
          // Subtract date-specific constraints
          try {
            const { data: constraintsRows } = await supabase
              .from('business_constraints')
              .select('start_time, end_time')
              .eq('date', dateStr)
              .order('start_time');
            for (const c of (constraintsRows || []) as Array<{ start_time: string; end_time: string }>) {
              const next: Window[] = [];
              for (const w of windows) {
                if (c.end_time <= w.start || c.start_time >= w.end) { next.push(w); continue; }
                if (w.start < c.start_time) next.push({ start: w.start, end: c.start_time });
                if (c.end_time < w.end) next.push({ start: c.end_time, end: w.end });
              }
              windows = next.filter(w => w.start < w.end);
            }
          } catch {}

          const normalized = windows
            .map(w => ({ startMin: toMinutes(w.start), endMin: toMinutes(w.end) }))
            .filter(w => w.startMin < w.endMin)
            .sort((a, b) => a.startMin - b.startMin);
          const serviceDuration = selectedService.duration_minutes ?? 60;
          let availableCount = 0;
          const now = new Date();
          const isSameDay = d.fullDate.toDateString() === now.toDateString();
          const findPrevBusyEnd = (startMin: number) => {
            let prevEnd = -1;
            for (const b of busyIntervals) {
              if (b.endMin <= startMin && b.endMin > prevEnd) prevEnd = b.endMin;
            }
            return prevEnd;
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
            while (tMin + serviceDuration <= w.endMin) {
              // Enforce break after previous busy
              const prevEnd = findPrevBusyEnd(tMin);
              if (prevEnd >= 0) {
                const requiredStart = prevEnd + globalBreakMinutes;
                if (tMin < requiredStart) {
                  tMin = requiredStart;
                  continue;
                }
              }
              const tStr = toHHMM(tMin);
              const hh = Math.floor(tMin / 60);
              const mm = tMin % 60;
              const dtCandidate = new Date(d.fullDate);
              dtCandidate.setHours(hh, mm, 0, 0);
              const isFutureOrNotToday = !isSameDay || dtCandidate.getTime() >= now.getTime();
              // Skip if overlaps an existing busy interval
              const overlaps = busyIntervals.some(b => Math.max(b.startMin, tMin) < Math.min(b.endMin, tMin + serviceDuration));
              // Enforce break before next busy
              const endMin = tMin + serviceDuration;
              const nextStart = findNextBusyStart(tMin);
              const violatesNextBreak = nextStart >= 0 && (endMin + globalBreakMinutes) > nextStart;
              if (isFutureOrNotToday && !overlaps && !violatesNextBreak) availableCount += 1;
              tMin += serviceDuration;
            }
          }
          return [dateStr, availableCount] as const;
        }));

        if (!isStale) {
          const map: Record<string, number> = {};
          checks.forEach(([ds, cnt]) => { map[ds] = cnt; });
          setDayAvailability(map);
        }
      } catch {
        if (!isStale) setDayAvailability({});
      }
    };
    prefetch();
    return () => { isStale = true; };
  }, [currentStep, selectedService, refreshTick]);

  // Explicitly refresh slots for the currently selected day (used by pull-to-refresh)
  const refreshSelectedDaySlots = async () => {
    if (selectedDay === null) return;
    setIsLoadingSlots(true);
    try {
      const date = days[selectedDay].fullDate;
      const dateString = date.toISOString().split('T')[0];
      const slots = await bookingApi.getAvailableSlots(dateString);
      // Refresh business hours windows cache for this DOW
      const dayOfWeek = date.getDay();
      const { data: bhRow } = await supabase
        .from('business_hours')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .maybeSingle();
      if (bhRow) {
        type Window = { start: string; end: string };
        const base: Window[] = [{ start: bhRow.start_time, end: bhRow.end_time }];
        const brks: Array<{ start_time: string; end_time: string }> = (bhRow as any).breaks || [];
        const singleBreak = (bhRow.break_start_time && bhRow.break_end_time)
          ? [{ start_time: bhRow.break_start_time, end_time: bhRow.break_end_time }]
          : [];
        const allBreaks = [...brks, ...singleBreak];
        let windows: Window[] = base;
        for (const b of allBreaks) {
          const next: Window[] = [];
          for (const w of windows) {
            if (b.end_time <= w.start || b.start_time >= w.end) { next.push(w); continue; }
            if (w.start < b.start_time) next.push({ start: w.start, end: b.start_time });
            if (b.end_time < w.end) next.push({ start: b.end_time, end: w.end });
          }
          windows = next.filter(w => w.start < w.end);
        }
        // Subtract date-specific constraints as well
        try {
          const { data: constraintsRows } = await supabase
            .from('business_constraints')
            .select('start_time, end_time')
            .eq('date', dateString)
            .order('start_time');
          for (const c of (constraintsRows || []) as Array<{ start_time: string; end_time: string }>) {
            const next: Window[] = [];
            for (const w of windows) {
              if (c.end_time <= w.start || c.start_time >= w.end) { next.push(w); continue; }
              if (w.start < c.start_time) next.push({ start: w.start, end: c.start_time });
              if (c.end_time < w.end) next.push({ start: c.end_time, end: w.end });
            }
            windows = next.filter(w => w.start < w.end);
          }
        } catch {}
        (globalThis as any).__bh_windows__ = (globalThis as any).__bh_windows__ || {};
        (globalThis as any).__bh_windows__[dayOfWeek] = windows;
      }
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error refreshing selected day slots:', error);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Pull-to-refresh handler: reload services and re-trigger slot/availability effects
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadServices();
      // Recompute availability summaries
      setRefreshTick((t) => t + 1);
      // Also refresh concrete slots for the currently selected day (if any)
      await refreshSelectedDaySlots();
    } finally {
      setRefreshing(false);
    }
  };

  // Function to actually book the appointment
  const proceedWithBooking = async (existingAppointmentToCancel?: any) => {
    if (!selectedService || selectedTime === null || selectedDay === null) {
      return;
    }

    const dateString = selectedDate?.toISOString().split('T')[0];
    // Guard: disallow booking in constrained windows
    try {
      const { data: constraintsRows } = await supabase
        .from('business_constraints')
        .select('start_time, end_time')
        .eq('date', dateString)
        .order('start_time');
      const withinConstraint = (t: string) => {
        return (constraintsRows || []).some((c: any) => {
          const s = String(c.start_time).slice(0,5);
          const e = String(c.end_time).slice(0,5);
          return s <= t && t < e;
        });
      };
      if (withinConstraint(selectedTime)) {
        Alert.alert('לא ניתן לקבוע', 'קיימים אילוצים בשעה/תאריך שבחרת. אנא בחר/י זמן אחר.');
        return;
      }
    } catch {}
    // קיימים שני תרחישים:
    // 1) יש שורה זמינה עבור התאריך/שעה → נעדכן אותה ל-booked
    // 2) אין שורה זמינה → ניצור שורה חדשה כ-booked
    const slotToBook = availableSlots.find(
      slot => slot.slot_date === dateString && 
              slot.slot_time === selectedTime && 
              slot.is_available
    );

    setIsBooking(true);
    try {
      // Cancel existing appointment if provided
      if (existingAppointmentToCancel) {
        const cancelSuccess = await bookingApi.cancelTimeSlot(existingAppointmentToCancel.id);
        if (!cancelSuccess) {
          console.error('Failed to cancel existing appointment');
          Alert.alert('שגיאה', 'שגיאה בביטול התור הקיים. אנא נסה שוב.');
          return;
        }
      }

      // Book slot (update existing if available, else insert new row)
      const durationMinutes = selectedService.duration_minutes ?? 60;
      const success = slotToBook
        ? await bookingApi.bookTimeSlot(
            slotToBook.id,
            user?.name || 'לקוח',
            user?.phone || '',
            selectedService.name,
            durationMinutes
          )
        : await bookingApi.bookByDateTime(
            dateString!,
            selectedTime,
            user?.name || 'לקוח',
            user?.phone || '',
            selectedService.name,
            durationMinutes
          );

      if (success) {
        const policyNote = '\n\nלתשומת לבך: אי אפשר לבטל את התור 48 שעות לפני מועד התור. ביטול בתקופה זו יחויב בתשלום על התור.';
        const message = existingAppointmentToCancel 
          ? `התור הקודם בוטל והתור החדש נקבע בהצלחה!\nהתור החדש ל${selectedService.name} נקבע ליום ${days[selectedDay].dayName} ${days[selectedDay].date} בשעה ${selectedTime}${policyNote}`
          : `התור שלך ל${selectedService.name} נקבע ליום ${days[selectedDay].dayName} ${days[selectedDay].date} בשעה ${selectedTime}${policyNote}`;

        setSuccessMessage(message);
        setShowSuccessModal(true);

        // Notify admins about the new booking
        try {
          const title = 'נקבע תור חדש';
          const dateString = selectedDate?.toISOString().split('T')[0];
          const content = `${user?.name || 'לקוח'} (${user?.phone || ''}) קבע/ה תור ל"${selectedService.name}" בתאריך ${dateString} בשעה ${selectedTime}`;
          notificationsApi.createAdminNotification(title, content, 'system').catch(() => {});
        } catch {}

        // Create a notification for the client
        try {
          if (user?.phone && user.phone.trim() !== '') {
            const notifTitle = 'התור שלך נקבע';
            const notifContent = `התור שלך ל"${selectedService.name}" נקבע ליום ${days[selectedDay].dayName} ${days[selectedDay].date} בשעה ${selectedTime}`;
            await notificationsApi.createNotification({
              title: notifTitle,
              content: notifContent,
              type: 'appointment_reminder',
              recipient_name: user?.name || 'לקוח',
              recipient_phone: user.phone.trim(),
            });
          }
        } catch {}

        // הניווט יתבצע לאחר אישור בחלון ההצלחה
      } else {
        console.error('Booking failed');
        Alert.alert('שגיאה', 'קביעת התור נכשלה. אנא נסה שוב.');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert('שגיאה', 'קביעת התור נכשלה. אנא נסה שוב.');
    } finally {
      setIsBooking(false);
    }
  };

  // Move the booking logic to execute only after confirmation in the modal
  const handleBookAppointment = async () => {
    if (!selectedService || selectedTime === null || selectedDay === null) {
      Alert.alert('שגיאה', 'אנא בחר תאריך, שעה ושירות לפני קביעת התור');
      return;
    }

    const dateString = selectedDate?.toISOString().split('T')[0];
    const slotToBook = availableSlots.find(
      slot => slot.slot_date === dateString && 
              slot.slot_time === selectedTime && 
              slot.is_available
    );

    setIsCheckingAppointments(true);
    
    // Check if user has an existing appointment on the selected day
    try {
      const sameDayAppointments = await checkUserAppointmentsOnDate(dateString!);
      if (sameDayAppointments.length > 0) {
        const existing = sameDayAppointments[0];
        setExistingAppointment(existing);
        setModalType('replace');
        setShowReplaceModal(true);
      } else {
        setModalType('confirm');
        setShowConfirmModal(true);
      }
    } catch (error) {
      console.error('Error checking same-day appointments:', error);
      setModalType('confirm');
      setShowConfirmModal(true);
    } finally {
      setIsCheckingAppointments(false);
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
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />}
        >

        {/* Step 1: Service Selection */}
        {currentStep === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.sectionTitleCentered]}>בחירת שירות</Text>
            {isLoadingServices ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>טוען שירותים...</Text>
              </View>
            ) : (
              <View style={styles.servicesGrid}>
                {availableServices.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.serviceCardGrid,
                      selectedService?.id === service.id && styles.serviceCardSelected
                    ]}
                    onPress={() => {
                      const isSame = selectedService?.id === service.id;
                      setSelectedService(isSame ? null : service);
                      setSelectedDay(null);
                      setSelectedTime(null);
                      setAvailableSlots([]);
                      setIsLoadingSlots(false);
                      setShowConfirmModal(false);
                      setShowReplaceModal(false);
                      setExistingAppointment(null);
                    }}
                    activeOpacity={0.9}
                  >
                    <View style={styles.imageWrapper}>
                      {service.image_url ? (
                        <Image source={{ uri: service.image_url }} style={styles.serviceImage} />
                      ) : (
                        <View style={[styles.serviceImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' }]}> 
                          <Ionicons name="image-outline" size={28} color="rgba(0,0,0,0.3)" />
                        </View>
                      )}
                      <View style={styles.priceBadge}>
                        <Text style={styles.priceBadgeText}>₪{service.price}</Text>
                      </View>
                      {selectedService?.id === service.id && (
                        <View style={styles.selectedIndicator}>
                          <Ionicons name="checkmark" size={16} color={Colors.white} />
                        </View>
                      )}
                    </View>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <View style={styles.infoRow}>
                        <View style={styles.durationChip}>
                          <Ionicons name="time-outline" size={12} color="rgba(0,0,0,0.6)" />
                          <Text style={styles.durationChipText}>{(service.duration_minutes ?? 60)} דק'</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Step 2: Day Selection */}
        {currentStep >= 2 && selectedService && (
          <View style={styles.section}>
            <View style={styles.dayHeaderRow}>
              <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.backCircle} activeOpacity={0.8}>
                <Ionicons name="arrow-forward" size={18} color="#000000" />
              </TouchableOpacity>
              <Text style={[styles.sectionTitle, styles.sectionTitleCentered]}>בחירת יום</Text>
              <View style={{ width: 36 }} />
            </View>
            <View style={styles.daysList}>
              {days.map((day, idx) => {
                const dsIso = day.fullDate.toISOString().split('T')[0];
                const dd = String(day.fullDate.getDate()).padStart(2, '0');
                const mm = String(day.fullDate.getMonth() + 1).padStart(2, '0');
                const yy = String(day.fullDate.getFullYear()).slice(-2);
                const dsPretty = `${dd}/${mm}/${yy}`;
                const hasAvail = (dayAvailability[dsIso] ?? 0) > 0;
                const isToday = new Date().toDateString() === day.fullDate.toDateString();
                const label = isToday ? 'היום' : day.dayName;
                const isSelected = selectedDay === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayPill,
                      !hasAvail && styles.dayPillUnavailable,
                      isSelected && hasAvail && styles.dayPillSelected,
                      isSelected && !hasAvail && styles.dayPillUnavailableSelected,
                    ]}
                    onPress={() => {
                      const isSame = selectedDay === idx;
                      setSelectedDay(isSame ? null : idx);
                      setSelectedTime(null);
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={[
                      styles.dayPillDate,
                      !hasAvail && styles.dayPillDateEm,
                      isSelected && styles.dayPillDateSelected,
                    ]}>{dsPretty}</Text>
                    <Text style={[
                      styles.dayPillLabel,
                      !hasAvail && styles.dayPillLabelEm,
                      isSelected && styles.dayPillLabelSelected,
                    ]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.daysLegend}>* ימים ללא תורים פנויים מסומנים באדום</Text>
            <Text style={styles.daysLegendSecondary}>
              * גם אם אין תורים פנויים – אפשר ללחוץ על היום ולהצטרף לרשימת ההמתנה לאותו היום
            </Text>
          </View>
        )}

        {/* Step 3: Time Selection (new screen-like) */}
        {currentStep >= 3 && selectedService && selectedDay !== null && (
          <View style={styles.section}>
            <View style={styles.dayHeaderRow}>
              <TouchableOpacity onPress={() => setCurrentStep(2)} style={styles.backCircle} activeOpacity={0.8}>
                <Ionicons name="arrow-forward" size={18} color="#000000" />
              </TouchableOpacity>
              <Text style={[styles.sectionTitle, styles.sectionTitleCentered]}>בחירת שעה</Text>
              <View style={{ width: 36 }} />
            </View>
            {isLoadingSlots ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>טוען שעות זמינות...</Text>
              </View>
            ) : availableTimeSlots.length > 0 ? (
              <View style={styles.timesList}>
                {availableTimeSlots.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.timePill, isSelected && styles.timePillSelected]}
                      onPress={() => setSelectedTime(isSelected ? null : slot)}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.timePillLabel, isSelected && styles.timePillLabelSelected]}>{slot}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noSlotsContainer}>
                <Ionicons name="time-outline" size={48} color="rgba(0,0,0,0.35)" />
                <Text style={styles.noSlotsText}>אין שעות פנויות ביום זה</Text>
              </View>
            )}
          </View>
        )}
        </ScrollView>
      </View>

      {/* Footer action button per step */}
      {footerVisible && (
        <View style={[styles.bookingFooter, { bottom: footerBottom }]}>
          {currentStep === 1 && selectedService && (
            <TouchableOpacity
              style={[styles.bookBtn]}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={styles.bookBtnText}>המשך לבחירת יום</Text>
            </TouchableOpacity>
          )}
        {currentStep === 2 && selectedDay !== null && (() => {
          const dateStr = selectedDate?.toISOString().split('T')[0] || '';
          const hasAvailForSelected = dateStr ? ((dayAvailability[dateStr] ?? 0) > 0) : false;
          if (hasAvailForSelected) {
            return (
              <TouchableOpacity
                style={[
                  styles.bookBtn,
                  (isBooking || isCheckingAppointments) && styles.bookBtnDisabled
                ]}
                onPress={() => {
                  (globalThis as any).__preserve_booking_state_on_focus__ = true;
                  router.push({
                    pathname: '/(client-tabs)/select-time' as any,
                    params: {
                      serviceName: selectedService?.name || '',
                      durationMinutes: String(selectedService?.duration_minutes ?? 60),
                      price: String(selectedService?.price ?? 0),
                      selectedDate: dateStr,
                    } as any,
                  } as any);
                }}
                disabled={isBooking || isCheckingAppointments}
              >
                <Text style={styles.bookBtnText}>המשך לבחירת שעה</Text>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              style={styles.waitlistButton}
              onPress={() => {
                router.push({
                  pathname: '/(client-tabs)/waitlist' as any,
                  params: {
                    serviceName: selectedService?.name || 'שירות כללי',
                    selectedDate: dateStr,
                  } as any,
                } as any);
              }}
              activeOpacity={0.9}
            >
              <Ionicons name="hourglass" size={18} color="#FFFFFF" />
              <Text style={styles.waitlistButtonText}>היכנס לרשימת המתנה</Text>
            </TouchableOpacity>
          );
        })()}
        {currentStep === 3 && (
          <TouchableOpacity 
            style={[
              styles.bookBtn,
              (!selectedService || selectedTime === null || isBooking || isCheckingAppointments) && styles.bookBtnDisabled
            ]}
            onPress={handleBookAppointment}
            disabled={!selectedService || selectedTime === null || isBooking || isCheckingAppointments}
          >
            <Text style={styles.bookBtnText}>
              {isBooking ? 'קביעת תור...' : 
               isCheckingAppointments ? 'בודק תורים קיימים...' : 
               `קבע תור - ₪${selectedService?.price || 0}`}
            </Text>
          </TouchableOpacity>
        )}
        </View>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <Modal
          visible={showConfirmModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>אישור קביעת תור</Text>
              <Text style={styles.modalMessage} numberOfLines={0} allowFontScaling={false}>
                שירות: {selectedService?.name}
                {'\n'}
                תאריך: {selectedDay !== null ? `${days[selectedDay].dayName} ${days[selectedDay].date}` : ''}
                {'\n'}
                שעה: {selectedTime}
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.modalButtonCancelText}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={() => {
                    setShowConfirmModal(false);
                    proceedWithBooking();
                  }}
                >
                  <Text style={styles.modalButtonText}>אישור</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Replace Confirmation Modal */}
      {existingAppointment && showReplaceModal && (
        <Modal
          visible={showReplaceModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowReplaceModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>יש לך תור קיים</Text>
              <Text style={styles.modalMessage} numberOfLines={0} allowFontScaling={false}>
                יש לך תור קיים ליום {existingAppointment?.slot_date ? new Date(existingAppointment.slot_date).toLocaleDateString('he-IL', { 
                 weekday: 'long', 
                 month: 'long', 
                 day: 'numeric' 
               }) : 'לא ידוע'} בשעה {existingAppointment?.slot_time || 'לא ידוע'} לשירות {existingAppointment?.service_name || 'לא מוגדר'}.
                {'\n'}
                {'\n'}
                האם אתה רוצה לבטל את התור הקיים ולקבוע תור חדש ליום {selectedDay !== null ? `${days[selectedDay].dayName} ${days[selectedDay].date}` : ''} בשעה {selectedTime}?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowReplaceModal(false)}
                >
                  <Text style={styles.modalButtonCancelText}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonReplace]}
                  onPress={() => {
                    setShowReplaceModal(false);
                    if (existingAppointment) {
                      proceedWithBooking(existingAppointment);
                    }
                  }}
                >
                  <Text style={styles.modalButtonText}>החלף תור</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonBookAdditional]}
                  onPress={() => {
                    setShowReplaceModal(false);
                    proceedWithBooking();
                  }}
                >
                  <Text style={styles.modalButtonText}>קבע תור נוסף</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Success Modal (Apple-style) */}
      {showSuccessModal && (
        <Modal
          visible={showSuccessModal}
          animationType="fade"
          transparent={true}
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
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={() => {
                    setShowSuccessModal(false);
                    try {
                      (router as any).replace?.('/(client-tabs)/appointments');
                    } catch {
                      router.back();
                    }
                  }}
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
  topSafeArea: {
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
    marginBottom: 0,
  },
  scrollContent: {
    paddingBottom: 96,
  },
  bookingFooter: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  sectionFixedTitle: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  header: {
    height: 104,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
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
  placeholder: {
    width: 36,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  sectionTitleCentered: {
    textAlign: 'center',
  },
  servicesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  serviceCard: {
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginLeft: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceCardSelected: {
    borderColor: Colors.primary,
    shadowOpacity: 0.15,
    transform: [{ scale: 1.02 }],
  },
  serviceCardGrid: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(142, 142, 147, 0.12)',
    marginBottom: 12,
  },
  imageWrapper: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F8F8F8',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceInfo: {
    padding: 14,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 10,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F2',
    borderColor: '#E5E5E5',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  durationChipText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  priceBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(142,142,147,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  daysRow: {
    flexGrow: 0,
    paddingHorizontal: 0,
  },
  dayBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    minWidth: 70,
    borderWidth: 1,
    borderColor: 'rgba(142, 142, 147, 0.2)',
  },
  dayBtnSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowOpacity: 0.15,
    transform: [{ scale: 1.05 }],
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142,142,147,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysList: {
    gap: 14,
    paddingTop: 8,
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)'
  },
  dayPillUnavailable: {
    borderColor: 'rgba(255,59,48,0.35)',
  },
  dayPillUnavailableSelected: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
    shadowOpacity: 0.18,
  },
  dayPillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowOpacity: 0.18,
  },
  dayPillDate: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '700',
  },
  dayPillDateEm: {
    color: '#DC2626',
  },
  dayPillDateSelected: {
    color: '#FFFFFF',
  },
  dayPillLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '800',
  },
  dayPillLabelEm: {
    color: '#DC2626',
  },
  dayPillLabelSelected: {
    color: '#FFFFFF',
  },
  timesList: {
    gap: 14,
    paddingTop: 8,
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
  daysLegend: {
    marginTop: 10,
    textAlign: 'right',
    color: '#1C1C1E',
    fontSize: 12,
  },
  daysLegendSecondary: {
    marginTop: 6,
    textAlign: 'right',
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 16,
  },
  dayDate: {
    fontSize: 20,
    color: '#1C1C1E',
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  dayDateSelected: {
    color: '#FFFFFF',
  },
  dayText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  slotBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(142, 142, 147, 0.12)',
    position: 'relative',
  },
  slotBtnSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    transform: [{ scale: 1.05 }],
  },
  slotContent: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  slotText: {
    color: '#1C1C1E',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  slotTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  slotSelectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(142, 142, 147, 0.1)',
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'right',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(142, 142, 147, 0.2)',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '700',
    letterSpacing: -0.2,
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
  tabBarSpacing: {
    height: 120,
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
  noSlotsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noSlotsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  noSlotsSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 20,
  },
  waitlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  waitlistButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(10px)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  modalMessage: {
    fontSize: 17,
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 32,
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  modalButtonCancel: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalButtonConfirm: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
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
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  modalButtonCancelText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});