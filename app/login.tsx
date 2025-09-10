import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { usersApi } from '@/lib/api/users';
import { supabase } from '@/lib/supabase';
import { findUserByCredentials, isValidUserType } from '@/constants/auth';

// Local palette to match the provided design (does not affect global colors)
const palette = {
  primary: '#000000',
  secondary: '#1C1C1E',
  accent: '#111111',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  inputBg: 'rgba(255,255,255,0.7)',
  inputBorder: '#E5E7EB',
  white: '#FFFFFF',
  backgroundStart: '#FFFFFF',
  backgroundEnd: '#F5F5F5',
};

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const login = useAuthStore((state) => state.login);
  const { isAuthenticated, user } = useAuthStore();

  // Effect to monitor authentication changes
  useEffect(() => {
    // Authentication state monitoring
  }, [isAuthenticated, user]);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    setIsLoading(true);
    
    try {
      // נסה להתחבר דרך ה-API האמיתי
      const user = await usersApi.authenticateUserByPhone(phone.trim(), password);
      
      if (user) {
        // Blocked user cannot log in
        if ((user as any)?.block) {
          Alert.alert('חשבון חסום', 'החשבון שלך חסום ואין אפשרות להתחבר. פנה למנהלת לקבלת עזרה.');
          return;
        }
        // Validate user type
        if (!isValidUserType(user.user_type)) {
          Alert.alert('שגיאה', 'סוג משתמש לא תקין');
          return;
        }
        
        // Convert Supabase user to app user format for the store
        const appUser = {
          id: user.id,
          phone: user.phone,
          type: user.user_type,
          name: user.name,
          email: user.email ?? null,
          image_url: user.image_url ?? null,
          user_type: user.user_type,
          block: (user as any)?.block ?? false,
        } as any;
        login(appUser);
        // Force navigation to the appropriate screen
        if (appUser.type === 'admin') {
          router.replace('/(tabs)');
        } else {
          router.replace('/(client-tabs)');
        }
      } else {
        // אם ה-API לא עובד, נסה עם המשתמשים הדמו
        const demoUser = findUserByCredentials(phone.trim(), password);
        if (demoUser) {
          login(demoUser);
          // Force navigation to the appropriate screen
          if (demoUser.type === 'admin') {
            router.replace('/(tabs)');
          } else {
            router.replace('/(client-tabs)');
          }
        } else {
          Alert.alert('שגיאה', 'מספר טלפון או סיסמה שגויים');
        }
      }
    } catch (error) {
      console.error('API Login error:', error);
      
      // אם ה-API נכשל, נסה עם המשתמשים הדמו
      try {
        const demoUser = findUserByCredentials(phone.trim(), password);
        if (demoUser) {
          login(demoUser);
          // Force navigation to the appropriate screen
          if (demoUser.type === 'admin') {
            router.replace('/(tabs)');
          } else {
            router.replace('/(client-tabs)');
          }
        } else {
          Alert.alert('שגיאה', 'מספר טלפון או סיסמה שגויים');
        }
      } catch (demoError) {
        console.error('Demo login error:', demoError);
        Alert.alert('שגיאה', 'אירעה שגיאה בהתחברות');
      }
    } finally {
      setIsLoading(false);
    }
  };


  const handleForgotSubmit = async () => {
    const p = (forgotPhone || '').trim();
    const e = (forgotEmail || '').trim();
    if (!e) { Alert.alert('שגיאה', 'אנא הזן מייל'); return; }
    console.log('[ForgotPassword] pressed', { phone: p, email: e });
    setIsSendingReset(true);
    try {
      // 1) Try Edge Function first
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('reset-password', {
        body: { email: e },
      });
      console.log('[ForgotPassword] edge response', { fnData, fnErr });
      if (fnErr) {
        // 2) Fallback: call Supabase Auth directly from client
        console.warn('[ForgotPassword] edge failed, falling back to auth.resetPasswordForEmail', fnErr);
        const { error: rpErr } = await supabase.auth.resetPasswordForEmail(e);
        if (rpErr) {
          const msg = (rpErr as any)?.message || 'שגיאה בבקשת איפוס סיסמה';
          Alert.alert('שגיאה', String(msg));
          return;
        }
      }

      Alert.alert('נשלח מייל', 'שלחנו אליך מייל לאיפוס סיסמה. בדוק את הדואר הנכנס.', [
        { text: 'אישור', onPress: () => setIsForgotOpen(false) },
      ]);
    } catch (err) {
      console.error('Forgot password error (invoke/catch):', err);
      // Last resort fallback just in case invoke threw before returning error
      try {
        const { error: rpErr } = await supabase.auth.resetPasswordForEmail(e);
        if (rpErr) {
          Alert.alert('שגיאה', String((rpErr as any)?.message || 'אירעה שגיאה בבקשה. נסה שוב.'));
          return;
        }
        Alert.alert('נשלח מייל', 'שלחנו אליך מייל לאיפוס סיסמה. בדוק את הדואר הנכנס.', [
          { text: 'אישור', onPress: () => setIsForgotOpen(false) },
        ]);
      } catch (subErr) {
        console.error('Forgot password fallback error:', subErr);
        Alert.alert('שגיאה', 'אירעה שגיאה בבקשה. נסה שוב.');
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <LinearGradient
      colors={[ '#FFFFFF', '#F6F6F6', '#EFEFEF' ]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.bgGradient}
    >
      {/* modern subtle gradient beams instead of circular blobs */}
      <LinearGradient
        colors={[ '#00000022', '#00000000' ]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.beamRight}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[ '#00000026', '#FFFFFF00' ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.beamTop}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.fullSafe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              {/* Header inside card */}
              <View style={styles.headerContent}>
                <Image source={require('@/assets/images/logo-03.png')} style={styles.logoImage} resizeMode="contain" />
                <Text style={styles.appSubtitle}>מלא פרטים כדי להתחבר לחשבון שלך</Text>
              </View>

              {/* Phone */}
              <View style={styles.field}>
                <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                  <Ionicons name="call-outline" size={18} color={palette.textSecondary} style={styles.iconRight} />
                  <TextInput
                    style={styles.input}
                    placeholder="מספר טלפון"
                    placeholderTextColor={palette.textSecondary}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoCorrect={false}
                    textAlign="right"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.field}>
                <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={palette.textSecondary} style={styles.iconRight} />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    placeholder="סיסמה"
                    placeholderTextColor={palette.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textAlign="right"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={palette.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* CTA */}
              <TouchableOpacity onPress={handleLogin} activeOpacity={0.9} disabled={isLoading} style={styles.ctaShadow}>
                <View style={styles.ctaRadiusWrap}>
                  <View style={[styles.cta, styles.ctaOutlined]}>
                    <Text style={styles.ctaText}>{isLoading ? 'מתחבר…' : 'התחברות'}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Links */}
              <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => setIsForgotOpen(true)}>
                <Text style={styles.forgotPasswordText}>שכחתי סיסמה</Text>
              </TouchableOpacity>
              <Text style={styles.registerLine}>
                אין לך חשבון? 
                <Link href="/register" asChild>
                  <Text style={styles.registerAction}>הירשם עכשיו</Text>
                </Link>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {/* Forgot Password Modal */}
      {isForgotOpen && (
        <View style={styles.forgotOverlay}>
          <View style={styles.forgotCard}>
            <Text style={styles.forgotTitle}>איפוס סיסמה</Text>
            <Text style={styles.forgotSubtitle}>הזן מספר טלפון ומייל כפי שמופיעים בחשבון</Text>
            <View style={{ height: 10 }} />
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}> 
              <Ionicons name="call-outline" size={18} color={palette.textSecondary} style={styles.iconRight} />
              <TextInput
                style={styles.input}
                placeholder="מספר טלפון"
                placeholderTextColor={palette.textSecondary}
                value={forgotPhone}
                onChangeText={setForgotPhone}
                keyboardType="phone-pad"
                autoCorrect={false}
                textAlign="right"
              />
            </View>
            <View style={{ height: 10 }} />
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}> 
              <Ionicons name="mail-outline" size={18} color={palette.textSecondary} style={styles.iconRight} />
              <TextInput
                style={styles.input}
                placeholder="אימייל"
                placeholderTextColor={palette.textSecondary}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textAlign="right"
              />
            </View>
            <View style={{ height: 14 }} />
            <View style={styles.forgotActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsForgotOpen(false)} disabled={isSendingReset}>
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleForgotSubmit} disabled={isSendingReset}>
                <Text style={styles.saveBtnText}>{isSendingReset ? 'שולח…' : 'אישור'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.white,
  },
  bgGradient: {
    flex: 1,
  },
  fullSafe: {
    flex: 1,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 8,
  },
  beamRight: {
    position: 'absolute',
    right: -120,
    top: -40,
    width: 300,
    height: 500,
    transform: [{ rotate: '18deg' }],
    opacity: 1,
    borderRadius: 24,
  },
  beamTop: {
    position: 'absolute',
    left: -80,
    top: -60,
    width: 380,
    height: 240,
    transform: [{ rotate: '-10deg' }],
    opacity: 1,
    borderRadius: 24,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoImage: {
    width: '80%',
    height: 100,
    marginBottom: 12,
    alignSelf: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: palette.textSecondary,
    opacity: 1,
    marginBottom: 14,
  },
  safeBottom: {
    flex: 1,
    backgroundColor: palette.white,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 24,
    marginTop: 0,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  field: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 12,
    borderWidth: 1,
    position: 'relative',
  },
  iconRight: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: palette.textPrimary,
    paddingHorizontal: 8,
    paddingRight: 36,
    textAlign: 'right',
  },
  inputPassword: {
    paddingRight: 36, // space for lock icon on right
    paddingLeft: 36,  // space for eye icon on left
  },
  eyeButton: {
    padding: 6,
    marginLeft: 0,
    marginRight: 8,
    position: 'absolute',
    left: 8,
    zIndex: 1,
  },
  ctaShadow: {
    marginTop: 12,
    borderRadius: 24,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  ctaRadiusWrap: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  cta: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOutlined: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.6)',
    borderRadius: 24,
    shadowColor: 'rgba(0,0,0,0.25)',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 14,
  },
  forgotPasswordText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  registerLine: {
    marginTop: 8,
    textAlign: 'center',
    color: palette.textSecondary,
    fontSize: 14,
  },
  registerAction: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
    marginRight: 4,
  },
  // Reuse modal button styles similar to other screens
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F2F2F7',
  },
  cancelBtnText: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: palette.primary,
  },
  saveBtnText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  forgotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  forgotCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  forgotTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  forgotSubtitle: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  forgotActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
});