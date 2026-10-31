-- ============================================================
-- Log!t Row Level Security & Access Control Setup
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- Idempotent: Safe to execute on new or existing installations.
-- ============================================================

-- 1. Enable Row Level Security on all application tables
ALTER TABLE IF EXISTS movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pending_movies ENABLE ROW LEVEL SECURITY;

-- 2. Movies Policies
DROP POLICY IF EXISTS "Users can view own movies" ON movies;
CREATE POLICY "Users can view own movies"
  ON movies FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own movies" ON movies;
CREATE POLICY "Users can insert own movies"
  ON movies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own movies" ON movies;
CREATE POLICY "Users can update own movies"
  ON movies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own movies" ON movies;
CREATE POLICY "Users can delete own movies"
  ON movies FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Settings Policies
DROP POLICY IF EXISTS "Users can view own settings" ON settings;
CREATE POLICY "Users can view own settings"
  ON settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON settings;
CREATE POLICY "Users can insert own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON settings;
CREATE POLICY "Users can update own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own settings" ON settings;
CREATE POLICY "Users can delete own settings"
  ON settings FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Users Profile Policies (Hardened: NEVER expose other users' emails or profile rows)
DROP POLICY IF EXISTS "Users can view profiles" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON users;
CREATE POLICY "Users can delete own profile"
  ON users FOR DELETE
  USING (auth.uid() = id);

-- 5. Pending Movies Policies
DROP POLICY IF EXISTS "Users can view own pending movies" ON pending_movies;
CREATE POLICY "Users can view own pending movies"
  ON pending_movies FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pending movies" ON pending_movies;
CREATE POLICY "Users can insert own pending movies"
  ON pending_movies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pending movies" ON pending_movies;
CREATE POLICY "Users can update own pending movies"
  ON pending_movies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pending movies" ON pending_movies;
CREATE POLICY "Users can delete own pending movies"
  ON pending_movies FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 6. Narrowly Scoped RPC Functions for Secure Authentication
-- These avoid exposing full table SELECT to public/anon.
-- ============================================================

-- Safely resolve email for signin by username without exposing users table
CREATE OR REPLACE FUNCTION get_email_for_username(lookup_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_username text;
  found_email text;
BEGIN
  IF lookup_username IS NULL THEN
    RETURN NULL;
  END IF;

  clean_username := lower(trim(lookup_username));
  IF length(clean_username) = 0 OR length(clean_username) > 60 THEN
    RETURN NULL;
  END IF;

  SELECT email INTO found_email
  FROM users
  WHERE lower(username) = clean_username
    AND (deleted_at IS NULL)
  LIMIT 1;

  RETURN found_email;
END;
$$;

-- Safely check whether a username is available during registration
CREATE OR REPLACE FUNCTION check_username_available(check_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_username text;
BEGIN
  IF check_username IS NULL THEN
    RETURN false;
  END IF;

  clean_username := lower(trim(check_username));
  IF length(clean_username) < 2 OR length(clean_username) > 60 THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM users
    WHERE lower(username) = clean_username
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION get_email_for_username(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_username_available(text) TO anon, authenticated, service_role;
