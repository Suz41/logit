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
| Google Drive | Backup JSON | OAuth 2.0, user's own Drive, 30min token expiry |
| localStorage | API keys, preferences | Browser-only, no secrets |

## Authentication

- Email/username login via Supabase Auth
- Google Drive uses OAuth 2.0 (user grants access)
- No passwords stored in plain text
- Session timeout after 60 minutes of inactivity
- Google Drive token expires after 30 minutes

## Row Level Security (RLS)

All tables have RLS enabled with policies:

- **movies**: Users can only read/write their own movies
- **settings**: Users can only read/write their own settings
- **users**: Anyone can read profiles (for username lookup), users can only update their own

## API Rate Limiting

- TMDB API requests are rate-limited to 300ms between calls
- Automatic retry on failure with exponential backoff
- Search results cached to reduce API calls

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
