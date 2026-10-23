# API

UniVent REST API. Implemented in Phase 3 (four Lambda handlers + API Gateway
routes), backed by DynamoDB in Phase 4, and protected by Cognito in Phase 5;
resources are defined in `infrastructure/template.yaml`.

The shapes below are the contract the Phase 2 frontend was built against, so
the frontend can be swapped from mock data to this API in Phase 6 without
changing any page or component.

## Routes
| Method | Path | Handler | Auth | Purpose |
| ------ | ---- | ------- | ---- | ------- |
| GET | `/events` | `getEvents.js` | Public | List all events |
| POST | `/events` | `createEvent.js` | Admin | Create an event |
| POST | `/register` | `register.js` | Student | Register for an event |
| GET | `/registrations?eventId=...` | `getRegistrations.js` | Student (own) / Admin (all) | List registrations (filter by event) |

### Access rules
- `GET /events` — public, no identity needed.
- `POST /events` — administrator only. `401` when signed out, `403` for any
  signed-in account that is not an administrator (students and organizations).
- `POST /register` — students only. Organizations and administrators receive
  `403`. The body email must match the signed-in account. Ownership (`email`,
  `ownerEmail`, `userId`) is taken from the authenticated principal, never
  from body fields.
- `GET /registrations` — an administrator sees every registration; a student
  sees only their own registrations; an organization receives `403`.
  `?eventId=` filters the list for administrators and students.

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
| `403` | signed in but not allowed (non-admin creating an event, non-student registering, organization listing registrations, email mismatch) |
| `404` | unknown event |
| `405` | wrong HTTP method for the route |
| `409` | duplicate registration, event full, or event counter not ready |
| `500` | unexpected server error |

## CORS
Every response (including errors) carries CORS headers, so the S3-hosted site
can call the API:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Allow-Methods: GET,POST,OPTIONS
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

## Local development identity
Without Cognito, local testing can use these headers:

| Header | Example | Meaning |
| ------ | ------- | ------- |
| `x-univent-role` | `admin` / `student` / `organization` | role of the caller |
| `x-univent-email` | `admin@univent.demo` | email of the caller |
| `x-univent-name` | `Demo Admin` | display name of the caller |
| `x-univent-sub` | `local-user-1` | optional user id |

They are honoured **only** when `UNIVENT_DEV_AUTH=true` and the code is
running outside AWS Lambda or inside SAM local (`AWS_SAM_LOCAL=true`). In a
deployed Lambda, `AWS_EXECUTION_ENV` is set and `AWS_SAM_LOCAL` is absent, so
client-supplied roles are ignored. The deployed template sets
`UNIVENT_DEV_AUTH=false`.

When the API runs with a Cognito authorizer (Phase 5), the identity is taken
from the authorizer claims instead and the headers are not used.

## Storage
`UNIVENT_STORE` selects the implementation behind
`backend/functions/lib/store.js`:

- `memory` (default) — seeded in-process store used by unit tests and the quick
  local server. Not persistent and not shared between Lambda instances.
- `dynamodb` — the deployed mode. Reads/writes the `Events` and
  `Registrations` tables. Registration is atomic via `TransactWriteItems`;
  duplicate and capacity checks are enforced by conditions, not prechecks.

The deployed SAM template sets `UNIVENT_STORE=dynamodb`, table names and the
`OwnerEmailIndex` name. Table keys and operational details are in
`docs/phases/PHASE-04-DYNAMODB.md`.

## Run it locally
`sam local start-api` needs the SAM CLI and a running Docker daemon. The
template now points Lambda at DynamoDB, so a local SAM run needs either real
dev tables or DynamoDB Local plus local-only environment overrides (table names,
`DYNAMODB_ENDPOINT`, `AWS_REGION`, and dummy `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` values). Do not use local identity or dummy credential
settings in a deployment.

For a quick local run without SAM, Docker, or AWS:

```bash
UNIVENT_DEV_AUTH=true node scripts/dev-api.js   # http://localhost:3000
```

This uses the seeded in-memory store and requires no DynamoDB credentials.

## Sample requests and responses (captured from the local server)

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
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Max-Age: 600
```
```json
{ "events": [ { "eventId": "e1", "title": "Hack Night", "date": "2026-11-02",
  "venue": "Seminar Hall A", "description": "Overnight hackathon. Form a team, build something, demo at dawn.",
  "capacity": 100, "registeredCount": 0, "category": "Technical", "organizer": "CodeCell",
  "startTime": "18:00", "endTime": "23:59", "regDeadline": "2026-11-01" } ] }
```

### POST /events (admin)
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "x-univent-role: admin" -H "x-univent-email: admin@univent.demo" \
  -d '{"title":"Serverless Meetup","date":"2026-12-05","venue":"CSE Seminar Room","capacity":60,"category":"Technical","organizer":"CodeCell","startTime":"16:00","endTime":"18:00","regDeadline":"2026-12-04"}'
```
```json
{ "eventId": "evt-c76efc09260d", "title": "Serverless Meetup", "date": "2026-12-05",
  "venue": "CSE Seminar Room", "description": "", "capacity": 60, "registeredCount": 0,
  "category": "Technical", "organizer": "CodeCell", "startTime": "16:00", "endTime": "18:00",
  "regDeadline": "2026-12-04", "createdAt": "2026-10-21T19:31:29.729Z" }
```
Status `201`. Without an identity: `401 {"message":"Sign in to create an event."}`.
As a student: `403 {"message":"Only administrators can create events."}`.
With a missing title: `400 {"message":"Title is required."}`.

### POST /register
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -H "x-univent-role: student" -H "x-univent-email: asha@ves.ac.in" \
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
curl "http://localhost:3000/registrations?eventId=e1" \
  -H "x-univent-role: admin" -H "x-univent-email: admin@univent.demo"
```
```json
{ "registrations": [ { "registrationId": "reg-9e6d8027cf7b", "eventId": "e1",
  "name": "Asha Sharma", "email": "asha@ves.ac.in",
  "createdAt": "2026-10-21T19:31:30.643Z", "status": "Confirmed" } ] }
```
Status `200`. Not signed in: `401`. Unknown `eventId`: `404`.

## Deferred to later phases
- AWS deployment of the Phase 4 tables, Phase 5 Cognito resources, and IAM
  roles — Phase 7.
- Organization-created events with an approval workflow (draft → pending →
  published) — later phase; `POST /events` stays admin-only and organization
  access to registration data is `403` for now.
- Registration cancellation and individual registration lookup routes.
- Deployed live API/Cognito verification — Phase 7. Phase 6 wires the frontend
  to this API and sends the Cognito ID token; mock mode remains available.
