# Frequently Asked Questions

## General

<details>
<summary><strong>What is Log!t?</strong></summary>
Log!t is a personal movie logger. Search any movie via TMDB, rate it, track rewatches, and view your stats — all stored locally with optional cloud sync.
</details>

<details>
<summary><strong>Is it free?</strong></summary>
Yes. Log!t is completely free and open source under the MIT license.
</details>

<details>
<summary><strong>Do I need an account?</strong></summary>
No. The app works fully offline without an account. Cloud sync is optional.
</details>

---

## Getting Started

<details>
<summary><strong>How do I start?</strong></summary>
Visit <a href="https://suz41.github.io/logit">suz41.github.io/logit</a>, set your TMDB API key in Settings, and start adding movies.
</details>

<details>
<summary><strong>What is a TMDB API key?</strong></summary>
A free key from <a href="https://www.themoviedb.org/settings/api">The Movie Database</a> that lets Log!t search for movies, posters, and metadata.
</details>

<details>
<summary><strong>Do I need a VPN?</strong></summary>
If you're in India, yes. TMDB API is blocked in India. Use a VPN to search and add movies. Once added, movies work offline without VPN.
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

---

## Data & Storage

<details>
<summary><strong>Where is my data stored?</strong></summary>
Movies are stored in your browser's localStorage. If you enable cloud sync, they're also backed up to Supabase.
</details>

<details>
<summary><strong>How much data can I store?</strong></summary>
localStorage has a ~5MB limit. This holds hundreds of movies. Export old data if you hit the limit.
</details>

<details>
<summary><strong>Can I export my data?</strong></summary>
Yes. Go to Stats → Export. Choose JSON (full data) or Text (one movie per line).
</details>

<details>
<summary><strong>Can I import from Letterboxd or IMDb?</strong></summary>
Not directly. Export from Letterboxd as CSV, convert to Log!t's text format, then import.
</details>

---

## Cloud Sync

<details>
<summary><strong>How does cloud sync work?</strong></summary>
Sign up from the welcome page. Your movies auto-sync to Supabase in the background. Use Push/Pull buttons for manual sync.
</details>

<details>
<summary><strong>Is cloud sync free?</strong></summary>
Yes. Log!t uses Supabase's free tier (500MB storage).
</details>

<details>
<summary><strong>Can I use multiple devices?</strong></summary>
Yes. Sign in on each device and your movies will sync automatically.
</details>

---

## Troubleshooting

<details>
<summary><strong>Movies not saving?</strong></summary>
Check if localStorage is full. Go to Settings → Clear All Local Data, then re-import your backup.
</details>

<details>
<summary><strong>Search not working?</strong></summary>
Verify your TMDB API key is set in Settings. Check your internet connection (and VPN if in India).
</details>

<details>
<summary><strong>Page freezing on load?</strong></summary>
Clear your browser cache. If the issue persists, clear localStorage and re-import your data.
</details>

<details>
<summary><strong>Sync not working?</strong></summary>
Sign out and sign back in. Use Pull to restore from cloud.
</details>
