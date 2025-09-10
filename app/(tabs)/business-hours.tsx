import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BusinessConstraintsModal from '@/components/BusinessConstraintsModal';

import { businessHoursApi } from '@/lib/api/businessHours';
import { notifyWaitlistOnBusinessHoursUpdate } from '@/lib/api/waitlistNotifications';
import { BusinessHours } from '@/lib/supabase';
import { businessProfileApi } from '@/lib/api/businessProfile';

// Modern Apple-like Colors
const Colors = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  primary: '#007AFF',
  accent: '#7B61FF',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  text: '#1C1C1E',
  secondaryText: '#8E8E93',
  tertiaryText: '#C7C7CC',
  border: '#E5E5EA',
  separator: 'rgba(60, 60, 67, 0.36)',
};

// Format time string to HH:MM (strip seconds if present)
const formatHHMM = (time?: string | null): string => {
  if (!time) return '';
  const parts = String(time).split(':');
  if (parts.length >= 2) {
    const hh = parts[0]?.padStart(2, '0') ?? '';
    const mm = parts[1]?.padStart(2, '0') ?? '';
    return `${hh}:${mm}`;
  }
  return String(time);
};

// Ensure HH:MM range displayed left-to-right with smaller time first
const formatRangeLtr = (a?: string | null, b?: string | null): string => {
  if (!a || !b) return '';
  const A = formatHHMM(a);
  const B = formatHHMM(b);
  const first = A.localeCompare(B) <= 0 ? A : B;
  const second = A.localeCompare(B) <= 0 ? B : A;
  const LRM = '\u200E'; // Left-to-right mark to enforce visual order in RTL
  return `${LRM}${first}${LRM} - ${LRM}${second}${LRM}`;
};

// Modern dropdown time picker component
interface TimePickerProps {
  value: string;
  onValueChange: (time: string) => void;
  label: string;
  options: string[];
  isBreakTime?: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({ 
  value, 
  onValueChange, 
  label, 
  options, 
  isBreakTime = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wheelRef = useRef<ScrollView | null>(null);
  const [tempValue, setTempValue] = useState<string>(value);

  const handleConfirm = () => {
    onValueChange(tempValue);
    setIsOpen(false);
  };

  const dropdownBackgroundColor = isBreakTime 
    ? 'rgba(255, 149, 0, 0.1)' 
    : 'rgba(0, 122, 255, 0.1)';
    
  const dropdownBorderColor = isBreakTime 
    ? 'rgba(255, 149, 0, 0.3)' 
    : 'rgba(0, 122, 255, 0.3)';
    
  const selectedColor = isBreakTime ? Colors.warning : Colors.primary;

  return (
    <View style={[styles.timePickerContainer, { zIndex: isOpen ? 10000 : 1 }]}> 
      <Text style={[styles.timePickerLabel, isBreakTime && styles.timePickerLabelSmall]}>{label}</Text>
      
      {/* Dropdown Button */}
      <TouchableOpacity
        style={[
          styles.dropdownButton,
          isBreakTime && styles.dropdownButtonSmall,
          isOpen && styles.dropdownButtonOpen,
          { 
            backgroundColor: dropdownBackgroundColor,
            borderColor: dropdownBorderColor 
          }
        ]}
        onPress={() => { setTempValue(value); setIsOpen(true); }}
        activeOpacity={0.8}
      >
        <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.dropdownButtonText, isBreakTime && styles.dropdownButtonTextSmall, { color: selectedColor, flex: 1, textAlign: 'center' }]}> 
          {formatHHMM(value)}
        </Text>
        <Ionicons 
          name={isOpen ? "chevron-up" : "chevron-down"} 
          size={16} 
          color={selectedColor} 
        />
      </TouchableOpacity>

      {/* Bottom Sheet Modal with iOS-like wheels */}
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsOpen(false)} />
        <View style={[styles.bottomSheet, { backgroundColor: Colors.card }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => setIsOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="checkmark" size={20} color={'#FFFFFF'} />
              </TouchableOpacity>
            </View>
          </View>
          <WheelPicker options={options} value={tempValue} onChange={setTempValue} accentColor={selectedColor} />
        </View>
      </Modal>
    </View>
  );
};

export default function BusinessHoursScreen() {
  const router = useRouter();
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Using multiple breaks; segments removed
  // Global break between appointments (minutes)
  const [globalBreakMinutes, setGlobalBreakMinutes] = useState<number>(0);
  const [isSavingGlobalBreak, setIsSavingGlobalBreak] = useState<boolean>(false);
  const [isBreakPickerOpen, setIsBreakPickerOpen] = useState<boolean>(false);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState<boolean>(false);

  const getDayName = (dayOfWeek: number) => {
    const dayNames = [
      'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'
    ];
    return dayNames[dayOfWeek] || '';
  };

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [tempStartTime, setTempStartTime] = useState('09:00');
  const [tempEndTime, setTempEndTime] = useState('17:00');
  const [tempBreakStartTime, setTempBreakStartTime] = useState('12:00');
  const [tempBreakEndTime, setTempBreakEndTime] = useState('13:00');
  const [tempSlotDuration, setTempSlotDuration] = useState<string>('60');
  const [useBreaks, setUseBreaks] = useState<boolean>(false);
  const [tempBreaks, setTempBreaks] = useState<Array<{ start_time: string; end_time: string }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [hoursData, profile] = await Promise.all([
          businessHoursApi.getAllBusinessHours(),
          businessProfileApi.getProfile(),
        ]);
        setBusinessHours(hoursData);
        setGlobalBreakMinutes(Math.max(0, Math.min(180, Number((profile as any)?.break ?? 0))));
      } catch (err) {
        setError('Failed to fetch business hours');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDayToggle = async (dayOfWeek: number, isActive: boolean) => {
    try {
      await businessHoursApi.updateBusinessHours(dayOfWeek, { is_active: isActive });
      setBusinessHours(prev => prev.map(h => 
        h.day_of_week === dayOfWeek ? { ...h, is_active: isActive } : h
      ));
    } catch (err) {
      setError('Failed to update business hours');
      console.error(err);
    }
  };

  const handleEditDay = (dayOfWeek: number) => {
    const dayHours = businessHours.find(h => h.day_of_week === dayOfWeek);
    if (dayHours) {
      setTempStartTime(dayHours.start_time);
      setTempEndTime(dayHours.end_time);
      setTempBreakStartTime(dayHours.break_start_time || '12:00');
      setTempBreakEndTime(dayHours.break_end_time || '13:00');
      setTempSlotDuration(String(dayHours.slot_duration_minutes || 60));
      const loadedBreaks = ((dayHours as any).breaks || []) as Array<{ start_time: string; end_time: string }>;
      setUseBreaks(loadedBreaks.length > 0 || (!!dayHours.break_start_time && !!dayHours.break_end_time));
      setTempBreaks(loadedBreaks);
      setEditingDay(dayOfWeek);
    }
  };

  const handleSaveDay = async () => {
    if (editingDay !== null) {
      {
        if (tempStartTime >= tempEndTime) {
          Alert.alert('שגיאה', 'שעת הסיום חייבת להיות אחרי שעת ההתחלה');
          return;
        }
        // validate multiple breaks (only if useBreaks is on)
        const allBreaks = useBreaks ? tempBreaks.slice() : [];
        for (const b of allBreaks) {
          if (!(tempStartTime < b.start_time && b.start_time < b.end_time && b.end_time <= tempEndTime)) {
            Alert.alert('שגיאה', 'כל הפסקה חייבת להיות בתוך שעות העבודה וללא חפיפה');
            return;
          }
        }
        const sortedBreaks = allBreaks.sort((a, b) => a.start_time.localeCompare(b.start_time));
        for (let i = 1; i < sortedBreaks.length; i++) {
          if (!(sortedBreaks[i - 1].end_time <= sortedBreaks[i].start_time)) {
            Alert.alert('שגיאה', 'אין חפיפה בין הפסקות');
            return;
          }
        }
      }

      try {
        await businessHoursApi.updateBusinessHours(editingDay, {
          start_time: tempStartTime,
          end_time: tempEndTime,
          break_start_time: useBreaks ? tempBreakStartTime : undefined,
          break_end_time: useBreaks ? tempBreakEndTime : undefined,
          breaks: useBreaks ? tempBreaks : [],
        });
        setBusinessHours(prev => prev.map(h => 
          h.day_of_week === editingDay ? { 
            ...h, 
            start_time: tempStartTime, 
            end_time: tempEndTime, 
            break_start_time: useBreaks ? tempBreakStartTime : undefined, 
            break_end_time: useBreaks ? tempBreakEndTime : undefined,
            breaks: useBreaks ? tempBreaks : [],
          } : h
        ));
        // Notify waitlist clients that match the updated working windows for this day
        try {
          await notifyWaitlistOnBusinessHoursUpdate(editingDay, {
            start_time: tempStartTime,
            end_time: tempEndTime,
            breaks: useBreaks ? tempBreaks : [],
            is_active: true,
          });
        } catch {}

        setEditingDay(null);
      } catch (err) {
        setError('Failed to save business hours');
        console.error(err);
      }
    }
  };

  const renderDayCard = (dayOfWeek: number) => {
    const dayHours = businessHours.find(h => h.day_of_week === dayOfWeek);
    const isEditing = editingDay === dayOfWeek;

    // Unified time options for all pickers (every שעה עגולה של היום)
    const allHourOptions = Array.from({ length: 24 }, (_, h) => `${h.toString().padStart(2, '0')}:00`);
    const startTimeOptions = allHourOptions;
    const endTimeOptions = allHourOptions;

    return (
      <TouchableOpacity key={dayOfWeek} style={styles.dayCard} activeOpacity={0.9} onPress={() => { if (!isEditing) { handleEditDay(dayOfWeek); } }} disabled={isEditing}>
        <View style={styles.dayHeader}>
          <View style={styles.dayInfo}>
            <Text style={styles.dayName}>{getDayName(dayOfWeek)}</Text>
                      {dayHours && dayHours.is_active && !isEditing && (
            <View>
              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={16} color={Colors.secondaryText} />
                <Text style={styles.dayTime}>
                  <Text style={styles.ltrText}>{formatRangeLtr(dayHours.start_time, dayHours.end_time)}</Text>
                </Text>
              </View>
              {/* Breaks summary: show all configured breaks if present, otherwise show single break fields */}
              {(() => {
                const dayBreaks = (((dayHours as any).breaks || []) as Array<{ start_time: string; end_time: string }>);
                if (dayBreaks.length > 0) {
                  return (
                    <View style={{ marginTop: 4, gap: 2 }}>
                      {dayBreaks.map((b, i) => (
                        <View key={`${b.start_time}-${b.end_time}-${i}`} style={styles.timeContainer}>
                          <Ionicons name="cafe-outline" size={14} color={Colors.secondaryText} />
                          <Text style={[styles.dayTime, { color: Colors.secondaryText, fontSize: 13 }]}> 
                            {dayBreaks.length > 1 ? `הפסקה #${i + 1}: ` : 'הפסקה: '}<Text style={styles.ltrText}>{formatRangeLtr(b.start_time, b.end_time)}</Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                }
                if (dayHours.break_start_time && dayHours.break_end_time) {
                  return (
                    <View style={[styles.timeContainer, { marginTop: 4 }]}>
                      <Ionicons name="cafe-outline" size={14} color={Colors.secondaryText} />
                      <Text style={[styles.dayTime, { color: Colors.secondaryText, fontSize: 13 }]}> 
                        הפסקה: <Text style={styles.ltrText}>{formatRangeLtr(dayHours.break_start_time, dayHours.break_end_time)}</Text>
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}
            </View>
          )}
            {dayHours && !dayHours.is_active && (
              <View style={styles.closedContainer}>
                <Ionicons name="close-circle-outline" size={16} color={Colors.secondaryText} />
                <Text style={styles.dayClosedText}>סגור</Text>
              </View>
            )}
          </View>
          
          <View style={styles.dayControls}>
            <Switch
              value={dayHours?.is_active || false}
              onValueChange={(value) => handleDayToggle(dayOfWeek, value)}
              trackColor={{ false: Colors.border, true: 'rgba(123,97,255,0.3)' }}
              thumbColor={(dayHours?.is_active || false) ? '#7B61FF' : Colors.card}
              ios_backgroundColor={Colors.border}
              style={styles.switch}
            />
          </View>
        </View>

              {isEditing && (
        <View style={styles.editContainer}>
          {/* Slot Duration Section removed – now global setting */}
          {/* Work Hours Section */}
          <View style={styles.workHoursSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>שעות עבודה</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Switch
                value={useBreaks}
                onValueChange={setUseBreaks}
                trackColor={{ false: Colors.border, true: 'rgba(123,97,255,0.3)' }}
                thumbColor={useBreaks ? '#7B61FF' : Colors.card}
                ios_backgroundColor={Colors.border}
              />
              <Text style={{ color: Colors.text, fontWeight: '600' }}>להציג ולהגדיר הפסקות?</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.timeColumn}>
                <TimePicker
                  value={tempStartTime}
                  onValueChange={setTempStartTime}
                  label="שעת התחלה"
                  options={startTimeOptions}
                  isBreakTime={false}
                />
              </View>
              
              <View style={styles.timeSeparator}>
                <Ionicons name="arrow-back" size={16} color={Colors.secondaryText} />
              </View>
              
              <View style={styles.timeColumn}>
                <TimePicker
                  value={tempEndTime}
                  onValueChange={setTempEndTime}
                  label="שעת סיום"
                  options={endTimeOptions}
                  isBreakTime={false}
                />
              </View>
            </View>
          </View>

          {/* Multiple Breaks Section */}
          {useBreaks && (
          <View style={styles.breakHoursSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cafe-outline" size={18} color={Colors.secondaryText} />
              <Text style={styles.sectionTitle}>הפסקות</Text>
            </View>
            <View style={{ gap: 12 }}>
              {tempBreaks.map((b, idx) => (
                <View key={idx} style={styles.breakItemRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <TouchableOpacity
                      onPress={() => setTempBreaks(tempBreaks.filter((_, i) => i !== idx))}
                      style={styles.breakDeleteButton}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={16} color={Colors.danger} />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>הפסקה #{idx + 1}</Text>
                      <Ionicons name="cafe" size={14} color={Colors.secondaryText} />
                    </View>
                  </View>
                  <View style={styles.timeRow}>
                    <View style={styles.timeColumn}>
                      <TimePicker
                        value={b.start_time}
                        onValueChange={(v) => {
                          const next = [...tempBreaks];
                          next[idx] = { ...next[idx], start_time: v };
                          setTempBreaks(next);
                        }}
                        label={'התחלה'}
                        options={startTimeOptions}
                        isBreakTime
                      />
                    </View>
                    <View style={styles.timeSeparator}>
                      <Ionicons name="arrow-back" size={16} color={Colors.secondaryText} />
                    </View>
                    <View style={styles.timeColumn}>
                      <TimePicker
                        value={b.end_time}
                        onValueChange={(v) => {
                          const next = [...tempBreaks];
                          next[idx] = { ...next[idx], end_time: v };
                          setTempBreaks(next);
                        }}
                        label="סיום"
                        options={endTimeOptions}
                        isBreakTime
                      />
                    </View>
                  </View>
                  {idx < tempBreaks.length - 1 && <View style={styles.breakDivider} />}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setTempBreaks(prev => ([...prev, { start_time: '12:00', end_time: '13:00' }]))}
                style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 16, backgroundColor: 'rgba(255,149,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,149,0,0.2)' }}
                activeOpacity={0.8}
              >
                <Text style={{ color: Colors.warning, fontWeight: '700' }}>הוסף הפסקה</Text>
              </TouchableOpacity>
            </View>
          </View>
          )}

          {/* Break Hours Section removed per UX – we use only the multi-breaks UI */}

          {/* Day Summary */}
          <View style={styles.daySummary}>
            <View style={styles.summaryHeader}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <Text style={styles.summaryTitle}>סיכום היום</Text>
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryText}>עבודה: <Text style={styles.ltrText}>{formatRangeLtr(tempStartTime, tempEndTime)}</Text></Text>
              {useBreaks ? (
                tempBreaks.length > 0 ? (
                  <View style={{ gap: 4 }}>
                    {tempBreaks.map((b, i) => (
                      <Text key={`${b.start_time}-${b.end_time}-${i}`} style={styles.summaryBreak}>
                        {`הפסקה ${tempBreaks.length > 1 ? '#' + (i + 1) + ': ' : ''}`}<Text style={styles.ltrText}>{formatRangeLtr(b.start_time, b.end_time)}</Text>
                      </Text>
                    ))}
                  </View>
                ) : null
              ) : (
                tempBreakStartTime && tempBreakEndTime ? (
                  <Text style={styles.summaryBreak}>
                    הפסקה: <Text style={styles.ltrText}>{formatRangeLtr(tempBreakStartTime, tempBreakEndTime)}</Text>
                  </Text>
                ) : null
              )}
            </View>
          </View>
          
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setEditingDay(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveDay}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>שמירה</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>טוען שעות עבודה...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header within a top-only SafeArea to keep top background white */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.card }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>שעות פעילות</Text>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
        <View style={styles.contentWrapper}>
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
        {/* Constraints button */}
        <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setIsConstraintsOpen(true)}
            activeOpacity={0.9}
            style={styles.constraintsButton}
          >
            <Ionicons name="remove-circle-outline" size={18} color={'#FFFFFF'} />
            <Text style={styles.constraintsButtonText}>ניהול אילוצים (ימים/שעות סגורים)</Text>
          </TouchableOpacity>
        </View>
        {/* Global constant break between appointments */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <View style={styles.globalBreakCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="timer-outline" size={18} color={Colors.accent} />
              <Text style={[styles.sectionTitle, { color: Colors.accent }]}>הפסקה קבועה בין תורים</Text>
            </View>
            <Text style={{ color: Colors.secondaryText, textAlign: 'right', marginBottom: 12 }}>
              בחר/י את מספר הדקות שיתווספו בין כל תור לתור. ערך 0 משאיר ללא הפסקה קבועה.
            </Text>
            <TouchableOpacity
              style={[styles.dropdownButton, isBreakPickerOpen && styles.dropdownButtonOpen]}
              onPress={() => setIsBreakPickerOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownButtonText, { color: Colors.accent }]}> {globalBreakMinutes} דק׳</Text>
              {isSavingGlobalBreak ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Ionicons name={isBreakPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.accent} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Break minutes picker modal */}
        <Modal
          visible={isBreakPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsBreakPickerOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setIsBreakPickerOpen(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: Colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: Colors.accent }]}>בחר/י הפסקה בין תורים (דקות)</Text>
              <TouchableOpacity onPress={() => setIsBreakPickerOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 8 }}>
              {([0,5,10,15,20,25,30] as number[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.sheetOption, m === globalBreakMinutes && styles.sheetOptionSelected]}
                  activeOpacity={0.7}
                  onPress={async () => {
                    try {
                      setIsSavingGlobalBreak(true);
                      setGlobalBreakMinutes(m);
                      await businessProfileApi.upsertProfile({ break: m } as any);
                      setIsBreakPickerOpen(false);
                    } catch (e) {
                      Alert.alert('שגיאה', 'נכשל בשמירת ההפסקה. נסו שוב.');
                    } finally {
                      setIsSavingGlobalBreak(false);
                    }
                  }}
                >
                  <Text style={[styles.sheetOptionText, m === globalBreakMinutes && styles.sheetOptionTextSelected]}>
                    {m} דק׳
                  </Text>
                  {m === globalBreakMinutes && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={20} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Days List */}
        <View style={styles.daysContainer}>
          {[0, 1, 2, 3, 4, 5, 6].map(renderDayCard)}
        </View>

        {/* Footer Spacing */}
        <View style={styles.footerSpacing} />
          </ScrollView>
        </View>
      </SafeAreaView>
      <BusinessConstraintsModal visible={isConstraintsOpen} onClose={() => setIsConstraintsOpen(false)} />
    </View>
  );
}

// Simple iOS-like wheel picker (single column)
const WheelPicker: React.FC<{ options: string[]; value: string; onChange: (v: string) => void; accentColor?: string }> = ({ options, value, onChange, accentColor = Colors.primary }) => {
  const listRef = useRef<ScrollView | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, options.findIndex(o => o === value)));

  useEffect(() => {
    const idx = Math.max(0, options.findIndex(o => o === value));
    setSelectedIndex(idx);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: idx * 44, animated: false });
    });
  }, [value, options]);

  const handleMomentumEnd = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y as number;
    const idx = Math.round(offsetY / 44);
    const clamped = Math.min(options.length - 1, Math.max(0, idx));
    setSelectedIndex(clamped);
    onChange(options[clamped]);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: clamped * 44, animated: true });
    });
  };

  return (
    <View style={styles.wheelContainer}>
      <View style={{ position: 'absolute', left: 16, right: 16, top: (220/2 - 22), height: 44, borderRadius: 12, borderWidth: 1, borderColor: accentColor, backgroundColor: 'rgba(0,0,0,0.03)' }} />
      <ScrollView
        ref={(ref) => { listRef.current = ref; }}
        showsVerticalScrollIndicator={false}
        snapToInterval={44}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
      >
        <View style={{ height: (220/2 - 22) }} />
        {options.map((opt, i) => {
          const active = i === selectedIndex;
          return (
            <View key={opt} style={styles.wheelItem}>
              <Text style={[styles.wheelText, active && styles.wheelTextActive]}>{formatHHMM(opt)}</Text>
            </View>
          );
        })}
        <View style={{ height: (220/2 - 22) }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.card,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  constraintsButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 18,
    paddingVertical: 14,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  constraintsButtonText: {
    color: Colors.card,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 20,
    paddingTop: 16,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  descriptionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  descriptionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.7,
  },
  description: {
    fontSize: 16,
    color: Colors.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.2,
    maxWidth: 320,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.secondaryText,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  errorContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  errorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  daysContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  dayCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(142, 142, 147, 0.1)',
    overflow: 'visible',
  },
  dayHeader: {
    flexDirection: 'row-reverse', // RTL
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dayName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  timeContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  dayTime: {
    fontSize: 15,
    color: Colors.secondaryText,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  ltrText: {
    writingDirection: 'ltr',
    textAlign: 'left',
    includeFontPadding: false,
  },
  closedContainer: {
    flexDirection: 'row-reverse', // RTL
    alignItems: 'center',
    gap: 6,
  },
  dayClosedText: {
    fontSize: 15,
    color: Colors.secondaryText,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  dayControls: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  editContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: Colors.separator,
    overflow: 'visible',
  },
  editSection: {
    gap: 20,
    marginBottom: 24,
    overflow: 'visible',
  },
  timePickerContainer: {
    gap: 8,
    position: 'relative',
    zIndex: 1000,
  },
  timePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  timePickerLabelSmall: {
    fontSize: 14,
  },
  dropdownButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 50,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownButtonSmall: {
    paddingVertical: 10,
    minHeight: 44,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  dropdownButtonOpen: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dropdownButtonTextSmall: {
    fontSize: 12,
  },
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 9999,
  },
  optionsScroll: {
    maxHeight: 200,
  },
  optionItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.separator,
  },
  optionItemSmall: {
    paddingVertical: 10,
  },
  optionItemSelected: {
    borderBottomColor: 'transparent',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  optionTextSmall: {
    fontSize: 13,
  },
  optionTextSelected: {
    color: Colors.card,
    fontWeight: '600',
  },
  // Modal bottom sheet styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E5EA',
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(60, 60, 67, 0.2)',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  sheetList: {
    maxHeight: 320,
  },
  wheelContainer: {
    height: 220,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  wheelItem: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  wheelTextActive: {
    color: Colors.primary,
  },
  sheetOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.separator,
  },
  sheetOptionSelected: {
    backgroundColor: 'rgba(123, 97, 255, 0.08)',
  },
  sheetOptionText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  sheetOptionTextSelected: {
    color: Colors.accent,
  },
  editActions: {
    flexDirection: 'row-reverse',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    color: Colors.secondaryText,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: Colors.card,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  generateButton: {
    marginHorizontal: 24,
    marginTop: 40,
    backgroundColor: Colors.success,
    borderRadius: 20,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  generateButtonContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  generateButtonText: {
    color: Colors.card,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  footerSpacing: {
    height: 40,
  },
  globalBreakCard: {
    backgroundColor: 'rgba(123, 97, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(123, 97, 255, 0.2)',
  },
  // Work Hours Section
  workHoursSection: {
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.1)',
    overflow: 'visible',
  },
  breakHoursSection: {
    backgroundColor: 'rgba(255, 149, 0, 0.04)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.1)',
    overflow: 'visible',
  },
  breakItemRow: {
    paddingVertical: 10,
  },
  breakDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    marginTop: 12,
  },
  breakDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.25)'
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  optionalLabel: {
    fontSize: 14,
    color: Colors.secondaryText,
    fontWeight: '500',
    marginRight: 4,
  },
  timeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 16,
    overflow: 'visible',
  },
  timeColumn: {
    flex: 1,
    overflow: 'visible',
    minWidth: 0,
  },
  timeSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    width: 28,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  daySummary: {
    backgroundColor: 'rgba(52, 199, 89, 0.05)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.1)',
  },
  summaryHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  summaryContent: {
    gap: 4,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.secondaryText,
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  summaryBreak: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.secondaryText,
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  breakTimeLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    letterSpacing: -0.3,
    marginTop: 20,
  },
});