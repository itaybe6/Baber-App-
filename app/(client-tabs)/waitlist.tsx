import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import TimePeriodSelector, { TimePeriod } from '@/components/TimePeriodSelector';
import { useWaitlistStore } from '@/stores/waitlistStore';
import { useAuthStore } from '@/stores/authStore';
 

export default function WaitlistScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { serviceName = 'שירות כללי', selectedDate = '' } = params as { serviceName: string; selectedDate: string };
  
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(null);
  const { user } = useAuthStore();
  const { addToWaitlist, isLoading, error, clearError } = useWaitlistStore();

  // Validate selectedDate
  const isValidDate = selectedDate && selectedDate !== '';
  const displayDate = isValidDate ? selectedDate : new Date().toISOString().split('T')[0];


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleAddToWaitlist = async () => {
    if (!selectedPeriod) {
      Alert.alert('שגיאה', 'אנא בחרי טווח זמן מועדף');
      return;
    }

    if (!user?.name || !user?.phone) {
      Alert.alert('שגיאה', 'מידע המשתמש חסר');
      return;
    }

    if (!selectedDate || selectedDate === '') {
      Alert.alert('שגיאה', 'תאריך לא נבחר');
      return;
    }

    try {
      const success = await addToWaitlist(
        user.name,
        user.phone,
        serviceName,
        selectedDate,
        selectedPeriod
      );

      if (success) {
        Alert.alert(
          'נוספת לרשימת המתנה',
          `נוספת בהצלחה לרשימת המתנה ליום ${formatDate(selectedDate)}. נודיע לך כשיתפנה מקום!`,
          [
            {
              text: 'אישור',
              onPress: () => {
                router.push('/(client-tabs)/book-appointment');
              },
            },
          ]
        );
      } else {
        Alert.alert('שגיאה', error || 'אירעה שגיאה בהוספה לרשימת המתנה');
      }
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בהוספה לרשימת המתנה');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F9FA']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.push('/(client-tabs)/book-appointment')}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', flexShrink: 1 }}>
              <Text style={styles.headerTitle}>רשימת המתנה</Text>
              <Text style={styles.headerSubtitle} numberOfLines={2} ellipsizeMode="tail">
                {`אין תורים זמינים\n${serviceName === 'שירות כללי' ? 'בתאריך זה' : `ל${serviceName} בתאריך זה`}`}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <View style={styles.contentWrapper}>
          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
          {/* Service and Date Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color={Colors.primary} />
              <Text style={styles.infoTitle}>פרטי הבקשה</Text>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar" size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>תאריך</Text>
                <Text style={styles.infoValue}>{formatDate(displayDate)}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="apps" size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>שירות</Text>
                <Text style={styles.infoValue}>
                  {serviceName === 'שירות כללי' ? 'כל שירות זמין' : serviceName}
                </Text>
              </View>
            </View>
          </View>

          {/* Time Period Selector */}
          <TimePeriodSelector
            selectedPeriod={selectedPeriod}
            onSelectPeriod={setSelectedPeriod}
            disabled={isLoading}
          />

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!selectedPeriod || isLoading) && styles.disabledButton,
              ]}
              onPress={handleAddToWaitlist}
              disabled={!selectedPeriod || isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <Ionicons name="hourglass" size={20} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>מוסיף לרשימת המתנה...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>
                    {selectedPeriod ? 'אישור ושמירה' : 'בחרי טווח זמן תחילה'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    writingDirection: 'rtl',
  },
  gradient: {
    flex: 1,
  },
  header: {
    height: 104,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.white,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
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
    textAlign: 'center',
    maxWidth: 260,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  scrollContent: {
    paddingBottom: 20, // מרווח קטן בתחתית
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  infoHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginRight: 12,
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
    textAlign: 'right',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'right',
  },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop:0,
    marginBottom: 40,
  },
  confirmButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#1C1C1E',
    minHeight: 56,
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

}); 