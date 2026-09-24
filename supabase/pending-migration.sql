-- ============================================================
-- Log!t Companion & Pending Movies Migration
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pending_movies_user_status ON pending_movies (user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_movies_user_created ON pending_movies (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_movies_user_tmdb ON pending_movies (user_id, tmdb_id);

-- Enable Row Level Security
ALTER TABLE pending_movies ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies
CREATE POLICY "Users can view own pending movies"
  ON pending_movies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pending movies"
  ON pending_movies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending movies"
  ON pending_movies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending movies"
  ON pending_movies FOR DELETE
  USING (auth.uid() = user_id);
