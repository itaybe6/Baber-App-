import React, { useState } from 'react';
import { StyleSheet, View, FlatList, Text, TouchableOpacity, Dimensions, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { designs, designCategories } from '@/constants/designs';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import { Heart, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView } from 'react-native';

const { width } = Dimensions.get('window');
const numColumns = 2;
const tileSize = width / numColumns;

// Updated design images to ensure all have valid images
const updatedDesigns = [
  {
    id: 'design-1',
    name: 'פרנץ\' קלאסי',
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371',
    category: ['classic', 'french'],
    popularity: 5,
  },
  {
    id: 'design-2',
    name: 'גליטר זהב',
    image: 'https://m.media-amazon.com/images/I/61q3opno0kL._UF1000,1000_QL80_.jpg',
    category: ['glitter', 'gold'],
    popularity: 4,
  },
  {
    id: 'design-3',
    name: 'מרבל אפקט',
    image: 'https://yofi.info/wp-content/uploads/2024/01/%D7%A6%D7%99%D7%A4%D7%95%D7%A8%D7%A0%D7%99%D7%99%D7%9D-%D7%9E%D7%A8%D7%90%D7%94-%D7%A1%D7%95%D7%95%D7%93%D7%A8.png',
    category: ['marble', 'design'],
    popularity: 5,
  },
  {
    id: 'design-4',
    name: 'פסטל מט',
    image: 'https://life.desigusxpro.com/wp-content/uploads/2019/07/pastelnyye-nogti-dizayn-3.jpg',
    category: ['pastel', 'matte'],
    popularity: 3,
  },
  {
    id: 'design-5',
    name: 'אומברה ורוד',
    image: 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66',
    category: ['ombre', 'pink'],
    popularity: 4,
  },
  {
    id: 'design-6',
    name: 'גיאומטרי שחור-לבן',
    image: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc',
    category: ['geometric', 'black-white'],
    popularity: 3,
  },
  {
    id: 'design-7',
    name: 'פרחוני עדין',
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371',
    category: ['floral', 'delicate'],
    popularity: 5,
  },
  {
    id: 'design-8',
    name: 'מטאלי כסף',
    image: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b',
    category: ['metallic', 'silver'],
    popularity: 4,
  },
  {
    id: 'design-9',
    name: 'נקודות זהב',
    image: 'https://images.unsplash.com/photo-1583255448430-17c5eda08e5c',
    category: ['dots', 'gold'],
    popularity: 4,
  },
  {
    id: 'design-10',
    name: 'אפקט מראה',
    image: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702',
    category: ['mirror', 'chrome'],
    popularity: 5,
  },
  {
    id: 'design-11',
    name: 'פרחים טרופיים',
    image: 'https://images.unsplash.com/photo-1604902396830-aca29e19b067',
    category: ['tropical', 'floral'],
    popularity: 3,
  },
  {
    id: 'design-12',
    name: 'גרדיאנט צבעוני',
    image: 'https://m.media-amazon.com/images/I/613crZsNoZL._AC_UF1000,1000_QL80_.jpg',
    category: ['gradient', 'colorful'],
    popularity: 4,
  },
];

export default function GalleryScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const toggleFavorite = (designId: string) => {
    if (favorites.includes(designId)) {
      setFavorites(favorites.filter(id => id !== designId));
    } else {
      setFavorites([...favorites, designId]);
    }
  };
  
  const filteredDesigns = updatedDesigns.filter(design => {
    const matchesSearch = design.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? design.category.includes(selectedCategory) : true;
    return matchesSearch && matchesCategory;
  });
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === null && styles.selectedCategoryChip
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[
              styles.categoryChipText,
              selectedCategory === null && styles.selectedCategoryChipText
            ]}>
              הכל
            </Text>
          </TouchableOpacity>
          
          {designCategories.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.selectedCategoryChip
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === category.id && styles.selectedCategoryChipText
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <FlatList
        data={filteredDesigns}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.tile}
            onPress={() => console.log('Design selected:', item.id)}
            activeOpacity={0.9}
          >
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: item.image }} 
                style={styles.image}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.gradient}
              >
                <Text style={styles.designName}>{item.name}</Text>
                <View style={styles.categoryTags}>
                  {item.category.slice(0, 2).map((cat, idx) => (
                    <View key={idx} style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>
                        {designCategories.find(c => c.id === cat)?.name || cat}
                      </Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
              
              <TouchableOpacity 
                style={styles.favoriteButton}
                onPress={() => toggleFavorite(item.id)}
              >
                <Heart 
                  size={20} 
                  color={Colors.white} 
                  fill={favorites.includes(item.id) ? Colors.error : 'transparent'}
                />
              </TouchableOpacity>
              
              <View style={styles.popularityContainer}>
                {Array(5).fill(0).map((_, idx) => (
                  <View 
                    key={idx} 
                    style={[
                      styles.popularityDot,
                      idx < item.popularity && styles.activePopularityDot
                    ]} 
                  />
                ))}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
      
      <TouchableOpacity style={styles.addDesignButton}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    marginTop: -42, // העלה את כל העמוד מעט למעלה
  },
  categoriesContainer: {
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedCategoryChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: 'FbPragmati-Regular',
  },
  selectedCategoryChipText: {
    color: Colors.white,
    fontFamily: 'FbPragmati-Bold',
  },
  tile: {
    width: tileSize,
    height: tileSize,
    padding: 4,
  },
  imageContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    justifyContent: 'flex-end',
  },
  designName: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 4,
    fontFamily: 'FbPragmati-Bold',
  },
  categoryTags: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  categoryTag: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
    marginBottom: 4,
  },
  categoryTagText: {
    color: Colors.white,
    fontSize: 13,
    fontFamily: 'FbPragmati-Light',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularityContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
  },
  popularityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginRight: 2,
  },
  activePopularityDot: {
    backgroundColor: Colors.primary,
  },
  addDesignButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});