# API

UniVent REST API. DynamoDB storage and Cognito authorization are defined in
`infrastructure/template.yaml`.

The frontend uses this authenticated API contract; there is no browser-local
mock API or identity-header authentication path.

## Routes
| Method | Path | Handler | Auth | Purpose |
| ------ | ---- | ------- | ---- | ------- |
| GET | `/events` | `getEvents.js` | Public | List all public events |
| POST | `/events` | `createEvent.js` | Admin / approved Organization | Create an event |
| GET | `/organization/events` | `getOrganizationEvents.js` | Approved Organization (own) / Admin (all) | List organization-owned events |
| PUT | `/events/{eventId}` | `updateEvent.js` | Approved Organization (own) / Admin (all) | Update an event |
| POST | `/register` | `register.js` | Student | Register for an event |
| GET | `/registrations?eventId=...` | `getRegistrations.js` | Student (own) / approved Organization (own events) / Admin (all) | List registrations (optionally filter by event) |
| GET | `/organization-applications` | `organizationApplications.js` | Approved Organization (own) / Admin (all) | Read application status or list applications |
| POST | `/organization-applications` | `organizationApplications.js` | Public, throttled | Submit an organization application without creating a Cognito user |
| PATCH | `/admin/organization-applications/{applicationId}` | `organizationApplications.js` | Admin | Approve, reject, suspend, or reactivate |

### Access rules
- `GET /events` — public, no identity needed.
- `POST /events` — administrators and organizations with both an
  `organizations` Cognito group claim and a persisted `APPROVED` application
  may create events. Organization ownership is saved from the verified
  Cognito `sub` claim; request-body owner fields are ignored. New organization
  events are published immediately.
- `GET /organization/events` — an approved organization sees only events
  indexed to its verified Cognito `sub`; administrators see all events.
  Students and pending, rejected, or suspended organizations receive `403`.
- `PUT /events/{eventId}` — administrators may update any event; an approved
  organization may update only an event whose stored `ownerSub` matches its
  verified Cognito `sub`. Other organizations receive `403`. Capacity cannot
  be reduced below the stored confirmed-registration counter (`409`).
- `POST /register` — students only. Organizations and administrators receive
  `403`. The body email must match the signed-in account. Ownership (`email`,
  `ownerEmail`, `userId`) is taken from the authenticated principal, never
  from body fields. Organization approval never adds an organization role to
  an existing student Cognito account.
- `GET /registrations` — an administrator sees every registration; a student
  sees only their own registrations; an approved organization sees
  registrations for its own events only. An organization filtering by another
  event receives `403`. Accounts with an organization application cannot use
  the Student registration-list path. `?eventId=` filters the list for each
  allowed role.
- `GET /organization-applications` — an approved organization sees its own
  application; an Admin sees current applications and retained legacy history.
- `POST /organization-applications` — public and rate-limited at API Gateway.
  The backend validates every field and exact `@ves.ac.in` official
  organization email, normalizes email casing, rejects unknown keys (including
  role/status/approval fields), generates the application UUID, and stores the
  record as `PENDING_APPROVAL`. No Cognito API is called on submission. The
  selected password is encrypted with KMS and stored separately from
  application history with a 30-day TTL; plaintext is never persisted. A
  transactionally maintained lock prevents duplicate applications for the
  same normalized official email.
- `PATCH /admin/organization-applications/{applicationId}` — both API Gateway
  and the Lambda require the `admins` group. `APPROVE` provisions a distinct
  Cognito account in the existing pool using the official organization email,
  marks that admin-approved address verified, sets the submitted password,
  and suppresses Cognito email delivery. It then conditionally persists
  `APPROVED`, grants the `organizations` group, and enables the account.
  Approval is idempotent and only reuses a Cognito account bound to the same
  application. `REJECT` preserves the history and deletes the encrypted
  password. `SUSPEND` and `REACTIVATE` synchronize account state and group
  membership. Organization API calls require both the group claim and a
  persisted, non-legacy approved application bound to the same Cognito `sub`.
  Historical `PENDING_VERIFICATION` records remain admin-visible but cannot
  grant access through the new workflow.

### Organization event ownership and lifecycle

New organization-owned event records store `ownerSub`, taken only from the
Cognito authorizer claim. The field is not returned by the API. The
`OrganizationOwnerIndex` GSI on the Events table lists those records. Existing
seeded/admin events do not have `ownerSub`; they remain unchanged and
Admin-managed, and are not retroactively assigned to an organization based on
the display-only `organizer` field.
`ownerSub` identifies a Cognito user, so each organization Cognito account is
an independent owner. This setup does not yet provide a shared organization ID
for multiple representatives to manage the same events.

The live organization workflow supports create, list, edit, and viewing
registrations for owned events. Creating publishes the event immediately.
There is no event cancellation, moderation/approval workflow, or organization
profile management in this API.

### Organization applications

Organization signup at `/org/signup` collects the official organization
email, contact details, and a separately selected password without creating a
Cognito account or requiring email OTP. The existing
`OrganizationApplicationsTable` is retained for legacy records; new
applications use the UUID-keyed `PublicOrganizationApplicationsTable` and
`OrganizationApplicationLocksTable`. The lock key is a SHA-256 digest of the
normalized official email.

Submission body:

```json
{
  "organizationName": "Robotics Club",
  "applicantName": "Aarav Mehta",
  "officialEmail": "robotics@ves.ac.in",
  "department": "Engineering",
  "representativeTitle": "Secretary",
  "representativePhone": "+1 555 010 1234",
  "reason": "Manage events and registrations for the club.",
  "password": "<selected password>"
}
```

The confirmation password is validated by the frontend and is not sent to the
API. The success response contains only the generated application ID and
`PENDING_APPROVAL` status (`201`). Pending and rejected applications have no
Cognito account and cannot log in. An Admin GET returns
`{ "applications": [...] }`, including legacy history. Admin action bodies
return the saved application with `200`:

```json
{ "action": "APPROVE" }
{ "action": "REJECT", "reason": "Please update the organization details." }
{ "action": "SUSPEND", "reason": "..." }
{ "action": "REACTIVATE" }
```

A duplicate pending submission or conflicting status transition returns `409`.

Only an Admin can list all applications or decide them. A group is granted only
after the Admin approves. If Cognito group removal fails after a rejection or
suspension, the API reports `502`; the saved status still blocks organization
endpoints, and repeating the decision retries group cleanup. Approval requires
the Lambda execution role to have `cognito-idp:AdminAddUserToGroup`; rejection
and suspension require `cognito-idp:AdminRemoveUserFromGroup`.

Admin listing scans the application tables, which is suitable for the current
small project but should become paginated before application volume grows.
The applicant client and its PostConfirmation classification remain for
in-flight legacy confirmations; new organization signup uses the primary
client only after admin approval. The PostConfirmation trigger remains
necessary for student classification.

### Response envelopes
Reads return a JSON object with one key:

```json
{ "events": [ { "eventId": "e1", "...": "..." } ] }
{ "registrations": [ { "registrationId": "reg-9e6d8027cf7b", "...": "..." } ] }
```

Creates return the created object directly (`201`).

## Event shape
| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `eventId` | string | yes | `evt-<12 hex>` for created events, `e1`…`e7` for the sample data |
| `title` | string | yes | 3–120 characters |
| `date` | string | yes | `YYYY-MM-DD`, must be a real date |
| `venue` | string | yes | 2–120 characters |
| `description` | string | no | up to 2000 characters |
| `capacity` | number | no | whole number 1–5000, defaults to `100` |
| `registeredCount` | number \| null | no | confirmed registrations; `null` when the stored counter is unavailable |
| `category` | string | no | e.g. `Technical`, `Cultural`, `Sports`, `Business` |
| `organizer` | string | no | organisation running the event |
| `startTime` | string | no | `HH:MM` (24-hour) |
| `endTime` | string | no | `HH:MM` (24-hour), must be after `startTime` |
| `regDeadline` | string | no | `YYYY-MM-DD`, cannot be after `date` |
| `createdAt` | string | no | ISO timestamp, set on created events |

```json
{ "eventId": "e1", "title": "Hack Night", "date": "2026-11-02", "venue": "Seminar Hall A",
  "description": "Overnight hackathon. Form a team, build something, demo at dawn.",
  "capacity": 100, "registeredCount": 0, "category": "Technical", "organizer": "CodeCell",
  "startTime": "18:00", "endTime": "23:59", "regDeadline": "2026-11-01" }
```

## Registration shape
| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `registrationId` | string | yes | `reg-<12 hex>` |
| `eventId` | string | yes | must exist, otherwise `404` |
| `name` | string | yes | 2–100 characters |
| `email` | string | yes | must match the signed-in account |
| `createdAt` | string | yes | ISO timestamp |
| `status` | string | yes | `Confirmed` (single status for now) |

Stored records also keep `ownerEmail` (normalized principal email) and `userId`
(principal `sub`) for ownership checks; neither internal field is returned.

Registration request:
```json
{ "eventId": "e1", "name": "Asha Sharma", "email": "asha@ves.ac.in" }
```

Registration response (`201`):
```json
{ "registrationId": "reg-9e6d8027cf7b", "eventId": "e1", "name": "Asha Sharma",
  "email": "asha@ves.ac.in", "createdAt": "2026-10-21T19:31:30.643Z", "status": "Confirmed" }
```

## Errors
Every error is JSON with a single `message` field:
```json
{ "message": "Email is required" }
```

## Status codes
| Code | Meaning |
| ---- | ------- |
| `200` | read succeeded |
| `201` | created |
| `400` | bad input (missing/invalid field, malformed JSON, empty `eventId`) |
| `401` | not signed in |
| `403` | signed in but not allowed (role restriction, cross-organization event access, email mismatch) |
| `404` | unknown event |
| `405` | wrong HTTP method for the route |
| `409` | duplicate registration/application, conflicting application decision, event full/counter not ready, or capacity reduction below current registrations |
| `502` | Cognito group grant/removal failed during an Admin decision |
| `500` | unexpected server error |

## CORS
Every response (including errors) carries CORS headers, so the S3-hosted site
can call the API:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,OPTIONS
Access-Control-Max-Age: 600
```
The origin comes from the `CORS_ORIGIN` environment variable (default `*`).
Phase 7 pins it to the deployed S3/CloudFront origin.

## Cognito identity
The protected routes use an API Gateway `CognitoAuthorizer`. The frontend sends
the **ID token** (not the access token) so the authorizer can pass `email`,
`name`, and `cognito:groups` to the handlers:

```http
Authorization: Bearer <idToken>
```

Role mapping is additive with admin precedence:
- group `admins` → `admin`;
- otherwise group `organizations` → `organization`;
- otherwise → `student`.

API Gateway rejects a missing/invalid/expired token with `401` before Lambda
runs. Lambda returns `403` when the authenticated role is not allowed to do the
action. The frontend role guards are UX only.

## Local development
The plain Node server exposes only public `GET /events`. It does not simulate
an authenticated identity. Protected routes must be tested through API Gateway
with a valid Cognito ID token; caller-supplied role headers are never trusted.

## Storage
`UNIVENT_STORE` selects the implementation behind
`backend/functions/lib/store.js`:

- `memory` (default) — seeded in-process store used by unit tests and the
  local public events endpoint. Not persistent or shared between Lambda
  instances.
- `dynamodb` — the deployed mode. Reads/writes the `Events`,
  `Registrations`, and `OrganizationApplications` tables. Registration is
  atomic via `TransactWriteItems`; duplicate and capacity checks are enforced
  by conditions, not prechecks.

The deployed SAM template sets `UNIVENT_STORE=dynamodb`, table names,
`OwnerEmailIndex`, and `OrganizationOwnerIndex`. The latter is a sparse GSI:
only records written with `ownerSub` appear in it. Adding the index does not
rewrite existing items. Table keys and operational details are in
`docs/phases/PHASE-04-DYNAMODB.md`.

Organization representatives apply through the live API after confirming and
signing in to their Cognito account. Admins review applications in the
frontend and decide through the Admin-only API. The group claim and persisted
application status are both required for organization access. Admin accounts
are provisioned privately; see `docs/aws-setup.md`.

## Run it locally
`sam local start-api` needs the SAM CLI and a running Docker daemon. The
template now points Lambda at DynamoDB, so a local SAM run needs either real
dev tables or DynamoDB Local plus local-only environment overrides (table names,
`DYNAMODB_ENDPOINT`, `AWS_REGION`, and dummy `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` values). Do not use dummy credential settings in a
deployment.

For a quick local run without SAM, Docker, or AWS:

```bash
node scripts/dev-api.js   # http://localhost:3000; public GET /events only
```

This serves seeded in-memory events and requires no DynamoDB credentials.
Authenticated routes require API Gateway and Cognito.

## API request and response examples

The local server supports only the public `GET /events` example below.
Protected examples require `API_URL` for the deployed API and a valid Cognito
ID token in `ID_TOKEN`.

### GET /events (public)
```bash
curl -i http://localhost:3000/events
```
```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,OPTIONS
Access-Control-Max-Age: 600
```
```json
{ "events": [ { "eventId": "e1", "title": "Hack Night", "date": "2026-11-02",
  "venue": "Seminar Hall A", "description": "Overnight hackathon. Form a team, build something, demo at dawn.",
  "capacity": 100, "registeredCount": 0, "category": "Technical", "organizer": "CodeCell",
  "startTime": "18:00", "endTime": "23:59", "regDeadline": "2026-11-01" } ] }
```

### POST /events (admin or organization)
```bash
curl -X POST "$API_URL/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"title":"Serverless Meetup","date":"2026-12-05","venue":"CSE Seminar Room","capacity":60,"category":"Technical","organizer":"CodeCell","startTime":"16:00","endTime":"18:00","regDeadline":"2026-12-04"}'
```
```json
{ "eventId": "evt-c76efc09260d", "title": "Serverless Meetup", "date": "2026-12-05",
  "venue": "CSE Seminar Room", "description": "", "capacity": 60, "registeredCount": 0,
  "category": "Technical", "organizer": "CodeCell", "startTime": "16:00", "endTime": "18:00",
  "regDeadline": "2026-12-04", "createdAt": "2026-10-21T19:31:29.729Z" }
```
Status `201`. Without an identity: `401 {"message":"Sign in to create an event."}`.
As a student: `403`. Organization ownership comes from Cognito, not the body.
With a missing title: `400 {"message":"Title is required."}`.

### POST /register
```bash
curl -X POST "$API_URL/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"eventId":"e1","name":"Asha Sharma","email":"asha@ves.ac.in"}'
```
```json
{ "registrationId": "reg-9e6d8027cf7b", "eventId": "e1", "name": "Asha Sharma",
  "email": "asha@ves.ac.in", "createdAt": "2026-10-21T19:31:30.643Z", "status": "Confirmed" }
```
Status `201`. Other outcomes:

| Case | Status | Body |
| ---- | ------ | ---- |
| not signed in | `401` | `{"message":"Sign in to register for an event."}` |
| missing email | `400` | `{"message":"Email is required."}` |
| invalid email | `400` | `{"message":"Email must be a valid email address."}` |
| unknown event | `404` | `{"message":"Event not found."}` |
| email of another account | `403` | `{"message":"Email must match the signed-in account."}` |
| already registered | `409` | `{"message":"This email is already registered for the event."}` |
| event full | `409` | `{"message":"This event is full."}` |
| counter not ready | `409` | `{"message":"This event is not ready for registration."}` |
| malformed JSON | `400` | `{"message":"Request body must be valid JSON."}` |

### GET /registrations
```bash
curl "$API_URL/registrations?eventId=e1" \
  -H "Authorization: Bearer $ID_TOKEN"
```
```json
{ "registrations": [ { "registrationId": "reg-9e6d8027cf7b", "eventId": "e1",
  "name": "Asha Sharma", "email": "asha@ves.ac.in",
  "createdAt": "2026-10-21T19:31:30.643Z", "status": "Confirmed" } ] }
```
Status `200`. Not signed in: `401`. Unknown `eventId`: `404`.

## Deferred to later phases
- AWS deployment of the application table, routes, Cognito group permissions,
  and IAM roles — Phase 7.
- Organization-created event draft/moderation/publish workflow. Approved
  organizations can create events, which publish immediately.
- Registration cancellation and individual registration lookup routes.
- Deployed live API/Cognito verification — Phase 7. Phase 6 wires the frontend
  to this API and sends the Cognito ID token.
