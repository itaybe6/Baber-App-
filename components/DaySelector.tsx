import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Dimensions, I18nManager } from 'react-native';
import Colors from '@/constants/colors';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface DaySelectorProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  daysToShow?: number;
  mode?: 'week' | 'month';
  markedDates?: Set<string> | string[]; // YYYY-MM-DD strings to mark with a dot
  startFromToday?: boolean; // when in week mode, start range from today instead of start-of-week
}

export default function DaySelector({
  selectedDate,
  onSelectDate,
  daysToShow = 7,
  mode = 'week',
  markedDates,
  startFromToday = false,
}: DaySelectorProps) {
  const [dates, setDates] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);
  const didInitialAutoScrollRef = useRef(false);
  const contentWidthRef = useRef(0);
  
  useEffect(() => {
    generateDates(selectedDate);
  }, [selectedDate, daysToShow, mode]);
  
  const generateDates = (anchor: Date) => {
    const base = new Date(anchor);
    const newDates: Date[] = [];

    if (mode === 'month') {
      const year = base.getFullYear();
      const month = base.getMonth();
      const firstOfMonth = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= lastDay; day++) {
        newDates.push(new Date(year, month, day));
      }
      setDates(newDates);
      updateCurrentMonth(firstOfMonth);
      return;
    }

    // week mode
    if (startFromToday) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      for (let i = 0; i < daysToShow; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        newDates.push(d);
      }
      setDates(newDates);
      updateCurrentMonth(newDates[0]);
      return;
    }

    // default: build the week that contains the selected date, starting on Sunday (א)
    const dayOfWeek = base.getDay(); // 0 = Sunday
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() - dayOfWeek);

    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      newDates.push(d);
    }

    setDates(newDates);
    updateCurrentMonth(newDates[0]);
  };
  
  const toLocalISODate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  const markedSet = useMemo(() => {
    if (!markedDates) return null;
    if (Array.isArray(markedDates)) return new Set(markedDates);
    // Assume Set<string>
    return new Set<string>(Array.from(markedDates as Set<string>));
  }, [markedDates]);
  
  const updateCurrentMonth = (date: Date) => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    setCurrentMonth(`${months[date.getMonth()]} ${date.getFullYear()}`);
  };
  
  const navigateDays = (direction: 'prev' | 'next') => {
    const newDates: Date[] = [];
    // Determine range shift base from current shown range
    const first = dates[0] ? new Date(dates[0]) : new Date(selectedDate);
    let baseDate: Date;
    if (startFromToday) {
      baseDate = new Date(first);
    } else {
      // start of week (Sunday)
      const startOfWeek = new Date(first);
      startOfWeek.setDate(first.getDate() - first.getDay());
      baseDate = new Date(startOfWeek);
    }
    baseDate.setDate(baseDate.getDate() + (direction === 'prev' ? -daysToShow : daysToShow));
    
    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      newDates.push(d);
    }
    
    setDates(newDates);
    updateCurrentMonth(newDates[0]);
  };
  
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };
  
  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };
  
  const getDayName = (date: Date) => {
    // Desired order and labels: א, ב, ג, ד, ה, ו, ש (Sun..Sat)
    const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    return days[date.getDay()];
  };
  
  const scrollToSelected = (animated: boolean) => {
    if (!scrollRef.current || dates.length === 0) return;
    const selectedIdx = dates.findIndex((d) =>
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
    if (selectedIdx < 0) return;
    
    const ITEM_FULL_WIDTH = 68; // 56 width + ~12 margins
    const screenWidth = Dimensions.get('window').width;
    
    // For RTL, we want to scroll to show the selected item in the center
    // Since the content is laid out RTL, we need to calculate from the right
    const totalContentWidth = dates.length * ITEM_FULL_WIDTH;
    
    // Calculate position to center the selected item
    const centerOffset = (screenWidth - ITEM_FULL_WIDTH) / 2;
    const itemPosition = selectedIdx * ITEM_FULL_WIDTH;
    
    // In RTL, scroll position 0 shows the rightmost content
    // We want to scroll so the selected item appears centered
    const targetX = Math.max(0, Math.min(
      totalContentWidth - screenWidth,
      totalContentWidth - itemPosition - ITEM_FULL_WIDTH - centerOffset
    ));
    
    try {
      scrollRef.current.scrollTo({ x: targetX, animated });
    } catch (error) {
      console.log('Scroll error:', error);
    }
  };

  // Ensure selected day is visible (especially on first load in month mode)
  useEffect(() => {
    if (mode !== 'month') return;
    const t = setTimeout(() => {
      if (!didInitialAutoScrollRef.current) {
        scrollToSelected(false);
        didInitialAutoScrollRef.current = true;
      }
    }, 10);
    return () => clearTimeout(t);
  }, [dates, selectedDate, mode]);
  
  return (
    <View style={[styles.container, { direction: 'rtl' }] }>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.daysContainer, { flexDirection: 'row' }]}
        onLayout={() => {
          if (mode !== 'month') return;
          if (!didInitialAutoScrollRef.current) {
            // Ensure initial centering once layout is ready
            scrollToSelected(false);
            didInitialAutoScrollRef.current = true;
          }
        }}
        onContentSizeChange={(w) => {
          contentWidthRef.current = w || 0;
          if (mode !== 'month') return;
          if (!didInitialAutoScrollRef.current) {
            scrollToSelected(false);
            didInitialAutoScrollRef.current = true;
          }
        }}
      >
        {dates.map((date, index) => {
          const selected = isSelected(date);
          const isMarked = !!markedSet && markedSet.has(toLocalISODate(date));
          const common = [styles.dayItem, { marginHorizontal: 6 }];
          if (selected) {
            return (
              <LinearGradient
                key={index}
                colors={['#7B61FF', '#7B61FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[...common, styles.selectedDayItem]}
              >
                <TouchableOpacity
                  style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => onSelectDate(date)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.dayName, styles.selectedDayText]}>{getDayName(date)}</Text>
                  <Text style={[styles.dayNumber, styles.selectedDayText]}>{date.getDate()}</Text>
                  {isMarked && <View style={styles.selectedMarkDot} />}
                </TouchableOpacity>
              </LinearGradient>
            );
          }
          return (
            <TouchableOpacity
              key={index}
              style={[...common, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFEFF4' }]}
              onPress={() => onSelectDate(date)}
              activeOpacity={0.85}
            >
              <Text style={styles.dayName}>{getDayName(date)}</Text>
              <Text style={[styles.dayNumber, isToday(date) && styles.todayText]}>{date.getDate()}</Text>
              {isMarked && <View style={styles.markDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  navButton: {
    padding: 4,
  },
  daysContainer: {
    paddingHorizontal: 0,
  },
  dayItem: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginVertical: 4,
    marginHorizontal: 2,
  },
  selectedDayItem: {
    shadowColor: '#7b61ff',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dayName: {
    fontSize: 14,
    color: Colors.subtext,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  selectedDayText: {
    color: Colors.white,
  },
  todayText: {
    color: Colors.primary,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  markDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7B61FF',
    marginTop: 4,
  },
  selectedMarkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
    marginTop: 4,
  },
});