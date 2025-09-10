import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: number;
}

export default function Card({ children, style, elevation = 2 }: CardProps) {
  return (
    <View 
      style={[
        styles.card, 
        { 
          shadowOpacity: 0.1 + (elevation * 0.05),
          shadowRadius: elevation,
          elevation: elevation,
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    marginVertical: 8,
    marginHorizontal: 0,
  },
});