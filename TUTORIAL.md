# Log!t — Detailed Setup & Usage Tutorial

Welcome to the comprehensive tutorial for **Log!t Staging (v2.0.0)**. This guide covers local deployment, custom Supabase cloud database hosting, database schemas, Row Level Security (RLS) policies, and user instructions.

---

## Part 1: Quick Play (Default Staging Server)

Log!t is pre-configured to work out-of-the-box using a default staging database. 

### 1. Launching the App
To run the app locally, serve the repository folder using a static file server:
* **Python**: `python3 -m http.server 8000`
* **Node (http-server)**: `npx -y http-server`
* Open `http://localhost:8000` in your web browser.

### 2. User Authentication Walkthrough
1. **Onboarding**: On your first visit, you will be redirected to `welcome.html`.
2. **Offline Mode**: If you do not want cloud sync, click **Continue Offline**. All movies you add will be stored in your browser's local storage (`localStorage.movies`).
3. **Sign Up**: 
   * Click **Create Account**.
   * Enter a **Username**, **Email**, and **Password** (min. 6 characters).
   * **Uniqueness Validation**: The app checks if the username is already taken. If so, you will see `Username already taken`.
   * **Duplicate Email Detection**: If you attempt to sign up with an already registered email, the app handles the Supabase auth error and alerts you: `Email already registered`.
4. **Sign In**: Switch back to **Sign In** and enter your credentials. Once verified, your local library is synced to the cloud.

---

## Part 2: Self-Hosting Guide (Custom Backend)

Follow this guide if you want to deploy Log!t on your own private Supabase instance.

### Step 1: Create a Supabase Project
1. Visit [supabase.com](https://supabase.com) and sign in.
2. Click **New Project** and select your organization.
3. Configure your project name, password, and region.
4. Wait 2-3 minutes for the database instance to initialize.

### Step 2: Initialize Database Schema & RLS Policies
Navigate to the **SQL Editor** in your Supabase dashboard, paste the following SQL script, and click **Run**:

```sql
-- ==========================================
-- 1. Create Tables
-- ==========================================

-- User Profiles
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movies Library
CREATE TABLE public.movies (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tmdb_id TEXT,
  imdb_id TEXT,
  t TEXT NOT NULL,          -- title
  yr TEXT,                  -- year
  rt INTEGER,               -- runtime
  g TEXT,                   -- genres
  dr TEXT,                  -- director
  c TEXT,                   -- cast
  lg TEXT,                  -- language
  ct TEXT,                  -- country
  r NUMERIC(3, 1),          -- rating
  w TEXT,                   -- watch type / rewatch status
  d DATE,                   -- watch date
  sp TEXT,                  -- poster path
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync Settings
CREATE TABLE public.settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  auto_sync BOOLEAN DEFAULT TRUE,
  sync_wifi_only BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Sync Queue (for local diagnostics)
CREATE TABLE public.sync_queue (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  error TEXT
);

-- ==========================================
-- 2. Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. Define RLS Policies
-- ==========================================

-- Profile policies
CREATE POLICY "Allow users to read own profiles" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow users to insert own profiles" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Allow users to update own profiles" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Movie policies
CREATE POLICY "Allow users to read own movies" ON public.movies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to insert own movies" ON public.movies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow users to update own movies" ON public.movies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow users to delete own movies" ON public.movies FOR DELETE USING (auth.uid() = user_id);

-- Settings policies
CREATE POLICY "Allow users to read own settings" ON public.settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to insert own settings" ON public.settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow users to update own settings" ON public.settings FOR UPDATE USING (auth.uid() = user_id);

-- Sync queue policies
CREATE POLICY "Allow users to manage own sync queue" ON public.sync_queue FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 4. Create Performance Indexes
-- ==========================================
CREATE INDEX idx_movies_user_id ON public.movies(user_id);
CREATE INDEX idx_movies_updated_at ON public.movies(updated_at);
CREATE INDEX idx_sync_queue_user_id ON public.sync_queue(user_id);
```

### Step 3: Configure Auth Email Templates
1. Go to **Authentication** → **Email Templates**.
2. Under **Confirm signup**, change the redirect link to match your local or production domain:
   * Example URL: `http://localhost:8000/index.html` or `https://yourdomain.github.io/logit/index.html`

### Step 4: Configure App Connection
1. In your Supabase Dashboard, navigate to **Project Settings** → **API**.
2. Copy the **Project URL** and the public **anon** key.
3. Open `http://localhost:8000/config.html` in your browser.
4. Paste the URL and Anon Key and click **Configure Supabase**. The configuration will save directly to your browser's local storage and take precedence over the hardcoded staging credentials.

---

## Part 3: Deep-Dive into Sync Engine Architecture

Log!t uses an offline-first synchronization strategy. Here is how it operates:

### 1. Offline Writes
If you are offline, movies you add, edit, or delete are immediately saved to `localStorage.movies`. The operation is placed in a local sync queue in `localStorage.logit_sync_queue` with one of the actions:
* `create`
* `update`
* `delete`

### 2. Auto-Sync Loop
Every **5 minutes** (or when manually triggered via the Profile page), the sync engine checks for network connectivity. If online:
1. **Uploads Local Changes**: Processes all pending changes in the queue sequentially.
2. **Downloads Remote Changes**: Fetches remote database modifications since the last successful sync timestamp (`logit_last_sync`).
3. **Updates State**: Merges data and saves the updated library locally.

### 3. Conflict Resolution Strategy
If a movie was edited on multiple devices:
* **Last Write Wins**: The version with the most recent `updated_at` timestamp takes priority.
* **User Preferences Preserved**: The merge prioritizes local user actions. Critical fields like rating (`r`), watch type (`w`), and watch date (`d`) are preserved from local inputs, while global metadata (e.g., title `t`, year `yr`, director `dr`) is merged from the remote database.
