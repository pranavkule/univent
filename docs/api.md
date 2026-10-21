# API

UniVent HTTP API. Implemented in Phase 3 (four Lambda handlers + API Gateway
routes defined in `infrastructure/template.yaml`).

The shapes below are the contract the Phase 2 frontend was built against, so
the frontend can be swapped from mock data to this API in Phase 6 without
changing any page or component.

## Routes
| Method | Path | Handler | Auth | Purpose |
| ------ | ---- | ------- | ---- | ------- |
| GET | `/events` | `getEvents.js` | Public | List all events |
| POST | `/events` | `createEvent.js` | Admin | Create an event |
| POST | `/register` | `register.js` | Signed-in user | Register for an event |
| GET | `/registrations?eventId=...` | `getRegistrations.js` | Signed-in user | List registrations (filter by event) |

### Access rules
- `GET /events` — public, no identity needed.
- `POST /events` — administrator only. `401` when signed out, `403` for any
  signed-in account that is not an administrator (students and organizations).
- `POST /register` — any signed-in user. The body email must match the
  signed-in account, so nobody can register somebody else's address.
- `GET /registrations` — an administrator sees every registration; any other
  signed-in user sees only their own registrations. `?eventId=` filters the
  list for everyone.

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
| `category` | string | no | e.g. `Technical`, `Cultural`, `Sports`, `Business` |
| `organizer` | string | no | organisation running the event |
| `startTime` | string | no | `HH:MM` (24-hour) |
| `endTime` | string | no | `HH:MM` (24-hour), must be after `startTime` |
| `regDeadline` | string | no | `YYYY-MM-DD`, cannot be after `date` |
| `createdAt` | string | no | ISO timestamp, set on created events |

```json
{ "eventId": "e1", "title": "Hack Night", "date": "2026-11-02", "venue": "Seminar Hall A",
  "description": "Overnight hackathon. Form a team, build something, demo at dawn.",
  "capacity": 100, "category": "Technical", "organizer": "CodeCell",
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
| `status` | string | yes | `Confirmed` (Phase 3 has a single status) |

Registration request:
```json
{ "eventId": "e1", "name": "Asha Sharma", "email": "asha@college.edu" }
```

Registration response (`201`):
```json
{ "registrationId": "reg-9e6d8027cf7b", "eventId": "e1", "name": "Asha Sharma",
  "email": "asha@college.edu", "createdAt": "2026-10-21T19:31:30.643Z", "status": "Confirmed" }
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
| `403` | signed in but not allowed (non-admin creating an event, email mismatch) |
| `404` | unknown event |
| `405` | wrong HTTP method for the route |
| `409` | duplicate registration, or the event is full |
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

## Local development identity
There is no Cognito user pool yet (Phase 5), so local testing can use these
headers:

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

## Storage (temporary)
Phase 3 stores data in memory inside the Lambda process
(`backend/functions/lib/memoryStore.js`). This is **not** persistent storage:
the data is lost when the container is recycled and it is not shared between
Lambda functions or concurrent instances. Consequently, a created event is
not visible to the separate `GET /events` function, and registrations created
by `POST /register` are not visible to `GET /registrations`. Duplicate and
capacity checks are only reliable inside a single warm `RegisterFunction`
container. DynamoDB replaces this in Phase 4 through the same storage
interface (`backend/functions/lib/store.js`).

## Run it locally
`sam local start-api` needs the SAM CLI and a running Docker daemon. To enable
development identity headers for local SAM route tests, pass a local-only
environment file (do not use it for deployment):

```json
{
  "CreateEventFunction": { "UNIVENT_DEV_AUTH": "true" },
  "RegisterFunction": { "UNIVENT_DEV_AUTH": "true" },
  "GetRegistrationsFunction": { "UNIVENT_DEV_AUTH": "true" }
}
```

Start SAM with warm containers so the temporary in-memory registration store
can retain state between requests:

```bash
sam local start-api --template-file infrastructure/template.yaml --env-vars local-env.json --warm-containers EAGER
```

For a quick local run without SAM or Docker:

```bash
UNIVENT_DEV_AUTH=true node scripts/dev-api.js   # http://localhost:3000
```

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
  "capacity": 100, "category": "Technical", "organizer": "CodeCell", "startTime": "18:00",
  "endTime": "23:59", "regDeadline": "2026-11-01" } ] }
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
  "venue": "CSE Seminar Room", "description": "", "capacity": 60, "category": "Technical",
  "organizer": "CodeCell", "startTime": "16:00", "endTime": "18:00",
  "regDeadline": "2026-12-04", "createdAt": "2026-10-21T19:31:29.729Z" }
```
Status `201`. Without an identity: `401 {"message":"Sign in to create an event."}`.
As a student: `403 {"message":"Only administrators can create events."}`.
With a missing title: `400 {"message":"Title is required."}`.

### POST /register
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -H "x-univent-role: student" -H "x-univent-email: asha@college.edu" \
  -d '{"eventId":"e1","name":"Asha Sharma","email":"asha@college.edu"}'
```
```json
{ "registrationId": "reg-9e6d8027cf7b", "eventId": "e1", "name": "Asha Sharma",
  "email": "asha@college.edu", "createdAt": "2026-10-21T19:31:30.643Z", "status": "Confirmed" }
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
| malformed JSON | `400` | `{"message":"Request body must be valid JSON."}` |

### GET /registrations
```bash
curl "http://localhost:3000/registrations?eventId=e1" \
  -H "x-univent-role: admin" -H "x-univent-email: admin@univent.demo"
```
```json
{ "registrations": [ { "registrationId": "reg-9e6d8027cf7b", "eventId": "e1",
  "name": "Asha Sharma", "email": "asha@college.edu",
  "createdAt": "2026-10-21T19:31:30.643Z", "status": "Confirmed" } ] }
```
Status `200`. Not signed in: `401`. Unknown `eventId`: `404`.

## Deferred to later phases
- DynamoDB tables and persistent storage — Phase 4.
- Cognito user pool, sign-in and the API Gateway authorizer — Phase 5.
- Organization-created events with an approval workflow (draft → pending →
  published) — later phase; `POST /events` stays admin-only for now.
- Frontend wired to this API (`services/api.js` swap) — Phase 6.
