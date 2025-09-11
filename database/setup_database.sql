-- Setup all required tables for the nailpolish application
-- Run this file in your Supabase SQL editor

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  push_token TEXT,
  user_type TEXT NOT NULL DEFAULT 'client' CHECK (user_type IN ('client', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create notifications table (without push_token for now)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN (
    'appointment_reminder',    -- תזכורת לתור
    'promotion',              -- מבצע
    'general',                -- הודעה כללית
    'system'                  -- התראת מערכת
  )),
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create waitlist_entries table
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  service_name TEXT NOT NULL,
  requested_date DATE NOT NULL,
  time_period TEXT NOT NULL CHECK (time_period IN ('morning', 'afternoon', 'evening', 'any')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'contacted', 'booked', 'cancelled')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create appointments table (renamed from available_time_slots)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  client_name TEXT,
  client_phone TEXT,
  service_name TEXT,
  appointment_id TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_phone ON notifications(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_waitlist_date_status ON waitlist_entries(requested_date, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_client ON waitlist_entries(client_phone, client_name);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id ON waitlist_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(slot_date);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(slot_time);
CREATE INDEX IF NOT EXISTS idx_appointments_available ON appointments(is_available);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_waitlist_entries_updated_at ON waitlist_entries;
CREATE TRIGGER update_waitlist_entries_updated_at 
    BEFORE UPDATE ON waitlist_entries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at 
    BEFORE UPDATE ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add user_id column to existing waitlist_entries table if it doesn't exist
ALTER TABLE waitlist_entries 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add user_id column to existing appointments table if it doesn't exist
ALTER TABLE appointments 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for user_id if it doesn't exist (ensure it's created after the column)
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id_new ON waitlist_entries(user_id);

-- Disable Row Level Security (RLS) for application tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;

-- RLS policies removed per application requirements

-- Insert a default admin user (optional)
-- INSERT INTO users (name, phone, user_type) VALUES ('Admin', '050-0000000', 'admin') ON CONFLICT (phone) DO NOTHING; 

-- 5. Create business_hours table (if not exists)
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start_time TIME,
  break_end_time TIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  slot_duration_minutes INT DEFAULT 60 CHECK (slot_duration_minutes IN (15, 20, 30, 45, 60)),
  breaks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_business_hours_day UNIQUE (day_of_week)
);

-- In case the table already existed, ensure the slot_duration_minutes column exists
ALTER TABLE business_hours
  ADD COLUMN IF NOT EXISTS slot_duration_minutes INT DEFAULT 60 CHECK (slot_duration_minutes IN (15, 20, 30, 45, 60));
ALTER TABLE business_hours
  ADD COLUMN IF NOT EXISTS breaks JSONB DEFAULT '[]'::jsonb;

-- Indexes for business hours table
CREATE INDEX IF NOT EXISTS idx_business_hours_day ON business_hours(day_of_week);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_business_hours_updated_at ON business_hours;
CREATE TRIGGER update_business_hours_updated_at 
    BEFORE UPDATE ON business_hours 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for business_hours
ALTER TABLE business_hours DISABLE ROW LEVEL SECURITY;

-- No RLS policies for business_hours


  -- 6. Create business_profile table (stores Instagram, Facebook and address for the business)
  CREATE TABLE IF NOT EXISTS business_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    display_name TEXT,
    address TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    tiktok_url TEXT,
    break INT DEFAULT 0 CHECK (break >= 0 AND break <= 180),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Trigger for updated_at on business_profile
  DROP TRIGGER IF EXISTS update_business_profile_updated_at ON business_profile;
  CREATE TRIGGER update_business_profile_updated_at 
      BEFORE UPDATE ON business_profile 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();

  -- Disable RLS for business_profile
  ALTER TABLE business_profile DISABLE ROW LEVEL SECURITY;

-- 7. Create designs table
CREATE TABLE IF NOT EXISTS designs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_urls JSONB DEFAULT '[]'::jsonb,
  categories JSONB DEFAULT '[]'::jsonb,
  popularity INT DEFAULT 3 CHECK (popularity >= 1 AND popularity <= 5),
  description TEXT,
  price_modifier DECIMAL(5,2) DEFAULT 0.0,
  is_featured BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for designs table
CREATE INDEX IF NOT EXISTS idx_designs_user_id ON designs(user_id);
CREATE INDEX IF NOT EXISTS idx_designs_popularity ON designs(popularity);
CREATE INDEX IF NOT EXISTS idx_designs_is_featured ON designs(is_featured);
CREATE INDEX IF NOT EXISTS idx_designs_categories ON designs USING GIN(categories);

-- Trigger for updated_at on designs
DROP TRIGGER IF EXISTS update_designs_updated_at ON designs;
CREATE TRIGGER update_designs_updated_at 
    BEFORE UPDATE ON designs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for designs
ALTER TABLE designs DISABLE ROW LEVEL SECURITY;

-- 8. Create recurring_appointments table
-- This table supports multiple barbers by associating each recurring appointment with a user_id
CREATE TABLE IF NOT EXISTS recurring_appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_time TIME NOT NULL,
  service_name TEXT NOT NULL,
  repeat_interval_weeks INT DEFAULT 1 CHECK (repeat_interval_weeks BETWEEN 1 AND 4),
  start_date DATE,
  end_date DATE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for recurring_appointments table
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_day_time ON recurring_appointments(day_of_week, slot_time);
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_client ON recurring_appointments(client_phone);
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_user_id ON recurring_appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_dates ON recurring_appointments(start_date, end_date);

-- Trigger for updated_at on recurring_appointments
DROP TRIGGER IF EXISTS update_recurring_appointments_updated_at ON recurring_appointments;
CREATE TRIGGER update_recurring_appointments_updated_at 
    BEFORE UPDATE ON recurring_appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for recurring_appointments
ALTER TABLE recurring_appointments DISABLE ROW LEVEL SECURITY;

-- 9. Function: generate time slots for a given date using business hours + segments
CREATE OR REPLACE FUNCTION public.generate_time_slots_for_date(target_date DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  dow INT;
  bh RECORD;
  dur INT;
  global_break_minutes INT;
  t TIME;
  within_break BOOLEAN;
BEGIN
  dow := EXTRACT(DOW FROM target_date);

  SELECT * INTO bh FROM business_hours 
  WHERE day_of_week = dow AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    DELETE FROM appointments 
    WHERE slot_date = target_date AND is_available = TRUE;
    RETURN;
  END IF;

  dur := COALESCE(bh.slot_duration_minutes, 60);

  -- Fetch global break (minutes) from latest business_profile row; default 0
  SELECT COALESCE(bp.break, 0)
  INTO global_break_minutes
  FROM business_profile bp
  ORDER BY bp.created_at DESC
  LIMIT 1;

  -- Remove only available slots to keep booked ones
  DELETE FROM appointments 
  WHERE slot_date = target_date AND is_available = TRUE;

  t := bh.start_time;
  WHILE t < bh.end_time LOOP
    within_break := FALSE;

    -- legacy single break window
    IF bh.break_start_time IS NOT NULL AND bh.break_end_time IS NOT NULL THEN
      IF t >= bh.break_start_time AND t < bh.break_end_time THEN
        within_break := TRUE;
      END IF;
    END IF;

    -- check JSONB breaks
    IF NOT within_break AND bh.breaks IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(bh.breaks) AS b
        WHERE t >= (b->>'start_time')::time
          AND t <  (b->>'end_time')::time
      ) INTO within_break;
    END IF;

    -- check date-specific business constraints (t inside any constraint window)
    IF NOT within_break THEN
      SELECT EXISTS (
        SELECT 1
        FROM business_constraints bc
        WHERE bc.date = target_date
          AND t >= bc.start_time
          AND t < bc.end_time
      ) INTO within_break;
    END IF;

    IF NOT within_break THEN
      INSERT INTO appointments (slot_date, slot_time, is_available)
      SELECT target_date, t, TRUE
      WHERE NOT EXISTS (
        SELECT 1 FROM appointments 
        WHERE slot_date = target_date AND slot_time = t
      );
    END IF;

    t := (t + make_interval(mins => dur + COALESCE(global_break_minutes, 0)))::time;
  END LOOP;

  -- Assign recurring appointments for this date
  -- 1) Update existing available slots to be booked for the recurring client
  UPDATE appointments s
  SET is_available = FALSE,
      client_name = r.client_name,
      client_phone = r.client_phone,
      service_name = r.service_name,
      user_id = r.user_id,
      updated_at = NOW()
  FROM recurring_appointments r
  WHERE s.slot_date = target_date
    AND s.slot_time = r.slot_time
    AND s.is_available = TRUE
    AND r.day_of_week = dow
    AND (r.start_date IS NULL OR r.start_date <= target_date)
    AND (r.end_date IS NULL OR r.end_date >= target_date);

  -- 2) Insert booked slots for recurring clients that don't have a slot yet (e.g., outside generated windows is skipped)
  INSERT INTO appointments (slot_date, slot_time, is_available, client_name, client_phone, service_name, user_id)
  SELECT target_date, r.slot_time, FALSE, r.client_name, r.client_phone, r.service_name, r.user_id
  FROM recurring_appointments r
  WHERE r.day_of_week = dow
    AND (r.start_date IS NULL OR r.start_date <= target_date)
    AND (r.end_date IS NULL OR r.end_date >= target_date)
    AND NOT EXISTS (
      SELECT 1 FROM appointments s
      WHERE s.slot_date = target_date
        AND s.slot_time = r.slot_time
    );
END;
$$;

-- 8. Schedule: every day at 00:00 generate slots for date + 6 days (rolling next 7 days including today)
-- Requires pg_cron extension (available on Supabase). Safe to CREATE EXTENSION IF NOT EXISTS
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Replace existing job (if any) so changes take effect
DO $$
DECLARE
  v_job_id INT;
BEGIN
  -- Unschedule existing job if it exists
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'generate_time_slots_for_next_week_day';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  -- Schedule the job to create slots for CURRENT_DATE + 6 days
  PERFORM cron.schedule(
    'generate_time_slots_for_next_week_day',
    '0 0 * * *', -- every day at 00:00 (database timezone)
    $cron$SELECT public.generate_time_slots_for_date((CURRENT_DATE + INTERVAL '6 days')::date);$cron$
  );
END;
$$;