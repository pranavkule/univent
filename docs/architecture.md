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

## Data (Phase 4)
- `Events` table: partition key `eventId`. Stores the event fields plus internal
  `registeredCount` and `registrationCounterReady`.
- `Registrations` table: partition key `eventId`, sort key `email` (one
  registration per account per event). GSI `OwnerEmailIndex`
  (`ownerEmail` + `eventId`) serves a signed-in user's registration list.
- Registration is one `TransactWriteItems` call: increment the event counter
  with a conditional capacity check and insert the registration. A conditional
  failure maps to duplicate, full, not-ready, or missing-event responses.
- `email` / `ownerEmail` come from the authenticated principal; `userId` stores
  the principal subject for later phases.
- Full schema, access patterns, reconciliation and IAM details:
  `docs/phases/PHASE-04-DYNAMODB.md`.

## Why serverless (viva answer)
"No servers to manage, pay-per-use, and each piece scales on its own.
SAM (`infrastructure/template.yaml`) defines all of it as code so the
stack is reproducible."
