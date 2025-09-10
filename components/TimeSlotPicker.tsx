import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import Colors from '@/constants/colors';
import { Clock } from 'lucide-react-native';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface TimeSlotPickerProps {
  timeSlots: TimeSlot[];
  selectedTime?: string;
  onSelectTime: (time: string) => void;
}

export default function TimeSlotPicker({
  timeSlots,
  selectedTime,
  onSelectTime,
}: TimeSlotPickerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Clock size={20} color={Colors.primary} />
        <Text style={styles.headerText}>בחרי שעה</Text>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeSlotsContainer}
      >
        {timeSlots.map((slot, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.timeSlot,
              selectedTime === slot.time && styles.selectedTimeSlot,
              !slot.available && styles.unavailableTimeSlot,
            ]}
            onPress={() => slot.available && onSelectTime(slot.time)}
            disabled={!slot.available}
          >
            <Text style={[
              styles.timeText,
              selectedTime === slot.time && styles.selectedTimeText,
              !slot.available && styles.unavailableTimeText,
            ]}>
              {slot.time}
            </Text>
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
  timeSlotsContainer: {
    paddingHorizontal: 8,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedTimeSlot: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unavailableTimeSlot: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    opacity: 0.5,
  },
  timeText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  selectedTimeText: {
    color: Colors.white,
  },
  unavailableTimeText: {
    color: Colors.subtext,
  },
});