# Project Rules

Hard constraints that must be followed when working on this project.

## Data Storage

- **localStorage is movies-only** — Only the `movies` key exists in localStorage. No avatar, no settings, no UI state.
- Auth keys (`logit_user_id`, `logit_offline_mode`) and API keys are functional necessities only.

## Design

- **No SVG logos** — Keep text-based logo only. User rejected film reel + text SVG.
- **No email in profile page** — User does not want email displayed.
- **No "+" button on favorites section** — User does not want add-to-favorites button visible.
- **Improve, don't redesign** — Polish and clean up, don't change the overall design.

## Performance

- **Profile page must never freeze** — All `getElementById` calls need null checks. All async operations need try/catch.

## Git Workflow

- **Push without asking** — When user says "push", commit and push immediately without confirmation prompts.

## VPN Requirement

- **Indian users need VPN** — TMDB API is blocked in India. VPN required for adding movies and changing posters. Once added, movies work offline.

## Technical

- **No frameworks** — Pure HTML, CSS, JavaScript only.
- **No build tools** — Edit files directly, no compilation needed.
- **Cloud sync is hardcoded** — Supabase credentials are pre-configured. No user setup needed.
