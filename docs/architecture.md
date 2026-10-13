# Architecture

Beginner-friendly overview of UniVent. No code here — just the plan.

## Scope
- Public: list events, view one event.
- Signed-in users: register for an event, see confirmation.
- Admins: create events, view registrations per event.
- Out of scope for now: payments, email/SMS notifications, multi-college support.

## Planned AWS services (one line each)
- **S3 (+ CloudFront)** — hosts the built React site (`apps/web/dist`). Cheap static hosting.
- **API Gateway** — single HTTP front door for the backend; routes to Lambdas; checks Cognito tokens.
- **Lambda** — four small functions in `backend/functions/`: `getEvents`, `createEvent`, `register`, `getRegistrations`. Each does one job.
- **DynamoDB** — two tables: `Events` and `Registrations`. Serverless NoSQL, pay per request.
- **Cognito** — User Pool for sign-up/sign-in; frontend sends the ID token, API Gateway verifies it.
- **CloudWatch** — logs from Lambda + API Gateway; where we debug errors.

## How a request flows
```
Browser (S3)
  → API Gateway (route + optional auth check)
    → Lambda (validate input → DynamoDB read/write)
      → JSON response back to browser
```
Example: Register button → `POST /register` → `register.js` → writes to
`Registrations` table → returns confirmation JSON.

## Data sketch
- Event: `eventId`, `title`, `date`, `venue`, `description`, `capacity`, `createdAt`.
- Registration: `registrationId`, `eventId`, `name`, `email`, `createdAt`.
- Tables and keys are finalized in Phase 4 (`docs/phases/PHASE-04-DYNAMODB.md`).

## Why serverless (viva answer)
"No servers to manage, pay-per-use, and each piece scales on its own.
SAM (`infrastructure/template.yaml`) defines all of it as code so the
stack is reproducible."
