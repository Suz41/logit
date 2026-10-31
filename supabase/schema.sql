-- ============================================================
-- Log!t Complete Database Schema & Authoritative Setup
-- Target Database: PostgreSQL / Supabase
-- Idempotent: Can be safely executed on a fresh database or existing database.
-- ============================================================

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. Table: users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ------------------------------------------------------------
-- 2. Table: movies
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  t TEXT NOT NULL,                     -- Title
  yr TEXT,                             -- Release Year
  rt INTEGER,                          -- Runtime in minutes
  g TEXT,                              -- Genres
  dr TEXT,                             -- Director
  c TEXT,                              -- Cast
  lg TEXT,                             -- Original Language
  ct TEXT,                             -- Country
  r TEXT,                              -- User Rating (e.g. "4.5")
  d TEXT,                              -- Watch Date ("YYYY-MM-DD")
  w TEXT,                              -- Watch Status ("1st Watch", "Rewatch")
  sp TEXT,                             -- Selected Poster Path
  sc TEXT,                             -- Poster Dominant Color
  pc TEXT,                             -- Poster Palette
  tmdb_id TEXT,                        -- TMDB ID
  imdb_id TEXT,                        -- IMDb ID
  overview TEXT,                       -- Plot Overview
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Movies Indexes
CREATE INDEX IF NOT EXISTS idx_movies_user_id ON movies (user_id);
CREATE INDEX IF NOT EXISTS idx_movies_user_updated ON movies (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_id_user ON movies (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_user_tmdb_unique
  ON movies (user_id, tmdb_id)
  WHERE tmdb_id IS NOT NULL AND tmdb_id != '' AND (w IS NULL OR w NOT LIKE 'Rewatch%');

-- Movies Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rating_range') THEN
    ALTER TABLE movies
      ADD CONSTRAINT chk_rating_range
      CHECK (r IS NULL OR (r ~ '^[0-9]+(\.[0-9]+)?$' AND CAST(r AS numeric) >= 0.5 AND CAST(r AS numeric) <= 5.0));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_runtime_positive') THEN
    ALTER TABLE movies
      ADD CONSTRAINT chk_runtime_positive
      CHECK (rt IS NULL OR rt >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_year_range') THEN
    ALTER TABLE movies
      ADD CONSTRAINT chk_year_range
      CHECK (yr IS NULL OR (yr ~ '^[0-9]{4}$' AND CAST(yr AS integer) >= 1880 AND CAST(yr AS integer) <= 2100));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Table: settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  favorites JSONB DEFAULT '[]'::jsonb,
  avatar TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_user_id ON settings (user_id);

-- ------------------------------------------------------------
-- 4. Table: pending_movies (Log!t Companion Queue)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  raw_input TEXT,
  movie_title TEXT NOT NULL,
  tmdb_id TEXT,
  rating TEXT,
  watch_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_pending_status CHECK (status IN ('pending', 'matched', 'completed', 'removed'))
);

CREATE INDEX IF NOT EXISTS idx_pending_movies_user_status ON pending_movies (user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_movies_user_created ON pending_movies (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_movies_user_tmdb ON pending_movies (user_id, tmdb_id);

-- ------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ------------------------------------------------------------
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_movies ENABLE ROW LEVEL SECURITY;

-- Movies
DROP POLICY IF EXISTS "Users can view own movies" ON movies;
CREATE POLICY "Users can view own movies" ON movies FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own movies" ON movies;
CREATE POLICY "Users can insert own movies" ON movies FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own movies" ON movies;
CREATE POLICY "Users can update own movies" ON movies FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own movies" ON movies;
CREATE POLICY "Users can delete own movies" ON movies FOR DELETE USING (auth.uid() = user_id);

-- Settings
DROP POLICY IF EXISTS "Users can view own settings" ON settings;
CREATE POLICY "Users can view own settings" ON settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own settings" ON settings;
CREATE POLICY "Users can insert own settings" ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own settings" ON settings;
CREATE POLICY "Users can update own settings" ON settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own settings" ON settings;
CREATE POLICY "Users can delete own settings" ON settings FOR DELETE USING (auth.uid() = user_id);

-- Users (Hardened)
DROP POLICY IF EXISTS "Users can view profiles" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can delete own profile" ON users;
CREATE POLICY "Users can delete own profile" ON users FOR DELETE USING (auth.uid() = id);

-- Pending Movies
DROP POLICY IF EXISTS "Users can view own pending movies" ON pending_movies;
CREATE POLICY "Users can view own pending movies" ON pending_movies FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own pending movies" ON pending_movies;
CREATE POLICY "Users can insert own pending movies" ON pending_movies FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own pending movies" ON pending_movies;
CREATE POLICY "Users can update own pending movies" ON pending_movies FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own pending movies" ON pending_movies;
CREATE POLICY "Users can delete own pending movies" ON pending_movies FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. Helper RPC Functions
-- ------------------------------------------------------------
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
  IF lookup_username IS NULL THEN RETURN NULL; END IF;
  clean_username := lower(trim(lookup_username));
  IF length(clean_username) = 0 OR length(clean_username) > 60 THEN RETURN NULL; END IF;

  SELECT email INTO found_email
  FROM users
  WHERE lower(username) = clean_username AND (deleted_at IS NULL)
  LIMIT 1;

  RETURN found_email;
END;
$$;

CREATE OR REPLACE FUNCTION check_username_available(check_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_username text;
BEGIN
  IF check_username IS NULL THEN RETURN false; END IF;
  clean_username := lower(trim(check_username));
  IF length(clean_username) < 2 OR length(clean_username) > 60 THEN RETURN false; END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM users WHERE lower(username) = clean_username
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_email_for_username(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_username_available(text) TO anon, authenticated, service_role;
