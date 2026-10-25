# Phase 6 — Integration and Security

Status: done locally; deployment-dependent checks remain Phase 7.

Goal: connect all modules, enforce permissions, configure error handling, verify the complete flow.

## Prerequisites
- Phases 2–5 complete (mock frontend, real API, DynamoDB, Cognito).

## Steps
1. Swap frontend seam:
   - Replace mock implementation in `apps/web/src/services/api.js` with `fetch` against the API Gateway URL (env var, e.g. `VITE_API_URL`); keep function signatures unchanged.
   - Merge `getAuthHeaders()` from `services/auth.js` into protected requests so the Cognito ID token is sent as `Authorization: Bearer <idToken>`.
   - Remove `mockEvents.js` usage from pages (keep the file for reference/tests).
2. Permissions:
   - `GET /events` public; students register for events; admins manage all
     events and registrations; approved organizations manage only events
     owned by their Cognito `sub`.
   - Organization endpoints require both the `organizations` group and a
     persisted `APPROVED` application. The Lambda checks this on every request;
     React route guards are UX only.
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

## Implemented locally
- `services/api.js` selects `liveApi.js` or the browser-local mock seam with
  `VITE_API_MODE`; live mode requires `VITE_API_URL`.
- Protected calls use `getAuthHeaders()` from the existing auth facade.
- Public event reads avoid protected registration calls; student registration
  history is loaded only for student accounts.
- `GET /events` now exposes the stored `registeredCount` so availability works
  without a new route. This is response-only; storage and transactions are
  unchanged.
- Confirmation uses the created registration state and falls back to the
  signed-in student's history.
- Cancellation is mock-only until a backend route exists; the live UI hides it.
- Admin event creation uses admin-only `POST /events`.
- Organization applications, Admin review decisions, event creation/editing,
  and registration viewing use the live APIs in live mode. Mock mode retains
  browser-local demo behavior and is not production authorization or
  persistence.
- Organization application data is stored in `OrganizationApplicationsTable`;
  Admin approval/rejection/suspension updates the state and synchronizes
  Cognito group membership. Rejected/suspended records block organization API
  access even when a token has a stale group claim.
- Frontend tests use mocked HTTP for Cognito and local dev headers.
- Remaining Phase 7 checks: deploy the application table and routes, verify
  AWS Academy IAM permission for Cognito group add/remove, deployed API
  URL/CORS, Cognito authorizer `401/403`, token refresh, and live end-to-end
  application/approval verification.
