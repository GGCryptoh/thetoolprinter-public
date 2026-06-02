# Design System

## Brand

- **Site name:** The Tool Printer
- **Logo text:** Mr AI Tea (displayed near robot logo)
- **Domain:** thetoolprinter.com
- **Logo:** Robot holding tea cup with gold data cables (`public/ai_tea_logo.png`)
- **Tagline:** "Your daily AI terminal"
- **Owner:** Geoff Hopkins — linkedin.com/in/geoffhopkins/

## Aesthetic: Memoria (Dark Metric Dashboard)

Executive engineering look. Clean but commanding. Linear meets Bloomberg.

### Palette
- **Background:** `bg-background` (oklch 0.145 — near-black)
- **Cards:** `bg-neutral-900/60` with `border-neutral-800/80`
- **Text hierarchy:** white → neutral-100 → neutral-200 → neutral-300 → neutral-400
- **No accent colors** — monochromatic only
- **Muted foreground:** oklch 0.85 (boosted from default for readability)

### Typography
- **Fonts:** Geist Sans (interface), Geist Mono (data, scores, timestamps)
- **Hero text:** `text-4xl font-light` (title), `text-2xl font-mono font-light` (Mr AI Tea)
- **Section headers:** `text-sm font-medium uppercase tracking-widest text-neutral-200` with bottom border rule
- **Body:** `text-sm text-neutral-200`
- **Metadata:** `text-[11px] text-neutral-400`
- **Section count badges:** `text-[10px] font-mono` in pill

### Score Pills
- Score 9+: `bg-neutral-100 text-neutral-900` (white, inverted)
- Score 7-8: `bg-neutral-700 text-neutral-100`
- Below 7: `bg-neutral-800 text-neutral-400`

### Cards
- Standard: `bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-5`
- Hover: `hover:border-neutral-600 hover:bg-neutral-800/40`
- New items: `border-l-2 border-l-neutral-400` (thin left accent)

### Layout
- Max width: `max-w-7xl`
- Section spacing: `space-y-14`
- Two-column grid for mid-sections: `grid gap-8 lg:grid-cols-2`
- Masthead: logo right, title left, accent gradient line

### Logo Treatment
- 192px circular with radial gradient mask feather
- `maskImage: radial-gradient(circle, black 50%, rgba(0,0,0,0.6) 65%, transparent 80%)`
- Subtle amber glow behind: `bg-amber-500/5 blur-2xl`

## Components (shadcn/ui)

Installed: button, input, card, badge, textarea, select, table, tabs, label, separator, dialog, alert-dialog, dropdown-menu, sheet, skeleton, scroll-area, switch

## New Item Indicators

- `localStorage` key: `aitea-last-visit` (ISO timestamp)
- Items created after last visit get `border-l-2 border-l-neutral-400`
- Timestamp updates 5s after page load
- First visit: nothing highlighted (no reference point)
- Return visit: new items since last session are highlighted
