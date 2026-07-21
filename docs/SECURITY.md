# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Do NOT** open a public issue
- Email the repository owner directly
- Include details about the vulnerability
- Allow time for a fix before disclosure

## Data Storage

All movie data is stored in Supabase cloud database with Row Level Security (RLS) enabled. Each user can only access their own data.

| Service | What's Stored | Security |
|---------|---------------|----------|
| Supabase | Movies, settings, users | RLS policies, auth required |
| Google Drive | Backup JSON | OAuth 2.0, user's own Drive |
| localStorage | API keys, preferences | Browser-only, no secrets |

## Authentication

- Email/password via Supabase Auth
- Google Drive uses OAuth 2.0 (user grants access)
- No passwords stored in plain text
- Session tokens managed by Supabase

## API Keys

- **TMDB API Key**: Public key for movie search (stored in localStorage)
- **Supabase Anon Key**: Public client key (safe to expose)
- **Google Client ID**: Public OAuth client ID (safe to expose)
- **Service Role Keys**: Never used in client-side code

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x     | Yes       |
| < 3.0   | No        |
