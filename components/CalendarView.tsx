import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import Colors from '@/constants/colors';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Appointment } from '@/constants/appointments';

interface CalendarViewProps {
  appointments: Appointment[];
  onSelectDate: (date: Date) => void;
  selectedDate: Date;
  onSelectAppointment: (appointment: Appointment) => void;
}

export default function CalendarView({
  appointments,
  onSelectDate,
  selectedDate,
  onSelectAppointment,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Generate days for the current month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };
  
  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };
  
  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };
  
  const formatMonth = (date: Date) => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };
  
  const isDateSelected = (date: Date) => {
    return (
      selectedDate.getFullYear() === date.getFullYear() &&
      selectedDate.getMonth() === date.getMonth() &&
      selectedDate.getDate() === date.getDate()
    );
  };
  
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      today.getFullYear() === date.getFullYear() &&
      today.getMonth() === date.getMonth() &&
      today.getDate() === date.getDate()
    );
  };
  
  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.date);
      return (
        appointmentDate.getFullYear() === date.getFullYear() &&
        appointmentDate.getMonth() === date.getMonth() &&
        appointmentDate.getDate() === date.getDate()
      );
    });
  };
  
  const hasAppointments = (date: Date) => {
    return getAppointmentsForDate(date).length > 0;
  };
  
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    
    const days = [];
    const weekdays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    
    // Render weekday headers
    const weekdayHeaders = weekdays.map((day, index) => (
      <View key={`header-${index}`} style={styles.weekdayHeader}>
        <Text style={styles.weekdayText}>{day}</Text>
      </View>
    ));
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<View key={`empty-${i}`} style={styles.emptyDay} />);
    }
    
    // Add cells for each day of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dateAppointments = getAppointmentsForDate(date);
      
      days.push(
        <TouchableOpacity
          key={`day-${i}`}
          style={[
            styles.day,
            isDateSelected(date) && styles.selectedDay,
            isToday(date) && styles.today,
          ]}
          onPress={() => onSelectDate(date)}
        >
          <Text style={[
            styles.dayText,
            isDateSelected(date) && styles.selectedDayText,
            isToday(date) && styles.todayText,
          ]}>
            {i}
          </Text>
          
          {hasAppointments(date) && (
            <View style={[
              styles.appointmentIndicator,
              isDateSelected(date) && styles.selectedAppointmentIndicator,
            ]} />
          )}
        </TouchableOpacity>
      );
    }
    
    // Group days into weeks
    const weeks = [];
    let week = [];
    
    for (let i = 0; i < days.length; i++) {
      week.push(days[i]);
      
      if ((i + 1) % 7 === 0 || i === days.length - 1) {
        weeks.push(
          <View key={`week-${weeks.length}`} style={styles.week}>
            {week}
          </View>
        );
        week = [];
      }
    }
    
    return (
      <View style={styles.calendar}>
        <View style={styles.weekdayRow}>
          {weekdayHeaders}
        </View>
        {weeks}
      </View>
    );
  };
  
  const renderAppointments = () => {
    const dateAppointments = getAppointmentsForDate(selectedDate);
    
    if (dateAppointments.length === 0) {
      return (
        <View style={styles.noAppointments}>
          <Text style={styles.noAppointmentsText}>אין תורים לתאריך זה</Text>
        </View>
      );
    }
    
    // Sort appointments by time
    dateAppointments.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
    
    return (
      <View style={styles.appointmentsList}>
        {dateAppointments.map((appointment, index) => {
          const appointmentDate = new Date(appointment.date);
          const time = appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
          
          return (
            <TouchableOpacity
              key={index}
              style={styles.appointmentItem}
              onPress={() => onSelectAppointment(appointment)}
            >
              <View style={[
                styles.appointmentStatus,
                { backgroundColor: getStatusColor(appointment.status) }
              ]} />
              <Text style={styles.appointmentTime}>{time}</Text>
              <Text style={styles.appointmentClient}>
                {getClientName(appointment.clientId)}
              </Text>
              <Text style={styles.appointmentService}>
                {getServiceName(appointment.serviceId)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };
  
  const getClientName = (clientId: string) => {
    // This would normally come from your clients data
    return clientId.replace('client-', 'לקוחה ');
  };
  
  const getServiceName = (serviceId: string) => {
    // This would normally come from your services data
    return serviceId.replace('service-', 'שירות ');
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
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <ChevronRight size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <Text style={styles.monthTitle}>{formatMonth(currentMonth)}</Text>
        
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      
      {renderCalendar()}
      
      <View style={styles.selectedDateHeader}>
        <Text style={styles.selectedDateText}>
          {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>
      
      {renderAppointments()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navButton: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  calendar: {
    paddingHorizontal: 8,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.subtext,
  },
  week: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2,
    backgroundColor: Colors.card,
  },
  emptyDay: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
  },
  selectedDay: {
    backgroundColor: Colors.primary,
  },
  today: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  selectedDayText: {
    color: Colors.white,
  },
  todayText: {
    color: Colors.primary,
  },
  appointmentIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  selectedAppointmentIndicator: {
    backgroundColor: Colors.white,
  },
  selectedDateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: 8,
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  appointmentsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  noAppointments: {
    padding: 16,
    alignItems: 'center',
  },
  noAppointmentsText: {
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
  appointmentStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  appointmentTime: {
    width: 60,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  appointmentClient: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    marginRight: 8,
    textAlign: 'right',
  },
  appointmentService: {
    fontSize: 14,
    color: Colors.subtext,
    textAlign: 'right',
  },
});