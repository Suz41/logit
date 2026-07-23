<h1 align="center">Log!t</h1>

<p align="center">
  <strong>Search, rate, and track every movie you watch.</strong>
</p>

<p align="center">
  <a href="https://suz41.github.io/logit">Live Demo</a> ·
  <a href="https://github.com/Suz41/logit/issues">Report Bug</a> ·
  <a href="https://github.com/Suz41/logit/blob/main/docs/TUTORIAL.md">Tutorial</a>
</p>

---

A cloud-first personal movie logger. Built with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools.

## Features

- **Cloud Storage** — All data stored in Supabase, access from any device
- **Username or Email Login** — Sign in with either username or email
- **Auto Backup** — Automatic backup to Google Drive after every change
- **TMDB Search** — Find any movie with poster, rating, cast, and metadata
- **Personal Stats** — Films watched, average rating, runtime, top directors/actors
- **Profile** — Avatar, favorite films, synced across devices
- **Change Password** — Update password from settings with confirmation
- **Dark Theme** — Clean, minimal pure black UI
- **Responsive** — Works on mobile and desktop
- **Import/Export** — JSON and text formats
- **Missing Data Indicators** — Red dots highlight movies with incomplete metadata

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                      USER DEVICE                        │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Library   │  │    Stats    │  │   Profile   │    │
│  │  (index)    │  │  (PS.html)  │  │  (profile)  │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │            │
│         └────────────────┼────────────────┘            │
│                          │                             │
│                    ┌─────▼─────┐                       │
│                    │ storage.js│                       │
│                    └─────┬─────┘                       │
└──────────────────────────┼──────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌────▼────┐ ┌────▼─────┐
        │ Supabase  │ │ Google  │ │  TMDB    │
        │ (Cloud DB)│ │ Drive   │ │  (API)   │
        └───────────┘ └─────────┘ └──────────┘
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Structure |
| CSS3 | Styling (dark theme) |
| JavaScript | Logic (vanilla, no frameworks) |
| Supabase | Cloud database & authentication |
| Google Drive API | Auto-backup & restore |
| TMDB API | Movie data & search |
| GitHub Pages | Hosting |

## Getting Started

1. Visit [suz41.github.io/logit](https://suz41.github.io/logit)
2. Create an account or sign in with email/username
3. Set your TMDB API key in Settings
4. Start logging movies

## Important

> **Indian Users:** TMDB API is blocked in India. You need a VPN to search and add movies. Once added, movies work without VPN.

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
├── css/                # Stylesheets
│   ├── main.css        # Global styles & nav
│   ├── library.css     # Movie grid & search
│   ├── modal.css       # Modals & sheets
│   ├── stats.css       # Stats page
│   ├── profile.css     # Profile page
│   ├── auth.css        # Auth pages
│   ├── about.css       # About page
│   ├── components.css  # Reusable components
│   ├── desktop.css     # Desktop overrides
│   └── animations.css  # Animations
├── js/                 # JavaScript modules
│   ├── app.js          # Page detection & init
│   ├── config.js       # API keys
│   ├── constants.js    # Shared constants
│   ├── storage.js      # Cloud storage operations
│   ├── supabase.js     # Supabase client
│   ├── auth.js         # Authentication
│   ├── drive.js        # Google Drive integration
│   ├── library.js      # Library page logic
│   ├── stats.js        # Stats page logic
│   ├── profile.js      # Profile page logic
│   ├── modals.js       # Modal logic
│   ├── search.js       # TMDB search
│   ├── movieFactory.js # Movie object builder
│   ├── movies.js       # Movie helpers
│   ├── statutils.js    # Stats calculations
│   ├── import.js       # Import logic
│   ├── export.js       # Export logic
│   ├── ui.js           # UI helpers
│   ├── utils.js        # Utility functions
│   ├── overlays.js     # Overlay UI
│   └── posterPicker.js # Poster selection
├── docs/               # Documentation
└── LICENSE
```

## Documentation

| Document | Description |
|----------|-------------|
| [Tutorial](docs/TUTORIAL.md) | Step-by-step usage guide |
| [Signup](docs/SIGNUP.md) | Account creation & login guide |
| [FAQ](docs/FAQ.md) | Frequently asked questions |
| [Setup](docs/SETUP.md) | Installation & configuration |
| [Design](docs/DESIGN.md) | Design system & tokens |
| [Flowchart](docs/FLOWCHART.md) | App flow & architecture |
| [Changelog](docs/CHANGELOG.md) | Version history |
| [Contributing](docs/CONTRIBUTING.md) | Contribution guidelines |
| [Security](docs/SECURITY.md) | Security policy |
| [AI Tools Used](docs/USED_AI.md) | AI tools used in development |

## License

[MIT](LICENSE)

---

<p align="center">
  Built with vanilla HTML, CSS & JS<br>
  No frameworks. No build tools. No dependencies.<br><br>
  Created by <a href="https://github.com/Suz41">Suz41</a> · <a href="https://instagram.com/suzalpins">Instagram</a>
</p>
