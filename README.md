# UniVent

Serverless college event registration and management system.
Built with React + Vite on the frontend and AWS serverless on the backend.
Phase 2 frontend prototype done (mock data + mock sign-in in the browser only).

## What it does (scope)
- Students browse college events, view details, and register (mock sign-in required).
- Participants view and cancel their own mock registrations on a dashboard.
- Everything runs on browser-local mock data for now; real backend (API Gateway,
  Lambda, DynamoDB) and real sign-in (Cognito) come in later phases.

## Tech stack
- Frontend: React + Vite (`apps/web`)
- Backend: AWS Lambda handlers (`backend/functions`)
- API: Amazon API Gateway (planned)
- Database: Amazon DynamoDB (planned)
- Auth: Amazon Cognito (planned)
- Hosting: Amazon S3 (+ CloudFront) for the frontend (planned)
- Monitoring: Amazon CloudWatch (planned)
- Infra as code: AWS SAM (`infrastructure/template.yaml`)

## Repo layout
```
apps/web/               # React + Vite frontend (src: components, pages, services)
backend/functions/      # Lambda handlers (getEvents, createEvent, register, getRegistrations)
infrastructure/         # template.yaml — SAM resource definitions
docs/                   # architecture, api, aws-setup, testing, phases/, screenshots/
scripts/                # helper scripts
phases.md               # short phase overview
```

## Docs (read in this order)
1. `docs/architecture.md` — scope, services, how a request flows.
2. `docs/api.md` — planned endpoints and data shapes.
3. `docs/aws-setup.md` — what to create in AWS and in which order.
4. `docs/testing.md` — how we will test it.
5. `phases.md` + `docs/phases/` — implementation roadmap (Phases 1–2 done).

## Run the frontend (Phase 2, mock data)
```bash
cd apps/web
npm install
npm run dev      # http://localhost:5173
```
Routes: `/` landing, `/events`, `/events/:id`, `/events/:id/register`
(sign-in required), `/confirmation/:id`, `/signup`, `/signin`, `/dashboard`.
`npm run build` + `npm run preview` verified. Mock users/registrations live
only in this browser's localStorage — temporary prototype storage, not a
backend. No test suite exists yet; the production build is the current check.

## Viva in 30 seconds
"UniVent is a serverless event app. The browser (S3) calls API Gateway,
which triggers Lambda functions. Lambda stores events and registrations in
DynamoDB. Cognito handles sign-in, and CloudWatch collects logs."

## Status
Phases 1–2 completed (foundation + mock-data frontend). Phases 3–8 not started.
See `phases.md`.
