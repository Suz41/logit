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
┌─────────────────────────────────┐
│           Library (Home)        │
│  ┌───────────────────────────┐  │
│  │  Movie Grid / List View   │  │
│  └───────────────────────────┘  │
└──────┬──────────┬───────────┬───┘
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
```

## Data Storage

```
┌─────────────────────────────────────────┐
│              Supabase Cloud            │
├─────────────────────────────────────────┤
│  movies      - All movie data          │
│  settings    - Avatar, favorites, etc  │
│  users       - Auth & profile          │
└─────────────────────────────────────────┘

localStorage (preferences only):
┌─────────────────────────────────────────┐
│  tmdb_key           - TMDB API key     │
│  logit_user_id      - Auth user ID     │
│  logit_grid_count   - Grid columns     │
│  logit_show_dates   - Date toggle      │
└─────────────────────────────────────────┘
```
