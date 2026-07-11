# Log!t Cloud Sync & Authentication - Implementation Guide

## Overview

This guide covers the authentication and cloud sync system added to Log!t. The system is **optional** and **offline-first**, meaning users can continue using Log!t without creating an account or enabling cloud features.

**Key Features:**
- Optional authentication (Google, GitHub, Email)
- Offline-first sync engine
- Automatic conflict resolution
- Cloud backup and multi-device sync
- Import/export JSON functionality
- Complete local control

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────┐
│                Log!t Application                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────┐   ┌──────────────────┐   │
│  │   Local Storage      │   │  Auth Manager    │   │
│  │  (localStorage)      │   │  (Supabase)      │   │
│  │                      │   │                  │   │
│  │ - Movies            │   │ - Sessions       │   │
│  │ - Settings          │   │ - OAuth Providers│   │
│  └──────────────────────┘   └──────────────────┘   │
│                                                      │
│  ┌──────────────────────┐   ┌──────────────────┐   │
│  │   Offline Queue      │   │ Sync Engine      │   │
│  │  (localStorage)      │   │  (Offline-First) │   │
│  │                      │   │                  │   │
│  │ - Pending changes    │   │ - Upload pending │   │
│  │ - Failed items       │   │ - Download new   │   │
│  │ - Sync history       │   │ - Resolve confl. │   │
│  └──────────────────────┘   └──────────────────┘   │
│           ↓                         ↓                │
│    ┌──────────────────────────────────────┐         │
│    │    Supabase Cloud Backend            │         │
│    ├──────────────────────────────────────┤         │
│    │ Auth | Database | Storage | Realtime │         │
│    └──────────────────────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

### Module Structure

- **`supabase.js`** - Supabase client initialization
- **`auth.js`** - Authentication flows (login, signup, logout)
- **`sync.js`** - Sync engine with conflict resolution
- **`offline.js`** - Offline queue management
- **`profile.js`** - Profile page functionality

---

## Setup Instructions

> [!NOTE]
> The app is pre-configured with a default shared staging database out-of-the-box (in `js/supabase.js`). Normal users do not need to perform any configuration. The following setup instructions are **only** required if you want to deploy and use your own private Supabase instance (self-hosting).

### Step 1: Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: log!t
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to users
4. Click "Create new project"
5. Wait for database initialization (2-3 minutes)

### Step 2: Get Credentials

In your Supabase project:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (https://xxxx.supabase.co)
   - **Anon public key** (starts with `eyJh...`)

⚠️ **Important**: Only use the **public (anon) key**, never the service role key

### Step 3: Configure Log!t

> [!NOTE]
> If you are using the default staging database, **skip this step**. This step is only for overriding the default credentials with your own custom Supabase project credentials.

**Option A: Via UI**
1. Open Log!t
2. Go to `/config.html`
3. Paste Project URL and Anon Key
4. Click "Configure Supabase"

**Option B: Manually**
```javascript
// In browser console
localStorage.setItem('supabase_url', 'https://xxxx.supabase.co');
localStorage.setItem('supabase_anon_key', 'your_anon_key_here');
```

### Step 4: Create Database Schema

In your Supabase project, go to **SQL Editor** and run this script:

```sql
-- Create users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create movies table
CREATE TABLE public.movies (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  year INTEGER,
  rating INTEGER,
  watched_date DATE,
  runtime INTEGER,
  director TEXT,
  language TEXT,
  country TEXT,
  notes TEXT,
  favorite BOOLEAN DEFAULT FALSE,
  rewatch BOOLEAN DEFAULT FALSE,
  poster_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create settings table
CREATE TABLE public.settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  auto_sync BOOLEAN DEFAULT TRUE,
  sync_wifi_only BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sync queue table (optional, for debugging)
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

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Create RLS policies for movies
CREATE POLICY "Users can view own movies"
  ON public.movies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movies"
  ON public.movies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movies"
  ON public.movies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own movies"
  ON public.movies FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for settings
CREATE POLICY "Users can view own settings"
  ON public.settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for sync queue
CREATE POLICY "Users can view own sync queue"
  ON public.sync_queue FOR SELECT
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_movies_user_id ON public.movies(user_id);
CREATE INDEX idx_movies_updated_at ON public.movies(updated_at);
CREATE INDEX idx_sync_queue_user_id ON public.sync_queue(user_id);
```

### Step 5: Enable Authentication Providers

In **Authentication** → **Providers**:

1. **Email** - Already enabled by default
2. **Google OAuth**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project
   - Enable Google+ API
   - Create OAuth 2.0 credentials (Web application)
   - Add authorized redirect URI: `https://xxxx.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase

3. **GitHub OAuth**:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Create new OAuth app
   - Set Authorization callback URL: `https://xxxx.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase

### Step 6: Configure Storage (Optional)

For custom posters and images:

1. In **Storage**, create bucket: `avatars`
2. Set visibility to **Private**
3. Create RLS policy to allow users to access their files

---

## User Flows

### First-Time User

```
Welcome Screen
    ↓
    ├─→ Continue Offline
    │   └─→ Library (offline mode)
    │
    ├─→ Sign in with Google/GitHub/Email
    │   └─→ Create account
    │   └─→ Redirect to Library
    │   └─→ Auto-upload existing movies
    │
    └─→ (Back button)
        └─→ Config screen
```

### Existing Offline User → Cloud Migration

```
Library (offline mode)
    ↓
Settings → Enable Cloud Sync
    ↓
Sign in with Google/GitHub/Email
    ↓
Auto-upload all local movies
    ↓
Start syncing across devices
```

### Online Sync Flow

```
Every 5 minutes (or manual trigger):
    ↓
Get pending changes from queue
    ↓
Upload to server (create/update/delete)
    ↓
Download remote changes (since last sync)
    ↓
Merge with local (conflict resolution)
    ↓
Clear synced queue items
```

### Offline Behavior

```
User makes changes
    ↓
Save to localStorage immediately
    ↓
Add to sync queue
    ↓
Show "pending" status
    ↓
When online:
    Sync automatically
    ↓
    Show "synced" status
```

---

## API Reference

### Logit.Auth

```javascript
// Check if authenticated
Logit.Auth.isAuthenticated()  // Returns boolean

// Check if offline mode
Logit.Auth.isOfflineMode()    // Returns boolean

// Get current user
Logit.Auth.getCurrentUser()   // Returns user object or null

// Sign out
await Logit.Auth.signOut()

// Manual sign in
await Logit.Auth.signInWithOAuth('google')
await Logit.Auth.signInWithOAuth('github')
await Logit.Auth.signInWithEmail(email, password)
await Logit.Auth.signUpWithEmail(email, password)
await Logit.Auth.sendMagicLink(email)
```

### Logit.Sync

```javascript
// Trigger manual sync
await Logit.Sync.sync()  // Returns { success, count, message }

// Get sync status
Logit.Sync.getSyncStatus()  // Returns 'offline', 'syncing', or 'synced'

// Get last sync time
Logit.Sync.getLastSyncTime()  // Returns Date or null

// Listen for status changes
Logit.Sync.onSyncStatusChange((status) => {
  console.log('Sync status:', status)
})

// Upload existing movies (on first login)
await Logit.Sync.uploadExistingMovies()  // Returns { success, count }
```

### Logit.Offline

```javascript
// Get pending changes
Logit.Offline.getPending()  // Returns array of queue items

// Get failed items
Logit.Offline.getFailed()   // Returns array with errors

// Get queue stats
Logit.Offline.getStats()    // Returns { total, pending, failed, synced }

// Clear synced items
Logit.Offline.clearSynced()

// Clear all queue
Logit.Offline.clearAll()
```

### Logit.Storage

```javascript
// Save and sync a movie
Logit.Storage.saveMovie(movie, 'create')  // or 'update'

// Delete and sync a movie
Logit.Storage.deleteMovie(movieId)

// Get storage size
Logit.Storage.getStorageSize()  // Returns { total, keys }

// Format bytes
Logit.Storage.formatBytes(1048576)  // "1.0 MB"
```

---

## Conflict Resolution

When the same movie is edited on two devices:

1. **Last Write Wins**: The most recently updated version takes precedence
2. **User Preferences Preserved**: Rating, notes, favorite, and rewatch status always use the local value (user's device)
3. **Other Fields Merged**: Title, year, runtime, director, language, country from remote (likely more accurate)

Example:
```
Device A updates rating to 8
Device B updates notes to "Great film"

Conflict resolution:
- Uses rating from Device A (local)
- Uses notes from Device B (more recent)
- Final: rating=8, notes="Great film"
```

---

## Debugging

### Enable Sync Logging

```javascript
// View pending changes
Logit.Offline.getFormattedQueue()

// View sync stats
Logit.Offline.getStats()

// View localStorage size
Logit.Storage.getStorageSize()

// Clear all local data (CAUTION!)
localStorage.clear()
```

### Check Network Status

```javascript
// Is online?
navigator.onLine

// Check Supabase connection
await Logit.Supabase.isOnline()

// View sync status
Logit.Sync.getSyncStatus()
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Cloud features not configured" | Run `/config.html` and enter Supabase credentials |
| Sync stuck on "syncing" | Refresh page, check internet connection |
| OAuth redirect loop | Clear browser cache, check Supabase redirect URIs |
| Movies not uploading | Check Row Level Security policies, verify user is authenticated |
| Duplicates on sync | This shouldn't happen; clear cache and resync |

---

## Deployment

### Hosting on GitHub Pages

1. Create repository: `username.github.io`
2. Push code to `main` branch
3. Enable GitHub Pages in repository settings
4. Access at `https://username.github.io/logit`

### Environment Variables (Client-Side)

All configuration is stored in localStorage:
- `supabase_url`
- `supabase_anon_key`
- `logit_offline_mode`
- `logit_auto_sync`
- `logit_sync_wifi_only`
- `logit_last_sync`

### Security Best Practices

1. **Never** commit Supabase service role key
2. **Only use** public anon key in client
3. **Always enable** Row Level Security in Supabase
4. **Regularly rotate** OAuth app secrets
5. **Test** RLS policies thoroughly

---

## Privacy & Data

- **Local Storage**: All movies stored locally on user's device by default
- **Optional Cloud**: Users must explicitly sign in to enable cloud sync
- **Encryption**: Supabase handles encryption in transit (HTTPS) and at rest
- **Deletion**: Users can delete account and all data via profile page
- **Export**: Users can export all data as JSON anytime

---

## Testing Checklist

- [ ] Welcome screen appears on first load
- [ ] Can sign in with Google
- [ ] Can sign in with GitHub
- [ ] Can sign in with email/password
- [ ] Offline mode works without authentication
- [ ] Movies sync to cloud after sign-in
- [ ] Offline changes queue and sync when online
- [ ] Conflict resolution works correctly
- [ ] Profile page shows sync status
- [ ] Manual sync button works
- [ ] Export/import JSON works
- [ ] Auto-sync can be toggled
- [ ] Sign out clears authentication
- [ ] Delete account works

---

## Roadmap / Future Enhancements

- [ ] Real-time sync using Supabase Realtime subscriptions
- [ ] Sharing lists with other users
- [ ] Collections and custom tags
- [ ] Advanced statistics with cloud data
- [ ] Watched indicators for shared accounts
- [ ] Push notifications for sync events
- [ ] Mobile app (React Native)
- [ ] Watchlist collaboration
- [ ] Review sharing

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **GitHub Issues**: https://github.com/suz41/logitv4/issues
- **Discussion Forum**: [GitHub Discussions]
- **Email**: support@logit.app

---

## Version History

- **v3.0.0** - Cloud sync with authentication
- **v2.0.0** - Full PC layout
- **v1.6-beta** - Compact stats, XSS fixes
- **v1.0** - Initial release

---

**Last Updated**: 2026-07-11
