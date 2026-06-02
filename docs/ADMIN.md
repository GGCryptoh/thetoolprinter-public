# Admin Panel

**URL:** `/admin` (hidden from public, no link on landing page)
**Auth:** Password gate → JWT cookie (7-day expiry)

## Pages

### Login (`/admin`)
- Password form — single input, no username
- Rate limited: 5 attempts per 15 min per IP
- On success: sets `aitea-admin` HTTP-only cookie, redirects to dashboard

### Dashboard (`/admin/dashboard`)
- Stats cards: total items, pending, approved, rejected
- Recent pipeline runs: status, items fetched/scored, timestamp

### Queue (`/admin/queue`)
- Pending items sorted by score (highest first)
- Each card shows: title, source badge, score pill, breakdown (N/I/R), summary, tags
- Actions: Approve, Reject (per item)
- Batch: "Approve 8+" and "Approve All" buttons

### Rejected (`/admin/rejected`)
- Auto-rejected and manually rejected items
- Promote button to move back to pending

### Feeds (`/admin/feeds`)
- List all feeds with type badge, URL, active status
- Add feed form: type (dropdown), name, URL, config (JSON)
- Toggle active/inactive, delete

### People (`/admin/people`)
- List all people with handle, description, tags
- Add person form: name, handle, description, tags (comma-separated)
- Toggle active/inactive, delete

### Knowledge (`/admin/knowledge`)
- One card per knowledge block category
- JSON textarea editor for `content_json`
- Save button per block

### Prompts (`/admin/prompts`)
- Current threshold display (trending min, signals range, auto-reject)
- Scoring prompt textarea editor
- Version badge, active status

## Server Actions (`app/admin/actions.ts`)

All mutations use Server Actions (no separate API routes):

| Action | What it does | Cache invalidation |
|--------|-------------|-------------------|
| `approveItem(id)` | Set status=approved | `updateTag('news')` |
| `rejectItem(id)` | Set status=rejected | `updateTag('news')` |
| `promoteItem(id)` | Set status=pending | `updateTag('news')` |
| `batchApprove(minScore)` | Approve all pending >= score | `updateTag('news')` |
| `approveAll()` | Approve all scored pending | `updateTag('news')` |
| `createFeed(formData)` | Insert new feed | — |
| `toggleFeed(id, active)` | Toggle feed active | — |
| `deleteFeed(id)` | Delete feed | — |
| `createPerson(formData)` | Insert new person | `updateTag('people')` |
| `togglePerson(id, active)` | Toggle person active | `updateTag('people')` |
| `deletePerson(id)` | Delete person | `updateTag('people')` |
| `updateKnowledgeBlock(id, json)` | Update content_json | `updateTag('knowledge')` |
| `updatePrompt(id, content)` | Update prompt text | — |

## Security

- `proxy.ts` verifies JWT cookie on all `/admin/*` subpages
- `/admin` login page and `/api/*` routes pass through without auth
- Invalid/expired JWT → cookie cleared, redirect to login
- Security headers added to all responses (CSP, HSTS, etc.)
- Admin pages have `X-Robots-Tag: noindex, nofollow`
