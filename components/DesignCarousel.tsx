import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  InteractionManager,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Design } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.6;
const CARD_HEIGHT = 200;
const CARD_SPACING = 16;

interface DesignCarouselProps {
  designs: Design[];
  onDesignPress?: (design: Design) => void;
  title?: string;
  subtitle?: string;
}

interface AdminUser {
  id: string;
  name: string;
  image_url?: string;
}

export default function DesignCarousel({ 
  designs, 
  onDesignPress, 
  title = "העיצובים החדשים שלנו",
  subtitle = "גלו את הטרנדים האחרונים ותבחרו את העיצוב המושלם"
}: DesignCarouselProps) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Animation values for floating elements
  const floatingAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Load admin user profile
  useEffect(() => {
    const loadAdminUser = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, image_url')
          .eq('user_type', 'admin')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setAdminUser(data);
        }
      } catch (e) {
        console.error('Error loading admin user:', e);
      }
    };

    loadAdminUser();
  }, []);

  // Start animations
  useEffect(() => {
    const startAnimations = () => {
      // Floating animation
      const floatingLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(floatingAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatingAnim, {
            toValue: 0,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      // Sparkle animation
      const sparkleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 0,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );

      // Glow animation
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

      floatingLoop.start();
      sparkleLoop.start();
      glowLoop.start();

      return () => {
        floatingLoop.stop();
        sparkleLoop.stop();
        glowLoop.stop();
      };
    };

    const handle = InteractionManager.runAfterInteractions(startAnimations);
    const appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        startAnimations();
      }
    });

    return () => {
      handle && typeof handle.cancel === 'function' && handle.cancel();
      appStateListener.remove();
    };
  }, []);

  const renderDesignCard = (design: Design, index: number) => {
    const imageUrl = design.image_urls && design.image_urls.length > 0 
      ? design.image_urls[0] 
      : design.image_url;

    return (
      <TouchableOpacity
        key={design.id}
        style={styles.cardContainer}
        onPress={() => onDesignPress?.(design)}
        activeOpacity={0.95}
      >
        <View style={styles.card}>
          {/* Background Pattern */}
          <View style={styles.backgroundPattern}>
            <Animated.View 
              style={[
                styles.patternCircle,
                { 
                  top: 20, 
                  right: 30,
                  opacity: sparkleAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.1, 0.3, 0.1],
                  }),
                  transform: [{
                    scale: sparkleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.8, 1.2, 0.8],
                    })
                  }]
                }
              ]}
            />
            <Animated.View 
              style={[
                styles.patternCircle,
                { 
                  bottom: 40, 
                  left: 25,
                  opacity: sparkleAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.2, 0.4, 0.2],
                  }),
                  transform: [{
                    scale: sparkleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1.2, 0.8, 1.2],
                    })
                  }]
                }
              ]}
            />
          </View>

          {/* Main Image Container */}
          <View style={styles.imageContainer}>
            <View style={styles.imageWrapper}>
              <Image 
                source={{ uri: imageUrl }} 
                style={styles.designImage}
                resizeMode="cover"
              />
              
              {/* Animated Glow Border */}
              <Animated.View 
                style={[
                  styles.glowBorder,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.8],
                    }),
                  }
                ]}
              />

              {/* Floating Sparkles */}
              <Animated.View 
                style={[
                  styles.sparkle,
                  { 
                    top: 15, 
                    right: 15,
                    transform: [{
                      translateY: floatingAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -8],
                      })
                    }],
                    opacity: sparkleAnim
                  }
                ]}
              >
                <Ionicons name="sparkles" size={16} color="#FFD700" />
              </Animated.View>

            </View>

            {/* Manager Profile Circle - Top Position */}
            {adminUser && (
              <View style={styles.managerProfileContainer}>
                <LinearGradient
                  colors={['#1C1C1E', '#1C1C1E', '#1C1C1E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.managerProfileRing}
                >
                  <View style={styles.managerProfileInner}>
                    <Image
                      source={
                        adminUser.image_url 
                          ? { uri: adminUser.image_url }
                          : require('@/assets/images/user.png')
                      }
                      style={styles.managerProfileImage}
                      resizeMode="cover"
                    />
                  </View>
                </LinearGradient>
                
                {/* Static Ring */}
                <View style={styles.staticRing} />
              </View>
            )}
          </View>

          {/* Content Section - Simplified */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.contentGradient}
          >
            <View style={styles.contentContainer}>
              {/* Design Name Only */}
              <Text style={styles.designName} numberOfLines={2}>
                {design.name}
              </Text>
            </View>
          </LinearGradient>

          {/* Premium Badge */}
          {design.is_featured && (
            <View style={styles.premiumBadge}>
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumBadgeGradient}
              >
                <Ionicons name="star" size={14} color="#FFFFFF" />
                <Text style={styles.premiumText}>מובחר</Text>
              </LinearGradient>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!designs || designs.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={styles.modernHeader}>
        <View style={styles.headerDecorationLeft}>
          <View style={[styles.decorationDot, { opacity: 0.3 }]} />
          <View style={[styles.decorationDot, { opacity: 0.2 }]} />
          <View style={[styles.decorationDot, { opacity: 0.1 }]} />
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.modernTitle}>גלריית העיצובים</Text>
        </View>
        <View style={styles.headerDecorationRight}>
          <View style={[styles.decorationDot, { opacity: 0.1 }]} />
          <View style={[styles.decorationDot, { opacity: 0.2 }]} />
          <View style={[styles.decorationDot, { opacity: 0.3 }]} />
        </View>
      </View>

      {/* Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="center"
        style={styles.scrollView}
      >
        {designs.map((design, index) => renderDesignCard(design, index))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
    paddingBottom: 20,
  },
  modernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 16,
  },
  headerDecorationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerDecorationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  decorationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1C1C1E',
  },
  headerTitleContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modernTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  scrollView: {
    paddingLeft: 24,
  },
  scrollContainer: {
    paddingRight: 24,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
  card: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  patternCircle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
  },
  imageWrapper: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  designImage: {
    width: '100%',
    height: '100%',
  },
  glowBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  sparkle: {
    position: 'absolute',
    zIndex: 10,
  },
  managerProfileContainer: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 20,
  },
  managerProfileRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  managerProfileInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    padding: 2,
  },
  managerProfileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  staticRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#1C1C1E',
    opacity: 0.8,
  },
  contentGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    zIndex: 15,
  },
  contentContainer: {
    padding: 12,
    paddingTop: 8,
  },
  designName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  premiumBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 25,
  },
  premiumBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
