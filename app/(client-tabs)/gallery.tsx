import React, { useState, useEffect, useRef, memo } from 'react';
import { StyleSheet, View, FlatList, Text, TouchableOpacity, Dimensions, Image, Modal, Animated, PanResponder, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useDesignsStore } from '@/stores/designsStore';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView } from 'react-native';

const { width } = Dimensions.get('window');
const numColumns = 2;
const horizontalPadding = 16;
const interItemGap = 8;
const rawTileSize = (width - horizontalPadding * 2 - interItemGap) / numColumns;
const tileSize = Math.round(rawTileSize);
const usedWidth = tileSize * numColumns + interItemGap + horizontalPadding * 2;
const remainderSpace = Math.max(0, width - usedWidth);
const effectiveContentPadding = horizontalPadding + remainderSpace / 2;
const slideSize = tileSize - 8; // account for tile padding

type DesignItem = {
  id: string;
  name: string;
  image_url: string;
  image_urls?: string[];
  popularity?: number;
  categories?: string[];
};

const SkeletonTile = memo(() => {
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={styles.tile}>
      <Animated.View style={[styles.skeletonBlock, { opacity }]} />
    </View>
  );
});

const DesignTile = memo(({ item, onOpen }: { item: DesignItem; onOpen: (images: string[]) => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  };
  const onLoad = () => {
    Animated.timing(imageOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };
  const urls = item.image_urls && item.image_urls.length > 0 ? item.image_urls : [item.image_url];
  return (
    <Animated.View style={[styles.tile, { transform: [{ scale }] }]}> 
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onOpen(urls)}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
        style={{ flex: 1 }}
      >
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            style={{ flex: 1 }}
          >
            {urls.map((url, idx) => (
              <View key={`${item.id}-img-${idx}`} style={{ width: slideSize, height: slideSize }}>
                <Animated.Image
                  source={{ uri: url }}
                  style={[styles.image, { opacity: imageOpacity }]}
                  resizeMode="cover"
                  onLoad={onLoad}
                />
              </View>
            ))}
          </ScrollView>
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={styles.gradient}>
            <Text style={styles.designName}>{item.name}</Text>
          </LinearGradient>
          {urls.length > 1 && (
            <View style={styles.multiBadge}>
              <Ionicons name="images-outline" size={12} color={Colors.white} />
              <Text style={styles.multiBadgeText}>{urls.length}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

export default function GalleryScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const panY = useRef(new Animated.Value(0)).current;
  const resetPan = () => {
    panY.setValue(0);
  };
  useEffect(() => {
    if (viewerVisible) resetPan();
  }, [viewerVisible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        const { dx, dy } = gesture;
        return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10; // vertical intent
      },
      onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        const { dy, vy } = gesture;
        if (Math.abs(dy) > 120 || Math.abs(vy) > 1.2) {
          setViewerVisible(false);
          Animated.timing(panY, { toValue: dy > 0 ? 600 : -600, duration: 150, useNativeDriver: true }).start(() => {
            resetPan();
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  
  // Use Supabase store
  const { designs, isLoading, fetchDesigns } = useDesignsStore();
  
  // Load data on component mount
  useEffect(() => {
    fetchDesigns();
  }, []);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDesigns();
    } finally {
      setRefreshing(false);
    }
  };
  
  
  
  const filteredDesigns = designs; // no text or category filtering
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" backgroundColor={Colors.white} />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={{ width: 22 }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>גלריית עיצובים</Text>
            <Text style={styles.headerSubtitle}>השראה לעיצוב הבא שלך</Text>
          </View>
          <View style={{ width: 22 }} />
        </View>
      </View>
      <View style={styles.contentWrapper}>
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonRow}>
              {Array(2).fill(0).map((_, i) => (
                <SkeletonTile key={`s1-${i}`} />
              ))}
            </View>
            <View style={styles.skeletonRow}>
              {Array(2).fill(0).map((_, i) => (
                <SkeletonTile key={`s2-${i}`} />
              ))}
            </View>
            <View style={styles.skeletonRow}>
              {Array(2).fill(0).map((_, i) => (
                <SkeletonTile key={`s3-${i}`} />
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={filteredDesigns as DesignItem[]}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: effectiveContentPadding }]}
            columnWrapperStyle={[styles.columnWrapper, { columnGap: interItemGap }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />} 
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="images-outline" size={26} color={Colors.text} />
                </View>
                <Text style={styles.emptyTitle}>אין עדיין עיצובים</Text>
                <Text style={styles.emptySubtitle}>כשתוסיפי עיצובים, הם יופיעו כאן</Text>
              </View>
            }
            renderItem={({ item }) => (
              <DesignTile
                item={item}
                onOpen={(urls) => {
                  setViewerImages(urls);
                  setViewerIndex(0);
                  setViewerVisible(true);
                }}
              />
            )}
          />
        )}
      </View>
      {/* Fullscreen image viewer */}
      <Modal visible={viewerVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerBackdrop}>
          <Animated.View style={{ flex: 1, transform: [{ translateY: panY }] }} {...panResponder.panHandlers}>
          <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1 }} edges={['top','bottom']}>
            <View style={styles.viewerHeader}>
              <TouchableOpacity onPress={() => setViewerVisible(false)} style={styles.viewerCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.viewerTitle}>תמונות העיצוב</Text>
              <View style={{ width: 44 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Pressable style={styles.viewerHitAreaTop} onPress={() => setViewerVisible(false)} />
              <Pressable style={styles.viewerHitAreaBottom} onPress={() => setViewerVisible(false)} />
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const w = e.nativeEvent.layoutMeasurement.width;
                  const idx = Math.round(x / (w || 1));
                  if (idx !== viewerIndex) setViewerIndex(idx);
                }}
                scrollEventThrottle={16}
                contentContainerStyle={{ alignItems: 'center' }}
              >
                {viewerImages.map((url, idx) => (
                  <View key={`viewer-${idx}`} style={{ width, height: '80%', justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={{ uri: url }} style={{ width: width, height: '100%' }} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>
              {viewerImages.length > 1 && (
                <View style={styles.viewerDots}>
                  {viewerImages.map((_, i) => (
                    <View key={`dot-${i}`} style={[styles.viewerDot, i === viewerIndex && styles.viewerDotActive]} />
                  ))}
                </View>
              )}
            </View>
          </SafeAreaView>
          </SafeAreaProvider>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    height: 104,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.white,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.subtext,
    marginTop: 6,
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
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
  },
  selectedCategoryChipText: {
    color: Colors.white,
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
    backgroundColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
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
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 4,
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
    fontSize: 10,
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
  multiBadge: {
    position: 'absolute',
    top: 8,
    right: 44,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  multiBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  viewerHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    position: 'relative',
    zIndex: 3,
  },
  viewerTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  viewerCloseBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerHitAreaTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '10%',
    zIndex: 1,
  },
  viewerHitAreaBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '10%',
    zIndex: 1,
  },
  viewerDots: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  viewerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  viewerDotActive: {
    backgroundColor: Colors.white,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 120,
    paddingTop: 12,
  },
  columnWrapper: {
    gap: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  skeletonContainer: {
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonBlock: {
    flex: 1,
    height: tileSize - 8,
    borderRadius: 12,
    backgroundColor: Colors.card,
    margin: 4,
  },
});