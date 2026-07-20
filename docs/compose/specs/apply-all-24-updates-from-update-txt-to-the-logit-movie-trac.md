# Specification: Apply All 24 Updates from update.txt to Logit Movie Tracker

## Overview
This specification describes the current state of the Logit movie tracker project and details the 24 updates required to improve data integrity, sync reliability, error handling, performance, and accessibility. The updates are organized by functional area and dependency layer.

## Current State
Logit is a vanilla JavaScript movie tracker using localStorage for primary storage and Supabase for optional cloud sync. The codebase uses the `window.Logit` namespace pattern with no build tools. Key files:
- `js/storage.js` - localStorage CRUD operations
- `js/sync.js` - Supabase cloud sync engine
- `js/offline.js` - Queue-based offline sync
- `js/library.js` - Main library page with grid display
- `js/profile.js` - User profile, import/export, settings
- `js/modals.js` - Rating and movie detail modals
- `js/utils.js` - Utility functions (esc, img, debounce, etc.)
- `js/movieFactory.js` - Movie object creation
- `js/auth.js` - Authentication handling
- `js/ui.js` - UI utilities
- `js/import.js` - Import parsing
- `js/export.js` - Export functionality
- `js/stats.js` - Statistics page

## Technical Debt Identified
1. **Timestamp overwriting**: `saveMovies()` updates `updated_at` for ALL movies on every save
2. **Duplicate sync paths**: Both queue-based sync and direct `pushToCloud`/`pullFromCloud` methods exist
3. **Conflict resolution**: Current implementation doesn't properly compare timestamps before overwriting
4. **XSS vulnerability**: Unsafe innerHTML interpolation in some places
5. **Error handling**: Inconsistent try/catch usage and user-facing messages
6. **Race conditions**: No sync lock or idempotent operations
7. **Duplicate movie prevention**: No protection against double-click or repeated imports
8. **localStorage robustness**: JSON parsing not wrapped in try/catch everywhere
9. **Data validation**: No validation for imports or storage operations
10. **Image fallbacks**: No handling for broken poster URLs
11. **Event listeners**: Duplicate listeners and direct attachment instead of delegation
12. **Global namespace**: Heavy reliance on global functions instead of event-based handlers
13. **Console logging**: `console.log` statements in production code
14. **Accessibility**: Missing aria-labels, focus management, keyboard navigation
15. **DOM performance**: Full grid rebuild with innerHTML on changes
16. **Queue management**: No compaction, retry limits, or backoff
17. **Schema versioning**: No versioned migrations for localStorage data
18. **Dead code**: Unused functions and variables

## Required Updates

### 1. Fix saveMovies() Timestamp Issue
**Current**: `saveMovies(movies)` sets `updated_at` to current time for ALL movies in the array.
**Required**: Only update `updated_at` for movies that actually changed. This prevents unnecessary sync conflicts and preserves original timestamps for unchanged movies.
**Files**: `js/storage.js`

### 2. Remove Duplicate Full-Library Push vs Queue Sync
**Current**: Both `pushToCloud()`/`pullFromCloud()` methods and queue-based sync exist. Multiple callers use direct push/pull instead of the queue.
**Required**: Remove `pushToCloud()` and `pullFromCloud()` from `sync.js`. Update all callers to use `Logit.Offline.enqueue()` + `Logit.Sync.sync()` instead.
**Files**: `js/sync.js`, `js/storage.js`, `js/library.js`, `js/profile.js`, `js/stats.js`

### 3. Redesign Conflict Resolution
**Current**: Conflict resolution doesn't properly compare timestamps before overwriting.
**Required**: Implement proper timestamp comparison before overwriting local data with remote changes. Use "last write wins" with timestamp comparison.
**Files**: `js/sync.js`

### 4. Fix Unsafe innerHTML Interpolation
**Current**: Some places use string concatenation for HTML without proper escaping.
**Required**: Use `Logit.Utils.esc()` for all user-provided data in HTML strings. Audit all innerHTML usage.
**Files**: `js/library.js`, `js/modals.js`, `js/utils.js`

### 5. Standardize Error Handling
**Current**: Inconsistent error handling - some functions have try/catch, others don't. User-facing messages are generic alerts.
**Required**: Wrap all async operations in try/catch. Provide user-friendly error messages via notifications or status elements.
**Files**: All JS files

### 6. Add Sync Lock and Idempotent Operations
**Current**: `_syncInProgress` flag exists but isn't used consistently. Queue operations aren't idempotent.
**Required**: Implement proper sync lock using mutex pattern. Make queue operations idempotent (same operation doesn't create duplicates).
**Files**: `js/sync.js`, `js/offline.js`

### 7. Prevent Duplicate Movies
**Current**: No protection against adding the same movie twice via double-click or repeated imports.
**Required**: Add debounce/throttle to Add Movie button. Track last added movie ID and skip if same ID within 2 seconds. Validate against existing movies before adding.
**Files**: `js/modals.js`, `js/profile.js`

### 8. Wrap JSON Parsing for localStorage
**Current**: Some `JSON.parse()` calls aren't wrapped in try/catch.
**Required**: Ensure all `JSON.parse()` calls for localStorage data are wrapped in try/catch with fallback to empty state.
**Files**: `js/storage.js`, `js/offline.js`

### 9. Add Data Validation
**Current**: No validation for imported data or storage operations.
**Required**: Validate movie objects have required fields (id, t, d, etc.) before saving. Validate import data format.
**Files**: `js/storage.js`, `js/profile.js`, `js/import.js`

### 10. Add Image Fallbacks
**Current**: No handling for broken poster URLs.
**Required**: Add `onerror` handler on img elements to replace broken poster URLs with a placeholder showing movie title.
**Files**: `js/library.js`, `js/modals.js`

### 11. Fix Duplicate Event Listeners
**Current**: Some elements have multiple event listeners attached directly.
**Required**: Remove duplicate listeners. Prefer event delegation on parent elements instead of attaching to individual items.
**Files**: `js/library.js`, `js/profile.js`

### 12. Move Toward Module/Event-Based Handlers
**Current**: Heavy reliance on global functions and direct DOM manipulation.
**Required**: Use event delegation patterns. Reduce global namespace pollution where possible.
**Files**: All JS files

### 13. Remove console.logs for Production
**Current**: `console.log` statements scattered throughout codebase.
**Required**: Remove all `console.log` calls. Keep `console.error` and `console.warn` for debugging.
**Files**: All JS files

### 14. Add Accessibility Features
**Current**: Missing aria-labels, focus management, keyboard navigation.
**Required**: Add aria-labels to interactive elements. Implement focus trapping in modals. Add keyboard navigation for grid items.
**Files**: `js/library.js`, `js/modals.js`, `js/ui.js`

### 15. Optimize DOM Updates
**Current**: Full grid rebuild with innerHTML on every change.
**Required**: Use diffing or targeted updates instead of rebuilding entire grid. Only update changed movie cards.
**Files**: `js/library.js`

### 16. Add Queue Compaction and Retry Limits
**Current**: Queue grows unbounded. No retry limits or backoff for failed items.
**Required**: Implement queue compaction (merge multiple updates for same entity). Add retry limits (max 3 attempts) with exponential backoff.
**Files**: `js/offline.js`, `js/sync.js`

### 17. Add schemaVersion for Versioned Migrations
**Current**: No version tracking for localStorage schema.
**Required**: Add `schemaVersion` key to localStorage. Implement migration functions that run on version mismatch.
**Files**: `js/storage.js`

### 18. Remove Dead Code
**Current**: Unused functions and variables exist.
**Required**: Audit and remove unused code. Clean up commented-out code.
**Files**: All JS files

## Dependency Layers
The updates have clear dependency layers:
1. **Data Layer** (must come first): 1, 8, 9, 17
2. **Sync Layer** (depends on data): 2, 3, 6, 16
3. **UI Layer** (depends on both): 4, 7, 10, 11, 14, 15
4. **Polish** (touches all layers): 5, 12, 13, 18

## Acceptance Criteria
- All 24 updates implemented and tested
- No regressions in existing functionality
- Backward compatibility with existing localStorage data
- Improved sync reliability and conflict resolution
- Better error handling and user feedback
- Enhanced accessibility
- Cleaner, more maintainable codebase