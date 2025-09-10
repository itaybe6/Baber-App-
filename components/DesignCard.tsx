import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Design } from '@/constants/designs';
import Colors from '@/constants/colors';
import Card from './Card';
import { Heart } from 'lucide-react-native';

interface DesignCardProps {
  design: Design;
  onPress: (design: Design) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (design: Design) => void;
}

const { width } = Dimensions.get('window');
const cardWidth = width / 2 - 24; // 2 columns with padding

export default function DesignCard({ 
  design, 
  onPress, 
  isFavorite = false,
  onToggleFavorite
}: DesignCardProps) {
  return (
    <TouchableOpacity 
      onPress={() => onPress(design)}
      activeOpacity={0.7}
      style={styles.container}
    >
      <Card style={styles.card}>
        <Image 
          source={{ uri: design.image }} 
          style={styles.image} 
          resizeMode="cover"
        />
        
        <View style={styles.content}>
          <Text style={styles.name}>{design.name}</Text>
          
          <View style={styles.footer}>
            <View style={styles.categoryContainer}>
              {design.category.slice(0, 2).map((cat, index) => (
                <View key={index} style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{cat}</Text>
                </View>
              ))}
            </View>
            
            {onToggleFavorite && (
              <TouchableOpacity 
                onPress={() => onToggleFavorite(design)}
                style={styles.favoriteButton}
              >
                <Heart 
                  size={20} 
                  color={isFavorite ? Colors.error : Colors.subtext} 
                  fill={isFavorite ? Colors.error : 'transparent'}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: cardWidth,
    margin: 8,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  content: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: Colors.accent + '40', // 40% opacity
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 10,
    color: Colors.primary,
  },
  favoriteButton: {
    padding: 4,
  },
});