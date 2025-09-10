import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  TextInput,
  Pressable,
  Dimensions,
} from 'react-native';
import { Calendar, Search, User, Clock, CalendarDays, X } from 'lucide-react-native';
import { Calendar as RNCalendar, LocaleConfig } from 'react-native-calendars';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { servicesApi } from '@/lib/api/services';
import type { Service } from '@/lib/supabase';

const { width } = Dimensions.get('window');

// Hebrew locale for react-native-calendars
LocaleConfig.locales['he'] = {
  monthNames: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
  monthNamesShort: ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'],
  dayNames: ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'],
  dayNamesShort: ['א','ב','ג','ד','ה','ו','ש'],
  today: 'היום',
  direction: 'rtl',
};
LocaleConfig.defaultLocale = 'he';

// Helper function to format date as YYYY-MM-DD in local timezone
function formatDateToLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface AddAppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddAppointmentModal({ visible, onClose, onSuccess }: AddAppointmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedClient, setSelectedClient] = useState<{ name: string; phone: string } | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [calendarMarked, setCalendarMarked] = useState<any>({});
  
  // Dropdown states
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  
  // Data states
  const [clients, setClients] = useState<Array<{ name: string; phone: string }>>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [lastTimesForDate, setLastTimesForDate] = useState<string | null>(null);
  
  // Search states
  const [clientSearch, setClientSearch] = useState('');
  const [filteredClients, setFilteredClients] = useState<Array<{ name: string; phone: string }>>([]);

  // Load initial data
  useEffect(() => {
    if (visible) {
      loadClients();
      loadServices();
      resetForm();
    }
  }, [visible]);

  // Filter clients based on search
  useEffect(() => {
    const query = clientSearch.trim().toLowerCase();
    if (query === '') {
      setFilteredClients(clients);
    } else {
      setFilteredClients(
        clients.filter(
          client =>
            client.name.toLowerCase().includes(query) ||
            client.phone.includes(query)
        )
      );
    }
  }, [clientSearch, clients]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, phone')
        .eq('user_type', 'client')
        .order('name');
      
      if (error) throw error;
      
      const validClients = (data || [])
        .filter((client: any) => client.phone && client.phone.trim() !== '')
        .map((client: any) => ({
          name: client.name || 'לקוח',
          phone: client.phone,
        }));
      
      setClients(validClients);
      setFilteredClients(validClients);
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת רשימת הלקוחות');
    }
  };

  const loadServices = async () => {
    try {
      const data = await servicesApi.getAllServices();
      setServices(data);
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת רשימת השירותים');
    }
  };

  const resetForm = () => {
    setSelectedDate(null);
    setSelectedClient(null);
    setSelectedService(null);
    setSelectedTime(null);
    setClientSearch('');
    setShowClientDropdown(false);
    setShowServiceDropdown(false);
    setShowTimeDropdown(false);
    setAvailableTimes([]);
    setCurrentMonth(new Date());
  };

  const loadAvailableTimesForDate = async (date: Date) => {
    if (!selectedService) return;
    
    setIsLoadingTimes(true);
    setAvailableTimes([]);
    
    try {
      const dateString = formatDateToLocalString(date);
      const dayOfWeek = date.getDay();
      
      // Get business hours for this day
      const { data: businessHours } = await supabase
        .from('business_hours')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .maybeSingle();

      if (!businessHours) {
        setAvailableTimes([]);
        return;
      }

      // Build time windows
      const startTime = businessHours.start_time;
      const endTime = businessHours.end_time;
      const slotDuration = businessHours.slot_duration_minutes || 60;
      
      // Generate time slots
      const slots: string[] = [];
      let currentTime = new Date(`2000-01-01T${startTime}`);
      const endDateTime = new Date(`2000-01-01T${endTime}`);
      
      while (currentTime < endDateTime) {
        const timeString = currentTime.toTimeString().slice(0, 5);
        slots.push(timeString);
        currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
      }

      // Check for existing appointments and remove booked slots
      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('slot_time, is_available')
        .eq('slot_date', dateString);

      const bookedTimes = new Set(
        (existingAppointments || [])
          .filter((apt: any) => apt.is_available === false)
          .map((apt: any) => String(apt.slot_time).slice(0, 5))
      );

      // Subtract date-specific constraints
      const { data: constraintsRows } = await supabase
        .from('business_constraints')
        .select('start_time, end_time')
        .eq('date', dateString)
        .order('start_time');
      const withinConstraint = (t: string) => {
        return (constraintsRows || []).some((c: any) => {
          const s = String(c.start_time).slice(0,5);
          const e = String(c.end_time).slice(0,5);
          return s <= t && t < e;
        });
      };

      const availableSlots = slots
        .filter(slot => !bookedTimes.has(slot))
        .filter(slot => !withinConstraint(slot));
      setAvailableTimes(availableSlots);
      setLastTimesForDate(dateString);
      
    } catch (error) {
      console.error('Error loading available times:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת השעות הזמינות');
    } finally {
      setIsLoadingTimes(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    // Open time dropdown and start loading immediately for better UX
    setShowTimeDropdown(true);
    setIsLoadingTimes(true);
    
    // Load available times for selected date
    if (selectedService) {
      loadAvailableTimesForDate(date);
    } else {
      // If no service yet, we'll fetch after service selection
      setIsLoadingTimes(false);
    }
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setShowServiceDropdown(false);
    
    // If date is already selected, reload available times
    if (selectedDate) {
      setIsLoadingTimes(true);
      loadAvailableTimesForDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedClient || !selectedService || !selectedTime) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות הנדרשים');
      return;
    }

    // Final check - verify the time is still available
    const dateString = formatDateToLocalString(selectedDate);
    const { data: conflictingAppointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('slot_date', dateString)
      .eq('slot_time', `${selectedTime}:00`);

    if (conflictingAppointments && conflictingAppointments.length > 0) {
      Alert.alert('תור נתפס', 'השעה שבחרת כבר נתפסה. אנא בחר שעה אחרת.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          slot_date: dateString,
          slot_time: `${selectedTime}:00`,
          is_available: false,
          client_name: selectedClient.name,
          client_phone: selectedClient.phone,
          service_name: selectedService.name,
        });

      if (error) throw error;

      const policyNote = '\n\nלתשומת לבך: אי אפשר לבטל את התור 48 שעות לפני מועד התור. ביטול בתקופה זו יחויב בתשלום על התור.';
      Alert.alert('הצלחה', `התור נקבע בהצלחה${policyNote}`, [
        { text: 'אישור', onPress: () => {
          onSuccess?.();
          onClose();
        }}
      ]);
      
    } catch (error) {
      console.error('Error creating appointment:', error);
      Alert.alert('שגיאה', 'שגיאה בקביעת התור');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDatePicker = () => {
    const today = new Date();
    const minDate = today.toISOString().slice(0, 10);
    const selected = selectedDate ? formatDateToLocalString(selectedDate) : undefined;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <CalendarDays size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>תאריך התור</Text>
        </View>
        <View style={styles.calendarContainer}>
          <RNCalendar
            current={selected || undefined}
            minDate={minDate}
            onDayPress={(day: any) => {
              const date = new Date(day.dateString);
              handleDateSelect(date);
            }}
            markedDates={selected ? { [selected]: { selected: true, selectedColor: '#7B61FF' } } : undefined}
            enableSwipeMonths
            hideDayNames={false}
            firstDay={0}
            style={{ direction: 'rtl' }}
            theme={{
              textDayFontSize: 16,
              textMonthFontSize: 16,
              arrowColor: '#7B61FF',
              selectedDayBackgroundColor: '#7B61FF',
              todayTextColor: '#7B61FF',
              // Force RTL order for header and weeks
              'stylesheet.calendar.header': {
                week: { flexDirection: 'row-reverse' },
              },
              'stylesheet.calendar.main': {
                week: { flexDirection: 'row-reverse' },
              },
            }}
          />
        </View>
      </View>
    );
  };

  const renderClientSelector = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <User size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>לקוח</Text>
      </View>
      
      {!selectedClient ? (
        <>
          <View style={[styles.selectorButton, styles.grayField]}>
            <View style={styles.selectorContent}>
              <TextInput
                style={styles.selectorTextInput}
                value={clientSearch}
                onChangeText={setClientSearch}
                placeholder="בחר לקוח..."
                placeholderTextColor={Colors.subtext}
                textAlign="right"
                onFocus={() => setShowClientDropdown(true)}
              />
              <View style={styles.selectorIcon}>
                <Search size={16} color={Colors.subtext} />
              </View>
            </View>
          </View>

          {showClientDropdown && (
            <View style={styles.dropdownContainer}>
              <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
                {filteredClients.slice(0, 50).map((client, idx) => (
                  <Pressable
                    key={client.phone}
                    style={[
                      styles.dropdownItem,
                      idx === Math.min(filteredClients.length, 50) - 1 && styles.dropdownItemLast
                    ]}
                    onPress={() => {
                      setSelectedClient(client);
                      setShowClientDropdown(false);
                      setClientSearch('');
                    }}
                  >
                    <View style={styles.clientAvatar}>
                      <Text style={styles.clientAvatarText}>
                        {client.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{client.name}</Text>
                      <Text style={styles.clientPhone}>{client.phone}</Text>
                    </View>
                  </Pressable>
                ))}
                {filteredClients.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>אין תוצאות</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </>
      ) : (
        <View style={styles.selectedClientCard}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>
              {selectedClient.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.selectedClientInfo}>
            <Text style={styles.selectedClientName}>{selectedClient.name}</Text>
            <Text style={styles.selectedClientPhone}>{selectedClient.phone}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setSelectedClient(null)}
            style={styles.changeButton}
          >
            <Text style={styles.changeButtonText}>שנה</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderServiceSelector = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Calendar size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>שירות</Text>
      </View>
      
      <Pressable 
        style={[styles.selectorButton, styles.grayField]} 
        onPress={() => setShowServiceDropdown(!showServiceDropdown)}
      >
        <View style={styles.selectorContent}>
          <Text style={selectedService ? styles.selectorText : styles.selectorPlaceholder}>
            {selectedService ? `${selectedService.name} · ₪${selectedService.price}` : 'בחר שירות...'}
          </Text>
          <View style={styles.selectorIcon}>
            <Calendar size={16} color={Colors.subtext} />
          </View>
        </View>
      </Pressable>
      
      {showServiceDropdown && (
        <View style={styles.dropdownContainer}>
          <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
            {services.map((service, idx) => (
              <Pressable
                key={service.id}
                style={[
                  styles.dropdownItem,
                  idx === services.length - 1 && styles.dropdownItemLast
                ]}
                onPress={() => handleServiceSelect(service)}
              >
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.servicePrice}>₪{service.price}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderTimeSelector = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Clock size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>שעה</Text>
      </View>
      
      <Pressable 
        style={[
          styles.selectorButton,
          styles.grayField,
          { opacity: selectedDate && selectedService ? 1 : 0.6 }
        ]} 
        onPress={() => {
          if (!selectedDate || !selectedService) {
            Alert.alert('שגיאה', 'בחר תחילה תאריך ושירות');
            return;
          }
          // Ensure times are up-to-date when opening
          if (!showTimeDropdown) {
            setIsLoadingTimes(true);
            loadAvailableTimesForDate(selectedDate);
          }
          setShowTimeDropdown(!showTimeDropdown);
        }}
      >
        <View style={styles.selectorContent}>
          <Text style={selectedTime ? styles.selectorText : styles.selectorPlaceholder}>
            {selectedTime || (isLoadingTimes ? 'טוען שעות...' : 'בחר שעה...')}
          </Text>
          <View style={styles.selectorIcon}>
            <Clock size={16} color={Colors.subtext} />
          </View>
        </View>
      </Pressable>
      
      {showTimeDropdown && (
        <View style={styles.dropdownContainer}>
          <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
            {isLoadingTimes ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>טוען שעות זמינות...</Text>
              </View>
            ) : availableTimes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>אין שעות זמינות ליום זה</Text>
              </View>
            ) : (
              availableTimes.map((time, idx) => (
                <Pressable
                  key={time}
                  style={[
                    styles.dropdownItem,
                    idx === availableTimes.length - 1 && styles.dropdownItemLast
                  ]}
                  onPress={() => {
                    setSelectedTime(time);
                    setShowTimeDropdown(false);
                  }}
                >
                  <Text style={styles.timeText}>{time}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>ביטול</Text>
          </TouchableOpacity>
          <Text style={styles.title}>הוספת תור ללקוח</Text>
          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={[styles.submitButtonText, isSubmitting && styles.submitButtonTextDisabled]}>
              {isSubmitting ? 'שומר...' : 'שמור'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.groupCard}>
            {renderClientSelector()}
            {renderServiceSelector()}
            {renderDatePicker()}
            {renderTimeSelector()}
          </View>
          
          {/* Summary */}
          {selectedDate && selectedClient && selectedService && selectedTime && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>סיכום התור</Text>
              <View style={styles.summaryContent}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>{selectedClient.name}</Text>
                  <Text style={styles.summaryLabel}>לקוח:</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>{selectedService.name}</Text>
                  <Text style={styles.summaryLabel}>שירות:</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>
                    {selectedDate.toLocaleDateString('he-IL', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      weekday: 'long'
                    })}
                  </Text>
                  <Text style={styles.summaryLabel}>תאריך:</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>{selectedTime}</Text>
                  <Text style={styles.summaryLabel}>שעה:</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  // (styles for success modal were removed)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C8',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    fontSize: 17,
    color: '#7B61FF',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#7B61FF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#C6C6C8',
  },
  submitButtonText: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#8E8E93',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'flex-end',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
    textAlign: 'right',
  },
  selectorButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  grayField: {
    backgroundColor: '#F2F2F7',
    borderColor: '#E5E5EA',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: {
    fontSize: 17,
    color: '#000000',
    flex: 1,
    textAlign: 'right',
  },
  selectorPlaceholder: {
    fontSize: 17,
    color: '#8E8E93',
    flex: 1,
    textAlign: 'right',
  },
  selectorTextInput: {
    fontSize: 17,
    color: '#000000',
    flex: 1,
    textAlign: 'right',
    paddingVertical: 0,
  },
  selectorIcon: {
    marginLeft: 8,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginTop: 8,
    maxHeight: 300,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
    textAlign: 'right',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  dropdownList: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7B61FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clientInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  clientName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000000',
  },
  clientPhone: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 2,
  },
  serviceInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000000',
  },
  servicePrice: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 2,
  },
  timeText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000000',
    textAlign: 'right',
    flex: 1,
  },
  selectedClientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedClientInfo: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  selectedClientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  selectedClientPhone: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 2,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeButtonText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
  datePickerContainer: {
    paddingHorizontal: 4,
  },
  // Calendar container for react-native-calendars
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 12,
    direction: 'rtl',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateOption: {
    width: 70,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dateOptionToday: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  dateOptionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  dateOptionTextSelected: {
    color: '#FFFFFF',
  },
  dateOptionDay: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'right',
  },
  summaryContent: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'left',
  },
  summaryValue: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
});
