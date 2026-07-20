# Plan: Apply All 24 Updates to Logit Movie Tracker

## Task List

### T1: Fix saveMovies() Timestamp Issue
**Description**: Modify `saveMovies()` in `js/storage.js` to only update `updated_at` for movies that actually changed, not all movies in the array.
**Acceptance**: 
- `saveMovies()` accepts optional array of changed movie IDs
- Only movies in the changed array get `updated_at` updated
- Unchanged movies preserve their original timestamps
- All callers updated to pass changed IDs where appropriate
**Files**: `js/storage.js`, `js/library.js`, `js/profile.js`, `js/stats.js`
**dependsOn**: 

### T2: Wrap All JSON.parse for localStorage Robustness
**Description**: Ensure all `JSON.parse()` calls for localStorage data are wrapped in try/catch with fallback to empty state.
**Acceptance**:
- Every `JSON.parse(localStorage.getItem(...))` is wrapped in try/catch
- Fallback returns empty array/object as appropriate
- No uncaught JSON parse errors from localStorage
**Files**: `js/storage.js`, `js/offline.js`
**dependsOn**: 

### T3: Add Data Validation for Movie Objects
**Description**: Add validation functions to ensure movie objects have required fields before saving to storage.
**Acceptance**:
- `validateMovie()` function checks for required fields (id, t, d, etc.)
- Invalid movies rejected with console.warn
- Import validation uses same function
- Existing invalid data handled gracefully
**Files**: `js/storage.js`, `js/profile.js`, `js/import.js`
**dependsOn**: 

### T4: Add schemaVersion for Versioned Migrations
**Description**: Implement schema versioning for localStorage to handle data migrations.
**Acceptance**:
- `schemaVersion` key added to localStorage
- Version number incremented when schema changes
- Migration functions run on version mismatch
- Backward compatible with existing data
**Files**: `js/storage.js`
**dependsOn**: 

### T5: Implement Sync Lock with Mutex Pattern
**Description**: Add proper sync lock using mutex pattern to prevent concurrent sync operations.
**Acceptance**:
- `acquireSyncLock()` and `releaseSyncLock()` methods added to offline.js
- Lock prevents concurrent queue operations
- Lock has timeout to prevent deadlocks
- Queue operations check lock before proceeding
**Files**: `js/offline.js`, `js/sync.js`
**dependsOn**: T1, T2, T3, T4

### T6: Remove pushToCloud/pullFromCloud Methods
**Description**: Remove direct push/pull methods from sync.js and update all callers to use queue-based sync.
**Acceptance**:
- `pushToCloud()` and `pullFromCloud()` removed from sync.js
- All callers updated to use `Logit.Offline.enqueue()` + `Logit.Sync.sync()`
- profile.js pullFromCloud button triggers sync
- library.js loadAndRender uses queue sync
**Files**: `js/sync.js`, `js/storage.js`, `js/library.js`, `js/profile.js`, `js/stats.js`
**dependsOn**: T5

### T7: Redesign Conflict Resolution
**Description**: Implement proper timestamp comparison before overwriting local data with remote changes.
**Acceptance**:
- Conflict resolution compares `updated_at` timestamps
- "Last write wins" with proper timestamp comparison
- Local changes preserved when local is newer
- Remote changes applied when remote is newer
**Files**: `js/sync.js`
**dependsOn**: T6

### T8: Add Queue Compaction and Retry Limits
**Description**: Implement queue compaction to merge multiple updates for same entity, and add retry limits with backoff.
**Acceptance**:
- Queue compaction merges updates for same entity ID
- Retry limit of 3 attempts per item
- Exponential backoff for failed items
- Queue stats include retry count
**Files**: `js/offline.js`, `js/sync.js`
**dependsOn**: T5

### T9: Fix Unsafe innerHTML Interpolation
**Description**: Audit and fix all innerHTML usage to ensure proper escaping of user-provided data.
**Acceptance**:
- All user-provided data in HTML strings escaped with `Logit.Utils.esc()`
- No unescaped data in innerHTML assignments
- Audit completed for all JS files
**Files**: `js/library.js`, `js/modals.js`, `js/utils.js`, `js/profile.js`, `js/stats.js`
**dependsOn**: 

### T10: Add Image Fallbacks for Broken Posters
**Description**: Add onerror handler on img elements to replace broken poster URLs with placeholder.
**Acceptance**:
- `onerror` handler added to all poster img elements
- Broken URLs replaced with placeholder showing movie title
- Placeholder styled appropriately
- Applied in library.js, modals.js, and profile.js
**Files**: `js/library.js`, `js/modals.js`, `js/profile.js`
**dependsOn**: 

### T11: Prevent Duplicate Movies on Double-Click
**Description**: Add debounce/throttle to Add Movie button to prevent duplicate additions.
**Acceptance**:
- Add Movie button debounced for 2 seconds
- Last added movie ID tracked
- Same ID skipped within debounce window
- Works for both manual add and import
**Files**: `js/modals.js`, `js/profile.js`
**dependsOn**: 

### T12: Fix Duplicate Event Listeners
**Description**: Remove duplicate event listeners and implement event delegation patterns.
**Acceptance**:
- Duplicate listeners removed
- Event delegation used for dynamic content
- Single listener per event type where possible
- Event listener cleanup on modal close
**Files**: `js/library.js`, `js/profile.js`, `js/modals.js`
**dependsOn**: 

### T13: Standardize Error Handling
**Description**: Wrap all async operations in try/catch and provide user-friendly error messages.
**Acceptance**:
- All async operations wrapped in try/catch
- User-facing messages via status elements or notifications
- No uncaught promise rejections
- Error messages are helpful and actionable
**Files**: All JS files
**dependsOn**: 

### T14: Add Accessibility Features
**Description**: Add aria-labels, focus management, and keyboard navigation.
**Acceptance**:
- aria-labels on all interactive elements
- Focus trapping in modals
- Keyboard navigation for grid items (arrow keys)
- Screen reader announcements for status changes
**Files**: `js/library.js`, `js/modals.js`, `js/ui.js`
**dependsOn**: 

### T15: Optimize DOM Updates
**Description**: Replace full grid rebuild with targeted updates.
**Acceptance**:
- Only changed movie cards updated
- New movies added to DOM without full rebuild
- Deleted movies removed from DOM
- Performance improvement measurable
**Files**: `js/library.js`
**dependsOn**: 

### T16: Remove console.log Statements
**Description**: Remove all console.log calls, keep console.error and console.warn.
**Acceptance**:
- All console.log statements removed
- console.error and console.warn preserved
- No logging in production code
**Files**: All JS files
**dependsOn**: 

### T17: Move Toward Module/Event-Based Handlers
**Description**: Reduce global namespace pollution and use event-based patterns.
**Acceptance**:
- Global functions minimized
- Event delegation used where appropriate
- Namespace organization improved
- No new global variables introduced
**Files**: All JS files
**dependsOn**: 

### T18: Remove Dead Code
**Description**: Audit and remove unused functions, variables, and commented-out code.
**Acceptance**:
- Unused functions removed
- Commented-out code cleaned up
- No dead imports or references
- Code size reduced
**Files**: All JS files
**dependsOn**: 

## Task Dependencies Summary
- **Independent tasks**: T1, T2, T3, T4, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18
- **Dependent tasks**:
  - T5 depends on T1, T2, T3, T4
  - T6 depends on T5
  - T7 depends on T6
  - T8 depends on T5

## Implementation Order
1. **Phase 1 - Data Layer** (T1, T2, T3, T4): Foundation changes to storage and validation
2. **Phase 2 - Sync Layer** (T5, T6, T7, T8): Sync reliability and conflict resolution
3. **Phase 3 - UI Layer** (T9, T10, T11, T12, T14, T15): User interface improvements
4. **Phase 4 - Polish** (T13, T16, T17, T18): Code quality and cleanup

## Estimated Effort
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 4-5 hours
- Phase 4: 2-3 hours
- **Total**: 11-15 hours

## Risk Assessment
- **High Risk**: T6 (removing pushToCloud/pullFromCloud) - many callers to update
- **Medium Risk**: T7 (conflict resolution) - complex logic
- **Low Risk**: Most other tasks - localized changes

## Testing Strategy
1. Unit tests for storage functions (T1, T2, T3, T4)
2. Integration tests for sync operations (T5, T6, T7, T8)
3. Manual testing for UI changes (T9, T10, T11, T12, T14, T15)
4. Code review for cleanup tasks (T13, T16, T17, T18)