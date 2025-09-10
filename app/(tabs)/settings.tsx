import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Switch, ScrollView, Image, Platform, Alert, TextInput, Modal, Pressable, ActivityIndicator, Animated, Easing, TouchableWithoutFeedback, PanResponder, GestureResponderEvent, PanResponderGestureState, KeyboardAvoidingView, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { servicesApi, updateService, createService, deleteService } from '@/lib/api/services';
import type { Service } from '@/lib/supabase';
import { notificationsApi } from '@/lib/api/notifications';
import { recurringAppointmentsApi } from '@/lib/api/recurringAppointments';
import { supabase } from '@/lib/supabase';
import { businessProfileApi } from '@/lib/api/businessProfile';
import type { BusinessProfile } from '@/lib/supabase';

import { 
  Bell, 
  HelpCircle, 
  LogOut, 
  ChevronLeft,
  ChevronRight,
  Send,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Trash2,
  Check,
  Instagram,
  Facebook,
  MapPin,
  Calendar
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi } from '@/lib/api/users';
import AdminBroadcastComposer from '@/components/AdminBroadcastComposer';
import AddAppointmentModal from '@/components/AddAppointmentModal';

// Helper for shadow style
const shadowStyle = Platform.select({
  ios: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
  },
  android: {
    elevation: 3,
  },
});

function AppSwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{
        false: '#E5E5EA',
        true: 'rgba(123, 97, 255, 0.35)',
      }}
      thumbColor={value ? '#7B61FF' : '#FFFFFF'}
      ios_backgroundColor={'#E5E5EA'}
      style={{
        transform: [{ scaleX: 1.0 }, { scaleY: 1.0 }],
        marginLeft: 8,
        marginRight: 2,
        shadowColor: '#000',
        shadowOpacity: value ? 0.12 : 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: value ? 2 : 0,
        borderRadius: 20,
        borderWidth: value ? 0 : 1,
        borderColor: value ? 'transparent' : '#E5E5EA',
      }}
    />
  );
}

export default function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);
  
  
  // Notification modal states (replaced by AdminBroadcastComposer)
  const [showSupportModal, setShowSupportModal] = useState(false);
  
  // Title dropdown states (removed)

  // Services edit modal state
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [editableServices, setEditableServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [editDurationDropdownFor, setEditDurationDropdownFor] = useState<string | null>(null);

  // Business profile state
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileInstagram, setProfileInstagram] = useState('');
  const [profileFacebook, setProfileFacebook] = useState('');
  const [profileTiktok, setProfileTiktok] = useState('');
  const [showEditDisplayNameModal, setShowEditDisplayNameModal] = useState(false);
  const [showEditAddressModal, setShowEditAddressModal] = useState(false);
  const [showEditInstagramModal, setShowEditInstagramModal] = useState(false);
  const [showEditFacebookModal, setShowEditFacebookModal] = useState(false);
  const [showEditTiktokModal, setShowEditTiktokModal] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState('');
  const [instagramDraft, setInstagramDraft] = useState('');
  const [facebookDraft, setFacebookDraft] = useState('');
  const [tiktokDraft, setTiktokDraft] = useState('');
  // Admin name/phone edit
  const [showEditAdminModal, setShowEditAdminModal] = useState(false);
  const [adminNameDraft, setAdminNameDraft] = useState('');
  const [adminPhoneDraft, setAdminPhoneDraft] = useState('');
  const [adminEmailDraft, setAdminEmailDraft] = useState('');
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [isUploadingAdminAvatar, setIsUploadingAdminAvatar] = useState(false);

  // Animated bottom-sheet controls
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const sheetTranslateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const dragY = useRef(new Animated.Value(0)).current; // additional drag delta
  const combinedTranslateY = Animated.add(sheetTranslateY as any, dragY as any);
  const overlayOpacity = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const animateOpenSheet = () => {
    dragY.setValue(0);
    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Load business profile on mount
  useEffect(() => {
    const load = async () => {
      setIsLoadingProfile(true);
      try {
        const p = await businessProfileApi.getProfile();
        setProfile(p);
        setProfileDisplayName(p?.display_name || '');
        setProfileAddress(p?.address || '');
        setProfileInstagram(p?.instagram_url || '');
        setProfileFacebook(p?.facebook_url || '');
        setProfileTiktok((p as any)?.tiktok_url || '');
      } finally {
        setIsLoadingProfile(false);
      }
    };
    load();
  }, []);

  // Keep edit drafts in sync when modal opens or profile updates
  useEffect(() => {
    if (showEditAddressModal) {
      setAddressDraft(profileAddress || '');
    }
  }, [showEditAddressModal, profileAddress]);

  useEffect(() => {
    if (showEditInstagramModal) {
      setInstagramDraft(profileInstagram || '');
    }
  }, [showEditInstagramModal, profileInstagram]);

  useEffect(() => {
    if (showEditFacebookModal) {
      setFacebookDraft(profileFacebook || '');
    }
  }, [showEditFacebookModal, profileFacebook]);

  useEffect(() => {
    if (showEditTiktokModal) {
      setTiktokDraft(profileTiktok || '');
    }
  }, [showEditTiktokModal, profileTiktok]);

  // Keep business name draft in sync when modal opens
  useEffect(() => {
    if (showEditDisplayNameModal) {
      setDisplayNameDraft(profileDisplayName || '');
    }
  }, [showEditDisplayNameModal, profileDisplayName]);

  const handleSaveBusinessProfile = async () => {
    setIsSavingProfile(true);
    try {
      const updated = await businessProfileApi.upsertProfile({
        display_name: profileDisplayName.trim() || null as any,
        address: profileAddress.trim() || null as any,
        instagram_url: profileInstagram.trim() || null as any,
        facebook_url: profileFacebook.trim() || null as any,
        tiktok_url: profileTiktok.trim() || null as any,
      });
      if (!updated) {
        Alert.alert('שגיאה', 'שמירת פרופיל העסק נכשלה');
        return;
      }
      setProfile(updated);
      Alert.alert('הצלחה', 'פרטי העסק נשמרו בהצלחה');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Open editors with current values
  const openEditAddress = () => {
    setAddressDraft(profileAddress || '');
    setShowEditAddressModal(true);
  };
  const openEditInstagram = () => {
    setInstagramDraft(profileInstagram || '');
    setShowEditInstagramModal(true);
  };
  const openEditFacebook = () => {
    setFacebookDraft(profileFacebook || '');
    setShowEditFacebookModal(true);
  };
  const openEditTiktok = () => {
    setTiktokDraft(profileTiktok || '');
    setShowEditTiktokModal(true);
  };

  // Save single-field handlers (preserve other values)
  const saveAddress = async () => {
    setIsSavingProfile(true);
    try {
      const updated = await businessProfileApi.upsertProfile({
        address: addressDraft.trim() || null as any,
        instagram_url: (profileInstagram || '').trim() || null as any,
        facebook_url: (profileFacebook || '').trim() || null as any,
      });
      if (!updated) {
        Alert.alert('שגיאה', 'שמירת הכתובת נכשלה');
        return;
      }
      setProfile(updated);
      setProfileAddress(updated.address || '');
      setShowEditAddressModal(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveInstagram = async () => {
    setIsSavingProfile(true);
    try {
      const updated = await businessProfileApi.upsertProfile({
        address: (profileAddress || '').trim() || null as any,
        instagram_url: instagramDraft.trim() || null as any,
        facebook_url: (profileFacebook || '').trim() || null as any,
      });
      if (!updated) {
        Alert.alert('שגיאה', 'שמירת קישור האינסטגרם נכשלה');
        return;
      }
      setProfile(updated);
      setProfileInstagram(updated.instagram_url || '');
      setShowEditInstagramModal(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveFacebook = async () => {
    setIsSavingProfile(true);
    try {
      const updated = await businessProfileApi.upsertProfile({
        address: (profileAddress || '').trim() || null as any,
        instagram_url: (profileInstagram || '').trim() || null as any,
        facebook_url: facebookDraft.trim() || null as any,
        tiktok_url: (profileTiktok || '').trim() || null as any,
      });
      if (!updated) {
        Alert.alert('שגיאה', 'שמירת קישור הפייסבוק נכשלה');
        return;
      }
      setProfile(updated);
      setProfileFacebook(updated.facebook_url || '');
      setShowEditFacebookModal(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveTiktok = async () => {
    setIsSavingProfile(true);
    try {
      const updated = await businessProfileApi.upsertProfile({
        address: (profileAddress || '').trim() || null as any,
        instagram_url: (profileInstagram || '').trim() || null as any,
        facebook_url: (profileFacebook || '').trim() || null as any,
        tiktok_url: tiktokDraft.trim() || null as any,
      });
      if (!updated) {
        Alert.alert('שגיאה', 'שמירת קישור הטיקטוק נכשלה');
        return;
      }
      setProfile(updated);
      setProfileTiktok((updated as any).tiktok_url || '');
      setShowEditTiktokModal(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const animateCloseSheet = (after?: () => void) => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      dragY.setValue(0);
      if (finished) after && after();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, g: PanResponderGestureState) => {
        return g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx);
      },
      onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
        const delta = Math.max(0, g.dy);
        dragY.setValue(delta);
      },
      onPanResponderRelease: (_: GestureResponderEvent, g: PanResponderGestureState) => {
        const shouldClose = g.dy > 140 || g.vy > 0.9;
        if (shouldClose) {
          animateCloseSheet(() => setShowServicesModal(false));
        } else {
          Animated.timing(dragY, {
            toValue: 0,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.timing(dragY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;
 
  // Predefined titles
  const predefinedTitles = [
    { id: 'promotion', title: 'מבצע חדש! 🎉', description: 'הודעה על מבצע או הנחה' },
    { id: 'reminder', title: 'תזכורת חשובה ⏰', description: 'תזכורת לתור או אירוע' },
    { id: 'update', title: 'עדכון שירות 📢', description: 'עדכון על שירותים חדשים' },
    { id: 'holiday', title: 'סגירה לחג 🏖️', description: 'הודעה על סגירה או שינוי שעות' },
    { id: 'welcome', title: 'ברוכים הבאים! 👋', description: 'הודעת ברכה ללקוחות' },
    { id: 'custom', title: 'כותרת מותאמת אישית ✏️', description: 'כותרת מותאמת אישית' }
  ];

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
            // כפה מעבר לעמוד התחברות
            router.replace('/login');
          }
        }
      ]
    );
  };

  const openServicesModal = async () => {
    setShowServicesModal(true);
    setIsLoadingServices(true);
    setServicesError(null);
    try {
      const data = await servicesApi.getAllServices();
      setEditableServices(data);
    } catch (e) {
      setServicesError('שגיאה בטעינת השירותים');
    } finally {
      setIsLoadingServices(false);
      // defer to allow modal mount
      setTimeout(() => animateOpenSheet(), 0);
    }
  };

  const closeServicesModal = () => {
    animateCloseSheet(() => setShowServicesModal(false));
  };

  const updateLocalServiceField = <K extends keyof Service>(id: string, key: K, value: Service[K]) => {
    setEditableServices(prev => prev.map(s => (s.id === id ? { ...s, [key]: value } : s)));
  };

  // Add Service modal state
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [addSvcName, setAddSvcName] = useState('שירות חדש');
  const [addSvcPrice, setAddSvcPrice] = useState<string>('0');
  // removed per-service duration field
  const [addSvcDuration, setAddSvcDuration] = useState<string>('60');
  // category removed
  const [addSvcIsSaving, setAddSvcIsSaving] = useState(false);
  // category removed
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [addSvcImage, setAddSvcImage] = useState<{ uri: string; base64?: string | null; mimeType?: string | null; fileName?: string | null } | null>(null);
  const [addSvcUploading, setAddSvcUploading] = useState(false);
  const [editImageUploading, setEditImageUploading] = useState<Record<string, boolean>>({});

  const durationOptions: number[] = Array.from({ length: ((180 - 10) / 5) + 1 }, (_, i) => 10 + i * 5);

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

  const uploadAdminAvatar = async (asset: { uri: string; base64?: string | null; mimeType?: string | null; fileName?: string | null }): Promise<string | null> => {
    try {
      let contentType = asset.mimeType || guessMimeFromUri(asset.fileName || asset.uri);
      let fileBody: Blob | Uint8Array;
      if (asset.base64) {
        const bytes = base64ToUint8Array(asset.base64);
        fileBody = bytes;
      } else {
        const response = await fetch(asset.uri, { cache: 'no-store' });
        const fetched = await response.blob();
        fileBody = fetched;
        contentType = fetched.type || contentType;
      }
      const extGuess = (contentType.split('/')![1] || 'jpg').toLowerCase();
      const randomId = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const filePath = `avatars/${user?.id || 'anon'}/${Date.now()}_${randomId()}.${extGuess}`;
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

  const handlePickAdminAvatar = async () => {
    try {
      if (!user?.id) return;
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('הרשאה נחוצה', 'יש לאשר גישה לגלריה כדי לבחור תמונה');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.9,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const a: any = result.assets[0];
      setIsUploadingAdminAvatar(true);
      const uploadedUrl = await uploadAdminAvatar({
        uri: a.uri,
        base64: a.base64 ?? null,
        mimeType: a.mimeType ?? null,
        fileName: a.fileName ?? null,
      });
      if (!uploadedUrl) {
        Alert.alert('שגיאה', 'העלאת התמונה נכשלה');
        return;
      }
      const updated = await usersApi.updateUser(user.id as any, { image_url: uploadedUrl } as any);
      if (!updated) {
        Alert.alert('שגיאה', 'שמירת תמונת הפרופיל נכשלה');
        return;
      }
      updateUserProfile({ image_url: uploadedUrl } as any);
    } catch (e) {
      console.error('pick/upload admin avatar failed', e);
      Alert.alert('שגיאה', 'העלאת התמונה נכשלה');
    } finally {
      setIsUploadingAdminAvatar(false);
    }
  };

  const uploadServiceImage = async (asset: { uri: string; base64?: string | null; mimeType?: string | null; fileName?: string | null }): Promise<string | null> => {
    try {
      let contentType = asset.mimeType || guessMimeFromUri(asset.fileName || asset.uri);
      let fileBody: Blob | Uint8Array;
      if (asset.base64) {
        const bytes = base64ToUint8Array(asset.base64);
        fileBody = bytes;
      } else {
        const response = await fetch(asset.uri, { cache: 'no-store' });
        const fetched = await response.blob();
        fileBody = fetched;
        contentType = fetched.type || contentType;
      }
      const extGuess = (contentType.split('/')[1] || 'jpg').toLowerCase();
      const randomId = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const filePath = `services/${Date.now()}_${randomId()}.${extGuess}`;
      // Reuse 'designs' bucket as בפרויקט – ניתן להחליף ל-bucket ייעודי 'services' אם קיים
      const { error } = await supabase.storage.from('designs').upload(filePath, fileBody as any, { contentType, upsert: false });
      if (error) {
        console.error('upload error', error);
        return null;
      }
      const { data } = supabase.storage.from('designs').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e) {
      console.error('upload exception', e);
      return null;
    }
  };

  const handlePickServiceImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('הרשאה נחוצה', 'יש לאשר גישה לגלריה כדי לבחור תמונה');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.9,
      base64: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const a: any = result.assets[0];
      setAddSvcImage({
        uri: a.uri,
        base64: a.base64 ?? null,
        mimeType: a.mimeType ?? null,
        fileName: a.fileName ?? null,
      });
    }
  };

  const handlePickServiceImageForEdit = async (serviceId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('הרשאה נחוצה', 'יש לאשר גישה לגלריה כדי לבחור תמונה');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.9,
      base64: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const a: any = result.assets[0];
      setEditImageUploading((prev) => ({ ...prev, [serviceId]: true }));
      try {
        const uploadedUrl = await uploadServiceImage({
          uri: a.uri,
          base64: a.base64 ?? null,
          mimeType: a.mimeType ?? null,
          fileName: a.fileName ?? null,
        });
        if (!uploadedUrl) {
          Alert.alert('שגיאה', 'העלאת התמונה נכשלה');
          return;
        }
        updateLocalServiceField(serviceId, 'image_url', uploadedUrl as any);
      } finally {
        setEditImageUploading((prev) => ({ ...prev, [serviceId]: false }));
      }
    }
  };

  const handleOpenAddService = async () => {
    // Close the services bottom sheet first to avoid overlay blocking touches
    if (showServicesModal) {
      animateCloseSheet(() => setShowServicesModal(false));
    }
    // Small delay to ensure sheet closed before opening new modal
    setTimeout(async () => {
      setShowAddServiceModal(true);
      // category selection removed
    }, 250);
  };

  const handleCreateService = async () => {
    if (!addSvcName.trim()) {
      Alert.alert('שגיאה', 'אנא מלא שם לשירות');
      return;
    }
    setAddSvcIsSaving(true);
    try {
      let imageUrl: string | null = null;
      if (addSvcImage) {
        setAddSvcUploading(true);
        imageUrl = await uploadServiceImage(addSvcImage);
        setAddSvcUploading(false);
        if (!imageUrl) {
          Alert.alert('שגיאה', 'העלאת התמונה נכשלה');
          return;
        }
      }
      const created = await createService({
        name: addSvcName.trim(),
        price: parseFloat(addSvcPrice) || 0,
        duration_minutes: parseInt(addSvcDuration, 10) || 60,
        image_url: imageUrl || undefined,
        is_active: true,
      } as any);
      if (created) {
        setEditableServices(prev => [created, ...prev]);
        setShowAddServiceModal(false);
        // reset
        setAddSvcName('שירות חדש');
        setAddSvcPrice('0');
        setAddSvcDuration('60');
        setAddSvcImage(null);
      } else {
        Alert.alert('שגיאה', 'יצירת השירות נכשלה');
      }
    } catch (e) {
      Alert.alert('שגיאה', 'יצירת השירות נכשלה');
    } finally {
      setAddSvcIsSaving(false);
    }
  };

  const handleDeleteService = (id: string) => {
    Alert.alert('מחיקת שירות', 'האם אתה בטוח שברצונך למחוק את השירות?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteService(id);
          if (ok) {
            setEditableServices(prev => prev.filter(s => s.id !== id));
            if (expandedServiceId === id) setExpandedServiceId(null);
          } else {
            Alert.alert('שגיאה', 'מחיקת השירות נכשלה');
          }
        }
      }
    ]);
  };

  const handleSaveService = async (service: Service) => {
    setSavingServiceId(service.id);
    try {
      const updated = await updateService(service.id, {
        name: service.name,
        price: service.price,
        image_url: service.image_url,
        duration_minutes: service.duration_minutes,
        is_active: service.is_active,
      });
      if (!updated) {
        Alert.alert('שגיאה', 'שמירת השירות נכשלה');
        return;
      }
      setEditableServices(prev => prev.map(s => (s.id === service.id ? updated : s)));
      Alert.alert('הצלחה', 'השירות נשמר בהצלחה');
    } catch (e) {
      Alert.alert('שגיאה', 'שמירת השירות נכשלה');
    } finally {
      setSavingServiceId(null);
    }
  };

  // handleSendNotification removed (handled by AdminBroadcastComposer)

  const handleCallSupport = async () => {
    const phone = '0527488779';
    const url = `tel:${phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('שגיאה', 'לא ניתן לבצע שיחה מהמכשיר הזה');
      }
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לבצע שיחה מהמכשיר הזה');
    }
  };

  // Title helpers removed (handled by AdminBroadcastComposer)
  
  // Recurring appointment modal state
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [isSubmittingRecurring, setIsSubmittingRecurring] = useState(false);
  const [showManageRecurringModal, setShowManageRecurringModal] = useState(false);
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [isLoadingRecurring, setIsLoadingRecurring] = useState(false);
  const [recurringList, setRecurringList] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Array<{ name: string; phone: string }>>([]);
  const [selectedClient, setSelectedClient] = useState<{ name: string; phone: string } | null>(null);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const [showDayDropdown, setShowDayDropdown] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [showTimeSheet, setShowTimeSheet] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [recurringServices, setRecurringServices] = useState<Service[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState<number>(1);
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);

  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const timeOptions = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,'0')}:00`);

  // Compute next date string (YYYY-MM-DD) for a given dayOfWeek (0..6) from today
  const getNextDateForDay = (dayOfWeek: number): string => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const currentDow = start.getDay();
    const delta = (dayOfWeek - currentDow + 7) % 7; // 0..6
    const target = new Date(start);
    target.setDate(start.getDate() + delta);
    return target.toISOString().split('T')[0];
  };

  // Validate that the selected time is still available for the nearest occurrence of the chosen day
  const isTimeAvailable = async (dayOfWeek: number, timeHHmm: string): Promise<boolean> => {
    try {
      // 1) Check conflicts with other recurring rules
      const { data: recurring } = await supabase
        .from('recurring_appointments')
        .select('slot_time')
        .eq('day_of_week', dayOfWeek);
      const recurringTimes = new Set((recurring || []).map((r: any) => String(r.slot_time).slice(0,5)));
      if (recurringTimes.has(timeHHmm)) return false;

      // 2) Check conflicts with existing booked slots on nearest occurrence date
      const targetDate = getNextDateForDay(dayOfWeek);
      const { data: booked } = await supabase
        .from('available_time_slots')
        .select('slot_time, is_available')
        .eq('slot_date', targetDate)
        .eq('is_available', false);
      const bookedTimes = new Set((booked || []).map((s: any) => String(s.slot_time).slice(0,5)));
      if (bookedTimes.has(timeHHmm)) return false;

      return true;
    } catch {
      // If check fails for any reason, be conservative and prevent selection
      return false;
    }
  };

  const loadAvailableTimesForDay = async (dayOfWeek: number) => {
    setIsLoadingTimes(true);
    setAvailableTimes([]);
    try {
      // Fetch business hours for day
      const { data: bhRow } = await supabase
        .from('business_hours')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .maybeSingle();

      if (!bhRow) {
        setAvailableTimes([]);
        return;
      }

      // Build windows minus breaks
      type Window = { start: string; end: string };
      const baseWindows: Window[] = [{ start: bhRow.start_time, end: bhRow.end_time }];
      const brks: Array<{ start_time: string; end_time: string }> = (bhRow as any).breaks || [];
      const singleBreak = (bhRow.break_start_time && bhRow.break_end_time)
        ? [{ start_time: bhRow.break_start_time, end_time: bhRow.break_end_time }]
        : [];
      const allBreaks = [...brks, ...singleBreak];

      const subtractBreaks = (wins: Window[], breaks: typeof allBreaks): Window[] => {
        let result = wins.slice();
        for (const b of breaks) {
          const next: Window[] = [];
          for (const w of result) {
            if (b.end_time <= w.start || b.start_time >= w.end) {
              next.push(w);
              continue;
            }
            if (w.start < b.start_time) next.push({ start: w.start, end: b.start_time });
            if (b.end_time < w.end) next.push({ start: b.end_time, end: w.end });
          }
          result = next;
        }
        return result.filter(w => w.start < w.end);
      };

      const windows = subtractBreaks(baseWindows, allBreaks);

      // Enumerate options by slot duration
      const dur: number = bhRow.slot_duration_minutes && bhRow.slot_duration_minutes > 0 ? bhRow.slot_duration_minutes : 60;
      const addMinutes = (hhmm: string, minutes: number): string => {
        const [h, m] = hhmm.split(':').map((x: string) => parseInt(x, 10));
        const total = h * 60 + m + minutes;
        const hh = Math.floor(total / 60) % 24;
        const mm = total % 60;
        return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
      };

      const compareTimes = (a: string, b: string) => a.localeCompare(b);
      const baseTimes: string[] = [];
      for (const w of windows) {
        let t = w.start as string;
        while (compareTimes(t, w.end) < 0) {
          baseTimes.push(t.slice(0,5));
          t = addMinutes(t, dur);
        }
      }

      // Exclude conflicts with other recurring rules (same day/time)
      const { data: recurring } = await supabase
        .from('recurring_appointments')
        .select('slot_time')
        .eq('day_of_week', dayOfWeek);
      const recurringTimes = new Set((recurring || []).map((r: any) => String(r.slot_time).slice(0,5)));

      // Exclude conflicts with existing booked slots on the nearest occurrence date
      const targetDate = getNextDateForDay(dayOfWeek);
      const { data: booked } = await supabase
        .from('available_time_slots')
        .select('slot_time, is_available')
        .eq('slot_date', targetDate)
        .eq('is_available', false);
      const bookedTimes = new Set((booked || []).map((s: any) => String(s.slot_time).slice(0,5)));

      const filtered = baseTimes.filter(t => !recurringTimes.has(t) && !bookedTimes.has(t));
      setAvailableTimes(filtered);
      // Reset selected time if it became invalid
      if (selectedTime && !filtered.includes(selectedTime)) {
        setSelectedTime(null);
      }
    } finally {
      setIsLoadingTimes(false);
    }
  };

  // Reload available times when the day changes or when opening modal
  useEffect(() => {
    if (showRecurringModal && Number.isInteger(selectedDayOfWeek as any)) {
      loadAvailableTimesForDay(selectedDayOfWeek as number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRecurringModal, selectedDayOfWeek]);

  useEffect(() => {
    if (showRecurringModal) {
      // Preload services list for selection
      servicesApi.getAllServices().then(setRecurringServices).catch(() => setRecurringServices([]));
      // Reset fields
      setClientSearch('');
      setSelectedClient(null);
      setSelectedDayOfWeek(null);
      setSelectedTime(null);
      setSelectedService(null);
      setRepeatWeeks(1);
      setShowDayDropdown(false);
      setShowTimeDropdown(false);
      setShowServiceDropdown(false);
      setShowClientDropdown(false);
      setShowRepeatDropdown(false);
      // Load initial client list (show all clients by default)
      searchClients('');
    }
  }, [showRecurringModal]);

  const searchClients = async (q: string) => {
    setClientSearch(q);
    const query = (q || '').trim();
    let builder = supabase
      .from('users')
      .select('name, phone')
      .eq('user_type', 'client')
      .order('name');
    if (query.length > 0) {
      builder = builder.or(`name.ilike.%${query}%,phone.ilike.%${query}%`);
    }
    const { data, error } = await builder;
    if (error) {
      setClientResults([]);
      return;
    }
    // Exclude clients that already have any recurring appointment
    const { data: recs } = await supabase
      .from('recurring_appointments')
      .select('client_phone');
    const recurringPhones = new Set((recs || []).map((r: any) => String(r.client_phone).trim()).filter(Boolean));

    const filtered = (data || [])
      .filter((u: any) => u.phone && u.phone.trim() !== '')
      .filter((u: any) => !recurringPhones.has(String(u.phone).trim()));

    setClientResults(filtered);
  };

  const handleSubmitRecurring = async () => {
    if (!selectedClient || selectedDayOfWeek === null || !selectedTime || !selectedService) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות: לקוח, יום, שעה ושירות');
      return;
    }
    // Final guard before creating: verify time is still available for the nearest occurrence
    const stillAvailable = await isTimeAvailable(selectedDayOfWeek as number, selectedTime as string);
    if (!stillAvailable) {
      Alert.alert('תור נתפס', 'השעה שבחרת כבר נתפסה לשבוע הקרוב. אנא בחר שעה אחרת.');
      return;
    }
    setIsSubmittingRecurring(true);
    try {
      const created = await recurringAppointmentsApi.create({
        client_name: selectedClient.name || 'לקוח',
        client_phone: selectedClient.phone,
        day_of_week: selectedDayOfWeek,
        slot_time: selectedTime,
        service_name: selectedService.name,
        repeat_interval_weeks: repeatWeeks,
      } as any);
      if (created) {
        Alert.alert('הצלחה', 'התור הקבוע נוצר בהצלחה. לאחר יצירת התורים השבועית, הסלוט יישמר ללקוח.');
        setShowRecurringModal(false);
      } else {
        Alert.alert('שגיאה', 'יצירת התור הקבוע נכשלה');
      }
    } catch (e) {
      Alert.alert('שגיאה', 'יצירת התור הקבוע נכשלה');
    } finally {
      setIsSubmittingRecurring(false);
    }
  };



  const renderSettingItem = (
    icon: React.ReactNode,
    title: string,
    subtitle?: string,
    rightComponent?: React.ReactNode,
    onPress?: () => void,
    swapIconAndRight?: boolean
  ) => {
    return (
      <View>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={onPress}
          disabled={!onPress}
        >
          {/* החלפת מיקומים: חץ משמאל, אייקון מימין */}
          {!rightComponent && onPress ? (
            <>
              <View style={styles.settingChevron}><ChevronLeft size={20} color={Colors.subtext} /></View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{title}</Text>
                {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
              </View>
              <View style={styles.settingIcon}>{icon}</View>
            </>
          ) : (
            <>
              {swapIconAndRight ? (
                <>
                  {/* החלפת מיקומים: rightComponent משמאל, אייקון מימין */}
                  <View>{rightComponent}</View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>{title}</Text>
                    {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
                  </View>
                  <View style={styles.settingIcon}>{icon}</View>
                </>
              ) : (
                <>
                  <View>{rightComponent}</View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>{title}</Text>
                    {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
                  </View>
                  <View style={styles.settingIcon}>{icon}</View>
                </>
              )}
            </>
          )}
        </TouchableOpacity>
        <View style={styles.settingDivider} />
      </View>
    );
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.white }]} edges={['top']}>
      <LinearGradient
        colors={[Colors.white, Colors.white]}
        style={styles.headerGradient}
      >
        
        <View style={styles.adminProfileCard}>
          <View style={styles.adminAvatarWrap}>
            <LinearGradient
              colors={["#7B61FF", "#7B61FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adminAvatarRing}
            >
              <View style={styles.adminAvatar}>
                <Image source={user?.image_url ? { uri: (user as any).image_url } : require('@/assets/images/logo-02.png')} style={styles.adminAvatarImage} resizeMode="cover" />
              </View>
            </LinearGradient>
            <TouchableOpacity
              style={styles.adminEditFab}
              onPress={() => {
                setAdminNameDraft(user?.name || '');
                setAdminPhoneDraft((user as any)?.phone || '');
                setAdminEmailDraft((user as any)?.email || '');
                setShowEditAdminModal(true);
              }}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="עריכת מנהל"
            >
              <LinearGradient
                colors={["#7B61FF", "#7B61FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.adminEditFabInner}
              >
                <Pencil size={16} color={Colors.white} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <Text style={styles.adminName}>{user?.name || 'מנהל'}</Text>
          <Text style={styles.adminPhone}>{user?.phone || 'מספר טלפון'}</Text>
          <Text style={styles.adminEmail}>{(user as any)?.email || 'כתובת מייל'}</Text>
        </View>
      </LinearGradient>
      
      <View style={styles.contentWrapper}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.sectionTitleNew}>התראות והודעות</Text>
        
        <View style={[styles.cardNew, shadowStyle]}>
          {renderSettingItem(
            <Bell size={20} color={Colors.primary} />,
            'התראות',
            'קבלת התראות על תורים ועדכונים',
            <AppSwitch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />,
            undefined,
            true
          )}
          
          {renderSettingItem(
            <Send size={20} color={Colors.primary} />,
            'שליחת הודעה לכל הלקוחות',
            'שלח התראה מותאמת אישית לכל הלקוחות',
            undefined,
            () => setShowBroadcast(true)
          )}
          

        </View>
        
        <Text style={styles.sectionTitleNew}>שירותים</Text>
        <View style={[styles.cardNew, shadowStyle]}>
          {renderSettingItem(
            <Pencil size={20} color={Colors.primary} />,
            'עריכת שירותים',
            'עדכון מחירים ומשך',
            undefined,
            openServicesModal
          )}
        </View>

        <Text style={styles.sectionTitleNew}>פרטי העסק</Text>
        <View style={[styles.cardNew, shadowStyle]}>
          {renderSettingItem(
            <Pencil size={20} color={Colors.primary} />, 
            'שם העסק',
            profileDisplayName || 'הוסף שם עסק',
            undefined,
            () => { setDisplayNameDraft(profileDisplayName || ''); setShowEditDisplayNameModal(true); }
          )}
          {renderSettingItem(
            <MapPin size={20} color="#FF3B30" />, 
            'כתובת העסק',
            profileAddress || 'הוסף כתובת',
            undefined,
            openEditAddress
          )}
          {renderSettingItem(
            <Instagram size={20} color="#E4405F" />, 
            'Instagram',
            profileInstagram ? undefined : 'הוסף קישור אינסטגרם',
            undefined,
            openEditInstagram
          )}
          {renderSettingItem(
            <Facebook size={20} color="#1877F2" />, 
            'Facebook',
            profileFacebook ? undefined : 'הוסף קישור פייסבוק',
            undefined,
            openEditFacebook
          )}
          {renderSettingItem(
            <Ionicons name="logo-tiktok" size={20} color="#000000" />, 
            'TikTok',
            profileTiktok ? undefined : 'הוסף קישור טיקטוק',
            undefined,
            openEditTiktok
          )}
        </View>

        {isAdmin && (
          <>
            <Text style={styles.sectionTitleNew}>ניהול תורים</Text>
            <View style={[styles.cardNew, shadowStyle]}>
              {renderSettingItem(
                <Calendar size={20} color={Colors.primary} />,
                'הוספת תור ללקוח',
                'קביעת תור חדש עבור לקוח',
                undefined,
                () => setShowAddAppointmentModal(true)
              )}
            </View>

            <Text style={styles.sectionTitleNew}>תורים קבועים</Text>
            <View style={[styles.cardNew, shadowStyle]}>
              {renderSettingItem(
                <Pencil size={20} color={Colors.primary} />, // reuse icon
                'הוספת תור קבוע',
                'בחר לקוח, יום ושעה לקביעת תור קבוע',
                undefined,
                () => setShowRecurringModal(true)
              )}
              {renderSettingItem(
                <Pencil size={20} color={Colors.primary} />, // reuse icon
                'ניהול תורים קבועים',
                'צפה, ערוך ומחק תורים קבועים קיימים',
                undefined,
                async () => {
                  setShowManageRecurringModal(true);
                  setIsLoadingRecurring(true);
                  try {
                    const items = await recurringAppointmentsApi.listAll();
                    setRecurringList(items);
                  } finally {
                    setIsLoadingRecurring(false);
                  }
                }
              )}
            </View>
          </>
        )}
        
        
        
        <Text style={styles.sectionTitleNew}>אבטחה ותמיכה</Text>
        
        <View style={[styles.cardNew, shadowStyle]}>
          {renderSettingItem(
            <HelpCircle size={20} color={Colors.primary} />,
            'עזרה ותמיכה',
            'שאלות נפוצות ויצירת קשר',
            undefined,
            () => setShowSupportModal(true)
          )}
        </View>
        
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={Colors.white} />
          <Text style={styles.logoutText}>התנתקות</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionText}>גרסה 1.0.0</Text>
        </ScrollView>
      </View>

      {/* Admin broadcast popup (consistent with Home screen) */}
      <AdminBroadcastComposer open={showBroadcast} onOpenChange={setShowBroadcast} renderTrigger={false} />

      {/* Support Modal */}
      <Modal
        visible={showSupportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowSupportModal(false)}
            >
              <Text style={styles.modalCloseText}>סגור</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>עזרה ותמיכה</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.previewCard}>
              <Text style={styles.previewNotificationTitle}>
                לכל עזרה ותמיכה יש ליצור קשר טלפוני עם חברת BCODE
              </Text>
              <Text style={styles.previewNotificationContent}>
                צוות התמיכה זמין עבורכם. לחצו על הכפתור מטה לחיוג מיידי.
              </Text>
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <TouchableOpacity style={styles.modalSendButton} onPress={handleCallSupport}>
                  <Text style={styles.modalSendText}>התקשר עכשיו </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Display Name Modal */}
      <Modal
        visible={showEditDisplayNameModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditDisplayNameModal(false)}
      >
        <View style={styles.smallModalOverlay}>
          <View style={styles.smallModalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEditDisplayNameModal(false)}>
                <Text style={styles.modalCloseText}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>שם העסק</Text>
              <TouchableOpacity style={[styles.modalSendButton, isSavingProfile && styles.modalSendButtonDisabled]} onPress={async () => {
                setIsSavingProfile(true);
                try {
                  const updated = await businessProfileApi.upsertProfile({
                    display_name: displayNameDraft.trim() || null as any,
                    address: (profileAddress || '').trim() || null as any,
                    instagram_url: (profileInstagram || '').trim() || null as any,
                    facebook_url: (profileFacebook || '').trim() || null as any,
                  });
                  if (updated) {
                    setProfile(updated);
                    setProfileDisplayName(updated.display_name || '');
                    setShowEditDisplayNameModal(false);
                  } else {
                    Alert.alert('שגיאה', 'שמירת שם העסק נכשלה');
                  }
                } finally {
                  setIsSavingProfile(false);
                }
              }} disabled={isSavingProfile}>
                <Text style={[styles.modalSendText, isSavingProfile && styles.modalSendTextDisabled]}>{isSavingProfile ? 'שומר...' : 'שמור'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.smallModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>שם העסק</Text>
                <TextInput
                  style={styles.textInput}
                  value={displayNameDraft}
                  onChangeText={setDisplayNameDraft}
                  placeholder="לדוגמה: הסטודיו של הודיה"
                  placeholderTextColor={Colors.subtext}
                  textAlign="right"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Admin (name & phone) Modal */}
      <Modal
        visible={showEditAdminModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditAdminModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: '#F8F9FA' }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEditAdminModal(false)}>
              <Text style={styles.modalCloseText}>ביטול</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>עריכת מנהל</Text>
            <TouchableOpacity
              style={[styles.modalSendButton, (isSavingAdmin) && styles.modalSendButtonDisabled]}
              onPress={async () => {
                if (!user?.id) { setShowEditAdminModal(false); return; }
                if (!adminNameDraft.trim() || !adminPhoneDraft.trim()) { Alert.alert('שגיאה', 'אנא מלא שם ומספר טלפון'); return; }
                try {
                  setIsSavingAdmin(true);
                  const updated = await usersApi.updateUser(
                    user.id as any,
                    {
                      name: adminNameDraft.trim() as any,
                      phone: adminPhoneDraft.trim() as any,
                      // pass null to clear email when empty
                      email: (adminEmailDraft || '').trim() ? (adminEmailDraft || '').trim() : (null as any),
                    } as any
                  );
                  if (updated) {
                    updateUserProfile({ name: updated.name as any, phone: (updated as any).phone, email: (updated as any).email } as any);
                    setShowEditAdminModal(false);
                  } else {
                    Alert.alert('שגיאה', 'שמירת פרטי המנהל נכשלה');
                  }
                } finally {
                  setIsSavingAdmin(false);
                }
              }}
              disabled={isSavingAdmin}
            >
              <Text style={[styles.modalSendText, isSavingAdmin && styles.modalSendTextDisabled]}>{isSavingAdmin ? 'שומר...' : 'שמור'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={styles.modalAvatarWrap}>
                <LinearGradient
                  colors={["#7B61FF", "#7B61FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalAvatarRing}
                >
                  <TouchableOpacity style={styles.modalAvatar} onPress={handlePickAdminAvatar} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="שנה תמונת מנהלת">
                    <Image source={user?.image_url ? { uri: (user as any).image_url } : require('@/assets/images/logo-02.png')} style={styles.modalAvatarImage} resizeMode="cover" />
                    {isUploadingAdminAvatar && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 36 }}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              </View>
              <Text style={styles.modalAdminName}>{adminNameDraft || user?.name || 'מנהל'}</Text>
              <Text style={styles.modalAdminMeta}>{adminPhoneDraft || (user as any)?.phone || ''}</Text>
              {(adminEmailDraft || (user as any)?.email) ? (
                <Text style={styles.modalAdminMeta}>{adminEmailDraft || (user as any)?.email}</Text>
              ) : null}
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity onPress={handlePickAdminAvatar} style={[styles.pickButton, { alignSelf: 'center', backgroundColor: '#F2F2F7', borderColor: '#E5E5EA' }]} activeOpacity={0.85} disabled={isUploadingAdminAvatar}>
                  <Text style={styles.pickButtonText}>{isUploadingAdminAvatar ? 'מעלה...' : 'החלף תמונה'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.iosCard}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>שם המנהל</Text>
                <TextInput
                  style={styles.textInput}
                  value={adminNameDraft}
                  onChangeText={setAdminNameDraft}
                  placeholder="שם מלא"
                  placeholderTextColor={Colors.subtext}
                  textAlign="right"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>מספר טלפון</Text>
                <TextInput
                  style={styles.textInput}
                  value={adminPhoneDraft}
                  onChangeText={setAdminPhoneDraft}
                  placeholder="050-0000000"
                  placeholderTextColor={Colors.subtext}
                  keyboardType="phone-pad"
                  textAlign="right"
                />
              </View>
              <View style={[styles.inputContainer, { marginBottom: 0 }]}>
                <Text style={styles.inputLabel}>כתובת מייל</Text>
                <TextInput
                  style={styles.textInput}
                  value={adminEmailDraft}
                  onChangeText={setAdminEmailDraft}
                  placeholder="name@example.com"
                  placeholderTextColor={Colors.subtext}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign="right"
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Address Modal */}
      <Modal
        visible={showEditAddressModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditAddressModal(false)}
      >
        <View style={styles.smallModalOverlay}>
          <View style={styles.smallModalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEditAddressModal(false)}>
                <Text style={styles.modalCloseText}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>עריכת כתובת</Text>
              <TouchableOpacity style={[styles.modalSendButton, isSavingProfile && styles.modalSendButtonDisabled]} onPress={saveAddress} disabled={isSavingProfile}>
                <Text style={[styles.modalSendText, isSavingProfile && styles.modalSendTextDisabled]}>{isSavingProfile ? 'שומר...' : 'שמור'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.smallModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>כתובת</Text>
                <TextInput
                  style={styles.textInput}
                  value={addressDraft}
                  onChangeText={setAddressDraft}
                  placeholder="כתובת העסק"
                  placeholderTextColor={Colors.subtext}
                  textAlign="right"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Instagram Modal */}
      <Modal
        visible={showEditInstagramModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditInstagramModal(false)}
      >
        <View style={styles.smallModalOverlay}>
          <View style={styles.smallModalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEditInstagramModal(false)}>
                <Text style={styles.modalCloseText}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>קישור אינסטגרם</Text>
              <TouchableOpacity style={[styles.modalSendButton, isSavingProfile && styles.modalSendButtonDisabled]} onPress={saveInstagram} disabled={isSavingProfile}>
                <Text style={[styles.modalSendText, isSavingProfile && styles.modalSendTextDisabled]}>{isSavingProfile ? 'שומר...' : 'שמור'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.smallModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Instagram URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={instagramDraft}
                  onChangeText={setInstagramDraft}
                  placeholder="https://instagram.com/yourpage"
                  placeholderTextColor={Colors.subtext}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign="right"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Facebook Modal */}
      <Modal
        visible={showEditFacebookModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditFacebookModal(false)}
      >
        <View style={styles.smallModalOverlay}>
          <View style={styles.smallModalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEditFacebookModal(false)}>
                <Text style={styles.modalCloseText}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>קישור פייסבוק</Text>
              <TouchableOpacity style={[styles.modalSendButton, isSavingProfile && styles.modalSendButtonDisabled]} onPress={saveFacebook} disabled={isSavingProfile}>
                <Text style={[styles.modalSendText, isSavingProfile && styles.modalSendTextDisabled]}>{isSavingProfile ? 'שומר...' : 'שמור'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.smallModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Facebook URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={facebookDraft}
                  onChangeText={setFacebookDraft}
                  placeholder="https://facebook.com/yourpage"
                  placeholderTextColor={Colors.subtext}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign="right"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit TikTok Modal */}
      <Modal
        visible={showEditTiktokModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditTiktokModal(false)}
      >
        <View style={styles.smallModalOverlay}>
          <View style={styles.smallModalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEditTiktokModal(false)}>
                <Text style={styles.modalCloseText}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>קישור טיקטוק</Text>
              <TouchableOpacity style={[styles.modalSendButton, isSavingProfile && styles.modalSendButtonDisabled]} onPress={saveTiktok} disabled={isSavingProfile}>
                <Text style={[styles.modalSendText, isSavingProfile && styles.modalSendTextDisabled]}>{isSavingProfile ? 'שומר...' : 'שמור'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.smallModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>TikTok URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={tiktokDraft}
                  onChangeText={setTiktokDraft}
                  placeholder="https://www.tiktok.com/@yourpage"
                  placeholderTextColor={Colors.subtext}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign="right"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time selection now uses inline dropdown below the field (no nested modal) */}
      {/* Manage Recurring Appointments Modal */}
      <Modal
        visible={showManageRecurringModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowManageRecurringModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: '#F8F9FA' }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowManageRecurringModal(false)}
            >
              <Text style={styles.modalCloseText}>סגור</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>ניהול תורים קבועים</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.recurringCard}>
              {isLoadingRecurring ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={{ marginTop: 12, color: Colors.subtext }}>טוען...</Text>
                </View>
              ) : (
                <View>
                  {recurringList.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: Colors.subtext }}>אין תורים קבועים</Text>
                  ) : (
                    recurringList.map((item, idx) => (
                      <View key={item.id}>
                        <View style={styles.manageItemRow}>
                          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ alignItems: 'flex-end', flex: 1 }}>
                              <Text style={styles.previewNotificationTitle}>{item.client_name}</Text>
                              <Text style={styles.previewNotificationContent}>{item.client_phone}</Text>
                              <Text style={styles.previewNotificationContent}>{item.service_name}</Text>
                              <Text style={styles.previewNotificationContent}>{['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][item.day_of_week]} · {String(item.slot_time).slice(0,5)}</Text>
                            </View>
                            <View style={styles.itemActions}>
                              <TouchableOpacity
                                style={styles.iconActionButton}
                                onPress={async () => {
                                  const ok = await recurringAppointmentsApi.delete(item.id);
                                  if (ok) setRecurringList((prev) => prev.filter((x) => x.id !== item.id));
                                  else Alert.alert('שגיאה', 'מחיקה נכשלה');
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="מחק"
                              >
                                <Trash2 size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                        {idx < recurringList.length - 1 && <View style={styles.manageDivider} />}
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {/* Recurring Appointment Modal */}
      <Modal
        visible={showRecurringModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRecurringModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: '#F8F9FA' }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowRecurringModal(false)}
            >
              <Text style={styles.modalCloseText}>ביטול</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>הוספת תור קבוע</Text>
            <TouchableOpacity 
              style={[styles.modalSendButton, isSubmittingRecurring && styles.modalSendButtonDisabled]}
              onPress={handleSubmitRecurring}
              disabled={isSubmittingRecurring}
            >
              <Text style={[styles.modalSendText, isSubmittingRecurring && styles.modalSendTextDisabled]}>
                {isSubmittingRecurring ? 'שומר...' : 'שמור'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.recurringCard}>
            {/* Client select as dropdown with inline search */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>לקוח</Text>
              {!selectedClient ? (
                <>
                  <Pressable style={[styles.dropdownContainer, styles.grayField]} onPress={() => setShowClientDropdown(!showClientDropdown)}>
                    <View style={styles.dropdownHeader}>
                      <Text style={[styles.dropdownText, styles.dropdownPlaceholder]}>בחר לקוח...</Text>
                      {showClientDropdown ? <ChevronUp size={20} color={Colors.subtext} /> : <ChevronDown size={20} color={Colors.subtext} />}
                    </View>
                  </Pressable>
                  {showClientDropdown && (
                    <View style={styles.dropdownOptions}>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                        <TextInput
                          style={[styles.textInput, { borderWidth: 1, borderColor: '#E5E5EA', backgroundColor: '#F2F2F7' }]}
                          value={clientSearch}
                          onChangeText={searchClients}
                          placeholder="חיפוש לפי שם או טלפון..."
                          placeholderTextColor={Colors.subtext}
                          textAlign="right"
                        />
                      </View>
                      <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {clientResults.map((c, idx) => (
                          <Pressable
                            key={c.phone}
                            style={[styles.dropdownOption, idx === clientResults.length - 1 && styles.dropdownOptionLast]}
                            onPress={() => { setSelectedClient(c); setShowClientDropdown(false); }}
                          >
                            <View style={styles.dropdownOptionContent}>
                              <Text style={styles.dropdownOptionTitle}>{c.name || 'לקוח'}</Text>
                              <Text style={styles.dropdownOptionDescription}>{c.phone}</Text>
                            </View>
                          </Pressable>
                        ))}
                        {clientResults.length === 0 && (
                          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                            <Text style={{ textAlign: 'center', color: Colors.subtext }}>אין תוצאות</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </>
              ) : (
                <View style={[styles.previewCard, { marginTop: 6 }]}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.previewNotificationTitle}>{selectedClient.name}</Text>
                      <Text style={styles.previewNotificationContent}>{selectedClient.phone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedClient(null); setShowClientDropdown(false); }}>
                      <Text style={{ color: '#FF3B30', fontWeight: '600' }}>שנה</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Service select (before day/time) */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>שירות</Text>
              <Pressable style={[styles.dropdownContainer, styles.grayField]} onPress={() => setShowServiceDropdown(!showServiceDropdown)}>
                <View style={styles.dropdownHeader}>
                  {selectedService ? (
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.serviceHeaderTitle}>{selectedService.name}</Text>
                      {!!selectedService.duration_minutes && (
                        <Text style={styles.serviceHeaderSub}>{`${selectedService.duration_minutes} דקות`}</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.dropdownText, styles.dropdownPlaceholder]}>בחר שירות...</Text>
                  )}
                  {showServiceDropdown ? <ChevronUp size={20} color={Colors.subtext} /> : <ChevronDown size={20} color={Colors.subtext} />}
                </View>
              </Pressable>
              {showServiceDropdown && (
                <View style={styles.dropdownOptions}>
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {recurringServices.map((svc, idx) => (
                      <Pressable
                        key={svc.id}
                        style={[styles.dropdownOption, idx === recurringServices.length - 1 && styles.dropdownOptionLast]}
                        onPress={() => { setSelectedService(svc); setShowServiceDropdown(false); }}
                      >
                        <View style={styles.dropdownOptionContent}>
                          <Text style={styles.dropdownOptionTitle}>{svc.name}</Text>
                          {!!svc.duration_minutes && (
                            <Text style={styles.dropdownOptionDescription}>{`${svc.duration_minutes} דקות`}</Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Repeat interval selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>חזרתיות</Text>
              <Pressable style={[styles.dropdownContainer, styles.grayField]} onPress={() => setShowRepeatDropdown(!showRepeatDropdown)}>
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownText}>{repeatWeeks === 1 ? 'כל שבוע' : `כל ${repeatWeeks} שבועות`}</Text>
                  {showRepeatDropdown ? <ChevronUp size={20} color={Colors.subtext} /> : <ChevronDown size={20} color={Colors.subtext} />}
                </View>
              </Pressable>
              {showRepeatDropdown && (
                <View style={styles.dropdownOptions}>
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {[1, 2, 3, 4].map((w, idx) => (
                      <Pressable
                        key={w}
                        style={[styles.dropdownOption, idx === 3 && styles.dropdownOptionLast]}
                        onPress={() => { setRepeatWeeks(w); setShowRepeatDropdown(false); }}
                      >
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.dropdownOptionTitle}>{w === 1 ? 'כל שבוע' : `כל ${w} שבועות`}</Text>
                          {repeatWeeks === w && <Check size={18} color={Colors.primary} />}
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Day select (disabled until service chosen) */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>יום בשבוע</Text>
              <Pressable
                style={[styles.dropdownContainer, styles.grayField, { opacity: selectedService ? 1 : 0.6 }]}
                onPress={() => {
                  if (!selectedService) {
                    Alert.alert('שגיאה', 'בחר תחילה שירות');
                    return;
                  }
                  setShowDayDropdown(!showDayDropdown);
                }}
              >
                <View style={styles.dropdownHeader}>
                  <Text style={[styles.dropdownText, !Number.isInteger(selectedDayOfWeek as any) && styles.dropdownPlaceholder]}>
                    {Number.isInteger(selectedDayOfWeek as any) ? dayNames[selectedDayOfWeek as number] : 'בחר יום...'}
                  </Text>
                  {showDayDropdown ? <ChevronUp size={20} color={Colors.subtext} /> : <ChevronDown size={20} color={Colors.subtext} />}
                </View>
              </Pressable>
              {showDayDropdown && (
                <View style={styles.dropdownOptions}>
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {dayNames.map((n, idx) => (
                      <Pressable key={n} style={[styles.dropdownOption, idx === dayNames.length - 1 && styles.dropdownOptionLast]} onPress={() => { setSelectedDayOfWeek(idx); setShowDayDropdown(false); }}>
                        <Text style={styles.dropdownOptionTitle}>{n}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Time select */}
            <View style={styles.inputContainer}> 
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderIcon}><Pencil size={18} color={Colors.primary} /></View>
                <Text style={styles.sectionHeaderTitle}>בחירת שעה</Text>
              </View>
              <Pressable
                style={[styles.dropdownContainer, styles.grayField, { opacity: Number.isInteger(selectedDayOfWeek as any) ? 1 : 0.6 }]}
                onPress={() => {
                  if (!selectedService) {
                    Alert.alert('שגיאה', 'בחר תחילה שירות');
                    return;
                  }
                  if (!Number.isInteger(selectedDayOfWeek as any)) {
                    Alert.alert('שגיאה', 'בחר תחילה יום בשבוע');
                    return;
                  }
                  setShowTimeDropdown((prev) => !prev);
                  if (availableTimes.length === 0 && !isLoadingTimes && Number.isInteger(selectedDayOfWeek as any)) {
                    loadAvailableTimesForDay(selectedDayOfWeek as number);
                  }
                }}
              >
                <View style={styles.dropdownHeader}>
                  <Text style={[styles.dropdownText, !selectedTime && styles.dropdownPlaceholder]}>
                    {selectedTime || (isLoadingTimes ? 'טוען שעות...' : 'בחר שעה...')}
                  </Text>
                  {showTimeDropdown ? <ChevronUp size={20} color={Colors.subtext} /> : <ChevronDown size={20} color={Colors.subtext} />}
                </View>
              </Pressable>
              {showTimeDropdown && (
                <View style={styles.dropdownOptions}>
                  {isLoadingTimes ? (
                    <View style={{ padding: 12, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                    </View>
                  ) : availableTimes.length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ textAlign: 'center', color: Colors.subtext }}>אין שעות פנויות ליום זה</Text>
                    </View>
                  ) : (
                    <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {availableTimes.map((t, idx) => (
                        <Pressable
                          key={t}
                          style={[styles.dropdownOption, idx === availableTimes.length - 1 && styles.dropdownOptionLast]}
                          onPress={async () => {
                            if (!Number.isInteger(selectedDayOfWeek as any)) return;
                            const ok = await isTimeAvailable(selectedDayOfWeek as number, t);
                            if (!ok) {
                              Alert.alert('תור נתפס', 'השעה שבחרת כבר נתפסה לשבוע הקרוב. אנא בחר שעה אחרת.');
                              return;
                            }
                            setSelectedTime(t);
                            setShowTimeDropdown(false);
                          }}
                        >
                          <View style={styles.dropdownOptionContent}>
                            <Text style={styles.dropdownOptionTitle}>{t}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>

            {/* Service select moved above */}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {/* Services Edit Modal as animated bottom sheet */}
      <Modal
        visible={showServicesModal}
        transparent
        animationType="fade"
        onRequestClose={closeServicesModal}
      >
        <View style={styles.sheetRoot}>
          <TouchableWithoutFeedback onPress={closeServicesModal}>
            <Animated.View style={[styles.sheetOverlay, { opacity: overlayOpacity }]} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[styles.sheetContainer, { transform: [{ translateY: combinedTranslateY }] } ] }
          >
            <View style={styles.dragHandleArea}>
              <View style={styles.sheetGrabberWrapper} {...panResponder.panHandlers}>
                <View style={styles.sheetGrabber} />
              </View>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={closeServicesModal}
                  accessibilityRole="button"
                  accessibilityLabel="סגור"
                >
                  <X size={20} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>עריכת שירותים</Text>
                <TouchableOpacity 
                  style={styles.modalActionButton}
                  onPress={handleOpenAddService}
                  accessibilityRole="button"
                  accessibilityLabel="הוסף שירות"
                >
                  <Text style={styles.modalActionText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.sheetBody}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.modalContentContainer, { paddingBottom: insets.bottom + 8 }]}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={false}
                scrollIndicatorInsets={{ bottom: 0 }}
                alwaysBounceVertical
              >
                {isLoadingServices && (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ marginTop: 12, color: Colors.subtext }}>טוען שירותים...</Text>
                  </View>
                )}

                {servicesError && (
                  <Text style={{ color: 'red', textAlign: 'center', marginVertical: 12 }}>{servicesError}</Text>
                )}

                {!isLoadingServices && !servicesError && editableServices.map((svc) => (
                  <Swipeable
                    key={svc.id}
                    friction={2}
                    rightThreshold={28}
                    renderRightActions={(progress, dragX) => (
                      <TouchableOpacity
                        style={styles.swipeDeleteAction}
                        activeOpacity={0.85}
                        onPress={() => handleDeleteService(svc.id)}
                      >
                        <Trash2 size={20} color={'#fff'} />
                        <Text style={styles.swipeDeleteText}>מחק</Text>
                      </TouchableOpacity>
                    )}
                  >
                    <View style={styles.iosCard}>
                    <TouchableOpacity
                      style={styles.accordionHeader}
                      activeOpacity={0.85}
                      onPress={() => setExpandedServiceId(prev => prev === svc.id ? null : svc.id)}
                    >
                      {/* Right: thumbnail */}
                      {svc.image_url ? (
                        <Image source={{ uri: svc.image_url }} style={styles.accordionThumb} />
                      ) : (
                        <View style={styles.accordionThumbPlaceholder}>
                          <Text style={styles.accordionThumbPlaceholderText}>
                            {(svc.name || 'ש').slice(0, 1)}
                          </Text>
                        </View>
                      )}
                      {/* Middle: title and subtitle */}
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.accordionTitle}>{svc.name || 'ללא שם'}</Text>
                        <Text style={styles.accordionSubtitle}>
                          {typeof svc.price === 'number' ? `₪${svc.price}` : 'ללא מחיר'}
                        </Text>
                      </View>
                      {/* Left: chevron */}
                      <View style={styles.accordionChevron}>
                        {expandedServiceId === svc.id ? (
                          <ChevronUp size={18} color={Colors.subtext} />
                        ) : (
                          <ChevronDown size={18} color={Colors.subtext} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {expandedServiceId === svc.id && (
                      <View>
                        <View style={styles.imageHeaderContainer}>
                          <TouchableOpacity
                            onPress={() => handlePickServiceImageForEdit(svc.id)}
                            activeOpacity={0.9}
                            style={{ position: 'relative' }}
                          >
                            {!!svc.image_url ? (
                              <Image source={{ uri: svc.image_url }} style={styles.serviceImagePreview} />
                            ) : (
                              <View style={[styles.serviceImagePreview, { alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={{ color: Colors.subtext }}>הקש לבחירת תמונה</Text>
                              </View>
                            )}
                            {editImageUploading[svc.id] && (
                              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16 }}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>

                        {/* Removed separate replace button; image is now tappable to replace */}

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>שם השירות</Text>
                          <TextInput
                            style={styles.formInput}
                            value={svc.name}
                            onChangeText={(t) => updateLocalServiceField(svc.id, 'name', t)}
                            textAlign="right"
                          />
                        </View>

                        

                        <View style={styles.twoColumnRow}>
                          <View style={[styles.formGroup, styles.twoColumnItem]}>
                            <Text style={styles.formLabel}>מחיר (₪)</Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(svc.price ?? '')}
                              onChangeText={(t) => {
                                const num = parseFloat(t.replace(/[^0-9.]/g, ''));
                                updateLocalServiceField(svc.id, 'price', isNaN(num) ? 0 : num);
                              }}
                              keyboardType="numeric"
                              textAlign="right"
                            />
                          </View>
                          <View style={[styles.formGroup, styles.twoColumnItem]}>
                            <Text style={styles.formLabel}>משך (דקות)</Text>
                            <Pressable
                              style={styles.dropdownContainer}
                              onPress={() => setEditDurationDropdownFor(prev => prev === svc.id ? null : svc.id)}
                            >
                              <View style={styles.dropdownHeader}>
                                <Text style={[styles.dropdownText, !svc.duration_minutes && styles.dropdownPlaceholder]}>
                                  {svc.duration_minutes ? `${svc.duration_minutes} דקות` : 'בחר משך...'}
                                </Text>
                                {editDurationDropdownFor === svc.id ? (
                                  <ChevronUp size={20} color={Colors.subtext} />
                                ) : (
                                  <ChevronDown size={20} color={Colors.subtext} />
                                )}
                              </View>
                            </Pressable>
                            {editDurationDropdownFor === svc.id && (
                              <View style={styles.dropdownOptions}>
                                <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                  {durationOptions.map((mins, idx) => (
                                    <Pressable
                                      key={mins}
                                      style={[styles.dropdownOption, idx === durationOptions.length - 1 && styles.dropdownOptionLast]}
                                      onPress={() => { updateLocalServiceField(svc.id, 'duration_minutes', mins as any); setEditDurationDropdownFor(null); }}
                                    >
                                      <Text style={styles.dropdownOptionTitle}>{`${mins} דקות`}</Text>
                                    </Pressable>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                        </View>

                        

                        <View style={styles.actionsRowInline}>
                          <TouchableOpacity
                            style={[styles.primaryPillButton, { opacity: savingServiceId === svc.id ? 0.7 : 1 }]}
                            onPress={() => handleSaveService(svc)}
                            disabled={savingServiceId === svc.id}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.primaryPillButtonText}>
                              {savingServiceId === svc.id ? 'שומר...' : 'שמור שינויים'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteIconButton}
                            onPress={() => handleDeleteService(svc.id)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel="מחק שירות"
                          >
                            <Trash2 size={20} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </Swipeable>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Add Service Modal */}
      <Modal
        visible={showAddServiceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddServiceModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: '#F8F9FA' }]}>
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: 'padding', android: undefined })}
            keyboardVerticalOffset={Platform.select({ ios: 70, android: 0 }) as number}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowAddServiceModal(false)}
              >
                <Text style={styles.modalCloseText}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>הוספת שירות</Text>
              <TouchableOpacity 
                style={[styles.modalSendButton, addSvcIsSaving && styles.modalSendButtonDisabled]}
                onPress={handleCreateService}
                disabled={addSvcIsSaving}
              >
                <Text style={[styles.modalSendText, addSvcIsSaving && styles.modalSendTextDisabled]}>
                  {addSvcIsSaving ? 'שומר...' : 'שמור'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.select({ ios: 'on-drag', android: 'on-drag' }) as any}
            >
            <View style={styles.recurringCard}>
            {/* Service Image Picker */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>תמונה של השירות</Text>
              <Pressable
                onPress={handlePickServiceImage}
                style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderStyle: 'dashed',
                  borderRadius: 14,
                  padding: 12,
                  backgroundColor: '#FAFAFA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {addSvcImage ? (
                  <Image
                    source={{ uri: addSvcImage.uri }}
                    style={{ width: 160, height: 160, borderRadius: 12 }}
                  />
                ) : (
                  <Text style={{ color: Colors.subtext }}>הקשה לבחירת תמונה</Text>
                )}
              </Pressable>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <TouchableOpacity
                  onPress={handlePickServiceImage}
                  style={[
                    styles.pickButton,
                    { backgroundColor: '#F2F2F7', borderColor: '#E5E5EA' },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pickButtonText}>
                    {addSvcImage ? 'החלף תמונה' : 'בחר תמונה'}
                  </Text>
                </TouchableOpacity>
                {addSvcUploading && (
                  <ActivityIndicator size="small" color={Colors.primary} />
                )}
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>שם השירות</Text>
              <TextInput
                style={styles.textInput}
                value={addSvcName}
                onChangeText={setAddSvcName}
                textAlign="right"
                placeholder="שם השירות"
                placeholderTextColor={Colors.subtext}
              />
            </View>
            
            <View style={styles.twoColumnRow}>
              <View style={[styles.formGroup, styles.twoColumnItem]}>
                <Text style={styles.formLabel}>מחיר (₪)</Text>
                <TextInput
                  style={styles.formInput}
                  value={addSvcPrice}
                  onChangeText={(t) => {
                    const num = t.replace(/[^0-9.]/g, '');
                    setAddSvcPrice(num);
                  }}
                  keyboardType="numeric"
                  textAlign="right"
                />
              </View>
              {/* per-service duration removed */}
            </View>
            {/* Service duration dropdown */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>משך השירות (דקות)</Text>
              <Pressable style={styles.dropdownContainer} onPress={() => setShowDurationDropdown(!showDurationDropdown)}>
                <View style={styles.dropdownHeader}>
                  <Text style={[styles.dropdownText, !addSvcDuration && styles.dropdownPlaceholder]}>
                    {addSvcDuration ? `${addSvcDuration} דקות` : 'בחר משך...'}
                  </Text>
                  {showDurationDropdown ? <ChevronUp size={20} color={Colors.subtext} /> : <ChevronDown size={20} color={Colors.subtext} />}
                </View>
              </Pressable>
              {showDurationDropdown && (
                <View style={styles.dropdownOptions}>
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {durationOptions.map((mins, idx) => (
                      <Pressable
                        key={mins}
                        style={[styles.dropdownOption, idx === durationOptions.length - 1 && styles.dropdownOptionLast]}
                        onPress={() => { setAddSvcDuration(String(mins)); setShowDurationDropdown(false); }}
                      >
                        <Text style={styles.dropdownOptionTitle}>{`${mins} דקות`}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            {/* category selection removed */}
            {/* Spacer to ensure last inputs are above keyboard */}
            <View style={{ height: 60 }} />
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Add Appointment Modal */}
      <AddAppointmentModal
        visible={showAddAppointmentModal}
        onClose={() => setShowAddAppointmentModal(false)}
        onSuccess={() => {
          // אפשר להוסיף כאן רענון של רשימת התורים אם צריך
          console.log('Appointment created successfully');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 8,
    paddingTop: 16,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 14 },
    }),
  },
  dragHandleArea: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetGrabberWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D1D6',
    marginTop: 6,
    marginBottom: 6,
  },
  headerGradient: {
    paddingBottom: 8,
  },
  adminProfileCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 20,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 6,
    alignItems: 'center',
    ...shadowStyle,
  },
  adminAvatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAvatarRing: {
    padding: 2,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  adminAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  adminEditFab: {
    position: 'absolute',
    bottom: -2,
    left: -2,
  },
  adminEditFabInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  adminName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  adminPhone: {
    fontSize: 15,
    color: Colors.subtext,
  },
  adminEmail: {
    fontSize: 14,
    color: Colors.subtext,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  statsRowNew: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 18,
  },
  statCardNew: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 18,
    marginHorizontal: 6,
    alignItems: 'center',
    paddingVertical: 18,
    ...shadowStyle,
  },
  statValueNew: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 2,
  },
  statLabelNew: {
    fontSize: 14,
    color: Colors.subtext,
  },
  sectionTitleNew: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginRight: 24,
    marginBottom: 10,
    marginTop: 18,
    textAlign: 'right',
  },
  cardNew: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 18,
    ...shadowStyle,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingItem_last: {
    borderBottomWidth: 0,
  },
  settingDivider: {
    height: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    borderStyle: 'dashed',
  },
  settingIcon: {
    marginLeft: 12,
  },
  settingChevron: {
    marginRight: 12,
  },
  settingIconRight: {
    marginLeft: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 2,
    textAlign: 'right',
  },
  settingSubtitle: {
    fontSize: 14,
    color: Colors.subtext,
    textAlign: 'right',
  },

  logoutButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  logoutText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '500',
    marginLeft: 8,
  },

  versionText: {
    fontSize: 14,
    color: Colors.subtext,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 32,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  smallModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  smallModalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden',
  },
  smallModalContent: {
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    backgroundColor: Colors.white,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  modalActionText: {
    fontSize: 22,
    color: Colors.text,
    fontWeight: '600',
    marginTop: -2,
  },
  modalCloseText: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  modalSendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalSendButtonDisabled: {
    backgroundColor: Colors.border,
  },
  modalSendText: {
    fontSize: 17,
    color: Colors.white,
    fontWeight: '600',
  },
  modalSendTextDisabled: {
    color: Colors.subtext,
  },
  modalContent: {
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  modalAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarRing: {
    padding: 3,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  modalAvatarImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  modalAdminName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  modalAdminMeta: {
    fontSize: 13,
    color: Colors.subtext,
    textAlign: 'center',
  },
  modalContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexGrow: 1,
  },
  sheetBody: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  textInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: Colors.subtext,
    textAlign: 'left',
    marginTop: 4,
  },
  notificationPreview: {
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'right',
  },
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...shadowStyle,
  },
  manageItemRow: {
    paddingVertical: 8,
  },
  manageDivider: {
    height: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  previewNotificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  previewNotificationContent: {
    fontSize: 14,
    color: Colors.subtext,
    lineHeight: 20,
    textAlign: 'right',
  },
  pickButton: {
    marginTop: 6,
    alignSelf: 'flex-end',
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pickButtonText: {
    color: '#1d1d1f',
    fontWeight: '600',
  },

  // Dropdown Styles
  dropdownContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  grayField: {
    backgroundColor: '#F2F2F7',
    borderColor: '#E5E5EA',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  dropdownPlaceholder: {
    color: Colors.subtext,
  },
  dropdownOptions: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -1,
    ...shadowStyle,
  },
  dropdownList: {
    maxHeight: 260,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    borderStyle: 'dashed',
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionContent: {
    flex: 1,
  },
  dropdownOptionTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: 'right',
  },
  dropdownOptionDescription: {
    fontSize: 14,
    color: Colors.subtext,
    textAlign: 'right',
  },
  serviceHeaderTitle: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'right',
    fontWeight: '500',
  },
  serviceHeaderSub: {
    fontSize: 13,
    color: Colors.subtext,
    textAlign: 'right',
    marginTop: 2,
  },
  customTitleContainer: {
    marginTop: 8,
  },

  // iOS style editor
  iosCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  // iOS-like section card and time sheet rows
  iosSectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  recurringCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,122,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  sheetOptionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sheetOptionText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  accordionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  accordionTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'right',
  },
  accordionSubtitle: {
    fontSize: 13,
    color: Colors.subtext,
    textAlign: 'right',
    marginTop: 2,
  },
  accordionThumb: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginLeft: 12,
  },
  accordionThumbPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  accordionThumbPlaceholderText: {
    fontSize: 14,
    color: Colors.subtext,
    fontWeight: '600',
  },
  accordionChevron: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageHeaderContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceImagePreview: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    color: Colors.subtext,
    marginBottom: 6,
    textAlign: 'right',
  },
  formInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    textAlign: 'right',
  },
  formTextArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  twoColumnRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  twoColumnItem: {
    flex: 1,
  },
  formGroupRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  primaryPillButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'center',
    minWidth: 160,
  },
  primaryPillButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionsRowInline: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  deleteIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDeleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    marginVertical: 8,
  },
  swipeDeleteText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  // deleteIconText removed in favor of vector icon

});