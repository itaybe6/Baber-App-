export interface Appointment {
  id: string;
  service_id: string;
  service_name: string;
  appointment_date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  image: string;
  category: string;
}

export interface AppointmentWithService extends Appointment {
  service: Service;
}

// Mock services for appointments
const mockServices: Service[] = [
  { id: '1', name: 'תספורת קלאסית', price: 80, duration: 30, image: '', category: 'basic' },
  { id: '2', name: 'תספורת מכונה', price: 120, duration: 45, image: '', category: 'gel' },
  { id: '3', name: 'עיצוב זקן', price: 200, duration: 90, image: '', category: 'acrylic' },
  { id: '4', name: 'תספורת ילדים', price: 150, duration: 60, image: '', category: 'design' },
  { id: '5', name: 'טיפול פנים לגבר', price: 100, duration: 40, image: '', category: 'care' },
  { id: '6', name: 'גילוח קלאסי בסכין', price: 60, duration: 30, image: '', category: 'basic' },
];

// Mock appointments for the next 2 weeks
export const generateAppointments = (): Appointment[] => {
  const appointments: Appointment[] = [];
  const now = new Date();
  
  // Generate some random appointments for the next 14 days
  for (let i = 0; i < 20; i++) {
    const appointmentDateTime = new Date(now);
    appointmentDateTime.setDate(appointmentDateTime.getDate() + Math.floor(Math.random() * 14));
    appointmentDateTime.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 4) * 15, 0);
    
    const timeOnly = new Date(appointmentDateTime);
    timeOnly.setFullYear(1970, 0, 1); // Set to epoch date but keep time
    
    const selectedService = mockServices[Math.floor(Math.random() * 6)];
    
    appointments.push({
      id: `app-${i}`,
      service_id: selectedService.id,
      service_name: selectedService.name,
      appointment_date: appointmentDateTime.toISOString(),
      time: timeOnly.toISOString(),
      status: ['confirmed', 'pending', 'completed', 'cancelled', 'no_show'][Math.floor(Math.random() * 5)] as any,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }
  
  return appointments;
};

// Generate appointments with service details
export const generateAppointmentsWithService = (): AppointmentWithService[] => {
  const appointments = generateAppointments();
  
  return appointments.map(appointment => {
    const service = mockServices.find(s => s.id === appointment.service_id) || mockServices[0];
    return {
      ...appointment,
      service
    };
  });
};