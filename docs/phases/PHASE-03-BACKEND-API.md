# Phase 3 — Backend and API

Goal: implement Lambda handlers and API Gateway routes; test endpoints before frontend integration.

## Prerequisites
- `backend/functions/` stubs: `getEvents.js`, `createEvent.js`, `register.js`, `getRegistrations.js`.
- `backend/package.json` (Node.js CommonJS).
- `infrastructure/template.yaml` (SAM, `nodejs20.x`).

## Steps
1. Define routes (in `infrastructure/template.yaml`):
   - `GET /events` → `getEvents.js`
   - `POST /events` → `createEvent.js`
   - `POST /register` → `register.js`
   - `GET /registrations` → `getRegistrations.js`
2. Implement handlers:
   - `getEvents.js` — return event list (in-memory/sample first).
   - `createEvent.js` — validate body (`title`, `date`, `venue`), return `201` + created object.
   - `register.js` — validate body (`eventId`, `name`, `email`), return `201` + registration.
   - `getRegistrations.js` — support `?eventId=` filter.
   - Consistent JSON shape + CORS headers on every response; `400` on bad input, `404` where relevant.
3. Test locally before wiring the frontend:
   - `sam build` / `sam local start-api` from repo root (or `infrastructure/` depending on template path).
   - Exercise each route with curl/Postman; record sample requests in `docs/api.md`.

## Done when
- All four routes defined in `template.yaml` and invokable via `sam local start-api`.
- `docs/api.md` documents method, path, request/response examples.
- No frontend changes in this phase.
