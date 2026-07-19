# Setup Guide

## Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)

## Quick Start

1. Go to [suz41.github.io/logit](https://suz41.github.io/logit)
2. Start logging movies

**Or use locally:**
1. Download the ZIP from GitHub
2. Extract it
3. Open `index.html` in your browser

No build tools, no installation required.

---

## TMDB API Key (Required for Movie Search)

1. Go to [themoviedb.org](https://www.themoviedb.org/)
2. Create a free account
3. Go to **Settings → API**
4. Request an API key (choose "Personal" use)
5. Copy your API key
6. In Log!t, click **Settings** and paste your key

---

## Cloud Sync

Cloud sync is built-in and pre-configured. Sign up from the welcome page to enable it. Movies sync automatically in the background.

---

## Project Structure

```
logit/
├── index.html          # Main library page
├── profile.html        # User profile
├── PS.html             # Stats page
├── about.html          # About page
├── welcome.html        # Welcome/auth page
├── config.html         # Supabase config page
├── reset.html          # Password reset
├── css/
│   ├── main.css        # Global styles
│   ├── components.css  # Reusable components
│   ├── library.css     # Library grid
│   ├── modal.css       # Modal styles
│   ├── desktop.css     # Desktop overrides
│   ├── animations.css  # Animations
│   ├── auth.css        # Auth pages
│   ├── stats.css       # Stats page
│   ├── profile.css     # Profile page
│   └── about.css       # About page
├── js/
│   ├── app.js          # Main app init
│   ├── config.js       # API keys, Supabase config
│   ├── constants.js    # Language/genre maps
│   ├── storage.js      # localStorage helpers
│   ├── utils.js        # Utility functions
│   ├── movies.js       # Movie CRUD operations
│   ├── search.js       # TMDB search
│   ├── movieFactory.js # Movie object builder
│   ├── modals.js       # Modal logic
│   ├── ui.js           # UI rendering
│   ├── library.js      # Library page logic
│   ├── stats.js        # Stats page logic
│   ├── statutils.js    # Stats calculations
│   ├── profile.js      # Profile page logic
│   ├── auth.js         # Authentication
│   ├── supabase.js     # Supabase client
│   ├── sync.js         # Cloud sync engine
│   ├── offline.js      # Offline queue
│   ├── import.js       # Import logic
│   ├── export.js       # Export logic
│   ├── overlays.js     # Overlay UI
│   ├── posterPicker.js # Poster selection
│   └── about.js        # About page
├── assets/
│   ├── logo.svg        # App logo
│   └── favicon.svg     # Tab icon
├── JSON/               # Sample data
├── docs/               # Documentation
└── LICENSE
```

---

## Development

No build tools required. Edit files directly and refresh the browser.

### Tips

- Use Chrome DevTools for debugging
- Check localStorage in Application tab
- Test on mobile using device emulation
- Clear localStorage to reset app state

### Common Issues

**CORS errors with images:**
- TMDB images may be blocked in some browsers
- Use a local proxy or CORS extension for development

**localStorage full:**
- Max size is ~5MB
- Compress avatar images before saving
- Export and clear old data periodically
