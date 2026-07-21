# Contributing to Log!t

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Create a branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test on both mobile and desktop
5. Commit and push
6. Open a Pull Request

## Guidelines

- Keep it simple — no frameworks, no build tools
- Test changes on mobile and desktop
- Follow existing code style
- One feature per PR
- Update documentation if needed

## Project Architecture

```
Frontend: HTML + CSS + Vanilla JS (no build tools)
Backend: Supabase (cloud DB + auth)
Backup: Google Drive API
Movies: TMDB API
```

## Code Style

- Use `var` for consistency with existing code
- Keep functions small and focused
- Add error handling for async operations
- Use descriptive variable names

## Reporting Issues

Open an issue with:
- What you expected
- What actually happened
- Steps to reproduce
- Browser/device info
