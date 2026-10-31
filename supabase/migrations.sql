-- ============================================================
-- Log!t Database Migrations & Constraints
-- Run these in your Supabase SQL Editor (https://supabase.com/dashboard)
-- Idempotent: Can be safely executed repeatedly on fresh or existing databases.
-- ============================================================

-- ============================================================
-- Item 21: Performance Indexes
-- Speeds up the most common query patterns.
-- ============================================================

-- Movies: lookup by user (every query filters on this)
CREATE INDEX IF NOT EXISTS idx_movies_user_id ON movies (user_id);

-- Movies: incremental sync (filters by updated_at)
CREATE INDEX IF NOT EXISTS idx_movies_user_updated ON movies (user_id, updated_at);

-- Movies: conflict detection (checks id + user_id)
CREATE INDEX IF NOT EXISTS idx_movies_id_user ON movies (id, user_id);

-- Settings: one row per user (upsert target)
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_user_id ON settings (user_id);

-- Users: username uniqueness check
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ============================================================
-- Item 22: Database Constraints (Valid Idempotent PostgreSQL)
-- Prevents malformed or duplicate data at the database level.
-- ============================================================

-- Movies: required columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movies' AND column_name = 'id' AND is_nullable = 'YES') THEN
    ALTER TABLE movies ALTER COLUMN id SET NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movies' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
    ALTER TABLE movies ALTER COLUMN user_id SET NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movies' AND column_name = 't' AND is_nullable = 'YES') THEN
    ALTER TABLE movies ALTER COLUMN t SET NOT NULL;
  END IF;
END $$;

-- Movies: check constraints (rating range, runtime positive, year range)
DO $$
BEGIN
  -- Rating check
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rating_range') THEN
    ALTER TABLE movies
      ADD CONSTRAINT chk_rating_range
      CHECK (r IS NULL OR (r ~ '^[0-9]+(\.[0-9]+)?$' AND CAST(r AS numeric) >= 0.5 AND CAST(r AS numeric) <= 5.0));
  END IF;

  -- Runtime check
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_runtime_positive') THEN
    ALTER TABLE movies
      ADD CONSTRAINT chk_runtime_positive
      CHECK (rt IS NULL OR rt >= 0);
  END IF;

  -- Year check
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_year_range') THEN
    ALTER TABLE movies
      ADD CONSTRAINT chk_year_range
      CHECK (yr IS NULL OR (yr ~ '^[0-9]{4}$' AND CAST(yr AS integer) >= 1880 AND CAST(yr AS integer) <= 2100));
  END IF;
END $$;

-- Prevent duplicate movies for the same user by tmdb_id (unless rewatch)
CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_user_tmdb_unique
  ON movies (user_id, tmdb_id)
  WHERE tmdb_id IS NOT NULL AND tmdb_id != '' AND (w IS NULL OR w NOT LIKE 'Rewatch%');

-- Settings: user_id is required
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
    ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================
-- Item 23: Pending Movies (Log!t Companion)
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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
