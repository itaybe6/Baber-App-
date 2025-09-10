import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors';
import Card from './Card';
import { Clock, Calendar, User, CreditCard } from 'lucide-react-native';
import { Appointment } from '@/constants/appointments';
import { clients } from '@/constants/clients';
import { services } from '@/constants/services';

interface AppointmentCardProps {
  appointment: Appointment;
  onPress: (appointment: Appointment) => void;
}

export default function AppointmentCard({ appointment, onPress }: AppointmentCardProps) {
  const client = clients.find(c => c.id === appointment.clientId);
  const service = services.find(s => s.id === appointment.serviceId);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return Colors.success;
      case 'pending':
        return Colors.warning;
      case 'cancelled':
        return Colors.error;
      case 'completed':
        return Colors.secondary;
      default:
        return Colors.subtext;
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'מאושר';
      case 'pending':
        return 'ממתין';
      case 'cancelled':
        return 'בוטל';
      case 'completed':
        return 'הושלם';
      default:
        return status;
    }
  };
  
  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'שולם';
      case 'deposit':
        return 'מקדמה';
      case 'unpaid':
        return 'לא שולם';
      default:
        return status;
    }
  };
  
  return (
    <TouchableOpacity 
      onPress={() => onPress(appointment)}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.serviceName}>{service?.name || 'שירות לא ידוע'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
            <Text style={styles.statusText}>{getStatusText(appointment.status)}</Text>
          </View>
        </View>
        
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Calendar size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{formatDate(appointment.date)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Clock size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{formatTime(appointment.date)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <User size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{client?.name || 'לקוחה לא ידועה'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <CreditCard size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{getPaymentStatusText(appointment.paymentStatus)}</Text>
          </View>
        </View>
        
        {appointment.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>{appointment.notes}</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  infoContainer: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
    textAlign: 'right',
  },
  notesContainer: {
    backgroundColor: Colors.card,
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  notesText: {
    fontSize: 14,
    color: Colors.subtext,
    textAlign: 'right',
  },
});