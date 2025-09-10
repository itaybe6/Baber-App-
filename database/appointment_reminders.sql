-- Enable one-off reminders for appointments: schedule a notification ~24h before the booked slot
-- This script creates:
-- 1) scheduled_reminders table to queue reminders
-- 2) trigger on appointments to enqueue reminder on booking/cancellation/changes
-- 3) processing function that inserts into notifications when due
-- 4) pg_cron job that runs the processor periodically

-- 0) Ensure pg_cron is available (Supabase usually uses the extensions schema)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1) Table for scheduled reminders (idempotent)
CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  service_name TEXT,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Helpful index for the processor
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_due_open
  ON public.scheduled_reminders(due_at)
  WHERE processed_at IS NULL;

-- Avoid duplicates per slot while pending
CREATE UNIQUE INDEX IF NOT EXISTS uq_scheduled_reminders_slot_open
  ON public.scheduled_reminders(slot_id)
  WHERE processed_at IS NULL;

-- 2) Helper: compute the appointment timestamp (timestamptz) given slot_date+slot_time in a specific timezone
-- Update the timezone below if needed (e.g., 'Asia/Jerusalem')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'make_appointment_timestamptz'
  ) THEN
    CREATE FUNCTION public.make_appointment_timestamptz(p_date DATE, p_time TIME, p_tz TEXT DEFAULT 'Asia/Jerusalem')
    RETURNS TIMESTAMP WITH TIME ZONE
    LANGUAGE SQL
    IMMUTABLE
    AS $fn$
      -- Interpret the local date+time in the given timezone and return as timestamptz (UTC absolute time)
      SELECT (p_date::timestamp + p_time) AT TIME ZONE p_tz;
    $fn$;
  END IF;
END $$;

-- 2b) Table for scheduled admin reminders (30 minutes before appointment)
CREATE TABLE IF NOT EXISTS public.scheduled_admin_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  service_name TEXT,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_scheduled_admin_reminders_due_open
  ON public.scheduled_admin_reminders(due_at)
  WHERE processed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scheduled_admin_reminders_slot_open
  ON public.scheduled_admin_reminders(slot_id)
  WHERE processed_at IS NULL;

-- 3) Enqueue reminder for a booked slot (24h before, or asap if already within 24h)
CREATE OR REPLACE FUNCTION public.enqueue_appointment_reminder(p_slot public.appointments)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appt_at timestamptz;
  due_at timestamptz;
BEGIN
  -- Only for booked rows with client details
  IF p_slot.is_available IS DISTINCT FROM FALSE OR p_slot.client_phone IS NULL OR trim(p_slot.client_phone) = '' THEN
    RETURN;
  END IF;

  appt_at := public.make_appointment_timestamptz(p_slot.slot_date, p_slot.slot_time);
  due_at := appt_at - INTERVAL '24 hours';

  -- If the due time is in the past, send ASAP (next run)
  IF due_at < NOW() THEN
    due_at := NOW();
  END IF;

  -- Upsert: remove any open reminder for this slot and insert a fresh one
  DELETE FROM public.scheduled_reminders
  WHERE slot_id = p_slot.id AND processed_at IS NULL;

  INSERT INTO public.scheduled_reminders (
    slot_id, due_at, client_name, client_phone, service_name, slot_date, slot_time
  ) VALUES (
    p_slot.id, due_at, COALESCE(NULLIF(p_slot.client_name, ''), 'לקוח'), trim(p_slot.client_phone), p_slot.service_name, p_slot.slot_date, p_slot.slot_time
  );
END;
$$;

-- 4) Cancel reminder if slot becomes available again or client removed
CREATE OR REPLACE FUNCTION public.cancel_appointment_reminder(p_slot public.appointments)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.scheduled_reminders
  WHERE slot_id = p_slot.id AND processed_at IS NULL;
END;
$$;

-- 4b) Enqueue admin reminder (30 minutes before appointment)
CREATE OR REPLACE FUNCTION public.enqueue_admin_appointment_reminder(p_slot public.appointments)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appt_at timestamptz;
  due_at timestamptz;
BEGIN
  IF p_slot.is_available IS DISTINCT FROM FALSE OR p_slot.client_phone IS NULL OR trim(p_slot.client_phone) = '' THEN
    RETURN;
  END IF;

  appt_at := public.make_appointment_timestamptz(p_slot.slot_date, p_slot.slot_time);
  due_at := appt_at - INTERVAL '30 minutes';
  IF due_at < NOW() THEN
    due_at := NOW();
  END IF;

  DELETE FROM public.scheduled_admin_reminders
  WHERE slot_id = p_slot.id AND processed_at IS NULL;

  INSERT INTO public.scheduled_admin_reminders (
    slot_id, due_at, client_name, client_phone, service_name, slot_date, slot_time
  ) VALUES (
    p_slot.id, due_at, COALESCE(NULLIF(p_slot.client_name, ''), 'לקוח'), trim(p_slot.client_phone), p_slot.service_name, p_slot.slot_date, p_slot.slot_time
  );
END;
$$;

-- 4c) Cancel admin reminder
CREATE OR REPLACE FUNCTION public.cancel_admin_appointment_reminder(p_slot public.appointments)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.scheduled_admin_reminders
  WHERE slot_id = p_slot.id AND processed_at IS NULL;
END;
$$;

-- 5) Trigger function to react on insert/update of appointments
CREATE OR REPLACE FUNCTION public.appointments_reminder_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_available = FALSE THEN
      PERFORM public.enqueue_appointment_reminder(NEW);
      PERFORM public.enqueue_admin_appointment_reminder(NEW);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If it became booked, or relevant fields changed while booked → re-enqueue
    IF (COALESCE(OLD.is_available, TRUE) = TRUE AND NEW.is_available = FALSE)
       OR (NEW.is_available = FALSE AND (OLD.slot_date IS DISTINCT FROM NEW.slot_date
                                        OR OLD.slot_time IS DISTINCT FROM NEW.slot_time
                                        OR OLD.client_phone IS DISTINCT FROM NEW.client_phone
                                        OR OLD.client_name IS DISTINCT FROM NEW.client_name)) THEN
      PERFORM public.enqueue_appointment_reminder(NEW);
      PERFORM public.enqueue_admin_appointment_reminder(NEW);
    END IF;

    -- If it became available again or lost client → cancel
    IF (COALESCE(OLD.is_available, FALSE) = FALSE AND NEW.is_available = TRUE)
       OR (NEW.is_available = FALSE AND (NEW.client_phone IS NULL OR trim(NEW.client_phone) = '')) THEN
      PERFORM public.cancel_appointment_reminder(NEW);
      PERFORM public.cancel_admin_appointment_reminder(NEW);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_reminders ON public.appointments;
CREATE TRIGGER trg_appointments_reminders
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.appointments_reminder_trigger();

-- 6) Processor: insert notifications for due reminders
CREATE OR REPLACE FUNCTION public.process_due_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Insert notifications for due and unprocessed reminders
  WITH due AS (
    SELECT r.*
    FROM public.scheduled_reminders r
    WHERE r.processed_at IS NULL AND r.due_at <= NOW()
    ORDER BY r.due_at ASC
    FOR UPDATE SKIP LOCKED
  ), ins AS (
    INSERT INTO public.notifications (title, content, type, recipient_name, recipient_phone)
    SELECT
      'תזכורת',
      format('היי %s, זה תזכורת לתור שלך ל%s בתאריך %s בשעה %s. נתראה! 👋',
             COALESCE(NULLIF(d.client_name, ''), 'לקוח'),
             COALESCE(NULLIF(d.service_name, ''), 'הטיפול'),
             to_char(d.slot_date, 'DD/MM/YYYY'),
             to_char(d.slot_time, 'HH24:MI')
      )::text,
      'appointment_reminder',
      COALESCE(NULLIF(d.client_name, ''), 'לקוח'),
      d.client_phone
    FROM due d
    RETURNING id
  )
  UPDATE public.scheduled_reminders r
  SET processed_at = NOW()
  WHERE r.id IN (SELECT id FROM due);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 7) Schedule the processor to run every 5 minutes (legacy scheduled_reminders processor)
-- The job name is stable; re-running this script will update or create once
DO $$
DECLARE
  v_job_id INT;
BEGIN
  -- Try to unschedule existing job with same name to apply new definition
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'appointment_reminders_processor';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  -- Schedule fresh job
  PERFORM cron.schedule(
    'appointment_reminders_processor',
    '*/5 * * * *',
    $cron$SELECT public.process_due_reminders();$cron$
  );
END $$;

-- 8) Processor for admin reminders: create notifications to all admins 30 minutes before
CREATE OR REPLACE FUNCTION public.process_due_admin_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH due AS (
    SELECT r.*
    FROM public.scheduled_admin_reminders r
    WHERE r.processed_at IS NULL AND r.due_at <= NOW()
    ORDER BY r.due_at ASC
    FOR UPDATE SKIP LOCKED
  ), ins AS (
    INSERT INTO public.notifications (title, content, type, recipient_name, recipient_phone)
    SELECT
      'תור בעוד 30 דקות',
      format('תזכורת מנהל: %s (%s) מוזמן/ת ל%s היום בשעה %s',
             COALESCE(NULLIF(d.client_name, ''), 'לקוח'),
             d.client_phone,
             COALESCE(NULLIF(d.service_name, ''), 'הטיפול'),
             to_char(d.slot_time, 'HH24:MI')
      )::text,
      'system',
      COALESCE(NULLIF(u.name, ''), 'מנהל'),
      TRIM(u.phone)
    FROM due d
    JOIN public.users u
      ON u.user_type = 'admin'
     AND u.phone IS NOT NULL AND TRIM(u.phone) <> ''
    RETURNING id
  )
  UPDATE public.scheduled_admin_reminders r
  SET processed_at = NOW()
  WHERE r.id IN (SELECT id FROM due);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 9) Schedule the admin processor every 5 minutes
DO $$
DECLARE
  v_job_id INT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'appointment_admin_reminders_processor';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'appointment_admin_reminders_processor',
    '*/5 * * * *',
    $cron$SELECT public.process_due_admin_reminders();$cron$
  );
END $$;

-- Notes:
-- - If your timezone is different, change the default in make_appointment_timestamptz()
-- - This uses SECURITY DEFINER functions so RLS on notifications won't block inserts
-- - You can test manually by calling: SELECT public.process_due_reminders();



-- =========================
-- New approach: no extra tables. Create notifications just-in-time from appointments
-- =========================

-- Cleanup legacy objects from the scheduled_* approach
DO $$
BEGIN
  -- Unschedule legacy jobs
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'appointment_reminders_processor';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'appointment_admin_reminders_processor';
  -- Drop trigger and helper functions
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_appointments_reminders' AND tgrelid = 'public.appointments'::regclass) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_appointments_reminders ON public.appointments';
  END IF;
  PERFORM 1;
END $$;

DROP FUNCTION IF EXISTS public.appointments_reminder_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_appointment_reminder(public.appointments) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_appointment_reminder(public.appointments) CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_admin_appointment_reminder(public.appointments) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_admin_appointment_reminder(public.appointments) CASCADE;
DROP FUNCTION IF EXISTS public.process_due_reminders() CASCADE;
DROP FUNCTION IF EXISTS public.process_due_admin_reminders() CASCADE;

-- Drop legacy scheduled tables if they exist
DROP TABLE IF EXISTS public.scheduled_reminders;
DROP TABLE IF EXISTS public.scheduled_admin_reminders;

-- Minimal schema addition on notifications to avoid duplicates
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS appointment_id UUID;
CREATE INDEX IF NOT EXISTS idx_notifications_appointment_id ON public.notifications(appointment_id);
-- Prevent duplicate notifications per appointment/type/recipient
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_notifications_appt_type_recipient'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_notifications_appt_type_recipient
             ON public.notifications(appointment_id, type, recipient_phone)
             WHERE appointment_id IS NOT NULL';
  END IF;
END $$;

-- Processor: client reminders 24h לפני התור (ללא טבלת תורים מתוזמנים)
CREATE OR REPLACE FUNCTION public.process_due_client_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH appts AS (
    SELECT a.id, a.client_name, a.client_phone, a.service_name, a.slot_date, a.slot_time
    FROM public.appointments a
    WHERE a.is_available = FALSE
      AND a.client_phone IS NOT NULL AND TRIM(a.client_phone) <> ''
      -- Send at or after the 24h threshold, but only while the appointment is still in the future (catch-up safe)
      AND public.make_appointment_timestamptz(a.slot_date, a.slot_time) - INTERVAL '24 hours' <= NOW()
      AND public.make_appointment_timestamptz(a.slot_date, a.slot_time) > NOW()
  )
  INSERT INTO public.notifications (title, content, type, recipient_name, recipient_phone, appointment_id)
  SELECT
    'תזכורת',
    format('היי %s, זה תזכורת לתור שלך ל%s בתאריך %s בשעה %s. נתראה! 👋',
           COALESCE(NULLIF(a.client_name, ''), 'לקוח'),
           COALESCE(NULLIF(a.service_name, ''), 'הטיפול'),
           to_char(a.slot_date, 'DD/MM/YYYY'),
           to_char(a.slot_time, 'HH24:MI')
    )::text,
    'appointment_reminder',
    COALESCE(NULLIF(a.client_name, ''), 'לקוח'),
    TRIM(a.client_phone),
    a.id
  FROM appts a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.appointment_id = a.id AND n.type = 'appointment_reminder' AND n.recipient_phone = TRIM(a.client_phone)
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Processor: admin reminders 30 דקות לפני התור
CREATE OR REPLACE FUNCTION public.process_due_admin_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH appts AS (
    SELECT a.id, a.client_name, a.client_phone, a.service_name, a.slot_date, a.slot_time
    FROM public.appointments a
    WHERE a.is_available = FALSE
      -- Send at or after the 30m threshold, but only while the appointment is still in the future (catch-up safe)
      AND public.make_appointment_timestamptz(a.slot_date, a.slot_time) - INTERVAL '30 minutes' <= NOW()
      AND public.make_appointment_timestamptz(a.slot_date, a.slot_time) > NOW()
  ), admins AS (
    SELECT name, TRIM(phone) AS phone
    FROM public.users
    WHERE user_type = 'admin' AND phone IS NOT NULL AND TRIM(phone) <> ''
  )
  INSERT INTO public.notifications (title, content, type, recipient_name, recipient_phone, appointment_id)
  SELECT
    'תור בעוד 30 דקות',
    format('תזכורת מנהל: %s (%s) מוזמן/ת ל%s היום בשעה %s',
           COALESCE(NULLIF(a.client_name, ''), 'לקוח'),
           COALESCE(TRIM(a.client_phone), ''),
           COALESCE(NULLIF(a.service_name, ''), 'הטיפול'),
           to_char(a.slot_time, 'HH24:MI')
    )::text,
    'system',
    COALESCE(NULLIF(ad.name, ''), 'מנהל'),
    ad.phone,
    a.id
  FROM appts a
  CROSS JOIN admins ad
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.appointment_id = a.id AND n.type = 'system' AND n.recipient_phone = ad.phone
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule the new processors every 5 minutes
DO $$
DECLARE
  v_job_id INT;
BEGIN
  -- Client reminders 24h
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'client_reminders_processor_24h';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
  PERFORM cron.schedule(
    'client_reminders_processor_24h',
    '*/5 * * * *',
    $cron$SELECT public.process_due_client_reminders();$cron$
  );

  -- Admin reminders 30m
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'admin_reminders_processor_30m';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
  PERFORM cron.schedule(
    'admin_reminders_processor_30m',
    '*/5 * * * *',
    $cron$SELECT public.process_due_admin_reminders();$cron$
  );
END $$;
