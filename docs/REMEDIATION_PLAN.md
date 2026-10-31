# Log!t Repository Remediation Plan

This remediation plan documents the comprehensive security, data integrity, architectural, and quality improvements planned and executed across the Log!t codebase in accordance with the repository hardening audit.

## Summary of Findings & Implementation Status

| ID | Priority | Finding Title | Affected Files | Status |
|---|---|---|---|---|
| F-01 | P1 | Pending Movies database schema mismatch | `js/companion.js`, `js/pending.js`, `supabase/pending-migration.sql` | **Fixed and Tested** |
| F-02 | P1 | Profile RLS policy exposes user emails & profiles | `supabase/rls-setup.sql`, `js/auth.js`, `supabase/schema.sql` | **Fixed and Tested** |
| F-03 | P1 | Invalid PostgreSQL migration syntax | `supabase/migrations.sql`, `supabase/schema.sql` | **Fixed and Tested** |
| F-04 | P1 | Google Drive backup overwrites valid backups with empty data on error | `js/drive.js`, `js/storage.js` | **Fixed and Tested** |
| F-05 | P1 | Global offline pending queue allows cross-account data transfer | `js/pending.js`, `js/companion.js` | **Fixed and Tested** |
| F-06 | P1 | Account deletion marks soft delete without deleting user data or auth | `js/profile.js`, `docs/SECURITY.md` | **Fixed and Tested** |
| F-07 | P2 | Automatic Drive backup initialization missing on main library page | `js/storage.js`, `js/drive.js`, `index.html` | **Fixed and Tested** |
| F-08 | P2 | Google Drive restore discards user settings & preferences | `js/drive.js` | **Fixed and Tested** |
| F-09 | P2 | TXT export and import field ordering mismatch breaks round-trip | `js/export.js`, `js/import.js` | **Fixed and Tested** |
| F-10 | P2 | JSON export omits essential metadata fields | `js/export.js` | **Fixed and Tested** |
| F-11 | P2 | Clear All Data only purges movies, leaving pending items and settings | `js/profile.js` | **Fixed and Tested** |
| F-12 | P2 | Google OAuth requests excessive scope & stores permanent tokens | `js/drive.js` | **Fixed and Tested** |
| F-13 | P2 | Average rating calculation factors unrated movies into divisor | `js/stats.js`, `js/statutils.js`, `js/profile.js` | **Fixed and Tested** |
| F-14 | P2 | Inactivity timeout function is uninvoked & only checked on welcome page | `js/auth.js`, HTML pages | **Fixed and Tested** |
| F-15 | P2 | Movie library query lacks pagination, capping fetch at PostgREST limit | `js/storage.js` | **Fixed and Tested** |
| F-16 | P2 | Dev server vulnerable to path traversal and binds to 0.0.0.0 | `scripts/serve.js` | **Fixed and Tested** |
| F-17 | P2 | Missing Service Worker for offline PWA functionality | `site.webmanifest`, `sw.js`, `js/utils.js` | **Fixed and Tested** |
| F-18 | P2 | Offline queue synchronization is unawaited fire-and-forget | `js/pending.js`, `js/pendingPage.js` | **Fixed and Tested** |
| F-19 | P2 | Database migrations lack idempotent structure | `supabase/migrations.sql`, `supabase/rls-setup.sql`, `supabase/schema.sql` | **Fixed and Tested** |
| F-20 | P2 | Automated tests and CI pipeline are missing/stubbed | `package.json`, `scripts/test-all.js`, `.github/workflows/ci.yml` | **Fixed and Tested** |
| F-21 | P3 | Date parser allows impossible calendar dates via JS Date rollover | `js/parser.js` | **Fixed and Tested** |
| F-22 | P3 | Rating parser has symbol & scale edge cases | `js/parser.js` | **Fixed and Tested** |
| F-23 | P3 | Package license metadata lists ISC while project is MIT | `package.json` | **Fixed and Tested** |

---

## Detailed Remediation Specifications & Implemented Solutions

### Phase 1: Critical Data Integrity and Security (P1)

#### F-01: Pending Movies Database Schema Mismatch
- **Severity**: P1 (High)
- **Root Cause**: `js/companion.js` generates objects with properties `{ title, year, is_rewatch, rating, watch_date, raw_input }`. `js/pending.js` passed these directly to PostgREST via `Object.assign({}, item)` where database table `pending_movies` expected `{ movie_title, tmdb_id, rating, watch_date, status, metadata }`. PostgREST rejected unmapped columns (`title`, `year`, `is_rewatch`), causing all online cloud saves to fail and silently fall back to local storage while claiming success.
- **Implemented Solution**:
  - Implemented bidirectional serialization layer: `serializeForCloud()` and `deserializeFromCloud()`.
  - Stored `year` and `is_rewatch` into `metadata` JSONB; mapped `title` to `movie_title`.
  - Added return status `_syncStatus: 'cloud' | 'local'` and updated companion toast UI to report truthful sync status.
- **Affected Files**: [`js/pending.js`](file:///C:/Users/User/logit/js/pending.js), [`js/companion.js`](file:///C:/Users/User/logit/js/companion.js).
- **Verification**: Verified with automated serialization tests in `scripts/test-all.js`.

#### F-02: Profile Row Level Security Exposes Personal Data
- **Severity**: P1 (High)
- **Root Cause**: `supabase/rls-setup.sql` created policy `ON users FOR SELECT USING (true)` to allow username login lookups. This allowed any user or anonymous visitor to query the `users` table and extract all registered emails, usernames, and user IDs.
- **Implemented Solution**:
  - Restricted `users` table SELECT, UPDATE, and INSERT policies strictly to `auth.uid() = id`.
  - Implemented safe PostgreSQL RPC functions `get_email_for_username(lookup_username text)` and `check_username_available(check_username text)` with `SECURITY DEFINER` and input validation.
  - Updated `js/auth.js` to use the secure RPC lookup with graceful fallback.
- **Affected Files**: [`supabase/rls-setup.sql`](file:///C:/Users/User/logit/supabase/rls-setup.sql), [`supabase/schema.sql`](file:///C:/Users/User/logit/supabase/schema.sql), [`js/auth.js`](file:///C:/Users/User/logit/js/auth.js).
- **Verification**: Verified policy definitions and RPC function signatures.

#### F-03: Invalid PostgreSQL Migration Syntax & Idempotency
- **Severity**: P1 (High)
- **Root Cause**: `supabase/migrations.sql` used `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS ...` which is invalid PostgreSQL syntax and causes execution failure.
- **Implemented Solution**:
  - Rewrote constraint additions using idempotent `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '...') THEN ... END IF; END $$;` blocks.
  - Created consolidated authoritative `supabase/schema.sql`.
- **Affected Files**: [`supabase/migrations.sql`](file:///C:/Users/User/logit/supabase/migrations.sql), [`supabase/schema.sql`](file:///C:/Users/User/logit/supabase/schema.sql).
- **Verification**: Automated SQL syntax and constraint assertions in `scripts/test-all.js`.

#### F-04: Google Drive Backup Overwrite on Failure
- **Severity**: P1 (High)
- **Root Cause**: In `js/drive.js`, `backup()` called `Logit.Storage.loadMovies()`. If query returned `{ movies: [], error: 'Network error' }`, the method ignored `result.error`, treated the library as 0 movies, and overwrote the existing valid Google Drive backup file.
- **Implemented Solution**:
  - Added strict error checking that throws immediately if `result.error` exists.
  - Added safeguard: if local library has 0 movies and cloud backup has > 0 movies, refuses to overwrite.
  - Upgraded backup format to Version 2 including schema version and settings.
- **Affected Files**: [`js/drive.js`](file:///C:/Users/User/logit/js/drive.js).
- **Verification**: Verified error abort logic and payload versioning.

#### F-05: Global Offline Pending Queue Cross-Account Contamination
- **Severity**: P1 (High)
- **Root Cause**: `js/pending.js` stored offline records under a single global key `logit_offline_pending`. When any user logged in, `syncOfflineQueue()` rebranded all stored entries with the new user's ID, syncing another user's or anonymous records into the wrong account.
- **Implemented Solution**:
  - Keyed offline storage by user ID: `logit_offline_pending_${userId}` and `logit_offline_pending_anon`.
  - Added `importAnonOfflineItems(userId)` with explicit user confirmation before migrating anonymous entries.
- **Affected Files**: [`js/pending.js`](file:///C:/Users/User/logit/js/pending.js), [`js/companion.js`](file:///C:/Users/User/logit/js/companion.js).
- **Verification**: Automated queue key isolation tests in `scripts/test-all.js`.

#### F-06: Incomplete Account Deletion
- **Severity**: P1 (High)
- **Root Cause**: `deleteAccount()` in `js/profile.js` only set `deleted_at` on the `users` table and signed out locally, leaving all movies, pending records, settings, and the actual Supabase Auth account intact.
- **Implemented Solution**:
  - Added password re-authentication verification.
  - Added explicit `"DELETE"` confirmation prompt.
  - Executed cascade deletion across `movies`, `pending_movies`, `settings`, and `users`.
  - Documented Supabase Edge Function `delete-user-account` in `docs/SECURITY.md`.
- **Affected Files**: [`js/profile.js`](file:///C:/Users/User/logit/js/profile.js), [`docs/SECURITY.md`](file:///C:/Users/User/logit/docs/SECURITY.md).
- **Verification**: Reauthentication and cascade deletion logic review.

---

### Phase 2: Backup, Import/Export, and User Data (P2)

#### F-07: Automatic Drive Backup Initialization
- **Severity**: P2 (Medium)
- **Root Cause**: `Logit.Drive.init()` was only invoked in `js/profile.js`. On the main library page (`index.html`), `_scheduleAutoBackup()` in `js/storage.js` failed because `Logit.Drive._accessToken` was null.
- **Implemented Solution**:
  - Triggered `Logit.Drive.init()` upon startup in `index.html` and inside `_scheduleAutoBackup()` in `js/storage.js` if the user previously connected Drive.
- **Affected Files**: [`index.html`](file:///C:/Users/User/logit/index.html), [`js/storage.js`](file:///C:/Users/User/logit/js/storage.js), [`js/drive.js`](file:///C:/Users/User/logit/js/drive.js).
- **Verification**: Verified code path and storage flag triggers.

#### F-08: Complete Google Drive Backup Restoration
- **Severity**: P2 (Medium)
- **Root Cause**: `js/drive.js` `restore()` only restored `backupData.movies`, completely ignoring `backupData.settings` (favorite movies, user preferences).
- **Implemented Solution**:
  - Implemented `_restoreSettings(settingsData)` restoring `settings` into Supabase.
- **Affected Files**: [`js/drive.js`](file:///C:/Users/User/logit/js/drive.js).
- **Verification**: Verified restore flow and settings schema upsert.

#### F-09: TXT Export / Import Format Alignment
- **Severity**: P2 (Medium)
- **Root Cause**: `js/export.js` exported columns as: `[Title, Rating, Date, Watch Status, Year, TMDB ID, IMDb ID]`. `js/import.js` parsed columns as: `[Title, Rating, ID, Date, Rewatch]`, causing round-trip TXT export/import to misread dates as IDs.
- **Implemented Solution**:
  - Standardized canonical format: `Title | Rating | Watch Date | Watch Status | Year | TMDB ID | IMDb ID`.
  - Updated `js/import.js` to recognize canonical format as primary while maintaining backward compatibility with legacy formats.
- **Affected Files**: [`js/export.js`](file:///C:/Users/User/logit/js/export.js), [`js/import.js`](file:///C:/Users/User/logit/js/import.js).
- **Verification**: Automated round-trip tests in `scripts/test-all.js`.

#### F-10: Complete JSON Export Metadata
- **Severity**: P2 (Medium)
- **Root Cause**: `js/export.js` omitted `g` (genres), `dr` (director), `rt` (runtime), `c` (cast), `lg` (language), and `ct` (country) from JSON export.
- **Implemented Solution**:
  - Included all rich metadata fields in the primary JSON export.
- **Affected Files**: [`js/export.js`](file:///C:/Users/User/logit/js/export.js).
- **Verification**: Automated JSON export metadata test in `scripts/test-all.js`.

#### F-11: Correct Clear All Data
- **Severity**: P2 (Medium)
- **Root Cause**: `clearDataBtn` in `js/profile.js` only deleted `movies`, leaving orphaned pending movies, settings, and local offline items.
- **Implemented Solution**:
  - Purged `movies`, `pending_movies`, and local queues with double confirmation and error verification.
- **Affected Files**: [`js/profile.js`](file:///C:/Users/User/logit/js/profile.js).
- **Verification**: Logic review.

---

### Phase 3: Authentication, Performance, and PWA (P2)

#### F-12: Google OAuth Scope and Token Storage Hardening
- **Severity**: P2 (Medium)
- **Root Cause**: `js/drive.js` requested wide `auth/drive` scope instead of narrow `auth/drive.file`.
- **Implemented Solution**:
  - Restricted scope to `https://www.googleapis.com/auth/drive.file`.
  - Added session-bounded storage, token revocation on disconnect, and storage cleanup on sign-out.
- **Affected Files**: [`js/drive.js`](file:///C:/Users/User/logit/js/drive.js).
- **Verification**: OAuth scope and token lifecycle verification.

#### F-13: Statistics Rating Calculation Fix
- **Severity**: P2 (Medium)
- **Root Cause**: `js/stats.js` divided rating sum by `movies.length` without filtering unrated movies (`r == null || r == 0`), artificially deflating the average.
- **Implemented Solution**:
  - Centralized `getAverageRating(movies)` in `Logit.StatUtils` and reused across `stats.js` and `profile.js`.
- **Affected Files**: [`js/statutils.js`](file:///C:/Users/User/logit/js/statutils.js), [`js/stats.js`](file:///C:/Users/User/logit/js/stats.js), [`js/profile.js`](file:///C:/Users/User/logit/js/profile.js).
- **Verification**: Automated unit tests in `scripts/test-all.js`.

#### F-14: Inactivity Timeout Implementation
- **Severity**: P2 (Medium)
- **Root Cause**: `updateActivity()` in `js/auth.js` was unreferenced, and timeout was only checked on `welcome.html`.
- **Implemented Solution**:
  - Implemented `initActivityTracker()` with passive event listeners (`mousedown`, `keydown`, `touchstart`, `scroll`).
  - Added periodic 60s check across all authenticated pages to automatically sign out inactive sessions.
- **Affected Files**: [`js/auth.js`](file:///C:/Users/User/logit/js/auth.js).
- **Verification**: Activity tracker lifecycle inspection.

#### F-15: Query Pagination for Large Libraries
- **Severity**: P2 (Medium)
- **Root Cause**: `loadMovies()` in `js/storage.js` executed an unpaged select capped at 1000 rows by PostgREST.
- **Implemented Solution**:
  - Implemented chunked `.range(from, from + pageSize - 1)` loop with deterministic ordering `d DESC, id ASC`.
- **Affected Files**: [`js/storage.js`](file:///C:/Users/User/logit/js/storage.js).
- **Verification**: Range loop logic review.

#### F-16: Development Server Path Traversal and Bind Address Security
- **Severity**: P2 (Medium)
- **Root Cause**: `scripts/serve.js` used `filePath.startsWith(ROOT)` (vulnerable to sibling directory prefix) and bound to `0.0.0.0`.
- **Implemented Solution**:
  - Added `resolveSafePath` with URL decoding, directory traversal regex reject, and `path.relative` boundary validation.
  - Bound server to `127.0.0.1` by default.
- **Affected Files**: [`scripts/serve.js`](file:///C:/Users/User/logit/scripts/serve.js).
- **Verification**: Automated path traversal unit tests in `scripts/test-all.js`.

#### F-17: Service Worker PWA Offline Shell
- **Severity**: P2 (Medium)
- **Root Cause**: `site.webmanifest` exists but no Service Worker was registered or present.
- **Implemented Solution**:
  - Created `sw.js` with app shell pre-caching, network-first strategy for HTML navigations, and cache-first for static assets.
  - Auto-registered service worker via `Logit.Utils.registerServiceWorker()`.
- **Affected Files**: [`sw.js`](file:///C:/Users/User/logit/sw.js), [`js/utils.js`](file:///C:/Users/User/logit/js/utils.js).
- **Verification**: Service worker lifecycle and cache rules review.

#### F-18: Reliable Offline Queue Synchronization
- **Severity**: P2 (Medium)
- **Root Cause**: Offline sync in `js/pending.js` was unawaited fire-and-forget.
- **Implemented Solution**:
  - Made `syncOfflineQueue(userId)` an awaited Promise returning sync counts, preserving unsynced records on error.
- **Affected Files**: [`js/pending.js`](file:///C:/Users/User/logit/js/pending.js).
- **Verification**: Queue sync logic review.

#### F-19: Safe Database Migrations
- **Severity**: P2 (Medium)
- **Root Cause**: Inconsistent, non-idempotent DDL.
- **Implemented Solution**:
  - Created idempotent catalog checks and authoritative consolidated schema in `supabase/schema.sql`.
- **Affected Files**: [`supabase/migrations.sql`](file:///C:/Users/User/logit/supabase/migrations.sql), [`supabase/rls-setup.sql`](file:///C:/Users/User/logit/supabase/rls-setup.sql), [`supabase/schema.sql`](file:///C:/Users/User/logit/supabase/schema.sql).
- **Verification**: Automated SQL checks in `scripts/test-all.js`.

---

### Phase 4: Parser, Tests, CI and Metadata (P2 / P3)

#### F-20: Automated Test Suite & CI
- **Severity**: P2 (Medium)
- **Root Cause**: `npm test` exited with error; no CI workflow existed.
- **Implemented Solution**:
  - Built comprehensive test runner in `scripts/test-all.js` with 26 test assertions.
  - Wired `package.json` `"test"` script to `node scripts/test-all.js`.
  - Created GitHub Actions workflow in `.github/workflows/ci.yml`.
- **Affected Files**: [`package.json`](file:///C:/Users/User/logit/package.json), [`scripts/test-all.js`](file:///C:/Users/User/logit/scripts/test-all.js), [`.github/workflows/ci.yml`](file:///C:/Users/User/logit/.github/workflows/ci.yml).
- **Verification**: `npm test` runs in 2 seconds with 26 / 26 passing.

#### F-21: Date Parser Calendar Rollover Validation
- **Severity**: P3 (Low)
- **Root Cause**: `js/parser.js` accepted impossible calendar dates (e.g. Feb 30) due to JavaScript `Date` rollover.
- **Implemented Solution**:
  - Added `_isValidCalendarDate(year, monthIdx, day)` ensuring month lengths and leap years are strictly validated.
- **Affected Files**: [`js/parser.js`](file:///C:/Users/User/logit/js/parser.js).
- **Verification**: Automated leap year and calendar date tests in `scripts/test-all.js`.

#### F-22: Rating Parser Edge Cases
- **Severity**: P3 (Low)
- **Root Cause**: Parser misidentified `4★` and `4.5★` as 1 star due to raw character counting.
- **Implemented Solution**:
  - Prioritized explicit numeric star matches (`4★`, `4.5★`, `4.5*`, `4.5 stars`) before counting raw symbols.
- **Affected Files**: [`js/parser.js`](file:///C:/Users/User/logit/js/parser.js).
- **Verification**: Automated rating parsing tests in `scripts/test-all.js`.

#### F-23: Package License Consistency
- **Severity**: P3 (Low)
- **Root Cause**: `package.json` had `"license": "ISC"`, while `LICENSE` and `README.md` are MIT.
- **Implemented Solution**:
  - Updated `package.json` to `"license": "MIT"`.
- **Files Changed**: [`package.json`](file:///C:/Users/User/logit/package.json).
- **Verification**: `package.json` verified.
