-- Log!t Database Migrations
-- Run these in your Supabase SQL Editor (https://supabase.com/dashboard)
-- These add indexes and constraints to prevent bad data at the database level.

-- ============================================================
-- Item 21: Performance Indexes
-- Speeds up the most common query patterns.
-- ============================================================

-- Movies: lookup by user (every query filters on this)
CREATE INDEX IF NOT EXISTS idx_movies_user_id ON movies (user_id);

-- Movies: incremental sync (downloadRemoteChanges filters by updated_at)
CREATE INDEX IF NOT EXISTS idx_movies_user_updated ON movies (user_id, updated_at);

-- Movies: conflict detection (syncItem checks id + user_id)
CREATE INDEX IF NOT EXISTS idx_movies_id_user ON movies (id, user_id);

-- Settings: one row per user (upsert target)
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_user_id ON settings (user_id);

-- Users: username uniqueness check
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ============================================================
-- Item 22: Database Constraints
-- Prevents malformed/duplicate data even if JS validation is bypassed.
-- ============================================================

-- Movies: required fields
ALTER TABLE movies
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN t SET NOT NULL;

-- Movies: rating must be between 0.5 and 5 (stored as text, soCHECK via pg)
ALTER TABLE movies
  ADD CONSTRAINT IF NOT EXISTS chk_rating_range
  CHECK (r IS NULL OR (CAST(r AS numeric) >= 0.5 AND CAST(r AS numeric) <= 5));

-- Movies: runtime must be non-negative
ALTER TABLE movies
  ADD CONSTRAINT IF NOT EXISTS chk_runtime_positive
  CHECK (rt IS NULL OR rt >= 0);

-- Movies: year must be reasonable
ALTER TABLE movies
  ADD CONSTRAINT IF NOT EXISTS chk_year_range
  CHECK (yr IS NULL OR (CAST(yr AS integer) >= 1880 AND CAST(yr AS integer) <= 2100));

-- Prevent duplicate movies for the same user by tmdb_id (unless rewatch)
-- This is a partial unique index — only enforces uniqueness for non-rewatch entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_user_tmdb_unique
  ON movies (user_id, tmdb_id)
  WHERE tmdb_id IS NOT NULL AND tmdb_id != '' AND (w IS NULL OR w NOT LIKE 'Rewatch%');

-- Settings: user_id is required
ALTER TABLE settings
  ALTER COLUMN user_id SET NOT NULL;
