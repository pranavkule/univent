# Architecture

Beginner-friendly overview of UniVent. No code here — just the plan.

## Scope
- Public: list events, view one event.
- Students (`@ves.ac.in` only): sign up with email confirmation, sign in,
  register for an event, see confirmation and their own registrations.
- Organizations: self-register with an official college email, confirm it,
  apply for approval, then manage their own events and registrations after
  Admin approval.
- Admins: privately provisioned; review organization applications, manage
  platform events, and view registrations.
- Out of scope for now: payments, registration notifications, multi-college
  support.

## Planned AWS services (one line each)
- **S3 (+ CloudFront)** — hosts the built React site (`apps/web/dist`). Cheap static hosting.
- **API Gateway** — single API front door for the backend; routes to Lambdas; checks Cognito ID tokens on protected routes.
- **Lambda** — focused API handlers, organization application/approval logic,
  and the Cognito `preSignUp` trigger.
- **DynamoDB** — `Events`, `Registrations`, and
  `OrganizationApplications` tables. Serverless NoSQL, pay per request.
- **Cognito** — User Pool for email sign-up/sign-in; exact `@ves.ac.in` public
  sign-up; Admins grant the `organizations` group only after approval;
  frontend sends the ID token, API Gateway verifies it.
- **CloudWatch** — logs from Lambda + API Gateway; where we debug errors.

## How a request flows
```
Browser (S3)
  → API Gateway (route + optional auth check)
    → Lambda (validate input → DynamoDB read/write; Admin decisions also update
      Cognito group membership)
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
- Organization registration confirms the official college email before the
  applicant submits details. The backend stores one application per trusted
  Cognito `sub`; only Admins can list or decide applications.
- Organization event-management and registration-view requests require both
  the `organizations` group claim and a persisted `APPROVED` application.
  Rejected/suspended records deny access even when a token still has a stale
  group claim.

## Data (Phase 4)
- `Events` table: partition key `eventId`. Stores the event fields plus internal
  `registeredCount` and `registrationCounterReady`.
- `Registrations` table: partition key `eventId`, sort key `email` (one
  registration per account per event). GSI `OwnerEmailIndex`
  (`ownerEmail` + `eventId`) serves a signed-in user's registration list.
- `OrganizationApplications` table: partition key `userSub`, with application
  details and `PENDING`, `APPROVED`, `REJECTED`, or `SUSPENDED` state. No GSI
  is needed for the current small Admin review list; it currently scans this
  table.
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
