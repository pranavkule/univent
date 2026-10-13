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
