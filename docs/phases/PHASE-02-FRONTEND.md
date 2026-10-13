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
