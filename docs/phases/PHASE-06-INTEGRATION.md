# Phase 6 — Integration and Security

Goal: connect all modules, enforce permissions, configure error handling, verify the complete flow.

## Prerequisites
- Phases 2–5 complete (mock frontend, real API, DynamoDB, Cognito).

## Steps
1. Swap frontend seam:
   - Replace mock implementation in `apps/web/src/services/api.js` with `fetch` against the API Gateway URL (env var, e.g. `VITE_API_URL`); keep function signatures unchanged.
   - Merge `getAuthHeaders()` from `services/auth.js` into protected requests so the Cognito ID token is sent as `Authorization: Bearer <idToken>`.
   - Remove `mockEvents.js` usage from pages (keep the file for reference/tests).
2. Permissions:
   - `GET /events` public; `POST /events` admin-only; `POST /register` student-only;
     `GET /registrations` admin-all / student-own; organization gets `403` on the
     current backend routes.
   - Verify IAM roles in `template.yaml` grant each Lambda only what it needs (DynamoDB + CloudWatch Logs).
   - Keep frontend role guards as UX only; the API Gateway authorizer and Lambda
     role checks must remain the authority.
3. Error handling:
   - Backend: consistent `{ message, ... }` errors with correct status codes + CORS.
   - Frontend: loading/empty/error states on every page; surface backend messages; validate forms before submit.
   - Treat `401` as "sign in again" and `403` as "this account cannot do that".
4. End-to-end check locally:
   - `sam local start-api` + `npm run dev`; walk through: list → details → login → register → confirmation → admin view registrations.
   - Use the mock auth mode for UI flow checks; the Cognito authorizer itself
     requires a deployed stage for a real `401`/token check.

## Done when
- Full flow works against the real API with auth on; unauthorized calls get `401/403`, bad input gets `400`.
- No mock data in the happy path; no hardcoded URLs/secrets in git.
