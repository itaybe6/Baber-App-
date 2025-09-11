import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Platform, Modal, ActivityIndicator, TextInput, FlatList, Alert, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';
import { generateAppointments } from '@/constants/appointments';
import { services } from '@/constants/services';
import { clients } from '@/constants/clients';
import { AvailableTimeSlot } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import Card from '@/components/Card';
import { Calendar, Clock, ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import DaySelector from '@/components/DaySelector';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView as RNScrollView } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import AdminBroadcastComposer from '@/components/AdminBroadcastComposer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Using require for images to avoid TS module resolution issues for static assets
import CategoryBar from '@/components/CategoryBar';
import DesignCard from '@/components/DesignCard';
import { useDesignsStore } from '@/stores/designsStore';
import DailySchedule from '@/components/DailySchedule';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationsStore } from '@/stores/notificationsStore';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const designsFromStore = useDesignsStore((state) => state.designs);
  const isLoadingDesigns = useDesignsStore((state) => state.isLoading);
  const fetchDesigns = useDesignsStore((state) => state.fetchDesigns);

  const isAdmin = useAuthStore((state) => state.isAdmin);
  const user = useAuthStore((state) => state.user);
  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const fetchUnread = useNotificationsStore((state) => state.fetchUnreadCount);

  const [appointments] = useState(generateAppointments());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = React.useState('לק ג\'ל');
  const [nextAppointment, setNextAppointment] = useState<AvailableTimeSlot | null>(null);
  const [loadingNextAppointment, setLoadingNextAppointment] = useState(true);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [loadingTodayCount, setLoadingTodayCount] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState({
    totalClients: 0,
    completedAppointments: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [blockedFilter, setBlockedFilter] = useState<'all' | 'blocked' | 'unblocked'>('all');
  const categories = [
    {
      key: "לק ג'ל",
      icon: (color: string) => <MaterialCommunityIcons name="bottle-tonic" size={22} color={color} />,
    },
    {
      key: 'מניקור',
      icon: (color: string) => <FontAwesome5 name="hand-sparkles" size={20} color={color} />,
    },
    {
      key: 'לק ברגליים',
      icon: (color: string) => <MaterialCommunityIcons name="foot-print" size={22} color={color} />,
    },
    {
      key: 'פדיקור',
      icon: (color: string) => <MaterialCommunityIcons name="spa" size={22} color={color} />,
    },
  ];
  
  // Get today's appointments
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayAppointments = appointments.filter(appointment => {
    const appointmentDate = new Date(appointment.appointment_date);
    return appointmentDate >= today && appointmentDate < tomorrow;
  }).sort((a, b) => {
    return new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime();
  });
  
  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'לקוחה לא ידועה';
  };

  const getClientImage = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.image || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330';
  };
  
  const getServiceName = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : 'שירות לא ידוע';
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeRange = (dateString: string) => {
    const date = new Date(dateString);
    const startTime = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    
    // Find the service to get duration
    const appointment = appointments.find(a => a.appointment_date === dateString);
    if (!appointment) return startTime;
    
    const service = services.find(s => s.id === appointment.service_id);
    if (!service) return startTime;
    
    // Calculate end time
    const endDate = new Date(date.getTime() + service.duration * 60000);
    const endTime = endDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    
    return `${startTime} — ${endTime}`;
  };
  
  // Fetch unread notifications count for current admin user
  useEffect(() => {
    if (user?.phone) {
      fetchUnread(user.phone);
    }
  }, [user?.phone, fetchUnread]);

  useFocusEffect(
    React.useCallback(() => {
      if (user?.phone) {
        fetchUnread(user.phone);
      }
    }, [user?.phone, fetchUnread])
  );

  // Fetch next appointment from database
  const fetchNextAppointment = async () => {
    try {
      setLoadingNextAppointment(true);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0];

      // Get only today's upcoming booked appointments
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('is_available', false) // Only booked appointments
        .eq('slot_date', today) // Today only
        .gt('slot_time', currentTime) // After current time
        .order('slot_time');

      if (error) {
        console.error('Error fetching next appointment:', error);
        setNextAppointment(null);
        return;
      }

      setNextAppointment((data?.length || 0) > 0 ? data![0] : null);
    } catch (error) {
      console.error('Error in fetchNextAppointment:', error);
      setNextAppointment(null);
    } finally {
      setLoadingNextAppointment(false);
    }
  };

  // Fetch today's appointments count
  const fetchTodayAppointmentsCount = async () => {
    try {
      setLoadingTodayCount(true);
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('appointments')
        .select('*')
        .eq('slot_date', today)
        .eq('is_available', false); // Only booked appointments

      // סינון לפי המשתמש הנוכחי - רק תורים שהוא יצר
      if (user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching today appointments count:', error);
        setTodayAppointmentsCount(0);
        return;
      }

      setTodayAppointmentsCount(data?.length || 0);
    } catch (error) {
      console.error('Error in fetchTodayAppointmentsCount:', error);
      setTodayAppointmentsCount(0);
    } finally {
      setLoadingTodayCount(false);
    }
  };

  // Fetch monthly statistics
  const fetchMonthlyStats = async () => {
    try {
      setLoadingStats(true);
      const now = new Date();
      
      // Get all clients from users table
      const { data: clientsData, error: clientsError } = await supabase
        .from('users')
        .select('*')
        .eq('user_type', 'client');

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return;
      }

      // Get all booked appointments for this month (past and upcoming within current month)
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      let appointmentsQuery = supabase
        .from('appointments')
        .select('*')
        .eq('is_available', false) // Only booked appointments
        .gte('slot_date', firstDayOfMonth) // From start of month
        .lte('slot_date', lastDayOfMonth); // To end of month

      // סינון לפי המשתמש הנוכחי - רק תורים שהוא יצר
      if (user?.id) {
        appointmentsQuery = appointmentsQuery.eq('user_id', user.id);
      }

      const { data: appointmentsData, error: appointmentsError } = await appointmentsQuery;

      if (appointmentsError) {
        console.error('Error fetching completed appointments:', appointmentsError);
        return;
      }



      setMonthlyStats({
        totalClients: clientsData?.length || 0,
        completedAppointments: appointmentsData?.length || 0
      });
    } catch (error) {
      console.error('Error in fetchMonthlyStats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch clients
  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_type', 'client')
        .order('name');

      if (error) {
        console.error('Error fetching clients:', error);
        return;
      }

      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error('Error in fetchClients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  // Filter clients based on search query
  useEffect(() => {
    let filtered = clients;
    if (blockedFilter === 'blocked') {
      filtered = filtered.filter((c) => c.block === true);
    } else if (blockedFilter === 'unblocked') {
      filtered = filtered.filter((c) => !c.block);
    }
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter((client) =>
        client.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredClients(filtered);
  }, [searchQuery, clients, blockedFilter]);

  // Handle phone call
  const handlePhoneCall = (phone: string) => {
    if (!phone) {
      Alert.alert('שגיאה', 'מספר הטלפון לא זמין');
      return;
    }

    Alert.alert(
      'התקשרות',
      `האם להתקשר ל-${phone}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התקשר',
          onPress: () => {
            Linking.openURL(`tel:${phone}`);
          },
        },
      ]
    );
  };

  const handleBlockClient = (client: any) => {
    Alert.alert(
      'חסימת לקוח',
      `האם לחסום את ${client?.name || 'הלקוח'}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase
                .from('users')
                .update({ block: true })
                .eq('id', client.id)
                .select('*')
                .single();
              if (error) {
                console.error('Error blocking client:', error);
                Alert.alert('שגיאה', 'חסימת הלקוח נכשלה');
                return;
              }
              setClients((prev) => prev.map((c) => (c.id === client.id ? data : c)));
              setFilteredClients((prev) => prev.map((c) => (c.id === client.id ? data : c)));
              Alert.alert('הלקוח נחסם', `${data?.name || 'הלקוח'} נחסם בהצלחה`);
            } catch (e) {
              console.error('Error blocking client:', e);
              Alert.alert('שגיאה', 'חסימת הלקוח נכשלה');
            }
          },
        },
      ]
    );
  };

  const handleUnblockClient = (client: any) => {
    Alert.alert(
      'שחרור חסימה',
      `האם לשחרר את ${client?.name || 'הלקוח'} מחסימה?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          style: 'default',
          onPress: async () => {
            try {
              const { data, error } = await supabase
                .from('users')
                .update({ block: false })
                .eq('id', client.id)
                .select('*')
                .single();
              if (error) {
                console.error('Error unblocking client:', error);
                Alert.alert('שגיאה', 'שחרור הלקוח מחסימה נכשל');
                return;
              }
              setClients((prev) => prev.map((c) => (c.id === client.id ? data : c)));
              setFilteredClients((prev) => prev.map((c) => (c.id === client.id ? data : c)));
              Alert.alert('הלקוח שוחרר', `${data?.name || 'הלקוח'} שוחרר מחסימה בהצלחה`);
            } catch (e) {
              console.error('Error unblocking client:', e);
              Alert.alert('שגיאה', 'שחרור הלקוח מחסימה נכשל');
            }
          },
        },
      ]
    );
  };

  const openEditClient = (client: any) => {
    setEditingClient(client);
    setEditClientName(client?.name || '');
    setEditClientPhone(client?.phone || '');
    setShowEditClientModal(true);
  };

  const saveClientEdit = async () => {
    if (!editingClient) return;
    try {
      setSavingClient(true);
      const { data, error } = await supabase
        .from('users')
        .update({ name: editClientName.trim(), phone: editClientPhone.trim() })
        .eq('id', editingClient.id)
        .select('*')
        .single();
      if (error) {
        console.error('Error updating client:', error);
        Alert.alert('שגיאה', 'עדכון הלקוח נכשל');
        return;
      }
      // Update local lists
      setClients((prev) => prev.map((c) => (c.id === editingClient.id ? data : c)));
      setFilteredClients((prev) => prev.map((c) => (c.id === editingClient.id ? data : c)));
      setShowEditClientModal(false);
      setEditingClient(null);
    } catch (e) {
      console.error('Error saving client edit:', e);
      Alert.alert('שגיאה', 'עדכון הלקוח נכשל');
    } finally {
      setSavingClient(false);
    }
  };

  const handleDeleteClient = (client: any) => {
    Alert.alert(
      'מחיקת לקוח',
      `האם למחוק את ${client?.name || 'הלקוח'}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('users').delete().eq('id', client.id);
              if (error) {
                console.error('Error deleting client:', error);
                Alert.alert('שגיאה', 'מחיקת הלקוח נכשלה');
                return;
              }
              setClients((prev) => prev.filter((c) => c.id !== client.id));
              setFilteredClients((prev) => prev.filter((c) => c.id !== client.id));
            } catch (e) {
              console.error('Error deleting client:', e);
              Alert.alert('שגיאה', 'מחיקת הלקוח נכשלה');
            }
          },
        },
      ]
    );
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchNextAppointment();
    fetchTodayAppointmentsCount();
    fetchMonthlyStats();
    fetchDesigns();
  }, []);

  const onRefresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        fetchNextAppointment(),
        fetchTodayAppointmentsCount(),
        fetchMonthlyStats(),
        (async () => { try { await fetchDesigns(); } catch {} })(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.header}>
        {/* Left side: Notifications bell */}
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => {
              router.push('/(tabs)/notifications');
            }}
            activeOpacity={0.85}
          >
            <View style={styles.bellIconWrapper}>
              <Ionicons name="notifications-outline" size={24} color="#1d1d1f" />
            </View>
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {/* Center: Logo */}
        <View style={styles.headerCenter}>
          <Image source={require('@/assets/images/logo-03.png')} style={styles.logo} resizeMode="contain" />
        </View>
        {/* Right side: Broadcast icon */}
        <View style={styles.headerSide}>
          <AdminBroadcastComposer variant="icon" />
        </View>
      </View>
    </SafeAreaView>
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <View style={styles.contentWrapper}>
        <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
      >
        
                 <DailySchedule 
           nextAppointment={nextAppointment}
           loading={loadingNextAppointment}
           onRefresh={fetchNextAppointment}
           todayAppointmentsCount={todayAppointmentsCount}
           loadingTodayCount={loadingTodayCount}
         />
        <View style={styles.statsBox}>
          <View style={styles.statsButtonsRow}>
            <TouchableOpacity
              style={styles.statsButton}
              onPress={() => {
                setShowClientsModal(true);
                fetchClients();
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.statsButtonIconCircle, { backgroundColor: 'rgba(0,0,0,0.10)' }]}> 
                <Ionicons name="people-outline" size={22} color="#1C1C1E" />
              </View>
              <View style={styles.statsButtonContent}>
                {loadingStats ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.statsNumber}>{monthlyStats.totalClients}</Text>
                )}
                <Text style={styles.statsLabelSecondary}>לקוחות</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.statsButton}>
              <View style={[styles.statsButtonIconCircle, { backgroundColor: 'rgba(0,0,0,0.10)' }]}> 
                <Ionicons name="checkmark-done-outline" size={22} color="#1C1C1E" />
              </View>
              <View style={styles.statsButtonContent}>
                {loadingStats ? (
                  <ActivityIndicator size="small" color="#34C759" />
                ) : (
                  <Text style={styles.statsNumber}>{monthlyStats.completedAppointments}</Text>
                )}
                <Text style={styles.statsLabelSecondary}>תורים החודש</Text>
              </View>
            </View>
          </View>
        </View>
        {/* כפתור עריכת גלריה למנהל מעל הגלריה */}
        {isAdmin && (
          <View style={{ paddingHorizontal: 8, marginBottom: 8, alignItems: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/edit-gallery')}
              activeOpacity={0.85}
              style={styles.editGalleryButton}
            >
              <Text style={styles.editGalleryButtonText}>עריכת גלריה</Text>
              <View style={[styles.statsButtonIconCircle, { backgroundColor: 'rgba(0,0,0,0.10)', width: 28, height: 28, borderRadius: 14, marginLeft: 8 }]}> 
                <Ionicons name="create-outline" size={18} color="#1C1C1E" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* גלריה אופקית */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[{ marginTop: 0, marginBottom: 8 }, styles.rtlFlip]}
          contentContainerStyle={{ flexDirection: 'row', gap: 12, paddingHorizontal: 8 }}
        >
          {isLoadingDesigns ? (
            <View style={{ paddingHorizontal: 16, justifyContent: 'center' }}>
              <ActivityIndicator size="small" color="#1C1C1E" />
            </View>
          ) : (
            designsFromStore.map((item) => (
              isAdmin ? (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.galleryTile, styles.unflip]}
                  activeOpacity={0.85}
                  onPress={() => setPreviewImageUrl(item.image_url)}
                >
                  <View style={styles.galleryImageContainer}>
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={styles.galleryGradient}
                    >
                      <Text style={styles.galleryDesignName}>{item.name}</Text>
                      <View style={styles.galleryCategoryTags}>
                        {(item.categories || []).slice(0, 2).map((cat, idx) => (
                          <View key={idx} style={styles.galleryCategoryTag}>
                            <Text style={styles.galleryCategoryTagText}>{cat}</Text>
                          </View>
                        ))}
                      </View>
                    </LinearGradient>
                  </View>
                </TouchableOpacity>
              ) : (
                <View key={item.id} style={[styles.galleryTile, styles.unflip]}>
                  <View style={styles.galleryImageContainer}>
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={styles.galleryGradient}
                    >
                      <Text style={styles.galleryDesignName}>{item.name}</Text>
                      <View style={styles.galleryCategoryTags}>
                        {(item.categories || []).slice(0, 2).map((cat, idx) => (
                          <View key={idx} style={styles.galleryCategoryTag}>
                            <Text style={styles.galleryCategoryTagText}>{cat}</Text>
                          </View>
                        ))}
                      </View>
                    </LinearGradient>
                  </View>
                </View>
              )
            ))
          )}
        </ScrollView>
        {/* Close outer vertical ScrollView */}
        </ScrollView>
      </View>



       {/* Image Preview Modal for Admin */}
       <Modal
         animationType="fade"
         transparent
         visible={!!previewImageUrl}
         onRequestClose={() => setPreviewImageUrl(null)}
       >
         <View style={styles.imagePreviewOverlay}>
           <View style={styles.imagePreviewHeader}>
             <TouchableOpacity
               style={styles.imagePreviewCloseButton}
               onPress={() => setPreviewImageUrl(null)}
               activeOpacity={0.8}
             >
               <Ionicons name="close" size={26} color="#fff" />
             </TouchableOpacity>
           </View>
           {previewImageUrl && (
             <Image
               source={{ uri: previewImageUrl }}
               style={styles.imagePreview}
               resizeMode="contain"
             />
           )}
         </View>
       </Modal>

       {/* Clients Modal */}
       <Modal
         animationType="slide"
         transparent={true}
         visible={showClientsModal}
         onRequestClose={() => setShowClientsModal(false)}
       >
         <View style={styles.modalOverlay}>
            <View style={styles.clientsModal}>
              <View style={styles.modalHeader}>
                <View style={{ width: 36, height: 36 }} />
                <Text style={styles.modalTitle}>רשימת לקוחות</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowClientsModal(false)}
                >
                  <Ionicons name="close" size={24} color="#1d1d1f" />
                </TouchableOpacity>
              </View>

             {/* Search Bar */}
             <View style={styles.searchContainer}>
               <Ionicons name="search" size={20} color="#8e8e93" style={styles.searchIcon} />
               <TextInput
                 style={styles.searchInput}
                 placeholder="חיפוש לפי שם..."
                 placeholderTextColor="#8e8e93"
                 value={searchQuery}
                 onChangeText={setSearchQuery}
               />
             </View>

             {/* Blocked Filter */}
             <View style={styles.filterRow}>
               <TouchableOpacity
                 onPress={() => setBlockedFilter('all')}
                 style={[styles.filterButton, blockedFilter === 'all' && styles.filterButtonActive]}
                 activeOpacity={0.85}
               >
                 <Text style={[styles.filterButtonText, blockedFilter === 'all' && styles.filterButtonTextActive]}>הכל</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 onPress={() => setBlockedFilter('blocked')}
                 style={[styles.filterButton, blockedFilter === 'blocked' && styles.filterButtonActive]}
                 activeOpacity={0.85}
               >
                 <Text style={[styles.filterButtonText, blockedFilter === 'blocked' && styles.filterButtonTextActive]}>חסומים</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 onPress={() => setBlockedFilter('unblocked')}
                 style={[styles.filterButton, blockedFilter === 'unblocked' && styles.filterButtonActive]}
                 activeOpacity={0.85}
               >
                 <Text style={[styles.filterButtonText, blockedFilter === 'unblocked' && styles.filterButtonTextActive]}>לא חסומים</Text>
               </TouchableOpacity>
             </View>

             {/* Clients List */}
             {loadingClients ? (
               <View style={styles.loadingContainer}>
                 <ActivityIndicator size="large" color="#1C1C1E" />
                 <Text style={styles.loadingText}>טוען לקוחות...</Text>
               </View>
              ) : (
                 <FlatList
                  style={{ flex: 1 }}
                  data={filteredClients}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                   <View style={styles.clientItem}>
                     <View style={styles.clientInfo}>
                       <Text style={styles.clientName}>{item.name}</Text>
                       {item.phone && (
                         <Text style={styles.clientPhone}>{item.phone}</Text>
                       )}
                     </View>
                     <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                       <TouchableOpacity
                         style={styles.blockButton}
                         onPress={() => (item.block ? handleUnblockClient(item) : handleBlockClient(item))}
                         activeOpacity={0.85}
                       >
                         <Text style={styles.blockButtonText}>{item.block ? 'שחרור מחסימה' : 'חסום'}</Text>
                       </TouchableOpacity>
                       <TouchableOpacity
                         style={[styles.phoneButton, { marginRight: 16 }]}
                         onPress={() => handlePhoneCall(item.phone)}
                       >
                         <Ionicons name="call" size={20} color="#007AFF" />
                       </TouchableOpacity>
                     </View>
                   </View>
                  )}
                   showsVerticalScrollIndicator={true}
                   contentContainerStyle={[styles.clientsList, { paddingBottom: insets.bottom + 24 }]}
                />
             )}
           </View>
         </View>
       </Modal>

      {/* Removed floating composer */}
 
    </SafeAreaView>
    </View>
   );
 }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 12,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row-reverse', // RTL
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSide: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  featuredImageContainer: {
    position: 'relative',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  featuredTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  featuredSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
    marginTop: 8,
    fontWeight: '400',
  },
  todaySection: {
    marginBottom: 24,
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  todaySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  todaySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 4,
  },
  appointmentsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.subtext,
  },
  appointmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  clientImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  appointmentDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    color: '#222',
    fontWeight: '500',
    marginRight: 8,
    textAlign: 'right',
    flex: 1,
  },
  timeRange: {
    fontSize: 14,
    color: Colors.subtext,
    textAlign: 'right',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  servicesSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  statsCard: {
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.subtext,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.border,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  bellIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#000000',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#fff',
  },
  galleryTile: {
    width: 160,
    height: 160,
    padding: 4,
  },
  galleryImageContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    justifyContent: 'flex-end',
  },
  galleryDesignName: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 4,
  },
  galleryCategoryTags: {
    flexDirection: 'row-reverse', // RTL
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  galleryCategoryTag: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
    marginBottom: 4,
  },
  galleryCategoryTagText: {
    color: Colors.white,
    fontSize: 10,
  },
  galleryPopularityContainer: {
    display: 'none',
  },
  galleryPopularityDot: {
    display: 'none',
  },
  galleryActivePopularityDot: {
    display: 'none',
  },
  cardsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  rtlFlip: {
    transform: [{ scaleX: -1 }],
  },
  unflip: {
    transform: [{ scaleX: -1 }],
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 18,
    flex: 1,
    marginHorizontal: 6,
    padding: 16,
    minHeight: 120,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    alignItems: 'flex-end',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 8,
    marginLeft: 0,
    marginRight: 0,
  },
  cardHour: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
    textAlign: 'right',
  },
  cardDate: {
    fontSize: 14,
    color: '#888',
    textAlign: 'right',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginLeft: 6,
  },
  updatesText: {
    fontSize: 13,
    color: '#222',
    textAlign: 'right',
  },
  statsBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginHorizontal: 0,
    marginBottom: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
    minHeight: 120,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  statsButtonIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  statsButtonContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
    textAlign: 'center',
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  statsLabel: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  statsLabelSecondary: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#eee',
    marginHorizontal: 8,
  },
  editGalleryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  editGalleryButtonText: {
    color: '#1d1d1f',
    fontWeight: '600',
    letterSpacing: -0.2,
    marginLeft: 8,
  },
  cardTitleHebrew: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 6,
    textAlign: 'right',
  },
  clockIconCircle: {
    backgroundColor: '#000000',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
    marginRight: 0,
  },
  dailyTitlePill: {
    alignSelf: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 22,
    marginBottom: 10,
    marginTop: 8,
    elevation: 0,
  },
  dailyTitleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  statsTitleWrapper: {
    display: 'none',
  },
  statsTitleNew: {
    display: 'none',
  },
  statsTitleAccent: {
    display: 'none',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 48,
    marginBottom: 2,
  },
  logo: {
    width: 160,
    height: 60,
    alignSelf: 'center',
  },
  logoAbsolute: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  // Clients Modal Styles
  clientsModal: {
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 20,
    height: '88%',
    width: '95%',
    alignSelf: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row-reverse', // RTL
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5e7',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1d1d1f',
    textAlign: 'center',
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row-reverse', // RTL
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginLeft: 12, // RTL - icon should be on the left in RTL layout
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1d1d1f',
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8e8e93',
    marginTop: 16,
    textAlign: 'center',
  },
  clientsList: {
    paddingTop: 10,
  },
  filterRow: {
    flexDirection: 'row-reverse', // RTL
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  filterButton: {
    backgroundColor: '#f2f2f7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(0,0,0,0.10)',
    borderColor: '#000000',
  },
  filterButtonText: {
    color: '#1d1d1f',
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  clientItem: {
    flexDirection: 'row-reverse', // RTL
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  // Renamed to avoid duplicate key in StyleSheet
  modalClientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1d1d1f',
    textAlign: 'right',
  },
  clientInfo: {
    flex: 1,
    marginRight: 16,
  },
  clientPhone: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'right',
    marginTop: 4,
  },
  phoneButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16, // RTL
  },
  iconCircleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  blockButton: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewHeader: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 2,
  },
  imagePreviewCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '92%',
    height: '80%',
    borderRadius: 16,
  },
});