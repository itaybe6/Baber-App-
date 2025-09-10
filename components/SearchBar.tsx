import React from 'react';
import { StyleSheet, TextInput, View, TouchableOpacity, Platform } from 'react-native';
import Colors from '@/constants/colors';
import { Search, X } from 'lucide-react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'חיפוש...',
  onClear,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchIcon}>
        <Search size={20} color={Colors.subtext} />
      </View>
      
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.subtext}
        clearButtonMode="never"
        textAlign="right"
      />
      
      {value.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            onChangeText('');
            onClear && onClear();
          }}
        >
          <X size={16} color={Colors.subtext} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        height: 40,
      },
      android: {
        height: 48,
      },
    }),
  },
  searchIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
    textAlign: 'right',
  },
  clearButton: {
    padding: 4,
  },
});