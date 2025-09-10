import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = { onPress?: () => void };

export default function NearestSlotsButton({ onPress }: Props) {
  return (
    <TouchableOpacity style={styles.button} activeOpacity={0.9} onPress={onPress}>
      <Ionicons name="flash" size={18} color="#FFD60A" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
});


