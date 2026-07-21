# Changelog

All notable changes to Log!t will be documented in this file.

## [3.3.0] - 2026-07-21

### Added
- Google Drive account status display with live connection badge (`Connected` / `Not Connected`) and linked account email
- Google UserInfo API integration (`/oauth2/v3/userinfo`) with fallback to Drive About API
- Dedicated Account Connect / Disconnect button with instant OAuth token revocation
- Pixel-perfect centered user profile header with absolute-positioned edit pencil icon next to username

### Changed
- Complete rewrite of `Logit.Drive` integration using modern `fetch()` API and async/await
- Optimized Drive API queries with targeted filters (`q=mimeType = ... and name = ... and trashed = false`)
- Proper RFC 2046 multipart body formatting for Google Drive file creation
- Automatic handling and clearance of expired OAuth tokens (401 response handling)
- Reorganized profile settings into 4 clean, distinct sections: Account, Google Drive, Backup & Data, and Danger Zone
- Fixed mobile vertical spacing gaps and element alignment across settings content blocks

### Fixed
- Fixed OAuth token callback promise resolution timing before updating status UI
- Fixed username text offset by removing inline element flex width skewing
- Fixed mobile spacing collapse where `.contentBlock` margin was overridden to `0`

## [3.2.0] - 2026-07-20

### Added
- Google Drive backup/restore integration
- Auto-backup to Google Drive after every movie change
- "Logit" folder created automatically on Google Drive
- Dynamic backup filenames: `logit-{count}-movies-{date}.json`
- Backup/restore buttons in profile settings
- Red dot indicators for movies with missing metadata
- Red border on incomplete movie cards
- Hover tooltips showing missing fields
- Month headers show red dots when containing incomplete movies
- Detailed documentation with architecture diagrams

### Changed
- Removed year from month labels (back to just month name)
- Updated all documentation (README, FLOWCHART, SECURITY, SETUP, TUTORIAL, SIGNUP, FAQ, CONTRIBUTING)
- Updated about page with Google Drive in tech stack

## [3.1.0] - 2026-07-20

### Fixed
- ReferenceError crash from undeclared `sidebarGridSlider`
- Month labels missing year (e.g., "January" for all years)
- Broken month sort using invalid Date() on YYYY-M format
- parseInt called without radix parameter
- Avatar not loading on page reload
- Runtime not editable in movie details

### Changed
- Added year to month group labels
- Shared constants for ratings and poster fallback
- Reduced code duplication (5x SVG fallback, 2x rating array, 3x avatar pattern)
- Declared `_favorites` property explicitly
- Removed dead sidebar/grid references from library.js
- Updated all documentation for v3.0 cloud-only architecture

### Removed
- Unused `Supabase.configure()` method
- Hardcoded `isOfflineMode()` function
- Dead sidebar toggle references
- Dead HTML element references (sidebarGridSlider, sidebarDateToggle, etc.)
- Unused CSS classes (~30 classes across 6 files)
- config.html (unused, defaults hardcoded)
- Old sync test files and compose artifacts
- Continue Offline button from welcome page

## [3.0.0] - 2026-07-20

### Added
- Cloud-only architecture (removed localStorage)
- Runtime editing in movie details
- Storage usage display in profile
- Exponential backoff for failed operations
- Queue compaction for sync
- Schema versioning for migrations

### Changed
- All data now stored in Supabase cloud database
- Removed offline mode — authentication required
- Removed push/pull sync buttons
- Simplified sync engine
- Improved error handling with user-facing messages
- Added image fallbacks for broken posters
- Added ARIA labels and keyboard navigation
- Performance improvements with incremental DOM updates

### Removed
- localStorage storage
- Offline queue system
- Push/pull manual sync buttons
- Offline mode

## [2.0.0] - 2026-07-19

### Added
- Cloud sync via Supabase
- User authentication (email/password)
- Profile page with avatar and favorites
- Stats page with directors, actors, genres, languages
- Export/Import (JSON and text)
- Responsive desktop layout

### Changed
- Full UI redesign
- Removed old banner/cover feature

## [1.0.0] - 2026-05-22

### Added
- Initial release
- Offline movie logging
- TMDB search integration
- Local storage
