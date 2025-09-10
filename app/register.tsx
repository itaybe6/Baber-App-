import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image, 
  Keyboard,
  Animated,
  Easing,
  InteractionManager
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { usersApi } from '@/lib/api/users';
import Colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Local palette (male, dark-neutral accents)
const palette = {
  primary: '#000000',
  secondary: '#1C1C1E',
  accent: '#111111',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  inputBg: 'rgba(255,255,255,0.7)',
  inputBorder: '#E5E7EB',
  white: '#FFFFFF',
};

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const bottomWhiteHeight = Math.max(insets.bottom, 20);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const router = useRouter();
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    // No-op: content is visible by default
  }, []);

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!name.trim()) {
      newErrors.name = 'שם מלא הוא שדה חובה';
    }

    if (!phone.trim()) {
      newErrors.phone = 'מספר טלפון הוא שדה חובה';
    } else if (phone.length < 10) {
      newErrors.phone = 'מספר טלפון לא תקין';
    }

    // Email required and must be valid
    if (!email.trim()) {
      newErrors.email = 'דואר אלקטרוני הוא שדה חובה';
    } else {
      const emailRegex = /^(?:[a-zA-Z0-9_'^&+%!-]+(?:\.[a-zA-Z0-9_'^&+%!-]+)*)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'כתובת דוא"ל לא תקינה';
      }
    }

    if (!password) {
      newErrors.password = 'סיסמה היא שדה חובה';
    } else if (!validatePassword(password)) {
      newErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'הסיסמאות לא תואמות';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      // בדיקה אם המשתמש כבר קיים לפי מספר טלפון
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone.trim())
        .single();

      if (existingUser) {
        Alert.alert('שגיאה', 'משתמש עם מספר הטלפון הזה כבר קיים במערכת');
        return;
      }

      // יצירת המשתמש החדש בטבלה המותאמת אישית עם הסיסמה שבחר
      const newUser = await usersApi.createUserWithPassword({
        name: name.trim(),
        user_type: 'client', // כל ההרשמות החדשות הן לקוחות
        phone: phone.trim(),
        email: email.trim(),
      } as any, password);

      if (!newUser) {
        Alert.alert('שגיאה', 'אירעה שגיאה ביצירת החשבון. אנא נסה שוב.');
        return;
      }

      // הצלחה!
      Alert.alert(
        'הרשמה הושלמה בהצלחה!', 
        `החשבון שלך נוצר בהצלחה.\n\nכעת תוכל להתחבר למערכת עם מספר הטלפון והסיסמה שבחרת.\n\nמספר טלפון: ${phone.trim()}`,
        [
          {
            text: 'אישור',
            onPress: () => router.push('/login')
          }
        ]
      );
      
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה במערכת. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (error: string) => {
    if (error.includes('User already registered')) {
      return 'משתמש זה כבר רשום במערכת';
    }
    if (error.includes('Invalid email')) {
      return 'כתובת אימייל לא תקינה';
    }
    if (error.includes('Password should be at least 6 characters')) {
      return 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }
    return 'אירעה שגיאה בהרשמה. אנא נסה שוב.';
  };

  return (
    <LinearGradient
      colors={[ '#FFFFFF', '#F6F6F6', '#EFEFEF' ]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={'height'}
          keyboardVerticalOffset={0}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContainer, isKeyboardVisible ? styles.scrollContainerCompact : null]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={isKeyboardVisible}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            automaticallyAdjustKeyboardInsets
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-forward" size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {/* Logo instead of title/subtitle */}
            <View style={styles.titleContainer}>
              <Image source={require('@/assets/images/logo-03.png')} style={styles.logoImage} resizeMode="contain" />
            </View>

            {/* Form with entrance animation */}
            <Animated.View
              style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY }] }]}
              collapsable={false}
            >
              {/* Form header text */}
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>הירשם עכשיו</Text>
                <Text style={styles.formSubtitle}>מלא את הפרטים כדי להירשם ולהתחבר</Text>
              </View>
              {/* Name Input */}
              <View style={styles.field}>
                <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                  <Ionicons name="person-outline" size={16} color={palette.textSecondary} style={styles.iconRight} />
                  <TextInput
                    style={styles.input}
                    placeholder="שם מלא"
                    placeholderTextColor={palette.textSecondary}
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (errors.name) {
                        setErrors(prev => ({...prev, name: ''}));
                      }
                    }}
                    textAlign="right"
                    autoCorrect={false}
                  />
                </View>
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>

              {/* Phone Input */}
              <View style={styles.field}>
                <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                  <Ionicons name="call-outline" size={16} color={palette.textSecondary} style={styles.iconRight} />
                  <TextInput
                    style={styles.input}
                    placeholder="מספר טלפון"
                    placeholderTextColor={palette.textSecondary}
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      if (errors.phone) {
                        setErrors(prev => ({...prev, phone: ''}));
                      }
                    }}
                    keyboardType="phone-pad"
                    autoCorrect={false}
                    textAlign="right"
                  />
                </View>
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              </View>

              {/* Email Input (optional) */}
              <View style={styles.field}>
                <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                  <Ionicons name="mail-outline" size={16} color={palette.textSecondary} style={styles.iconRight} />
                  <TextInput
                    style={styles.input}
                    placeholder="דואר אלקטרוני"
                    placeholderTextColor={palette.textSecondary}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) {
                        setErrors(prev => ({...prev, email: ''}));
                      }
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textAlign="right"
                  />
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>



              {/* Password Input */}
              <View style={styles.field}>
                <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={palette.textSecondary} style={styles.iconRight} />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    placeholder="סיסמה (לפחות 6 תווים)"
                    placeholderTextColor={palette.textSecondary}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) {
                        setErrors(prev => ({...prev, password: ''}));
                      }
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textAlign="right"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={palette.textSecondary} />
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              {/* Confirm Password Input */}
              <View style={styles.field}>
                <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={palette.textSecondary} style={styles.iconRight} />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    placeholder="אימות סיסמה"
                    placeholderTextColor={palette.textSecondary}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errors.confirmPassword) {
                        setErrors(prev => ({...prev, confirmPassword: ''}));
                      }
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    textAlign="right"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={palette.textSecondary} />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
              </View>

              {/* Register Button - styled like login CTA */}
              <TouchableOpacity onPress={handleRegister} activeOpacity={0.9} disabled={loading} style={styles.ctaShadow}>
                <View style={styles.ctaRadiusWrap}>
                  <LinearGradient colors={[ '#000000', '#000000' ]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
                    {loading ? (
                      <ActivityIndicator color={palette.white} size="small" />
                    ) : (
                      <Text style={styles.ctaText}>הרשמה</Text>
                    )}
                  </LinearGradient>
                </View>
              </TouchableOpacity>

              {/* Login Link */}
              <View style={styles.loginSection}>
                <Text style={styles.loginText}>
                  יש לך כבר חשבון? 
                  <Text onPress={() => router.push('/login')} style={[styles.loginLink, styles.loginLinkSpacer]}>התחבר עכשיו</Text>
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {/* Bottom white safe-area only for this screen */}
      <View pointerEvents="none" style={[styles.bottomWhiteInset, { height: bottomWhiteHeight }]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gradient: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 0,
  },
  scrollContainerCompact: {
    flexGrow: 0,
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    paddingHorizontal: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    opacity: 0.7,
  },
  logoImage: {
    width: '80%',
    height: 100,
    marginBottom: 8,
    alignSelf: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
    flex: 1,
    minHeight: '70%',
    // subtle top shadow
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 2,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  field: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 10,
    borderWidth: 1,
    position: 'relative',
    width: '92%',
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: palette.textPrimary,
    textAlign: 'right',
    paddingHorizontal: 6,
    paddingRight: 32,
  },
  inputPassword: {
    paddingRight: 32,
    paddingLeft: 32,
  },
  iconRight: {
    position: 'absolute',
    right: 10,
    zIndex: 1,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 0,
    marginRight: 6,
    position: 'absolute',
    left: 6,
    zIndex: 1,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 5,
    textAlign: 'right',
    width: '92%',
    alignSelf: 'center',
  },
  registerButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  ctaShadow: {
    marginTop: 12,
    borderRadius: 24,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    width: '92%',
    alignSelf: 'center',
  },
  ctaRadiusWrap: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  cta: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ctaText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    color: Colors.subtext,
    fontSize: 16,
  },
  loginLink: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  loginLinkSpacer: {
    marginRight: 4,
  },
  bottomWhiteInset: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },

});