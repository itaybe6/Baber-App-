import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

interface TimeSlotGridProps {
  slots: string[];
  selectedSlot?: string;
  onSelectSlot: (slot: string) => void;
}

const COLORS = {
  pink: '#F6F4FB',
  blue: '#8B6DE9',
  highlight: '#EFBBCF',
  white: '#fff',
  selected: '#8B6DE9',
};

export default function TimeSlotGrid({ slots, selectedSlot, onSelectSlot }: TimeSlotGridProps) {
  return (
    <View style={[styles.gridContainer, { flexDirection: 'row-reverse' }] }>
      {slots.map((slot, idx) => {
        const selected = selectedSlot === slot;
        return (
          <TouchableOpacity
            key={slot}
            style={[styles.slotBtn, selected && styles.selectedSlotBtn]}
            onPress={() => onSelectSlot(slot)}
            activeOpacity={0.85}
          >
            <Text style={[styles.slotText, selected && styles.selectedSlotText]}>{slot}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 8,
  },
  slotBtn: {
    width: '30%',
    minWidth: 90,
    maxWidth: 120,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.pink,
    marginHorizontal: '1.5%',
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    direction: 'rtl',
  },
  selectedSlotBtn: {
    backgroundColor: COLORS.selected,
  },
  slotText: {
    color: COLORS.blue,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  selectedSlotText: {
    color: COLORS.white,
  },
}); 