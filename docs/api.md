# API

Planned endpoints. Shapes are frozen so the frontend (Phase 2) can use
mock data with the same format before the backend exists.

## Routes
| Method | Path | Handler | Auth | Purpose |
| ------ | ---- | ------- | ---- | ------- |
| GET | /events | `getEvents.js` | Public | List all events |
| POST | /events | `createEvent.js` | Admin | Create an event |
| POST | /register | `register.js` | Signed-in user | Register for an event |
| GET | /registrations?eventId=... | `getRegistrations.js` | Admin | List registrations (filter by event) |

## Shapes (examples)
Event:
```json
{ "eventId": "e1", "title": "Hack Night", "date": "2026-11-02", "venue": "Seminar Hall", "description": "Build overnight.", "capacity": 100 }
```

Registration request:
```json
{ "eventId": "e1", "name": "Asha", "email": "asha@college.edu" }
```

Registration response (`201`):
```json
{ "registrationId": "r9", "eventId": "e1", "name": "Asha", "email": "asha@college.edu" }
```

Error (always JSON):
```json
{ "message": "Email is required" }
```

## Status codes
- `200` reads, `201` creates, `400` bad input, `401` not signed in,
  `403` not allowed (e.g. non-admin creating events), `404` unknown event.

## Notes
- Every response includes CORS headers so the S3-hosted site can call the API.
- Full handler-by-handler steps: `docs/phases/PHASE-03-BACKEND-API.md`.
