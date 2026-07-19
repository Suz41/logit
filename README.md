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

A clean, offline-first movie logger with cloud sync. Built with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools.

## Features

- **Offline-First** — Works without internet, data stored in localStorage
- **Cloud Sync** — Supabase integration for cross-device backup
- **TMDB Search** — Find any movie with poster, rating, cast, and metadata
- **Personal Stats** — Films watched, average rating, runtime, top directors/actors
- **Profile** — Avatar, favorite films
- **Dark Theme** — Clean, minimal UI
- **Responsive** — Works on mobile and desktop
- **Import/Export** — JSON and text formats

## Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Structure |
| CSS3 | Styling |
| JavaScript | Logic (vanilla, no frameworks) |
| Supabase | Cloud sync & authentication |
| TMDB API | Movie data & search |
| GitHub Pages | Hosting |

## Getting Started

1. Visit [suz41.github.io/logit](https://suz41.github.io/logit)
2. Set your TMDB API key in Settings
3. Start logging movies

**Or use locally:**
1. Download the ZIP from GitHub
2. Extract and open `index.html` in your browser

## Important

> **Indian Users:** TMDB API is blocked in India. Use a VPN to search and add movies. Once added, movies work offline without VPN.

## Documentation

| Document | Description |
|----------|-------------|
| [Tutorial](docs/TUTORIAL.md) | Step-by-step usage guide |
| [Setup](docs/SETUP.md) | Installation & configuration |
| [Design](docs/DESIGN.md) | Design system & tokens |
| [Flowchart](docs/FLOWCHART.md) | App flow & architecture |
| [Changelog](docs/CHANGELOG.md) | Version history |
| [Contributing](docs/CONTRIBUTING.md) | Contribution guidelines |
| [Security](docs/SECURITY.md) | Security policy |
| [Code of Conduct](docs/CODE_OF_CONDUCT.md) | Community standards |
| [AI Tools Used](docs/USED_AI.md) | AI tools used in development |

## Project Structure

```
logit/
├── index.html          # Library (home)
├── profile.html        # User profile
├── PS.html             # Stats dashboard
├── about.html          # About page
├── welcome.html        # Auth page
├── config.html         # Supabase config
├── reset.html          # Password reset
├── css/                # Stylesheets
├── js/                 # JavaScript modules
├── docs/               # Documentation
├── .github/            # GitHub templates
├── LICENSE
└── .gitignore
```

## License

[MIT](LICENSE)

---

<p align="center">
  Built with vanilla HTML, CSS & JS<br>
  No frameworks. No build tools. No dependencies.
</p>
