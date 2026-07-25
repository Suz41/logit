<h1 align="center">Log!t</h1>

<p align="center">A minimal movie tracker. Search via TMDB, rate with half-stars, and watch your stats grow.</p>

<p align="center">
  <a href="https://suz41.github.io/logit">Live Demo</a> ·
  <a href="https://github.com/Suz41/logit/blob/main/docs/CHANGELOG.md">Changelog</a>
</p>

---

## What is Log!t?

A minimal, cloud-first movie logger. Search any movie via TMDB, rate it with half-star precision, and track everything you watch. Your data syncs across all your devices.

## Features

- Search any movie via TMDB with auto-poster and metadata
- Rate with half-star precision
- Track first watch vs rewatches
- Stats dashboard: genres, directors, actors, runtime, regions
- Cloud sync via Supabase
- Import / export your data anytime
- Clean dark UI, no ads, no tracking

## Quick Start

1. Go to **[suz41.github.io/logit](https://suz41.github.io/logit)**
2. Create an account or sign in
3. Set your TMDB API key in **Settings**
4. Start logging movies

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript — no frameworks
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
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
