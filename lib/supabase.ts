import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants?.expoConfig as any)?.extra ?? {};

// טעינת משתני סביבה עם סדר עדיפויות ברור
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||     // עדיפות ראשונה - משתנה סביבה
  extra.EXPO_PUBLIC_SUPABASE_URL ||           // עדיפות שנייה - מ app.json
  extra.SUPABASE_URL ||                       // עדיפות שלישית - legacy
  undefined;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || // עדיפות ראשונה - משתנה סביבה
  extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ||       // עדיפות שנייה - מ app.json
  extra.SUPABASE_ANON_KEY ||                   // עדיפות שלישית - legacy
  undefined;

// הצגת מידע debug רק ב development
if (__DEV__) {
  console.log('[supabase] Configuration loaded:');
  console.log('- URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.log('- Anon Key:', supabaseAnonKey ? 'SET' : 'MISSING');
  console.log('- Source: Using environment variables');
}

// מניעת קריסות בזמן ייבוא במצב production
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  
  console.error(`[supabase] Missing configuration: ${missingVars.join(', ')}`);
  console.error('[supabase] Please set these environment variables in your .env file');
}

export const supabase = createClient(
  (supabaseUrl as string) || 'https://example.invalid',
  (supabaseAnonKey as string) || 'anon-key-missing',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Types for our database tables
export interface User {
  id: string;
  name: string;
  user_type: 'admin' | 'client';
  phone: string;
  email?: string;
  password_hash?: string;
  image_url?: string;
  push_token?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  image_url?: string;
  favorite_designs?: string[];
  created_at: string;
  last_visit?: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  // Optional in type; DB has default 60 when not provided
  duration_minutes?: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ServiceCategory removed; categories are now static in constants/services.ts

export interface Design {
  id: string;
  name: string;
  image_url: string;
  // New: list of image URLs for designs with multiple images. First item should match image_url.
  image_urls?: string[];
  categories: string[];
  popularity: number;
  description?: string;
  price_modifier: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignCategory {
  id: string;
  name: string;
  description?: string;
  display_order: number;
}

export interface Appointment {
  id: string;
  service_name: string;
  appointment_date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';
  created_at: string;
  updated_at: string;
}

// Appointment with service details included (if needed for future joins)
export interface AppointmentWithService extends Appointment {
  service: Service;
}

// Business Hours interface
export interface BusinessHours {
  id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  break_start_time?: string; // HH:MM format, optional
  break_end_time?: string; // HH:MM format, optional
  is_active: boolean;
  // New: optional per-day slot duration in minutes (e.g., 15, 20, 30, 45, 60). If not set, defaults to 60
  slot_duration_minutes?: number;
  // New: multiple breaks stored as JSON array of { start_time, end_time }
  breaks?: Array<{ start_time: string; end_time: string }>;
  created_at: string;
  updated_at: string;
}

// Available Time Slots interface
export interface AvailableTimeSlot {
  id: string;
  slot_date: string; // YYYY-MM-DD format
  slot_time: string; // HH:MM format
  is_available: boolean;
  client_name?: string | null;
  client_phone?: string | null;
  service_name?: string | null;
  // Duration of the appointment in minutes
  duration_minutes: number;
  appointment_id?: string | null;
  created_at: string;
  updated_at: string;
}

// Business constraints (date-specific unavailable windows)
export interface BusinessConstraint {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string;   // HH:MM or HH:MM:SS
  reason?: string | null;
  created_at: string;
  updated_at: string;
}

// Waitlist interface
export interface WaitlistEntry {
  id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  requested_date: string; // YYYY-MM-DD format
  time_period: 'morning' | 'afternoon' | 'evening' | 'any'; // Preferred time period
  status: 'waiting' | 'contacted' | 'booked' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// Notification interface
export interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'appointment_reminder' | 'promotion' | 'general' | 'system';
  recipient_name: string;
  recipient_phone: string;
  created_at: string;
  is_read: boolean;
  read_at?: string;
  // Optional flag to indicate if a push was sent successfully
  push_sent?: boolean;
}

// Business profile (single-row table storing social links and address)
export interface BusinessProfile {
  id: string;
  display_name?: string;
  address?: string;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  // Number of minutes break between appointments
  break?: number;
  created_at: string;
  updated_at: string;
}