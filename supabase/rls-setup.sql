-- Log!t Row Level Security Setup
-- Run this in Supabase SQL Editor to secure your data

-- Enable RLS on all tables
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Movies: users can only read/write their own movies
CREATE POLICY "Users can view own movies"
  ON movies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movies"
  ON movies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movies"
  ON movies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own movies"
  ON movies FOR DELETE
  USING (auth.uid() = user_id);

-- Settings: users can only read/write their own settings
CREATE POLICY "Users can view own settings"
  ON settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users: users can read all profiles (for username lookup) but only update their own
CREATE POLICY "Users can view profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);
