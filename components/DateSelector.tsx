import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';

interface DateSelectorProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const COLORS = {
  pink: '#F6F4FB', // רקע ברירת מחדל
  blue: '#8B6DE9', // סגול כהה
  highlight: '#EFBBCF',
  white: '#fff',
};

export default function DateSelector({ selectedDate, onSelectDate }: DateSelectorProps) {
  const [dates, setDates] = useState<Date[]>([]);

  useEffect(() => {
    // הצג תמיד את השבוע מהיום ראשון (א) ועד שבת (ש)
    const today = new Date();
    // מצא את יום ראשון של השבוע הנוכחי
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    const newDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      newDates.push(date);
    }
    setDates(newDates);
  }, []);

  const getDayName = (date: Date) => {
    const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    return days[date.getDay()];
  };

  const isSelected = (date: Date) =>
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scroll, { flexDirection: 'row-reverse' }]}>
        {dates.map((date, idx) => {
          const selected = isSelected(date);
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.dayBtn, selected && styles.selectedDayBtn]}
              onPress={() => onSelectDate(date)}
              activeOpacity={0.85}
            >
              <Text style={[styles.dayName, selected && styles.selectedDayText]}>{getDayName(date)}</Text>
              <Text style={[styles.dayNumber, selected && styles.selectedDayText]}>{date.getDate()}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignItems: 'center',
  },
  scroll: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBtn: {
    width: 54,
    height: 64,
    borderRadius: 18,
    backgroundColor: COLORS.pink,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectedDayBtn: {
    backgroundColor: COLORS.blue,
  },
  dayName: {
    fontSize: 13,
    color: COLORS.blue,
    marginBottom: 2,
    fontWeight: '500',
  },
  dayNumber: {
    fontSize: 18,
    color: COLORS.blue,
    fontWeight: 'bold',
  },
  selectedDayText: {
    color: COLORS.white,
  },
}); 