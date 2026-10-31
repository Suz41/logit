# Log!t

Log!t is a personal movie tracking application built for cinephiles and casual viewers who want a clean, fast, and thoughtful system to log, rate, and analyze every movie they watch. Combining instant movie discovery via The Movie Database (TMDB) with a client-side personal library, Log!t transforms viewing notes into a durable digital archive.

[Live Demo](https://suz41.github.io/logit) | [Setup Guide](docs/SETUP.md) | [Security Architecture](docs/SECURITY.md) | [Database Migration](docs/DATABASE_MIGRATION_GUIDE.md) | [Testing Guide](docs/TESTING.md) | [FAQ](docs/FAQ.md)

---

## Overview

Many people watch films regularly but lose track of what they have watched, when they saw it, or how their opinions have evolved. Log!t bridges rapid capture with deep long-term organization.

Whether you need to record a quick watch on your mobile device in two seconds, sync your library across devices via Supabase, create encrypted cloud backups on Google Drive, or explore deep breakdowns of directors and genres, Log!t handles the entire lifecycle without heavy frameworks or unnecessary bloat.

---

## Core Capabilities

### Log!t Companion (Rapid Capture)

Designed for instant, friction-free logging on mobile devices:

- **Natural Language Parsing**: Type or paste natural strings such as `Interstellar 5/5 yesterday`, `The Prestige 4.5`, or `Whiplash 5 stars rewatch`. The client-side parser extracts title, rating, watch date, and rewatch status in real-time.
- **Calendar Rollover Protection**: Date parsing strictly validates real calendar dates, preventing invalid entries such as leap-year mistakes or impossible days from rolling over.
- **Clipboard Batch Paste**: Converts multi-line notes or raw text lists into structured preview cards with a single click.
- **Android Share Target**: Integrates directly into mobile share sheets, letting you capture titles shared from IMDb, Letterboxd, YouTube, or web browsers.
- **Isolated Offline Queues**: Pending entries cached offline are strictly isolated by account ID in local storage to prevent data leakage between different users on shared devices.

### Pending Movies System

The Pending Queue serves as the staging ground between quick mobile captures and your permanent library:

- Automatically queries TMDB to match posters, release years, directors, runtimes, and genres.
- Allows previewing alternative TMDB release candidates when duplicate or ambiguous titles exist.
- Moves verified titles into your main library with pre-populated ratings and watch dates in one click.

### Precision Ratings & Diary Tracking

- **Half-Point Increments**: Record ratings from 0.5 to 5.0 with full half-point precision.
- **Rewatch Distinction**: Differentiates first-time watches from repeat viewings.
- **Rich Metadata Retention**: Captures director, runtime, genres, original language, production countries, and release year alongside your personal review notes.

### Analytics & Viewing Statistics

- **Weighted Rating Calculation**: Average ratings accurately calculate across rated films and mathematically exclude unrated entries from the divisor.
- **Catalog Breakdown**: Visual summaries detailing your most-watched directors, dominant genres, release decades, and country distributions.
- **Chronological Distribution**: Monthly and yearly viewing velocity charts.

### Backup Resilience & Portability

- **Google Drive Cloud Backups**: Automated and on-demand synchronization to Google Drive using scoped access (`drive.file`).
- **Zero-Byte Overwrite Protection**: Backup routines abort immediately on database error and strictly refuse to overwrite populated remote backups with empty libraries.
- **Version 2 Backup Schema**: Backs up both movie records and user configuration (favorite genres, theme preferences, and custom avatars).
- **Format Flexibility**: Export or import your entire catalogue using a canonical 7-column CSV/TXT format (with legacy 5-column backwards compatibility) or full-fidelity uncompressed JSON.

### Hardened Security & Account Management

- **Row Level Security (RLS)**: PostgreSQL tables enforce authenticated user ownership. Direct public reading of sensitive user profile rows is eliminated in favor of secure `SECURITY DEFINER` stored procedures.
- **Session Inactivity Guard**: Automatically terminates active client sessions after 60 minutes of total idle time.
- **Cascade Account Deletion**: Provides full user account removal that cascades across movies, pending queues, and cloud storage tokens.
- **Development Server Boundary Protection**: The built-in development server restricts file delivery to the repository root, rejecting path traversal attempts, URL-encoded escapes, and null-byte injections.

---

## Architecture & Technology

Log!t is engineered with lightweight, dependency-free web technologies:

- **Frontend**: Vanilla HTML5, Vanilla CSS, and modern ECMAScript (ES6+). No build steps or heavy node bundles required.
- **Backend & Database**: Supabase PostgreSQL with Row Level Security, idempotent migration scripts, and stored procedures.
- **Metadata Provider**: The Movie Database (TMDB) API for movie details and high-resolution posters.
- **Storage & Backup**: Supabase Cloud, browser IndexedDB / LocalStorage, and Google Drive REST API.
- **Offline Shell**: Progressive Web App (PWA) architecture utilizing a dedicated Service Worker (`sw.js`).
- **Development Server**: Native Node.js HTTP server (`scripts/serve.js`) bound strictly to loopback (`127.0.0.1`).

---

## Project Structure

```text
logit/
|-- index.html                 # Main library view and dashboard
|-- companion.html             # Log!t Companion quick-capture interface
|-- pending.html               # Pending ingestion queue
|-- profile.html               # User profile, cloud sync, and account controls
|-- stats.html                 # Viewing statistics and analytics
|-- about.html                 # About and credits page
|-- welcome.html               # Authentication and sign-in
|-- reset.html                 # Password recovery workflow
|-- sw.js                      # Service Worker offline cache controller
|-- manifest.json              # Web App manifest configuration
|-- css/                       # Modular CSS stylesheets
|-- js/                        # Client-side JavaScript modules
|   |-- auth.js                # Supabase authentication and session timeout
|   |-- companion.js           # Companion UI and share listener
|   |-- drive.js               # Google Drive backup and restore pipeline
|   |-- export.js              # Canonical TXT and rich JSON exporters
|   |-- import.js              # Multi-format data importer
|   |-- parser.js              # Natural language and calendar date parser
|   |-- pending.js             # Pending queue, serialization, and offline storage
|   |-- profile.js             # Account deletion, clear data, and preferences
|   |-- stats.js               # Analytics charts and statistics renderers
|   |-- statutils.js           # Mathematical aggregations and rating utilities
|   |-- storage.js             # Supabase data layer and range pagination
|   `-- utils.js               # Service Worker registration and UI helpers
|-- supabase/                  # Database definitions and security scripts
|   |-- migrations.sql         # Idempotent incremental migrations
|   |-- pending-migration.sql  # Pending queue schema definitions
|   |-- rls-setup.sql          # Row Level Security policies and secure RPCs
|   `-- schema.sql             # Consolidated authoritative production schema
|-- scripts/                   # Tooling and verification scripts
|   |-- serve.js               # Hardened local development HTTP server
|   `-- test-all.js            # Automated unit and integration test runner
|-- docs/                      # Technical documentation
|   |-- BACKUP_FORMAT.md       # Backup schema specification (V1 and V2)
|   |-- DATABASE_MIGRATION_GUIDE.md # Supabase migration instructions
|   |-- FAQ.md                 # Frequently asked questions
|   |-- REMEDIATION_PLAN.md    # Architecture remediation specifications
|   |-- REMEDIATION_REPORT.md  # Production audit remediation report
|   |-- SECURITY.md            # Security disclosures and RLS specifications
|   |-- SETUP.md               # Environment and deployment guide
|   `-- TESTING.md             # Test suite execution guide
`-- package.json               # Project metadata and test commands
```

---

## Local Development & Setup

### Prerequisites

- A modern standards-compliant web browser.
- A free Supabase project for database and authentication services.
- A TMDB API key for movie searches and metadata.
- Node.js (version 18 or newer) for running the local server and test suite.

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/Suz41/Logit.git
   cd Logit
   ```

2. Start the local development server:
   ```bash
   node scripts/serve.js
   ```

3. Open your browser and navigate to:
   ```text
   http://127.0.0.1:8080
   ```

4. Enter your TMDB API key and Supabase project credentials in the settings view.

---

## Verification & Testing

Log!t includes a dedicated automated test suite verifying natural language parsing, calendar date rollover rules, queue serialization, import and export round-trips, statistics math, path traversal security, and database schema idempotency.

Run the full test suite with:

```bash
npm test
```

Continuous integration runs on all pull requests and pushes via GitHub Actions (`.github/workflows/ci.yml`).

---

## Documentation Index

- [Setup Guide](docs/SETUP.md): Step-by-step instructions for Supabase, TMDB, and Google Drive setup.
- [Security Architecture](docs/SECURITY.md): Comprehensive review of RLS rules, token handling, and session policies.
- [Database Migration Guide](docs/DATABASE_MIGRATION_GUIDE.md): Instructions for applying database schemas and migrations.
- [Backup Specification](docs/BACKUP_FORMAT.md): Detailed layout of the JSON and CSV backup structures.
- [Test Suite & QA Guide](docs/TESTING.md): Verification assertions and testing instructions.
- [Remediation Report](docs/REMEDIATION_REPORT.md): Historical record of security and stability hardening.
- [Frequently Asked Questions](docs/FAQ.md): Common usage and configuration questions.

---

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](LICENSE) file for details.

---

## Credits

Developed by [Suz41](https://github.com/Suz41). Movie metadata and poster artwork provided by [The Movie Database (TMDB)](https://www.themoviedb.org/). Backend cloud services powered by [Supabase](https://supabase.com/).
