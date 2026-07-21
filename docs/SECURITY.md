# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Do NOT** open a public issue
- Email the repository owner directly
- Include details about the vulnerability
- Allow time for a fix before disclosure

## Scope

This project stores all data in Supabase cloud database. Security concerns may include:
- Authentication bypass
- XSS vulnerabilities
- RLS policy misconfigurations
- Data exposure through API

## Data Storage

All movie data, user profiles, and settings are stored in Supabase with Row Level Security (RLS) enabled. Each user can only access their own data.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.0.x   | Yes       |
| < 3.0   | No        |
