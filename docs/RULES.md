# Rules

**Can I use React or Vue?**
No. Pure HTML, CSS, JavaScript only.

**Can I add npm or build tools?**
No. Edit files directly, no compilation.

**Where should I store data?**
Movies go in localStorage. Avatar, favorites, and settings go in Supabase.

**Can I show email on profile?**
No.

**Can I add a "+" button on favorites?**
No.

**Can I use an SVG logo?**
No. Text logo only.

**Can I redesign the UI?**
No. Improve and polish only, don't change the design.

**Should I ask before pushing?**
No. Push immediately when asked.

**What colors can I use for buttons?**
Never use `background: var(--accent)` with `color: #fff` — it creates invisible white-on-white text. Use explicit `#fff` or `#000`.

**Do I need to test on mobile?**
Yes. Always test on both mobile and desktop.

**Do I need null checks?**
Yes. All `getElementById` calls need null checks. All async operations need try/catch.

**Is cloud sync optional for users?**
Yes. Supabase is pre-configured and hardcoded. Users don't need to set it up.

**Do Indian users need VPN?**
Yes. TMDB API is blocked in India. VPN needed for adding movies and changing posters.
