import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Service } from '@/constants/services';
import Colors from '@/constants/colors';
import Card from './Card';
import { Clock } from 'lucide-react-native';

interface ServiceCardProps {
  service: Service;
  onPress: (service: Service) => void;
  selected?: boolean;
}

export default function ServiceCard({ service, onPress, selected = false }: ServiceCardProps) {
  return (
    <TouchableOpacity 
      onPress={() => onPress(service)}
      activeOpacity={0.7}
    >
      <Card style={[styles.card, selected && styles.selectedCard]}>
        <Image 
          source={{ uri: service.image }} 
          style={styles.image} 
          resizeMode="cover"
        />
        <View style={styles.content}>
          <Text style={styles.name}>{service.name}</Text>
          {/* description removed */}
          <View style={styles.footer}>
            <View style={styles.durationContainer}>
              <Clock size={14} color={Colors.subtext} />
              <Text style={styles.duration}>{service.duration} דקות</Text>
            </View>
            <Text style={styles.price}>₪{service.price}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse',
    padding: 12,
    marginVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedCard: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.accent + '20', // 20% opacity
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'right',
  },
  description: {
    fontSize: 14,
    color: Colors.subtext,
    marginBottom: 8,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  duration: {
    fontSize: 14,
    color: Colors.subtext,
    marginRight: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
});