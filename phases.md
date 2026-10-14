# UniVent — Phases

Short overview. Details live in `docs/phases/`.

| Phase | Focus | Status | Details |
| ----- | ----- | ------ | ------- |
| 1 | Repository and foundation | Completed | — |
| 2 | Frontend prototype (mock data) | Completed | `docs/phases/PHASE-02-FRONTEND.md` |
| 3 | Backend and API | Not started | `docs/phases/PHASE-03-BACKEND-API.md` |
| 4 | DynamoDB integration (Teammate 1) | Not started | `docs/phases/PHASE-04-DYNAMODB.md` |
| 5 | Cognito authentication (Teammate 2) | Not started | `docs/phases/PHASE-05-COGNITO.md` |
| 6 | Integration and security | Not started | `docs/phases/PHASE-06-INTEGRATION.md` |
| 7 | AWS deployment and monitoring | Not started | `docs/phases/PHASE-07-DEPLOYMENT.md` |
| 8 | Testing and final submission | Not started | `docs/phases/PHASE-08-TESTING.md` |

Phase 1 done: GitHub repo, base folder structure (`apps/web`, `backend/functions`, `infrastructure/template.yaml`), project plan, initial docs.
Phase 2 done: React + Vite prototype on mock data — landing page, events with search/category filters, event details, mock sign-up/sign-in, registration with validation and mock ID confirmation, participant dashboard (own registrations with statuses). Routes: `/`, `/events`, `/events/:id`, `/events/:id/register`, `/confirmation/:id`, `/signup`, `/signin`, `/dashboard`. Mock auth/data isolated in `services/` for later Cognito/API swap; organizer-wide view intentionally out of scope. `npm run build` and preview verified, no AWS yet.
Organization workspace (mock frontend, verified via `npm run build`): role-gated `/org` section for approved organization accounts (demo: `codecell@ves.ac.in`) with sidebar layout, summary cards, My Events (search + status filter, edit/submit/cancel), Create/Edit Event form (draft + submit-for-approval with validation), org-scoped Registrations, and Organization Profile (name/description editable; email/approval read-only, Admin-controlled). Mock services in `apps/web/src/services/orgEvents.js` + `organizations.js`, localStorage-backed; backend (API Gateway/Lambda/DynamoDB) and Cognito still pending.
Student + Admin interfaces (mock frontend, verified via `npm run build`): `/dashboard` is the student hub (welcome, Upcoming/My/Attended cards, upcoming events, quick links); `/registrations` lists the student's own registrations with status filter and confirm-before-cancel (upcoming events only); `/profile` shows read-only account details; `/events` gains availability filter, date sort, and per-event Registered badges; `/events/:id` and `/events/:id/register` handle full/closed/already-registered states. Role-gated `/admin` section (demo: `admin@univent.demo`) with Overview (6 platform cards, pending queues, recent activity), Organizations (approve/reject-with-reason/suspend/reactivate), Events (platform-wide approve/reject/cancel with reasons), Users (safe fields only, no passwords), and Reports (registrations by event, status distribution, audit-log placeholder). New mock services in `apps/web/src/services/admin.js`; no AWS/Cognito/DynamoDB yet.
