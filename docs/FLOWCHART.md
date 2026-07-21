# App Flow

## User Journey

```
┌─────────────┐
│   Welcome   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Sign In /  │
│  Sign Up    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│           Library (Home)                │
│  ┌───────────────────────────────────┐  │
│  │  Movie Grid (grouped by month)    │  │
│  │  • Red dots = missing metadata    │  │
│  │  • Red border = incomplete movie  │  │
│  └───────────────────────────────────┘  │
└──────┬──────────┬───────────┬───────────┘
       │          │           │
       ▼          ▼           ▼
┌──────────┐ ┌─────────┐ ┌─────────┐
│  Search  │ │  Stats  │ │ Profile │
│  & Add   │ │  Page   │ │  Page   │
│  Movie   │ │         │ │         │
└──────────┘ └─────────┘ └─────────┘
```

## Add Movie Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Click +  │────▶│  Search  │────▶│  Select  │
│          │     │  TMDB    │     │  Movie   │
└──────────┘     └──────────┘     └────┬─────┘
                                       │
                                       ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Saved!  │◀────│  Confirm │◀────│  Rate &  │
│  (Cloud) │     │          │     │  Date    │
└──────────┘     └──────────┘     └──────────┘
       │
       ▼ (after 5s)
┌──────────┐
│  Auto    │
│  Backup  │
│  to Drive│
└──────────┘
```

## Data Storage

```
┌─────────────────────────────────────────────────────────┐
│                      Supabase Cloud                     │
├─────────────────────────────────────────────────────────┤
│  movies   - All movie data (title, rating, poster, etc) │
│  settings - Avatar, favorites, preferences              │
│  users    - Auth & profile                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Google Drive                          │
├─────────────────────────────────────────────────────────┤
│  Logit/                                                 │
│    └── logit-movies-backup.json (auto-updated)          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              localStorage (preferences only)            │
├─────────────────────────────────────────────────────────┤
│  tmdb_key            - TMDB API key                     │
│  logit_user_id       - Auth user ID                     │
│  logit_drive_token   - Google Drive auth token           │
│  logit_grid_count    - Grid columns                     │
│  logit_show_dates    - Date toggle                      │
└─────────────────────────────────────────────────────────┘
```

## Sync & Backup Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Movie   │────▶│ Supabase │────▶│  Cloud   │
│  Change  │     │  Save    │     │  Saved   │
└──────────┘     └──────────┘     └──────────┘
       │
       ▼ (5s delay)
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Auto    │────▶│  Google  │────▶│  Drive   │
│  Backup  │     │  Drive   │     │  Updated │
└──────────┘     └──────────┘     └──────────┘
```

## Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Enter   │────▶│ Supabase │────▶│  Auth    │
│  Email + │     │  Auth    │     │  Success │
│  Pass    │     │          │     │          │
└──────────┘     └──────────┘     └────┬─────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │  User ID     │
                               │  stored in   │
                               │  localStorage│
                               └──────────────┘
```

## Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend                            │
├─────────────────────────────────────────────────────────┤
│  HTML5    - Structure (5 pages)                         │
│  CSS3     - Styling (dark theme, responsive)            │
│  JS       - Vanilla, no frameworks (~20 files)          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     Backend Services                    │
├─────────────────────────────────────────────────────────┤
│  Supabase  - Database, auth, RLS policies               │
│  Google    - Drive API (backup/restore)                 │
│  TMDB      - Movie search & metadata                   │
│  GitHub    - Pages hosting                              │
└─────────────────────────────────────────────────────────┘
```
