# Phase 2 — Frontend Prototype (Mock Data)

Goal: build event listings, event details, registration form, and confirmation using mock data. No backend calls yet.

## Prerequisites
- Phase 1 completed.
- `apps/web` with React + Vite + `react-router-dom` (`apps/web/package.json`).
- Entry points: `apps/web/src/main.jsx`, `apps/web/src/App.jsx`.

## Steps
1. Add mock data:
   - Create `apps/web/src/services/mockEvents.js` with 6–8 events (`id`, `title`, `date`, `venue`, `description`, `capacity`).
   - Create `apps/web/src/services/api.js` that returns mock data with the same shape the real API will use (so Phase 6 can swap the implementation).
2. Routing in `App.jsx`:
   - `/` → event list, `/events/:id` → details, `/events/:id/register` → registration form, `/confirmation/:id` → confirmation.
3. Pages (`apps/web/src/pages/`):
   - `Events.jsx` — list from mock data.
   - `EventDetails.jsx` — single event by `id`.
   - `Register.jsx` — form (name, email, event id), client-side validation, stores result in memory/localStorage.
   - `Confirmation.jsx` — shows registration summary.
4. Components (`apps/web/src/components/`):
   - `EventCard.jsx`, `EventList.jsx`, `RegistrationForm.jsx`, `Navbar.jsx`.
5. Run locally:
   - `npm install` then `npm run dev` inside `apps/web`.

## Done when
- All four screens render via `npm run dev` with mock data only.
- No imports from backend; `api.js` is the single seam for later integration.

## Completed scope (polish pass)
- Routes: `/` (landing: hero, Explore Events/Sign Up CTAs, featured events,
  how-it-works), `/events` (search + category filters), `/events/:id`,
  `/events/:id/register` (sign-in required), `/confirmation/:id`,
  `/signup`, `/signin`, `/dashboard` (participant's own registrations).
- Mock auth isolated in `src/services/auth.js` (+ `AuthProvider.jsx` /
  `ProtectedRoute.jsx`); mock data in `src/services/api.js` /
  `mockEvents.js`. Both seams keep their signatures for the Phase 5
  (Cognito) / Phase 6 (real API) swap.
- Mock honesty: users/registrations live only in browser localStorage,
  passwords stored as plain text (demo-only), nothing is sent to a server.
- The earlier organizer-wide dashboard was replaced by the participant
  dashboard; organizer tooling stays out of Phase 2 scope.

## Landing redesign (same phase, no new deps)
- Light two-column hero (eyebrow, headline, dual CTAs, honest event/category
  counts) with a CSS-only visual: spotlight event card + floating chips +
  mini schedule, all rendered from the shared mock data.
- Landing shows How It Works, Why UniVent, and a closing CTA — no event
  grid or category tiles on the landing page (event list + search live
  only on `/events` via the shared `EventSearch.jsx` + `filterEvents`
  (`services/eventFilter.js`)).
- `EventCard.jsx` redesigned (category art banner, SVG date/venue/seats
  meta, line-clamped description, bottom-aligned CTA); `Navbar.jsx` has
  Home / Explore Events / My Registrations links, active states, and a
  mobile menu; `Footer.jsx` replaces the old mock-note div (note kept
  inside the footer). Skip link, landmarks, `:focus-visible` styles added.
- Branding via reusable `Logo.jsx` (`/univent-logo.png` from `apps/web/public/`,
  `object-fit: contain`, meaningful alt text) in navbar + footer, both linking
  home; text wordmark kept as fallback if the file is missing.
