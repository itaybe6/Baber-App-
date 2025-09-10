import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import Colors from '@/constants/colors';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';

interface DatePickerProps {
  onSelectDate: (date: Date) => void;
  selectedDate?: Date;
  disabledDates?: Date[];
  minDate?: Date;
  maxDate?: Date;
}

export default function DatePicker({
  onSelectDate,
  selectedDate,
  disabledDates = [],
  minDate = new Date(),
  maxDate,
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dates, setDates] = useState<Date[]>([]);
  
  // Generate dates for the next 14 days
  useEffect(() => {
    const generateDates = () => {
      const newDates: Date[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        newDates.push(date);
      }
      
      return newDates;
    };
    
    setDates(generateDates());
  }, []);
  
  const isDateDisabled = (date: Date) => {
    // Check if date is before minDate
    if (minDate && date < minDate) return true;
    
    // Check if date is after maxDate
    if (maxDate && date > maxDate) return true;
    
    // Check if date is in disabledDates
    return disabledDates.some(disabledDate => 
      disabledDate.getFullYear() === date.getFullYear() &&
      disabledDate.getMonth() === date.getMonth() &&
      disabledDate.getDate() === date.getDate()
    );
  };
  
  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    
    return (
      selectedDate.getFullYear() === date.getFullYear() &&
      selectedDate.getMonth() === date.getMonth() &&
      selectedDate.getDate() === date.getDate()
    );
  };
  
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      today.getFullYear() === date.getFullYear() &&
      today.getMonth() === date.getMonth() &&
      today.getDate() === date.getDate()
    );
  };
  
  const formatDay = (date: Date) => {
    return date.getDate().toString();
  };
  
  const formatWeekday = (date: Date) => {
    const weekdays = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
    return weekdays[date.getDay()];
  };
  
  const formatMonth = (date: Date) => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Calendar size={20} color={Colors.primary} />
        <Text style={styles.headerText}>בחרי תאריך</Text>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.datesContainer}
      >
        {dates.map((date, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dateItem,
              isDateSelected(date) && styles.selectedDateItem,
              isDateDisabled(date) && styles.disabledDateItem,
            ]}
            onPress={() => !isDateDisabled(date) && onSelectDate(date)}
            disabled={isDateDisabled(date)}
          >
            <Text style={[
              styles.weekday,
              isDateDisabled(date)
                ? styles.disabledText
                : isDateSelected(date)
                ? styles.selectedText
                : styles.weekdayBlack,
            ]}>
              {formatWeekday(date)}
            </Text>
            <Text style={[
              styles.day,
              isDateSelected(date) && styles.selectedText,
              isDateDisabled(date) && styles.disabledText,
              isToday(date) && styles.todayText,
            ]}>
              {formatDay(date)}
            </Text>
            {isToday(date) && <View style={styles.todayIndicator} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  datesContainer: {
    paddingHorizontal: 8,
  },
  dateItem: {
    width: 60,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedDateItem: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  disabledDateItem: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    opacity: 0.5,
  },
  weekday: {
    fontSize: 14,
    color: Colors.subtext,
    marginBottom: 4,
  },
  day: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  selectedText: {
    color: Colors.white,
  },
  disabledText: {
    color: Colors.subtext,
  },
  todayText: {
    color: Colors.primary,
  },
  todayIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  weekdayBlack: {
    color: Colors.text,
  },
});