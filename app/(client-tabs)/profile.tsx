import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Modal, TextInput, ActivityIndicator, Switch, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { Ionicons } from '@expo/vector-icons';
import { LogOut } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
 
import { supabase, AvailableTimeSlot } from '@/lib/supabase';
import { usersApi } from '@/lib/api/users';
import { notificationsApi } from '@/lib/api/notifications';

export default function ClientProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUserProfile, notificationsEnabled, setNotificationsEnabled } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [pastAppointments, setPastAppointments] = useState<AvailableTimeSlot[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [editPassword, setEditPassword] = useState<string>('');
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean>(notificationsEnabled);
  const [isUpcomingOpen, setIsUpcomingOpen] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AvailableTimeSlot[]>([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const formatTimeHHMM = (t?: string | null): string => {
    if (!t) return '';
    const parts = String(t).split(':');
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    return t as string;
  };
  const guessMimeFromUri = (uriOrName: string): string => {
    const ext = uriOrName.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'heic' || ext === 'heif') return 'image/heic';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  };

  const base64ToUint8Array = (base64: string): Uint8Array => {
    const clean = base64.replace(/^data:[^;]+;base64,/, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let outputLength = (clean.length / 4) * 3;
    if (clean.endsWith('==')) outputLength -= 2; else if (clean.endsWith('=')) outputLength -= 1;
    const bytes = new Uint8Array(outputLength);
    let p = 0;
    for (let i = 0; i < clean.length; i += 4) {
      const enc1 = chars.indexOf(clean.charAt(i));
      const enc2 = chars.indexOf(clean.charAt(i + 1));
      const enc3 = chars.indexOf(clean.charAt(i + 2));
      const enc4 = chars.indexOf(clean.charAt(i + 3));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      bytes[p++] = chr1;
      if (enc3 !== 64) bytes[p++] = chr2;
      if (enc4 !== 64) bytes[p++] = chr3;
    }
    return bytes;
  };

  const uploadAvatar = async (asset: { uri: string; base64?: string | null; mimeType?: string | null; fileName?: string | null }): Promise<string | null> => {
    try {
      let contentType = asset.mimeType || guessMimeFromUri(asset.fileName || asset.uri);
      let fileBody: Blob | Uint8Array;
      if (asset.base64) {
        fileBody = base64ToUint8Array(asset.base64);
      } else {
        const response = await fetch(asset.uri, { cache: 'no-store' });
        const fetched = await response.blob();
        fileBody = fetched;
        contentType = fetched.type || contentType;
      }

      const extGuess = (contentType.split('/')[1] || 'jpg').toLowerCase();
      const randomId = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const filePath = `${user?.id || 'anon'}/${Date.now()}_${randomId()}.${extGuess}`;
      const { error } = await supabase.storage.from('avatars').upload(filePath, fileBody as any, { contentType, upsert: false });
      if (error) {
        console.error('avatar upload error', error);
        return null;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e) {
      console.error('avatar upload exception', e);
      return null;
    }
  };

  const pickAndUploadAvatar = async () => {
    try {
      if (!user?.id) return;
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('הרשאה נחוצה', 'יש לאשר גישה לגלריה כדי לבחור תמונת פרופיל');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: false,
        quality: 0.9,
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0] as any;
      setIsUploadingAvatar(true);
      const uploadedUrl = await uploadAvatar({ uri: a.uri, base64: a.base64 ?? null, mimeType: a.mimeType ?? null, fileName: a.fileName ?? null });
      if (!uploadedUrl) {
        Alert.alert('שגיאה', 'נכשל בהעלאת התמונה');
        return;
      }
      const updated = await usersApi.updateUser(user.id, { image_url: uploadedUrl } as any);
      if (updated) {
        updateUserProfile({ image_url: uploadedUrl } as any);
      } else {
        updateUserProfile({ image_url: uploadedUrl } as any);
      }
    } catch (e) {
      console.error('pick/upload avatar failed', e);
      Alert.alert('שגיאה', 'נכשל בהעלאת התמונה');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'התנתק', 
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(client-tabs)');
          }
        }
      ]
    );
  };

  const menuItems = [
    {
      id: 'edit-profile',
      icon: 'person-outline',
      title: 'עריכת פרופיל',
      subtitle: 'עדכון פרטים אישיים',
      onPress: async () => {
        setEditName(user?.name ?? '');
        setEditPhone(user?.phone ?? '');
        setEditEmail((user as any)?.email ?? '');
        setEditPassword('');
        setIsEditOpen(true);
        // Try to load freshest user details (email, etc.)
        try {
          if (user?.id) {
            const full = await usersApi.getUserById(user.id);
            if (full) {
              setEditName(full.name ?? '');
              setEditPhone(full.phone ?? '');
              setEditEmail((full as any)?.email ?? '');
            }
          }
        } catch {}
      },
    },
    {
      id: 'notifications',
      icon: 'notifications-outline',
      title: 'התראות',
      subtitle: pushEnabled ? 'התראות מופעלות' : 'התראות כבויות',
      onPress: async () => {
        const next = !pushEnabled;
        setPushEnabled(next);
        setNotificationsEnabled(next);
        try {
          if (!user?.phone) return;
          if (next) {
            const token = await notificationsApi.requestNotificationPermissions();
            if (token) {
              await notificationsApi.registerPushToken(user.phone, token);
            }
          } else {
            await notificationsApi.clearPushToken(user.phone);
          }
        } catch {}
      },
    },
    {
      id: 'delete-account',
      icon: 'trash-outline',
      title: 'מחיקת חשבון',
      subtitle: 'מחיקת החשבון לצמיתות',
      onPress: async () => {
        if (!user?.id || isDeleting) return;
        Alert.alert(
          'מחיקת חשבון',
          'האם אתה בטוח שברצונך למחוק את החשבון? פעולה זו אינה ניתנת לביטול.',
          [
            { text: 'ביטול', style: 'cancel' },
            {
              text: 'מחק',
              style: 'destructive',
              onPress: async () => {
                try {
                  setIsDeleting(true);
                  const ok = await usersApi.deleteUser(user.id);
                  if (ok) {
                    logout();
                    router.replace('/login');
                  } else {
                    Alert.alert('שגיאה', 'נכשל במחיקת החשבון');
                  }
                } catch (e) {
                  console.error('delete account failed', e);
                  Alert.alert('שגיאה', 'נכשל במחיקת החשבון');
                } finally {
                  setIsDeleting(false);
                }
              }
            }
          ]
        );
      },
    },
    {
      id: 'terms',
      icon: 'document-text-outline',
      title: 'תנאי שימוש',
      subtitle: 'הצגת תנאי השימוש באפליקציה',
      onPress: () => setIsTermsOpen(true),
    },
  ];

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setIsLoading(true);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        let query = supabase
          .from('appointments')
          .select('*')
          .eq('is_available', false)
          .lt('slot_date', todayStr)
          .order('slot_date', { ascending: false })
          .order('slot_time', { ascending: false });

        if (user?.name || user?.phone) {
          const conditions: string[] = [];
          if (user?.name) conditions.push(`client_name.ilike.%${user.name.trim()}%`);
          if (user?.phone) conditions.push(`client_phone.eq.${user.phone.trim()}`);
          if (conditions.length > 0) {
            query = query.or(conditions.join(','));
          }
        }

        const { data, error } = await query;
        if (error) throw error;

        let items: AvailableTimeSlot[] = data || [];
        if (user?.name || user?.phone) {
          items = items.filter(slot => {
            const nameMatch = user?.name && slot.client_name && slot.client_name.trim().toLowerCase() === user.name.trim().toLowerCase();
            const phoneMatch = user?.phone && slot.client_phone && slot.client_phone.trim() === user.phone.trim();
            return Boolean(nameMatch || phoneMatch);
          });
        }

        setPastAppointments(items);

        // Upcoming appointments count
        let upcomingQuery = supabase
          .from('appointments')
          .select('*')
          .eq('is_available', false)
          .gte('slot_date', todayStr);

        if (user?.name || user?.phone) {
          const upcomingConds: string[] = [];
          if (user?.name) upcomingConds.push(`client_name.ilike.%${user.name.trim()}%`);
          if (user?.phone) upcomingConds.push(`client_phone.eq.${user.phone.trim()}`);
          if (upcomingConds.length > 0) {
            upcomingQuery = upcomingQuery.or(upcomingConds.join(','));
          }
        }

        const { data: upcomingData, error: upcomingError } = await upcomingQuery;
        if (upcomingError) throw upcomingError;

        let upcomingItems: AvailableTimeSlot[] = upcomingData || [];
        if (user?.name || user?.phone) {
          upcomingItems = upcomingItems.filter(slot => {
            const nameMatch = user?.name && slot.client_name && slot.client_name.trim().toLowerCase() === user.name.trim().toLowerCase();
            const phoneMatch = user?.phone && slot.client_phone && slot.client_phone.trim() === user.phone.trim();
            return Boolean(nameMatch || phoneMatch);
          });
        }
        setUpcomingAppointments(upcomingItems);
      } catch (e) {
        console.error('Error loading past appointments:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppointments();
  }, [user?.name, user?.phone]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.headerContainer}>
          <View
            style={[styles.gradientHeader, { paddingTop: 16 + insets.top, backgroundColor: Colors.white }]}
          >

            <View style={styles.profileCard}>
              <View style={styles.profileTop}>
                <View style={styles.avatarWrap}>
                  <LinearGradient
                    colors={["#7B61FF", "#7B61FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradientRing}
                  >
                    <View style={styles.profileAvatar}>
                      {user?.image_url ? (
                        <Image source={{ uri: user.image_url }} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="person-outline" size={28} color="#2F2F2F" />
                      )}
                    </View>
                  </LinearGradient>
                  <TouchableOpacity style={styles.avatarPlusWrap} onPress={pickAndUploadAvatar} disabled={isUploadingAvatar}>
                    <LinearGradient
                      colors={["#7B61FF", "#7B61FF"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.avatarPlus}
                    >
                      {isUploadingAvatar ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.profileName, styles.profileNameOnGradient, styles.centerText]}>{user?.name || 'לקוח יקר'}</Text>
                <Text style={[styles.profilePhone, styles.profilePhoneOnGradient, styles.centerText]}>{user?.phone || 'מספר טלפון'}</Text>
                {(user as any)?.email ? (
                  <Text style={[styles.profileEmail, styles.centerText]}>{(user as any).email}</Text>
                ) : null}
              </View>

              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statChip} onPress={() => setIsUpcomingOpen(true)}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.text} />
                  <Text style={styles.statChipText}>תורים עתידיים {upcomingAppointments.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.statChip} onPress={() => setIsHistoryOpen(true)}>
                  <Ionicons name="time-outline" size={14} color={Colors.text} />
                  <Text style={styles.statChipText}>תורים קודמים {pastAppointments.length}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Section Header: Settings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>הגדרות</Text>
          <Text style={styles.sectionSubtitle}>ניהול פרטי פרופיל, התראות ותנאי שימוש</Text>
        </View>

        {/* No inline history. Use the menu item to open the sheet. */}

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => {
            const isNotifications = item.id === 'notifications';
            return (
              <TouchableOpacity 
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={isNotifications ? 0.7 : 0.6}
              >
                {!isNotifications && (
                  <Ionicons name="chevron-back-outline" size={20} color={Colors.subtext} />
                )}
                {isNotifications && (
                  <Switch
                    value={pushEnabled}
                    onValueChange={async (value) => {
                      setPushEnabled(value);
                      setNotificationsEnabled(value);
                      try {
                        if (!user?.phone) return;
                        if (value) {
                          const token = await notificationsApi.requestNotificationPermissions();
                          if (token) {
                            await notificationsApi.registerPushToken(user.phone, token);
                          }
                        } else {
                          await notificationsApi.clearPushToken(user.phone);
                        }
                      } catch {}
                    }}
                    trackColor={{ false: '#E5E5EA', true: 'rgba(123,97,255,0.3)' }}
                    thumbColor={pushEnabled ? '#7B61FF' : Colors.card}
                    ios_backgroundColor="#E5E5EA"
                    style={styles.switch}
                  />
                )}
                <View style={styles.menuItemContent}>
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>{item.title}</Text>
                    <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                  </View>
                  <View style={styles.menuItemIcon}>
                    <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={["#2F2F2F", "#4A4A4A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoutGradient}
          >
            <LogOut size={20} color={Colors.white} />
            <Text style={styles.logoutText}>התנתקות</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.versionText}>גרסה 1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditOpen} transparent animationType="slide" onRequestClose={() => setIsEditOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 12} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalOverlayContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>עריכת פרופיל</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>שם</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="שם מלא"
                style={styles.textInput}
                textAlign="right"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>טלפון</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="מספר טלפון"
                keyboardType="phone-pad"
                style={styles.textInput}
                textAlign="right"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>מייל</Text>
              <TextInput
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.textInput}
                textAlign="right"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>סיסמה חדשה</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={editPassword}
                  onChangeText={setEditPassword}
                  placeholder="השאירו ריק אם אין שינוי"
                  secureTextEntry={!showEditPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.textInput, { paddingLeft: 44 }]}
                  textAlign="right"
                />
                <TouchableOpacity onPress={() => setShowEditPassword(v => !v)} style={styles.passwordToggle}>
                  <Ionicons name={showEditPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.subtext} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditOpen(false)} disabled={isSaving}>
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={async () => {
                  if (!user?.id) {
                    setIsEditOpen(false);
                    return;
                  }
                  if (!editName.trim() || !editPhone.trim()) {
                    Alert.alert('שגיאה', 'אנא מלא את כל השדות');
                    return;
                  }
                  try {
                    setIsSaving(true);
                    const updated = await usersApi.updateUser(user.id, {
                      name: editName.trim(),
                      phone: editPhone.trim(),
                      email: (editEmail || '').trim() ? (editEmail || '').trim() : (null as any),
                      ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
                    } as any);
                    if (updated) {
                      updateUserProfile({ name: updated.name as any, phone: (updated as any).phone, email: (updated as any).email } as any);
                    } else {
                      // Fallback: update local store even if API failed, per request UX
                      updateUserProfile({ name: editName.trim(), phone: editPhone.trim(), email: (editEmail || '').trim() || (null as any) } as any);
                    }
                    setIsEditOpen(false);
                  } catch (e) {
                    console.error('Failed to save profile', e);
                    Alert.alert('שגיאה', 'נכשל בשמירת הפרופיל');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>שמירה</Text>}
              </TouchableOpacity>
            </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* History Bottom Sheet */}
      <Modal visible={isHistoryOpen} transparent animationType="slide" onRequestClose={() => setIsHistoryOpen(false)}>
        <View style={styles.historyOverlay}>
          <View style={styles.historySheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ width: 44 }} />
              <Text style={styles.sheetTitle}>היסטוריית תורים</Text>
              <TouchableOpacity onPress={() => setIsHistoryOpen(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={true}>
              {isLoading ? (
                <View style={styles.historyLoadingState}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.historyLoadingText}>טוען היסטוריית תורים...</Text>
                </View>
              ) : pastAppointments.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Ionicons name="calendar-outline" size={56} color={Colors.subtext} />
                  <Text style={styles.historyEmptyTitle}>אין תורים קודמים</Text>
                  <Text style={styles.historyEmptySubtitle}>כשתהיה היסטוריה, נראה אותה כאן</Text>
                </View>
              ) : (
                pastAppointments.map((item) => (
                  <View key={`${item.id}-${item.slot_date}-${item.slot_time}`} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <Text style={styles.historyService}>{item.service_name || 'שירות'}</Text>
                      <View style={styles.statusPill}>
                        <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                        <Text style={styles.statusPillText}>בוצע</Text>
                      </View>
                    </View>
                    <View style={styles.historyCardBody}>
                      <View style={styles.historyMeta}>
                        <Ionicons name="calendar" size={16} color="#A78BFA" />
                        <Text style={styles.historyMetaText}>{new Date(item.slot_date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                      </View>
                      <View style={styles.historyMeta}>
                        <Ionicons name="time" size={16} color="#8E8E93" />
                        <Text style={styles.historyMetaText}>{formatTimeHHMM(item.slot_time)}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Terms of Use Bottom Sheet */}
      <Modal visible={isTermsOpen} transparent animationType="slide" onRequestClose={() => setIsTermsOpen(false)}>
        <View style={styles.historyOverlay}>
          <View style={styles.historySheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ width: 44 }} />
              <Text style={styles.sheetTitle}>תנאי שימוש</Text>
              <TouchableOpacity onPress={() => setIsTermsOpen(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.termsContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.termsParagraph}>
                ברוכים הבאים לאפליקציה לניהול ובניית תורים. השימוש באפליקציה ובשירותים הנלווים לה כפוף לתנאים המפורטים במסמך זה, ומהווה הסכמה מלאה ומודעת לכל תנאיו.
              </Text>
              <Text style={styles.termsHeading}>1. יצירת חשבון וזיהוי</Text>
              <Text style={styles.termsParagraph}>
                לשם שימוש בשירותים ייתכן שתידרש מסירת פרטים מזהים, כגון שם וטלפון. אתה מצהיר כי המידע שנמסר נכון ומעודכן, ותדאג לעדכנו בעת הצורך. אין להשתמש בפרטים של אדם אחר ללא הרשאתו.
              </Text>
              <Text style={styles.termsHeading}>2. הזמנת תורים ושינויים</Text>
              <Text style={styles.termsParagraph}>
                הזמנת תורים, שינוי או ביטול מתבצעים דרך האפליקציה בכפוף לזמינות. פרטי התור המאושרים יוצגו באפליקציה ויישלחו כהתראה לפי ההגדרות. זמני השירות משוערים ויכולים להשתנות עקב אילוצים תפעוליים.
              </Text>
              <Text style={styles.termsHeading}>3. ביטולים ואי הגעה</Text>
              <Text style={styles.termsParagraph}>
                ניתן לבטל או לשנות תור בתוך פרק זמן סביר לפני מועדו. אי הגעה או איחורים משמעותיים עלולים לגרור הגבלות עתידיות על קביעת תורים, לפי שיקול דעת העסק.
              </Text>
              <Text style={styles.termsHeading}>4. תשלומים וקבלות</Text>
              <Text style={styles.termsParagraph}>
                אם התשלום מתבצע דרך האפליקציה, הוא עשוי להיעשות באמצעות ספקי סליקה חיצוניים. פרטי אמצעי התשלום אינם נשמרים בשרתים שלנו מעבר לנדרש לביצוע העסקה. אם התשלום מתבצע בבית העסק, הוא יוסדר ישירות בינך לבין העסק.
              </Text>
              <Text style={styles.termsHeading}>5. התראות ודיוורים</Text>
              <Text style={styles.termsParagraph}>
                ניתן להפעיל או לכבות התראות מתוך האפליקציה או דרך הגדרות המכשיר. השבתת התראות עשויה לפגוע בקבלת תזכורות על תורים ועדכונים חשובים.
              </Text>
              <Text style={styles.termsHeading}>6. פרטיות ואבטחת מידע</Text>
              <Text style={styles.termsParagraph}>
                אנו עשויים לאסוף ולעבד מידע הדרוש להפעלת השירות, לרבות פרטי זיהוי בסיסיים ונתוני תורים. המידע נשמר ומעובד בהתאם לדין החל ולמדיניות הפרטיות. באפשרותך לפנות אלינו בבקשה לעיון, עדכון או מחיקה של מידע אישי, בכפוף לחובותינו לפי דין.
              </Text>
              <Text style={styles.termsHeading}>7. שימוש מותר והתנהגות</Text>
              <Text style={styles.termsParagraph}>
                אין לעשות שימוש הפוגע בזכויות אחרים, מפר חוק או משבש את תפעול האפליקציה. אנו רשאים להגביל או לחסום גישה לשירות במקרה של שימוש לרעה או הפרת תנאים אלה.
              </Text>
              <Text style={styles.termsHeading}>8. קניין רוחני</Text>
              <Text style={styles.termsParagraph}>
                כל הזכויות באפליקציה, לרבות שם, לוגו, עיצובים, תכנים, קוד ותמונות, שמורות לבעליהם. אין להעתיק, לשנות, להפיץ או ליצור יצירות נגזרות ללא רשות מראש ובכתב.
              </Text>
              <Text style={styles.termsHeading}>9. הגבלת אחריות</Text>
              <Text style={styles.termsParagraph}>
                השירות ניתן כפי שהוא AS-IS ולפי זמינותו. לא נהיה אחראים לנזקים עקיפים, תוצאתיים או אובדן רווחים הנובעים מהשימוש באפליקציה. האחריות לשימוש ולתכנים המוזנים על ידך היא עליך בלבד.
              </Text>
              <Text style={styles.termsHeading}>10. זמינות ושינויים בשירות</Text>
              <Text style={styles.termsParagraph}>
                ייתכנו הפסקות, תקלות או עבודות תחזוקה. אנו רשאים לעדכן, לשנות או להפסיק את השירות, כולו או חלקו, מעת לעת.
              </Text>
              <Text style={styles.termsHeading}>11. צדדים שלישיים</Text>
              <Text style={styles.termsParagraph}>
                האפליקציה עשויה לשלב קישורים או שירותים של צדדים שלישיים, כגון שירותי תשלומים או מסרים. איננו אחראים על אתרים או שירותים אלה ותנאיהם יחולו על שימושך בהם.
              </Text>
              <Text style={styles.termsHeading}>12. שימוש על ידי קטינים</Text>
              <Text style={styles.termsParagraph}>
                אם אינך בגיל כשירות לפי הדין החל, השימוש באפליקציה מותנה בהסכמת הורה או אפוטרופוס כדין.
              </Text>
              <Text style={styles.termsHeading}>13. עדכון התנאים</Text>
              <Text style={styles.termsParagraph}>
                אנו רשאים לעדכן תנאים אלה מעת לעת. פרסום נוסח מעודכן באפליקציה יהווה הודעה על שינוי. המשך שימושך לאחר העדכון מהווה הסכמה לנוסח המעודכן.
              </Text>
              <Text style={styles.termsHeading}>14. יצירת קשר</Text>
              <Text style={styles.termsParagraph}>
                לשאלות, תקלות או בקשות בנוגע לתנאים אלה או לשירות, ניתן לפנות אלינו באמצעות פרטי הקשר המופיעים בעמוד העסק.
              </Text>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Upcoming Appointments Bottom Sheet */}
      <Modal visible={isUpcomingOpen} transparent animationType="slide" onRequestClose={() => setIsUpcomingOpen(false)}>
        <View style={styles.historyOverlay}>
          <View style={styles.historySheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ width: 44 }} />
              <Text style={styles.sheetTitle}>תורים עתידיים</Text>
              <TouchableOpacity onPress={() => setIsUpcomingOpen(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={true}>
              {isLoading ? (
                <View style={styles.historyLoadingState}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.historyLoadingText}>טוען תורים עתידיים...</Text>
                </View>
              ) : upcomingAppointments.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Ionicons name="calendar-outline" size={56} color={Colors.subtext} />
                  <Text style={styles.historyEmptyTitle}>אין תורים עתידיים</Text>
                  <Text style={styles.historyEmptySubtitle}>כשתוזמנו תורים, הם יופיעו כאן</Text>
                </View>
              ) : (
                upcomingAppointments.map((item) => (
                  <View key={`${item.id}-${item.slot_date}-${item.slot_time}`} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <Text style={styles.historyService}>{item.service_name || 'שירות'}</Text>
                      <View style={[styles.statusPill, { backgroundColor: 'rgba(0,122,255,0.12)' }]}>
                        <Ionicons name="calendar" size={16} color="#A78BFA" />
                        <Text style={[styles.statusPillText, { color: '#A78BFA' }]}>קרוב</Text>
                      </View>
                    </View>
                    <View style={styles.historyCardBody}>
                      <View style={styles.historyMeta}>
                        <Ionicons name="calendar" size={16} color="#A78BFA" />
                        <Text style={styles.historyMetaText}>{new Date(item.slot_date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                      </View>
                      <View style={styles.historyMeta}>
                        <Ionicons name="time" size={16} color="#8E8E93" />
                        <Text style={styles.historyMetaText}>{formatTimeHHMM(item.slot_time)}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    // Remove drop shadow/back-plate look
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    marginBottom: 8,
  },
  headerDecor1: { },
  headerDecor2: { },
  gradientHeader: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  profileHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 20,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  profileTop: {
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  centerText: {
    textAlign: 'center',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarGradientRing: {
    padding: 2,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 0,
  },
  avatarPlusWrap: {
    position: 'absolute',
    bottom: 2,
    left: 2,
  },
  avatarPlus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileAvatarInitial: {
    color: '#2F2F2F',
    fontSize: 22,
    fontWeight: '800',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  profileInfo: {
    flex: 1,
    marginRight: 6,
    alignItems: 'flex-end',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  profileNameOnGradient: {
    color: Colors.text,
  },
  profilePhone: {
    fontSize: 16,
    color: Colors.text,
    opacity: 0.7,
    marginBottom: 8,
  },
  profilePhoneOnGradient: {
    color: Colors.text,
    opacity: 0.7,
    marginBottom: 0,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.subtext,
  },
  phoneRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  loyaltyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  loyaltyText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },

  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 20,
  },
  modalOverlayContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.subtext,
    marginBottom: 6,
    textAlign: 'right',
  },
  inputWrapper: {
    position: 'relative',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: Colors.text,
  },
  passwordToggle: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
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
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // History sheet styles
  historyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  historySheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  sheetCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  historyLoadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  historyLoadingText: {
    marginTop: 8,
    color: Colors.subtext,
  },
  historyEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  historyEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  historyEmptySubtitle: {
    fontSize: 14,
    color: Colors.subtext,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  historyCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyService: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusPillText: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '700',
  },
  historyCardBody: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
  },
  historyMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  historyMetaText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  termsContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  termsHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'right',
  },
  termsParagraph: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -10,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statChipText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.subtext,
    textAlign: 'center',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'right',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.subtext,
    opacity: 0.8,
    textAlign: 'right',
  },
  menuContainer: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  menuItemText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: Colors.subtext,
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  logoutButton: {
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    alignSelf: 'stretch',
    marginBottom: 24,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
  },
  logoutText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '500',
    marginLeft: 8,
  },
  versionText: {
    fontSize: 12,
    color: Colors.subtext,
    textAlign: 'center',
    marginBottom: 8,
  },
});