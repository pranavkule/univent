# Phase 6 — Integration and Security

Goal: connect all modules, enforce permissions, configure error handling, verify the complete flow.

## Prerequisites
- Phases 2–5 complete (mock frontend, real API, DynamoDB, Cognito).

## Steps
1. Swap frontend seam:
   - Replace mock implementation in `apps/web/src/services/api.js` with `fetch` against the API Gateway URL (env var, e.g. `VITE_API_URL`); keep function signatures unchanged.
   - Remove `mockEvents.js` usage from pages (keep the file for reference/tests).
2. Permissions:
   - `GET /events` public; `POST /events` admin-only; `POST /register` authenticated; `GET /registrations` admin or owner-scoped.
   - Verify IAM roles in `template.yaml` grant each Lambda only what it needs (DynamoDB + CloudWatch Logs).
3. Error handling:
   - Backend: consistent `{ message, ... }` errors with correct status codes + CORS.
   - Frontend: loading/empty/error states on every page; surface backend messages; validate forms before submit.
4. End-to-end check locally:
   - `sam local start-api` + `npm run dev`; walk through: list → details → login → register → confirmation → admin view registrations.

## Done when
- Full flow works against the real API with auth on; unauthorized calls get `401/403`, bad input gets `400`.
- No mock data in the happy path; no hardcoded URLs/secrets in git.
