# Setup Guide

## Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A Supabase account (for cloud storage)
- A Google account (for Drive backup, optional)

## Quick Start

1. Visit [suz41.github.io/logit](https://suz41.github.io/logit)
2. Create an account or sign in
3. Set your TMDB API key in Settings
4. Start logging movies

## Services Used

| Service | Purpose | Required? |
|---------|---------|-----------|
| Supabase | Cloud database & auth | Yes |
| Google Drive | Auto-backup & restore | Optional |
| TMDB | Movie search & metadata | Yes |
| GitHub Pages | Hosting | No (auto) |

## TMDB API Key (Required)

1. Go to [themoviedb.org](https://www.themoviedb.org/)
2. Create a free account
3. Go to **Settings → API**
4. Request an API key (choose "Personal" use)
5. Copy your API key
6. In Log!t, click **Settings** and paste your key

## Google Drive Backup (Optional)

1. Go to Google Cloud Console
2. Enable Google Drive API
3. Create OAuth 2.0 credentials
4. Add `https://suz41.github.io` as authorized origin
5. The Client ID is pre-configured in the app

## Note for Indian Users

TMDB API is blocked in India. You need a VPN to search and add movies. Once added, movies work without VPN.

## Project Structure

```
logit/
├── index.html          # Library (home)
├── profile.html        # User profile & settings
├── PS.html             # Stats dashboard
├── about.html          # About page
├── welcome.html        # Auth page
├── reset.html          # Password reset
├── migrations.sql      # Database setup SQL
├── css/                # Stylesheets (10 files)
├── js/                 # JavaScript modules (21 files)
└── docs/               # Documentation
```

## Development

No build tools required. Edit files directly and refresh the browser.

### Tips

- Use Chrome DevTools for debugging
- Check Supabase dashboard for data
- Test on mobile using device emulation
