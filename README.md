# RESPONDE

> **Real-Time Disaster Intake & Geospatial Analytics System**  
> Capstone Project — Bachelor of Science in Information Technology  
> Batangas State University (BSU)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![UptimeRobot](https://img.shields.io/badge/UptimeRobot-Monitored-3BD671?logo=uptimerobot)](https://uptimerobot.com)

---

## Overview

**RESPONDE** is a disaster response command center dashboard built for **Talisay Municipal Disaster Risk Reduction and Management Office (MDRRMO)** in Batangas, Philippines. It consolidates real-time incident reports from Facebook Messenger bots and scrapers, processes them through an NLP pipeline, and presents actionable intelligence through an interactive geospatial map and analytics dashboard.

The system supports **Tagalog**, **Batangueño**, and **English** for natural language understanding, making it accessible to local communities during emergencies.

---

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Real-time KPI cards, Talisay heat map, Messenger bot & scraper activity feeds with click-to-detail modals |
| **Incident Reports** | Full officer verification pipeline with editable review modal, checklist, rejection reasons, bulk actions, and pagination |
| **Messenger Bot Logs** | Split-pane chat UI with PSID-based session grouping, Supabase Realtime live sync (~1-2s) with 60s polling fallback, and staggered message animations |
| **Scraper Feed** | Facebook comment monitoring with NLP entity extraction, confidence scoring, status management, and Realtime live sync with manual refresh |
| **Geospatial Map** | Interactive MapLibre GL map consuming only *verified* incidents, with choropleth barangays, dispatch arcs, and a mobile bottom-sheet drawer |
| **Analytics** | Charts and statistical reports on incident trends and response metrics, with CSV export of the filtered set |
| **Global Search** | Command-palette search across reports, conversations, and barangays with deep-links (`?focus=`, `?barangay=`) |
| **Settings** | Dark mode toggle, auto-refresh intervals, notification preferences, user management |

### Incident Verification Pipeline

```
Incoming (Bot/Scraper)
    │
    ▼
[PENDING] ── officer hasn't reviewed yet
    │
    ▼
[UNDER REVIEW] ── officer opened, possibly editing
    │
    ├─→ [VERIFIED] ── confirmed real → plots on Geospatial Map
    └─→ [REJECTED] ── fake/spam/outside jurisdiction
              │
              ▼
         [RESOLVED] ── team responded, incident closed
```

### Key Capabilities

- **Officer Review & Edit** — Officers can correct NLP mistakes (barangay, type, urgency, coordinates, landmark) while preserving the original raw text
- **Verification Checklist** — 5-point checklist before an incident can be verified and plotted on the map
- **Rejection Reasons** — Structured rejection with enum reasons: `spam_or_fake`, `duplicate`, `outside_jurisdiction`, `not_disaster_related`, `insufficient_info`
- **Bulk Actions** — Multi-select rows to start review, mark resolved, or restore to pending
- **Duplicate Detection** — Simple heuristic warning when same barangay + type appears within 30 minutes
- **Dark / Light Mode** — Fully themeable UI with system preference detection and gradient backgrounds
- **Collapsible Sidebar** — 240px expanded / 89px compact mode with hamburger toggle and active pill indicator
- **Smooth Animations** — Framer Motion page transitions, staggered list entrances, modal scale animations, and button press feedback (`active:scale-[0.97]`)
- **Real-time Data** — Supabase Realtime subscriptions (`conversations`, `fb_comments`, `incident_reports`) with polling fallback; new rows appear in ~1-2s; optimistic UI updates with rollback on error
- **Toast Notifications** — Slide-in feedback for verify, reject, save, and error states
- **Hidden Scrollbars** — Clean UI with functional scrolling (mouse wheel / trackpad) but no visible scrollbars
- **Mobile-first Responsive** — Bottom nav bar and bottom sheets on phones, tables collapse to cards, 44px touch targets, safe-area padding
- **Multi-language NLP** — BERT/spaCy pipeline for Tagalog, Batangueño, and English entity extraction
- **Sector Classification** — Automatic categorization into Search & Rescue, Medical, Food & Water, Infrastructure

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| [React 19](https://react.dev) | UI library |
| [TypeScript](https://www.typescriptlang.org) | Type safety |
| [Vite](https://vitejs.dev) | Build tool & dev server |
| [Tailwind CSS v4](https://tailwindcss.com) | Utility-first styling (`@import tailwindcss`) |
| [React Router v7](https://reactrouter.com) | Client-side routing |
| [Framer Motion](https://www.framer.com/motion/) | Page transitions, staggered animations, modals |
| [Supabase JS](https://supabase.com/docs/reference/javascript) | Real-time database client |
| [Lucide React](https://lucide.dev) | Icon library |

### Backend

| Technology | Purpose |
|------------|---------|
| [FastAPI](https://fastapi.tiangolo.com) | Python async web framework |
| [Node.js](https://nodejs.org) + [Express](https://expressjs.com) | Core API, RBAC authentication, and report intake |
| [PostgreSQL](https://www.postgresql.org) + [PostGIS](https://postgis.net) | Database with geospatial extensions (Supabase) |
| [BERT](https://huggingface.co/docs/transformers/model_doc/bert) / [RoBERTa](https://huggingface.co/) | NLP for entity extraction & multi-task classification |
| [Facebook Graph API](https://developers.facebook.com/docs/graph-api) | Messenger bot & page scraper integration |
| [UptimeRobot](https://uptimerobot.com) | 24/7 uptime monitoring & Render backend keep-alive (5-min interval) |

---

## Project Structure

```
responde-frontend-reactjs/
├── public/
│   └── Responde_logo.png          # Application logo
├── src/
│   ├── components/
│   │   ├── Layout.tsx             # Main shell (sidebar + header + page transitions)
│   │   ├── ThemeContent.tsx       # Dark/light mode context provider
│   │   ├── DatePicker.tsx         # Custom date picker component
│   │   ─── GlobalSearch.tsx       # Command-palette search with deep-links
│   │   ─── MapContainer.tsx       # MapLibre GL map, choropleth + pins + arcs
│   │   ─── Pagination.tsx         # Shared pager (Incident Reports)
│   │   ─── PageLoader.tsx         # Route-level loading + error states
│   │   ─── ReportReviewModal.tsx     # Shared officer review modal + toasts
│   │   ├── DropDown.tsx           # Reusable filter dropdown
│   │   ├── Stagger.tsx            # StaggerContainer & StaggerItem animation wrappers
│   │   └── Transition.tsx         # Page transition wrapper (AnimatePresence)
│   ├── pages/
│   │   ├── Dashboard.tsx          # Overview, heat map, bot/scraper feeds
│   │   ├── IncidentReports.tsx    # Verification pipeline table & review modal
│   │   ├── MessengerBotLogs.tsx   # Chat-style conversation viewer with Realtime sync
│   │   ├── ScraperFeed.tsx        # Facebook scraper feed with NLP extraction
│   │   ├── GeospatialMap.tsx      # MapLibre map (verified incidents only)
│   │   ├── Analytics.tsx          # Charts & reports
│   │   ├── Settings.tsx           # System preferences & user management
│   │   └── Login.tsx              # Authentication screen
│   ├── context/              # Reports, bot conversations, notifications, auth
│   ├── services/             # incidentService, apiClient, authService
│   ├── hooks/                # Shared data hooks
│   ├── data/                 # Barangay metadata, sample reports
│   ├── utils/                # Formatters, date/intent helpers
│   ├── types/                # Map + domain types
│   ├── website/              # Public landing pages
│   ├── lib/
│   │   └── supabaseClient.ts      # Supabase client initialization
│   ├── App.tsx                    # Route definitions with Transition wrapper
│   ├── main.tsx                   # Entry point (ThemeProvider wrapper)
│   └── index.css                  # Tailwind v4 directives + custom scrollbar hide
├── index.html
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18.0 or higher
- [npm](https://www.npmjs.com) (or yarn / pnpm)
- A [Supabase](https://supabase.com) project with API credentials

### Step-by-Step Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/sedrickamote/responde-frontend-reactjs.git
cd responde-frontend-reactjs
```

#### 2. Install Dependencies

```bash
npm install
```

> **Key dependencies:**
> - `@supabase/supabase-js` — Database client & auth
> - `react` & `react-dom` (v19)
> - `react-router-dom` (v7)
> - `tailwindcss` (v4) & `@tailwindcss/vite`
> - `framer-motion` — Animations
> - `leaflet` & `react-leaflet` — Geospatial mapping
> - `lucide-react` — Icons

#### 3. Configure Environment Variables

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""
```

> All Vite env variables must be prefixed with `VITE_` to be accessible in frontend code.

#### 4. Start the Dev Server

```bash
npm run dev
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run debug` | Dev server with verbose Vite logging |
| `npm run typecheck` | TypeScript validation (`tsc --noEmit`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |

> **Verification gates:** `npm run build` (which runs `tsc -b` over the referenced projects) must pass before committing. NOTE: `npm run typecheck` (`tsc --noEmit` on the solution-style root `tsconfig.json` with `"files": []`) currently checks an empty program and always passes — do not rely on it; fix the script or use `tsc --noEmit -p tsconfig.app.json`. `npm run lint` currently reports pre-existing warnings repo-wide.

---

## Database Schema Notes

The frontend expects the following Supabase tables:

| Table | Purpose |
|-------|---------|
| `conversations` | Messenger bot message |
| `fb_comments` | Scraped Facebook comments |
| `incident_reports` | Triaged officer queue (status: `pending`, `under_review`, `verified`, `rejected`, `resolved`) |

> The frontend subscribes to all three tables over Supabase Realtime — they must all be members of the `supabase_realtime` publication (see `supabase/migrations/20261103_add_conversations_fb_comments_to_realtime.sql` in `responde-core-api`). `incident_reports` also carries `resolved_by` / `resolved_at` attribution.

For the **Incident Reports** verification workflow, the backend should support:
- `status` enum: `pending`, `under_review`, `verified`, `rejected`, `resolved`
- Officer-editable fields: `barangay`, `type`, `urgency`, `coordinates`, `landmark`, `description`
- Auto-tracked fields: `original_text`, `source`, `reported_at`, `reporter_name`, `verified_by`, `verified_at`, `rejection_reason`

---

## UI/UX Design Notes

- **Tailwind v4** syntax: `@import tailwindcss`, `@custom-variant dark`
- **Dark mode** toggled via `ThemeContext` with `dark:` variants throughout
- **Light background gradient**: `113deg #fff → #f1f5ff → #e5ebff → #e3eaff`
- **Animation easing**: Strong ease-out `[0.23, 1, 0.32, 1]` for UI interactions; no animation on high-frequency actions (tab switching)
- **Modal pattern**: `scale(0.96)` at 250ms with backdrop blur; sections stagger in at 50ms
- **Scrollbars**: Hidden globally via CSS while preserving scroll functionality.

---

## Skeleton Loading Screens

Loading states on data-heavy pages (Dashboard, Messenger Bot Logs, Scraper Feed) use
**[boneyard-js](https://boneyard.vercel.app)** to show pixel-perfect, content-shaped shimmer skeletons
instead of a generic spinning circle. The skeletons are automatically derived from your real DOM — no
manual skeleton shapes to write or maintain.

### How it works

1. `<PageLoader variant="dashboard" loading={loading}>` wraps each page's real content.
2. When `loading=true`, boneyard renders a shimmer skeleton whose bones match the page's actual layout.
3. When `loading=false`, the skeleton cross-fades into the real content (300 ms, no layout shift).
4. The global theme (slate-100/200/800/700 palette, shimmer) is set in `main.tsx` via `configureBoneyard()`.

### Generating / refreshing bone files

Bones are captured from your running app by the CLI and committed to source control
(`src/bones/*.bones.json`). You only need to regenerate them when the **layout** of a wrapped page changes.

```bash
# 1. Install Playwright browser (one-time setup)
npx playwright install chromium

# 2. Start the dev server
npm run dev

# 3. In a second terminal, run the capture
npx boneyard-js build http://localhost:5173

# 4. Commit the generated files
git add src/bones/
git commit -m "chore: refresh boneyard skeleton bones"
```

The CLI will visit `/dashboard`, `/messenger-bot-logs`, and `/scraper-feed` at widths 375 / 768 / 1280 px
and write three `.bones.json` files. Until these files exist, the pages silently show no skeleton
(they appear blank during the loading state, then snap to content when data arrives).

> **Note:** Pages require Supabase login to render. Log in via `/login` in your browser before running
> the build step, or use the `fixture` prop on `<PageLoader>` to supply mock data for the CLI.

### Adding a new page

1. Wrap the page content: `<PageLoader variant="my-page" loading={loading}>…</PageLoader>`
2. Add `'my-page'` to the `VARIANT_NAMES` map in [`src/components/PageLoader.tsx`](src/components/PageLoader.tsx)
3. Add `'/my-page'` to the `routes` array in [`vite.config.ts`](vite.config.ts)
4. Re-run the boneyard build step above

---


<p align="center">
  <strong>RESPONDE</strong> — Real-Time Disaster Intelligence for Talisay, Batangas
</p>
