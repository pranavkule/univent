# UniVent

Serverless college event registration and management system.
Built with React + Vite on the frontend and AWS serverless on the backend.
Foundation / documentation stage — no application features implemented yet.

## What it does (scope)
- Students browse college events, view details, and register.
- Admins create events and view registrations.
- Sign-in protects registration and admin actions.
- Everything runs serverless (no servers to manage).

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
5. `phases.md` + `docs/phases/` — implementation roadmap (Phase 1 done).

## Viva in 30 seconds
"UniVent is a serverless event app. The browser (S3) calls API Gateway,
which triggers Lambda functions. Lambda stores events and registrations in
DynamoDB. Cognito handles sign-in, and CloudWatch collects logs."

## Status
Phase 1 (repository and foundation) completed. Phases 2–8 not started.
See `phases.md`.
