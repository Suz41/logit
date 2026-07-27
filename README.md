# 🎬 Log!t

<p align="center">
  <a href="https://suz41.github.io/logit">
    <img src="https://img.shields.io/badge/Live%20Demo-Explore%20App-E94560?style=for-the-badge" alt="Live Demo">
  </a>
  <img src="https://img.shields.io/badge/Version-v3.8.0-0F3460?style=for-the-badge" alt="Version">
</p>

<p align="center">
  <strong>A gorgeous, minimal, and framework-free movie tracker.</strong><br>
  Search via TMDB, rate with half-star precision, synchronize to the cloud, and watch your stats grow dynamically.
</p>

<p align="center">
  <a href="https://suz41.github.io/logit">Explore Live Demo</a> ·
  <a href="docs/SETUP.md">Setup Guide</a> ·
  <a href="docs/FAQ.md">FAQs</a>
</p>

---

## 🌟 Features

* **🔍 Smart Search & Metadata**: Look up any film using the TMDB API. Instantly pulls high-res posters, director details, country, genres, language, runtime, cast list, and production companies.
* **⭐ Precise Ratings**: Rate movies with half-star precision.
* **🔄 First Watch vs. Rewatches**: Keep track of how many times you've rewatched your favorite movies.
* **📈 Stats Dashboard**: Dedicated visualization dashboard tracking total runtime, genre distributions, favorite directors, actors, countries of origin, and release years.
* **☁️ Supabase Cloud Sync**: Instant cloud synchronization across your phone, tablet, and computer.
* **💾 Import & Export**: Download your entire movie library as a JSON file anytime.
* **🛡️ Private & Clean**: Zero ads, zero tracking, and pure dark mode aesthetics.

---

## 🚀 Quick Start

1. Visit the live app at **[suz41.github.io/logit](https://suz41.github.io/logit)**.
2. Sign up or log in.
3. Grab a free API key from **[The Movie Database (TMDB)](https://www.themoviedb.org/settings/api)**.
4. Input your API key in **Settings**, and you are ready to start tracking!

---

## 🛠️ Tech Stack

<p align="left">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/TMDB%20API-01B4E4?style=for-the-badge&logo=themoviedatabase&logoColor=white" alt="TMDB API">
  <img src="https://img.shields.io/badge/GitHub%20Pages-222222?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages">
</p>

* **Frontend**: Pure Vanilla HTML5, CSS3 Variables, and ES6 JavaScript Modules. No build tools, bundlers, or frameworks needed.
* **Database & Auth**: Supabase (PostgreSQL) with Row-Level Security (RLS) policies.
* **Sync & Backup**: Google Drive integration for auto-backups.

---

## 📂 Project Structure

```text
logit/
├── index.html          # Library Catalog (Home page)
├── profile.html        # User Profile, Settings, & Cloud Sync
├── stats.html          # Dynamic Analytics Dashboard
├── about.html          # App Metadata & Detailed Changelog
├── welcome.html        # Authentication Page (Sign-in / Sign-up)
├── reset.html          # Supabase Password Reset Flow
├── supabase/           # Supabase database setup & SQL scripts
├── css/                # Sleek stylesheets (components, modal, stats)
├── js/                 # Vanilla JS logical modules
└── docs/               # Technical Guides and Setup Documentation
```

---

## 📖 Documentation

* [Tutorial (docs/TUTORIAL.md)](docs/TUTORIAL.md) — Walkthrough of features and UI controls.
* [Signup Guide (docs/SIGNUP.md)](docs/SIGNUP.md) — Setting up your user account.
* [Self-Hosting & Setup (docs/SETUP.md)](docs/SETUP.md) — Running your own local copy or personal Supabase instance.
* [FAQ (docs/FAQ.md)](docs/FAQ.md) — General debugging and questions.
* [Changelog (docs/CHANGELOG.md)](docs/CHANGELOG.md) — Full release history.

---

## 🌏 Note for Indian Users

The TMDB API is blocked by some ISPs in India. You may need a VPN active when searching or adding a new movie. Once a movie is logged, it will load and display without a VPN.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.

---

<p align="center">
  Built with vanilla web technologies &middot; Created by <a href="https://github.com/Suz41">Suz41</a>
</p>