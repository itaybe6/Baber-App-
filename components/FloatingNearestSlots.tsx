import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, AvailableTimeSlot } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function FloatingNearestSlots() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [slots, setSlots] = useState<AvailableTimeSlot[]>([]);

  const fetchNearest = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const dateStrings: string[] = [];
      for (let i = 0; i <= 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dateStrings.push(d.toISOString().split('T')[0]);
      }

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .in('slot_date', dateStrings)
        .eq('is_available', true)
        .order('slot_date')
        .order('slot_time');

      if (error) throw error;

      const now = new Date();
      now.setSeconds(0, 0);
      const upcoming = (data || []).filter((slot) => {
        const [h, m] = (slot.slot_time || '00:00').split(':').map((t: string) => parseInt(t, 10));
        const slotDateTime = new Date(slot.slot_date + 'T' + `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        return slotDateTime >= now;
      });

      const sorted = upcoming.sort((a, b) => {
        const aDate = new Date(a.slot_date + 'T' + a.slot_time + ':00');
        const bDate = new Date(b.slot_date + 'T' + b.slot_time + ':00');
        return aDate.getTime() - bDate.getTime();
      });

      setSlots(sorted.slice(0, 3));
    } catch (e) {
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    fetchNearest();
  }, [fetchNearest]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', weekday: 'long' });
  };

  return (
    <>
      <View style={[styles.fabWrap, { bottom: Math.max(110, insets.bottom + 86) }]}>
        <LinearGradient
          colors={[ '#FFD60A', '#FF9F0A' ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabRing}
        >
          <TouchableOpacity style={styles.fabInner} activeOpacity={0.88} onPress={open}>
            <Ionicons name="flash" size={26} color="#FFD60A" />
          </TouchableOpacity>
        </LinearGradient>
      </View>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.headerIcon}>
                <Ionicons name="flash" size={18} color="#FFD60A" />
              </View>
              <Text style={styles.sheetTitle}>תורים זמינים בקרוב</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>טוען...</Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="calendar-outline" size={22} color="#8E8E93" />
                <Text style={styles.emptyText}>אין תורים זמינים בקרוב</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {slots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    style={styles.row}
                    activeOpacity={0.85}
                    onPress={() => {
                      setIsOpen(false);
                      router.push('/(client-tabs)/book-appointment');
                    }}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons name="time-outline" size={16} color="#007AFF" />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTime}>{slot.slot_time}</Text>
                      <Text style={styles.rowDate}>{formatDate(slot.slot_date)}</Text>
                    </View>
                    <Ionicons name="chevron-back" size={18} color="#8E8E93" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <SafeAreaView edges={["bottom"]} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    right: 20,
    bottom: 110,
    zIndex: 50,
  },
  fabRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD60A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
      },
      android: { elevation: 16 },
    }),
  },
  fabInner: {
    flex: 1,
    borderRadius: 34,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sheetTitle: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  closeBtn: {
    padding: 6,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    color: '#8E8E93',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  list: {
    paddingBottom: 8,
    gap: 10,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  rowInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rowTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  rowDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
});


