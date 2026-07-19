# Log!t Tutorial

## Getting Started

### 1. Open the App
Visit [suz41.github.io/logit](https://suz41.github.io/logit) or open `index.html` locally.

### 2. Set TMDB API Key
- Click the **Settings** icon
- Enter your TMDB API key (get one free at [themoviedb.org](https://www.themoviedb.org/settings/api))

### 3. Add Your First Movie
- Click the **+** button (bottom nav on mobile, header on desktop)
- Search for a movie by title
- Select the correct result
- Rate it (1-5 stars)
- Click **Add**

### 4. View Your Library
- All logged movies appear on the home page
- Use the search bar to filter
- Click any poster to view details

### 5. Stats Page
- Navigate to **Stats** to see:
  - Total films watched
  - Average rating
  - Total runtime
  - Top directors and actors
  - Genre, language, and region breakdowns

### 6. Profile
- Click the **Profile** icon
- Set your avatar
- Add favorite films
- View sync status

---

## Features

### Rating Movies
- Tap the star icon on any movie
- Rate from 1 to 5 stars (supports half stars)

### Rewatches
- Mark movies as "Rewatch" when adding
- Rewatch count appears in stats

### Import/Export
**Export:**
- Go to Stats → Export
- Choose JSON or Text format

**Import:**
- Go to Stats → Import
- Paste JSON or text, or upload a file

### Cloud Sync (Optional)
1. [Sign up](SIGNUP.md) from the welcome page
2. Movies auto-sync to Supabase
3. Push/Pull buttons for manual sync

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `Esc` | Close modals |

---

## Troubleshooting

**Movies not saving?**
- Check localStorage isn't full
- Try clearing old data in Settings

**Search not working?**
- Verify TMDB API key is set
- Check internet connection

**Sync issues?**
- Sign out and sign back in
- Use Pull to restore from cloud
