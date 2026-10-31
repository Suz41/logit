# Log!t Testing & Quality Assurance Guide

This document details the automated test suite, verification procedures, manual QA checklists, and continuous integration pipeline for Log!t.

---

## 1. Running Automated Tests

Log!t includes a native Node.js automated test runner in [`scripts/test-all.js`](file:///C:/Users/User/logit/scripts/test-all.js) requiring zero external testing framework dependencies.

To execute the full suite:

```bash
npm test
```

Or run directly:

```bash
node scripts/test-all.js
```

### Test Suite Output

```text
====================================================
Running Log!t Automated Test Suite
====================================================

1. Natural Language Parser Tests
  ✓ Parses title, explicit /5 rating, and relative date
  ✓ Parses 9/10 normalized to 4.5/5 scale
  ✓ Parses 4★ and 4.5★ correctly without symbol count distortion
  ✓ Parses 4.5* and 4.5 stars notation
  ✓ Parses unicode star strings (★★★★★, ★★★★☆)
  ✓ Extracts release year in parentheses without corrupting title
  ✓ Calendar validation accepts valid leap year date (Feb 29, 2024)
  ✓ Calendar validation rejects impossible dates (Feb 29 non-leap year, Feb 30, April 31)
  ✓ Date parser does not roll over impossible dates (e.g. 2023-02-30)
  ✓ Multi-line parser handles batch entries

2. Pending Queue Schema & Isolation Tests
  ✓ serializeForCloud produces strictly conforming pending_movies schema
  ✓ deserializeFromCloud restores normalized application properties
  ✓ Offline queues are strictly isolated by account ID

3. Import / Export Round-Trip Tests
  ✓ Canonical 7-column TXT parses correctly without field displacement
  ✓ Legacy 5-column TXT format maintains backward compatibility
  ✓ Complete JSON export preserves all rich metadata fields and is NOT flagged as slim

4. Statistics & Aggregation Tests
  ✓ getAverageRating excludes unrated movies from divisor
  ✓ getAverageRating returns 0.0 for empty or all-unrated libraries

5. Development Server Path Traversal & Security Tests
  ✓ Allows legitimate files inside repository root
  ✓ Rejects ../ path traversal attacks
  ✓ Rejects URL-encoded traversal attacks
  ✓ Rejects sibling-directory prefix attacks (e.g. root-secret)
  ✓ Rejects null-byte poisoning attempts

6. Database Migration & RLS Syntax Checks
  ✓ supabase/migrations.sql does not use unsupported ADD CONSTRAINT IF NOT EXISTS
  ✓ supabase/rls-setup.sql does not contain unrestricted USING (true) on users
  ✓ supabase/schema.sql provides consolidated authoritative schema

====================================================
Test Execution Summary: 26 total | 26 passed | 0 failed
====================================================
```

---

## 2. Test Suites Breakdown

### Suite 1: Parser Edge Cases ([`js/parser.js`](file:///C:/Users/User/logit/js/parser.js))
- **Date Rollover Prevention**: Validates calendar days (`_isValidCalendarDate`) preventing JavaScript Date rollover for invalid days (Feb 30, April 31, Feb 29 non-leap year).
- **Rating Syntax**: Verifies `4★`, `4.5★`, `4.5*`, `4.5 stars`, `5/5`, `9/10`, and `Whiplash ★★★★★`.
- **Title Protection**: Ensures years in parentheses `(1999)` are extracted without corrupting movie titles.

### Suite 2: Pending Movies Schema & Queue Isolation ([`js/pending.js`](file:///C:/Users/User/logit/js/pending.js))
- **Serialization Guard**: Ensures `title`, `year`, `is_rewatch` are mapped strictly to `movie_title`, `metadata.year`, and `metadata.is_rewatch` so PostgREST insert operations never fail with schema errors.
- **Account Isolation**: Verifies `logit_offline_pending_anon` vs `logit_offline_pending_${userId}` ensuring User A never sees or syncs User B's offline records.

### Suite 3: Import / Export Round-Trip ([`js/export.js`](file:///C:/Users/User/logit/js/export.js), [`js/import.js`](file:///C:/Users/User/logit/js/import.js))
- **Canonical TXT**: Ensures 7-column pipe files export and import cleanly with 100% data fidelity.
- **Complete JSON**: Confirms `g`, `dr`, `rt`, `c`, `lg`, `ct` are exported so imported JSON files do not require TMDB API keys.

### Suite 4: Statistics & Average Rating ([`js/statutils.js`](file:///C:/Users/User/logit/js/statutils.js))
- **Unrated Exclusion**: Confirms movies with null or empty ratings do not artificially deflate average ratings.

### Suite 5: Dev Server Security ([`scripts/serve.js`](file:///C:/Users/User/logit/scripts/serve.js))
- **Traversal Protection**: Checks path boundaries against `../`, encoded `%2e%2e`, null bytes, and sibling directory attacks.

### Suite 6: Database Integrity ([`supabase/`](file:///C:/Users/User/logit/supabase/))
- **Syntax Validation**: Ensures SQL files avoid invalid PostgreSQL syntax and enforce idempotent policies.

---

## 3. Local Development Server

Run the hardened local development server:

```bash
npm start
# or: node scripts/serve.js
```

The server binds to `http://127.0.0.1:3000/` and provides:
- **Application**: `http://127.0.0.1:3000/index.html`
- **Companion**: `http://127.0.0.1:3000/companion.html`
- **Pending Review**: `http://127.0.0.1:3000/pending.html`
- **Status API**: `http://127.0.0.1:3000/api/status`

---

## 4. Manual QA Verification Checklist

| Test Item | Steps | Expected Result |
|---|---|---|
| **PWA Offline Shell** | Open `index.html` in Chrome/Edge, toggle **Offline** in DevTools Network tab, and refresh. | Page loads from Service Worker cache shell (`sw.js`). |
| **Inactivity Timeout** | Sign in, leave tab idle for 60 minutes or simulate `localStorage.setItem('logit_session_timeout', String(Date.now() - 3700000))`. | Client logs out and redirects to `welcome.html?reason=timeout`. |
| **Google Drive Disconnect** | In `profile.html`, connect Drive, then click **Disconnect**. | Token revoked, local keys cleared, badge updates to *Not Connected*. |
| **Account Deletion** | In `profile.html`, click **Delete Account**, enter password, and type `DELETE`. | User movies, pending items, settings, and profile are deleted, and user is redirected to welcome screen. |
| **TXT Round-Trip** | In `profile.html`, click **Export TXT**, download file, click **Import Movies**, paste contents. | All movies parsed with accurate title, rating, date, and rewatch status. |
