# Changelog

All notable changes to Log!t will be documented in this file.

## [3.4.0] - 2026-07-23

### Added
- Username login — sign in with username or email
- Back button in sign up mode to return to sign in
- Confirm password field in change password modal
- Google Drive connection status badge (green/red dot)
- Session timeout after 60 minutes of inactivity
- TMDB request queue — serializes simultaneous requests, respects 429 + Retry-After
- Search rate limiting (300ms minimum between TMDB requests)
- Last backup timestamp display in settings
- RLS policies for all database tables (movies, settings, users)
- Offline fallback message when Supabase is unavailable
- Retry button when library fails to load
- Centralized auth helper `Logit.Auth.getUserId()`
- Network error detection (offline, connection failed)

### Changed
- Simplified login page — removed animations, gradients, orbs
- Login page buttons — no hover effects, clean minimal style
- Login form layout — "or" divider between Sign In and Create Account
- Forgot password link centered inside auth card
- Change password modal — redesigned, no double-box, matches app aesthetic
- Settings buttons — improved hover/active states for mobile and PC
- Removed pulse animation from Google Drive status dot
- Rewrote README — concise, scannable, feature table
- `loadMovies()` returns `{ movies, error }` for better error handling

### Fixed
- Google Drive shows "Not Connected" when not authenticated (was showing connected)
- Login page alignment issues (logo, forgot password, spacing)
- Google Drive token persists across page reloads
- Distinguishes "Library is empty" from "Failed to load library"
- Removed direct localStorage usage for user ID — now uses centralized helper

## [3.3.0] - 2026-07-21

### Added
- Google Drive account status display with live connection badge (`Connected` / `Not Connected`) and linked account email
- Google UserInfo API integration (`/oauth2/v3/userinfo`) with fallback to Drive About API
- Dedicated Account Connect / Disconnect button with instant OAuth token revocation
- Pixel-perfect centered user profile header with absolute-positioned edit pencil icon next to username
- Detailed visual dark-mode software architecture flowchart diagram illustrating UI, Services, and Storage Sync layers
- Custom Change Password modal overlay styled directly with system variables
- Clickable "Forgot Password?" recovery link inside the Change Password dialog to trigger password reset links to user email
- Password visibility toggle buttons (eye icon) added to both password inputs inside the Change Password modal overlay
- Replaced all unicode emoji icons (`👁️`) in the password fields with crisp, responsive inline vector SVG icons across all login and change password modules

### Changed
- Complete rewrite of `Logit.Drive` integration using modern `fetch()` API and async/await
- Optimized Drive API queries with targeted filters (`q=mimeType = ... and name = ... and trashed = false`)
- Proper RFC 2046 multipart body formatting for Google Drive file creation
- Automatic handling and clearance of expired OAuth tokens (401 response handling)
- Reorganized profile settings into 4 clean, distinct sections: Account, Google Drive, Backup & Data, and Danger Zone
- Cleaned up 100+ lines of unused legacy CSS layout rules from `css/profile.css`
- Fixed mobile vertical spacing gaps and element alignment across settings content blocks
- Redesigned the login/authentication interface with premium glassmorphic cards, ambient background grid overlays, and floating green/pink glows, strictly matched to the official system color palette

### Fixed
- Fixed duplicate Google Drive backups by automatically finding, updating, and renaming any existing backup files to match the new count and date format (e.g. `logit-count-movies-date.json`), maintaining exactly one file in the folder
- Added version query parameters (`?v=30`) to all script imports in `profile.html` to prevent browser caching of legacy drive engines
- Added detailed browser console diagnostics (`[Drive] Target backup filename`) to troubleshoot Google Drive API interactions in real time
- Fixed OAuth token callback promise resolution timing before updating status UI
- Fixed username text offset by removing inline element flex width skewing
- Fixed mobile spacing collapse where `.contentBlock` margin was overridden to `0`

### Removed
- Completely removed all favicon asset files and icon link tags from all HTML pages

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
