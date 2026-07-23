# Frequently Asked Questions

## General

<details>
<summary><strong>What is Log!t?</strong></summary>
Log!t is a personal movie logger. Search any movie via TMDB, rate it, track rewatches, and view your stats — all stored in the cloud.
</details>

<details>
<summary><strong>Is it free?</strong></summary>
Yes. Log!t is completely free and open source under the MIT license.
</details>

<details>
<summary><strong>Do I need an account?</strong></summary>
Yes. Log!t requires an account to store your movies in the cloud.
</details>

---

## Getting Started

<details>
<summary><strong>How do I start?</strong></summary>
Visit <a href="https://suz41.github.io/logit">suz41.github.io/logit</a>, sign in or create an account, set your TMDB API key in Settings, and start adding movies.
</details>

<details>
<summary><strong>What is a TMDB API key?</strong></summary>
A free key from <a href="https://www.themoviedb.org/settings/api">The Movie Database</a> that lets Log!t search for movies, posters, and metadata.
</details>

<details>
<summary><strong>Do I need a VPN?</strong></summary>
If you're in India, yes. TMDB API is blocked in India. You need a VPN to search and add movies. Once a movie is added, it works without VPN.
</details>

---

## Features

<details>
<summary><strong>How do I add a movie?</strong></summary>
Click the <strong>+</strong> button, search by title, select the result, rate it, and click Add.
</details>

<details>
<summary><strong>Can I rate half stars?</strong></summary>
Yes. Log!t supports half-star ratings from 0.5 to 5.
</details>

<details>
<summary><strong>How do rewatches work?</strong></summary>
When adding a movie, select "Rewatch" as the watch type. Rewatch counts appear in your stats.
</details>

<details>
<summary><strong>Can I change a movie poster?</strong></summary>
Yes. Click on any movie in your library, then click the poster to choose an alternative from TMDB.
</details>

<details>
<summary><strong>Can I edit movie details?</strong></summary>
Yes. Click on a movie, then click Edit. You can change rating, director, language, country, runtime, and watch date.
</details>

<details>
<summary><strong>What do the red dots mean?</strong></summary>
Red dots indicate movies with missing metadata (runtime, director, genres, language, or country). Hover to see which fields are missing.
</details>

---

## Data & Storage

<details>
<summary><strong>Where is my data stored?</strong></summary>
All data is stored in Supabase cloud database. Your data is also auto-backed up to Google Drive.
</details>

<details>
<summary><strong>Can I export my data?</strong></summary>
Yes. Go to Profile → Settings → Export. Choose JSON (full data) or Text (one movie per line).
</details>

<details>
<summary><strong>How does Google Drive backup work?</strong></summary>
After your first manual backup, Log!t automatically saves your movies to a "Logit" folder on your Google Drive after every change. Backup files are named like `logit-146-movies-2026-07-20.json` showing the movie count and date.
</details>

---

## Troubleshooting

<details>
<summary><strong>Movies not saving?</strong></summary>
Check your internet connection. Make sure you're signed in. Try signing out and back in.
</details>

<details>
<summary><strong>Search not working?</strong></summary>
Verify your TMDB API key is set in Settings. Check your internet connection (and VPN if in India).
</details>

<details>
<summary><strong>Can't sign in?</strong></summary>
Make sure you're using the correct email (or username) and password. Use the "Forgot Password?" link to reset.
</details>

<details>
<summary><strong>Backup not working?</strong></summary>
Re-authenticate with Google Drive by clicking "Backup to Drive" again. Check Google Cloud Console settings.
</details>
