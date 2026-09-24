# 🎬 Log!t

Log!t is a lightweight movie tracking app for logging every movie you watch, rating it with half-point precision, and building a personal watch history with insightful stats.

Search for movies through TMDB, organize your library, track rewatches, and keep everything synced in the cloud.

[Live Demo](https://suz41.github.io/logit) • [Setup Guide](docs/SETUP.md) • [FAQ](docs/FAQ.md)

<p align="center">
  <img alt="Log!t app preview" src="https://raw.githubusercontent.com/Suz41/logit/main/assets/preview.png" width="900" />
</p>

## Why Log!t?

Whether you're trying to remember what you watched last month or want a full statistical view of your movie habits, Log!t gives you a clean, fast way to track your viewing life.

- Search and add movies from TMDB instantly
- Rate titles from 0.5 to 5.0 in half-point increments
- Track first watches, rewatches, and total runtime
- Explore genre, country, director, and decade stats
- Sync your library securely with Supabase
- Back up data to Google Drive

## Features

### Movie Library

- Add movies from TMDB search
- Maintain a personal watchlist and history
- Track watch dates and rewatch counts
- Update poster art and metadata when needed

### Advanced Ratings

- Half-point precision ratings
- Quick score logging for every viewing
- Review your average rating and trends over time

### Insights & Stats

- Genre breakdowns
- Director and country stats
- Decade trends
- Runtime and watch totals
- Rewatch tracking and first-watch analytics

### Cloud Sync & Backup

- Secure cloud database with Supabase
- User authentication and profile-based storage
- Google Drive backup support for added safety
- Export data as JSON or text

## Tech Stack

- Frontend: Vanilla HTML, CSS, and JavaScript
- Database & Auth: Supabase
- Movie Metadata: TMDB API
- Hosting: GitHub Pages

## Quick Start

1. Open the app: [suz41.github.io/logit](https://suz41.github.io/logit)
2. Create an account or sign in
3. Add your TMDB API key in Settings
4. Start searching and logging movies

## Local Setup

This project does not require a build step. You can run it directly in a browser.

### Prerequisites

- A modern web browser
- A Supabase account
- A TMDB API key
- Optional: Google account for Drive backup

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/Suz41/logit.git
   cd logit
   ```

2. Open the project in a browser, or serve it locally if preferred.

3. Configure the required services in the app settings:
   - TMDB API key
   - Supabase connection details if applicable

4. Start tracking your movies.

For detailed setup instructions, see [docs/SETUP.md](docs/SETUP.md).

## Documentation

- [Setup Guide](docs/SETUP.md)
- [FAQ](docs/FAQ.md)

## Project Structure

```text
logit/
├── index.html         # Library/home screen
├── profile.html       # User profile and settings
├── stats.html         # Stats dashboard
├── about.html         # About page
├── welcome.html       # Authentication page
├── reset.html         # Password reset page
├── css/               # Stylesheets
├── js/                # JavaScript logic and modules
├── supabase/          # Database setup SQL scripts
├── docs/              # Setup and FAQ docs
├── README.md          # Project overview
└── LICENSE            # License file
```

## Contributing

Contributions are welcome. If you'd like to improve the app, fix a bug, or add a feature, feel free to open an issue or submit a pull request.

## License

This project is open source and licensed under the MIT license.

## Credits

Built with vanilla web technologies by [Suz41](https://github.com/Suz41).

Special thanks to:

- [TMDB](https://www.themoviedb.org/) for movie metadata
- [Supabase](https://supabase.com/) for cloud storage and auth

