# Design System

## Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#000` | Page background |
| `--surface` | `#0d0d0d` | Cards, modals |
| `--surface2` | `#1a1a1a` | Secondary surfaces |
| `--border` | `rgba(255,255,255,0.08)` | Borders, dividers |
| `--text` | `#fff` | Primary text |
| `--muted` | `rgba(255,255,255,0.5)` | Secondary text |
| `--green` | `#30d158` | Primary accent |
| `--red` | `#ff453a` | Danger, delete |

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Logo | Poppins | 22px | 800 |
| H1 | Poppins | 24-28px | 700 |
| H2 | Inter | 20-24px | 700 |
| Body | Inter | 14px | 400 |
| Small | Inter | 11-12px | 500 |
| Labels | Inter | 10px | 600 |

## Spacing

- Page padding: 16px mobile, 30-40px desktop
- Card padding: 16px
- Gap between elements: 8-12px
- Border radius: 14px cards, 10px buttons, 99px pills

## Components

### Cards
- Background: `var(--surface)`
- Border: `0.5px solid var(--border)`
- Radius: 14px
- Padding: 16px

### Buttons
- Primary: Green background, black text
- Secondary: Transparent with border
- Height: 44-48px
- Radius: 12px

### Modals
- Backdrop: `rgba(0,0,0,0.7)` with blur
- Content: Centered, max-width 400-500px
- Radius: 16-20px

### Inputs
- Background: `rgba(255,255,255,0.04)`
- Border: `0.5px solid var(--border)`
- Radius: 10px
- Padding: 12-14px

## Grid

### Mobile
- Movie grid: 3 columns
- Stats: Single column

### Desktop (1024px+)
- Movie grid: 5+ columns
- Stats: 3 columns
- Two-column layouts: 1fr 360px

## Animations

- Transitions: 0.2s ease
- Scale on tap: 0.97
- Hover lift: translateY(-4px)
- Collapse/expand: grid-template-rows

## Dark Theme

The app is dark-only. No light mode. All surfaces are near-black with subtle white borders for depth.
