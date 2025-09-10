 import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const categories = [
  { key: 'gel', label: "לק ג'ל", icon: 'hand-back-left-outline' },
  { key: 'feet', label: 'לק ברגליים', icon: 'foot-print' },
  { key: 'manicure', label: 'מניקור', icon: 'hand-heart' },
];

type CategoryButtonProps = {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
};

const CategoryButton = ({ icon, label, active, onPress }: CategoryButtonProps) => {
  const animated = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: active ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [active]);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ marginHorizontal: 6 }}>
      <View style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={icon} size={22} color={active ? '#fff' : '#8B6DE9'} />
        </View>
        <Text style={active ? styles.activeText : styles.inactiveText}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

type CategoryBarProps = {
  initial?: string;
  onSelect: (key: string) => void;
};

export default function CategoryBar({ initial = 'haircut', onSelect }: CategoryBarProps) {
  const [selected, setSelected] = useState(initial);

  const handleSelect = (key: string) => {
    setSelected(key);
    if (onSelect) onSelect(key);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scroll, {paddingRight: 12}]}>
      {categories.map(cat => (
        <CategoryButton
          key={cat.key}
          icon={cat.icon}
          label={cat.label}
          active={selected === cat.key}
          onPress={() => handleSelect(cat.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    // marginRight: 16, // הוספת הזזה לימין
  },
  pill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    minWidth: 80,
    marginBottom: 8,
  },
  pillActive: {
    backgroundColor: '#8B6DE9',
  },
  pillInactive: {
    backgroundColor: '#F6F4FB',
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  iconCircle: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginRight: 0,
  },
  activeText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 15,
    marginRight: 8,
    fontFamily: 'System',
  },
  inactiveText: {
    color: '#8B6DE9',
    fontWeight: '500',
    fontSize: 15,
    marginRight: 8,
    fontFamily: 'System',
  },
}); 