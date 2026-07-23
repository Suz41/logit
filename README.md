<h1 align="center">Log!t</h1>

<p align="center">Search, rate, and track every movie you watch.</p>

<p align="center">
  <a href="https://suz41.github.io/logit">Live Demo</a> ·
  <a href="https://github.com/Suz41/logit/blob/main/docs/TUTORIAL.md">Tutorial</a> ·
  <a href="https://github.com/Suz41/logit/blob/main/docs/CHANGELOG.md">Changelog</a>
</p>

---

## What is Log!t?

A cloud-first personal movie logger. Search any movie via TMDB, rate it, and track everything you watch. Your data syncs across all your devices.

## Features

| Feature | Description |
|---------|-------------|
| **TMDB Search** | Find any movie with poster, rating, cast, and metadata |
| **Cloud Sync** | All data stored in Supabase — access from any device |
| **Google Drive Backup** | Auto-backup after every change, restore anytime |
| **Username or Email Login** | Sign in with either |
| **Stats Dashboard** | Films watched, average rating, runtime, top directors/actors |
| **Profile** | Avatar, favorite films, bio — synced everywhere |
| **Import/Export** | JSON and text formats |
| **Dark Theme** | Minimal pure black UI, responsive on mobile and desktop |

## Quick Start

1. Go to **[suz41.github.io/logit](https://suz41.github.io/logit)**
2. Create an account or sign in
3. Set your TMDB API key in **Settings**
4. Start logging movies

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript — no frameworks
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Backup:** Google Drive API
- **Movie Data:** TMDB API
- **Hosting:** GitHub Pages

## Project Structure

```
logit/
├── index.html          # Library (home)
├── profile.html        # Profile & settings
├── PS.html             # Stats dashboard
├── about.html          # About page
├── welcome.html        # Login/signup
├── reset.html          # Password reset
├── migrations.sql      # Database setup
├── css/                # Styles
├── js/                 # JavaScript modules
└── docs/               # Documentation
```

## Documentation

- [Tutorial](docs/TUTORIAL.md) — How to use Log!t
- [Signup](docs/SIGNUP.md) — Account creation guide
- [FAQ](docs/FAQ.md) — Frequently asked questions
- [Setup](docs/SETUP.md) — Installation & configuration
- [Changelog](docs/CHANGELOG.md) — Version history

## Note for Indian Users

TMDB API is blocked in India. You need a VPN to search and add movies. Once added, movies work without VPN.

## License

[MIT](LICENSE)

---

<p align="center">
  Built with vanilla HTML, CSS & JS<br>
  No frameworks. No build tools.<br><br>
  Created by <a href="https://github.com/Suz41">Suz41</a>
</p>
