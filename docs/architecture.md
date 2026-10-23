# Architecture

Beginner-friendly overview of UniVent. No code here — just the plan.

## Scope
- Public: list events, view one event.
- Students (`@ves.ac.in` only): sign up with email confirmation, sign in,
  register for an event, see confirmation and their own registrations.
- Organizations: sign in through provisioned accounts; event management is
  still out of the current backend.
- Admins: create events, view all registrations, use the admin workspace.
- Out of scope for now: payments, registration notifications, multi-college
  support.

## Planned AWS services (one line each)
- **S3 (+ CloudFront)** — hosts the built React site (`apps/web/dist`). Cheap static hosting.
- **API Gateway** — single API front door for the backend; routes to Lambdas; checks Cognito ID tokens on protected routes.
- **Lambda** — five small functions in `backend/functions/`: `getEvents`, `createEvent`, `register`, `getRegistrations`, and the Cognito `preSignUp` trigger. Each does one job.
- **DynamoDB** — two tables: `Events` and `Registrations`. Serverless NoSQL, pay per request.
- **Cognito** — User Pool for email sign-up/sign-in; exact `@ves.ac.in` self sign-up; groups map to student/organization/admin roles; frontend sends the ID token, API Gateway verifies it.
- **CloudWatch** — logs from Lambda + API Gateway; where we debug errors.

## How a request flows
```
Browser (S3)
  → API Gateway (route + optional auth check)
    → Lambda (validate input → DynamoDB read/write)
      → JSON response back to browser
```
Example: Register button → `POST /register` with `Authorization: Bearer
<idToken>` → API Gateway validates the Cognito token → `register.js` checks the
student role and email claim → writes to `Registrations` table → returns
confirmation JSON.

## Authentication flow (Phase 5)
```
Sign-up form (@ves.ac.in)
  → Cognito User Pool → PreSignUp Lambda exact-domain check
    → email code → /confirm-signup → sign-in
      → ID token + refresh token in the Cognito SDK
        → API Gateway CognitoAuthorizer on protected routes
          → Lambda reads email / sub / cognito:groups
```
- Email-code confirmation is required; the PreSignUp trigger does not
  auto-confirm.
- `admins` group → admin, otherwise `organizations` group → organization,
  otherwise student. Admin wins if both groups are present.
- Lambda re-checks roles for defense in depth; frontend route guards are not
  authorization.
- Organization accounts can browse events but `POST /register` and
  `GET /registrations` return `403` until organization event ownership is
  implemented.

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
