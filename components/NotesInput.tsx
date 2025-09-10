import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

interface NotesInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const COLORS = {
  border: '#EFBBCF',
  bg: '#fff',
};

export default function NotesInput({ value, onChangeText, placeholder }: NotesInputProps) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || 'Add a comment...'}
        placeholderTextColor={'#B0B0B0'}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginVertical: 12,
    minHeight: 56,
  },
  input: {
    fontSize: 15,
    color: '#2D5B8A',
    minHeight: 48,
    textAlign: 'right',
  },
}); 