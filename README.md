# 🎬 Log!t

Log!t is a personal movie tracking app built for people who want a clean, fast, and thoughtful way to keep a record of everything they watch. Instead of relying on scattered notes or memory, you can search for a title, log your rating, track when you watched it, and build a history that becomes a richer picture of your viewing habits over time.

The app is designed around a simple idea: every movie should be easy to add, easy to rate, and easy to revisit later through meaningful statistics. It blends movie discovery via TMDB with a lightweight personal library so you can keep a catalogue that feels more like a digital movie journal than a spreadsheet.

[Live Demo](https://suz41.github.io/logit) • [Setup Guide](docs/SETUP.md) • [FAQ](docs/FAQ.md)

## Why this project exists

Many people watch movies regularly but never really keep track of what they have seen, how they felt about it, or how their taste evolves over time. Log!t exists to solve that problem in a way that feels natural and enjoyable rather than tedious.

Instead of only storing a list of titles, Log!t helps you capture the context around each movie: the rating, the watch date, whether it was a first watch or a rewatch, and the metadata that gives the library more texture. Over time, that turns a simple collection into a personal archive with useful patterns and trends.

## What you can do with Log!t

Log!t is built for people who want to track movies in a way that is both practical and expressive. You can search through TMDB for titles, add them to your library, and rate them using half-point precision from 0.5 to 5.0. This makes the rating system feel much closer to how people actually talk about movies, rather than forcing everything into broad integer values.

As your library grows, the app also becomes more useful as a reflection tool. You can see patterns in your ratings, identify which directors or genres dominate your viewing habits, and track rewatch activity in a way that makes your watch history feel alive. It is not just a list of titles; it is a way to understand your own taste and habits.

## Key features

### ⚡ Log!t Companion (Quick Capture)

Log!t Companion is a lightweight, mobile-first companion tool designed for instant movie capture on the go (*"I just watched a film; I want to record it in 2 seconds"*).

- **Natural Language Parsing**: Type or paste freely (e.g. `Interstellar 5/5 yesterday`, `The Prestige 4.5`, `Dune Part Two`, `Whiplash ★★★★★ rewatch`) and let the client-side parser detect title, rating, date, and rewatch status in real-time.
- **1-Tap Clipboard Paste**: Automatically read and convert multi-line lists or notes into structured preview cards.
- **Android Share Target**: Integrates directly into Android's system share sheet to capture movies shared from IMDb, Letterboxd, YouTube, or your mobile browser.
- **Offline Resilience**: Automatically caches captures to your local device when offline, syncing to Supabase when connected.

### 📥 Pending Movies System

The Pending Queue bridges rapid mobile captures with your full movie library.

- Queued items automatically match TMDB posters, metadata, and crew details in the background.
- Review pending films, change TMDB release matches if necessary, and log movies into your library in one click with pre-populated ratings and watch dates.

### Movie discovery and personal library

The app makes it easy to discover movies and add them to your own collection. Using TMDB search, you can quickly find a title, inspect basic metadata, and save it to your library with the information you care about most. This keeps the process smooth and fast, especially when you are adding a lot of films over time.

Once saved, the movie remains part of your personal record. You can revisit it later, update details, and maintain a watch list that reflects your actual viewing history instead of a static archive.

### Precision ratings and watch tracking

One of the defining features of Log!t is the rating system. Ratings can be recorded in half-point increments, which makes the app feel more intentional and realistic for movie fans. A 3.5 or 4.5 rating carries more nuance than a rounded number and better matches how people evaluate films in real life.

The app also distinguishes between first watches and rewatches, allowing you to capture repeated viewings in a meaningful way. This helps you understand not only what you liked, but also how often you revisit certain movies and which ones continue to hold value over time.

### Statistics and trends

Beyond simple tracking, Log!t gives you a sense of your viewing habits through built-in analytics. You can explore breakdowns by genre, director, country, and decade, which makes the app useful for discovering patterns in your taste. If you watch a lot of thrillers, revisit classics, or gravitate toward a particular region of cinema, the stats make those patterns visible.

This turns the app into both a utility and a reflection tool. It is useful for personal organization, but it also helps you learn more about your own movie preferences over time.

### Cloud sync and backups

Log!t stores your viewing history in the cloud through Supabase, which means your library is tied to your account instead of just your browser. This makes the app feel much more complete and reliable, especially if you switch devices or want the ability to keep your collection accessible anywhere.

The project also supports Google Drive backup, adding another layer of protection for your data. That means the app is designed not only for tracking but also for preserving your watch history in a durable way.

## The technology behind it

Log!t is intentionally built with simple web technologies instead of a heavy framework. The frontend uses vanilla HTML, CSS, and JavaScript, which keeps the project lightweight, easy to understand, and straightforward to modify.

For storage and authentication, the app relies on Supabase, which gives it a strong backend foundation without introducing unnecessary complexity. Movie metadata comes from TMDB, which is the source for rich search results, posters, and movie information. GitHub Pages is used for hosting, making the app easy to deploy and share.

## Quick start

To start using the app, open the live demo and sign in or create an account. After that, add your TMDB API key in the settings so the app can fetch search results and movie metadata. Once that is in place, you can begin adding films, rating them, and building your tracking library.

The process is intentionally simple: search, add, rate, and review. That makes the app approachable even for someone who just wants a clean movie journal without any complicated setup.

## Local setup

This project does not require a build step. Because the app is built with plain web files, you can run it directly in a browser or serve it locally if you prefer a local development flow.

### Prerequisites

Before using the project locally, you should have a modern web browser, a Supabase account, and a TMDB API key. If you want Google Drive backup support, a Google account is also useful.

### Development flow

1. Clone the repository to your machine.
2. Open the project files in a browser or serve the folder locally:
   ```bash
   node scripts/serve.js
   ```
3. Configure the required app settings, including the TMDB API key and Supabase connection details if needed.
4. Start adding movies, ratings, and watch data.

For more detailed instructions, see the [Setup Guide](docs/SETUP.md).

## Documentation

The project includes documentation to help with setup and troubleshooting:

- [Setup Guide](docs/SETUP.md) for configuration and environment details
- [FAQ](docs/FAQ.md) for common questions and support topics

## Project structure

```text
logit/
├── index.html         # Library and home screen
├── companion.html     # Log!t Companion (quick mobile capture)
├── pending.html       # Pending movies queue
├── profile.html       # User profile and settings
├── stats.html         # Statistics dashboard
├── about.html         # About page
├── welcome.html       # Authentication page
├── reset.html         # Password reset page
├── css/               # Stylesheets (main, companion, pending, etc.)
├── js/                # JavaScript modules (parser, pending, library, etc.)
├── supabase/          # Database migrations & RLS policies
├── docs/              # Setup and FAQ documentation
├── README.md          # Project overview
├── LICENSE            # Project license
└── package.json       # Project metadata and scripts
```

## Contribution and licensing

Contributions are welcome if you want to improve the experience, fix a bug, or add a feature. The project is open source and is intended to be easy to understand and extend, which makes it a good fit for collaborative improvements.

The project is licensed under the MIT license.

## Credits

Log!t was built with vanilla web technologies by [Suz41](https://github.com/Suz41). The app relies on the movie metadata and search functionality provided by [TMDB](https://www.themoviedb.org/) and cloud infrastructure from [Supabase](https://supabase.com/).
