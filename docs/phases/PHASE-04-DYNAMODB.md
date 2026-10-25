# Phase 4 — DynamoDB Integration (Teammate 1)

Owner: Teammate 1. Goal: design the tables and connect the Phase 3 handlers to
DynamoDB without changing the API contract.

The original DynamoDB implementation was verified locally. The project owner
reports a deployed backend in `us-east-1`; the organization ownership changes
in the current template have not been deployed or live-tested.

## Configuration
| Variable | Purpose |
| -------- | ------- |
| `UNIVENT_STORE` | `memory` (default) or `dynamodb` |
| `EVENTS_TABLE` | Events table name |
| `REGISTRATIONS_TABLE` | Registrations table name |
| `REGISTRATIONS_OWNER_INDEX` | GSI name, default `OwnerEmailIndex` |
| `EVENTS_OWNER_INDEX` | Organization event GSI, default `OrganizationOwnerIndex` |
| `DYNAMODB_ENDPOINT` | Optional local endpoint, e.g. `http://127.0.0.1:8000` |

`backend/functions/lib/store.js` lazily loads the selected implementation.
Handlers keep calling the same store interface. The DynamoDB methods are async,
and every handler awaits each store call; the synchronous memory store works
with the same `await` expressions.

## Table design
### Events
- Partition key: `eventId` (string).
- Public fields: title, date, venue, description, capacity, category,
  organizer, startTime, endTime, regDeadline, createdAt.
- Organization-created items additionally store the internal Cognito `ownerSub`
  claim. The `OrganizationOwnerIndex` GSI uses `ownerSub` as partition key and
  `eventId` as sort key; ownerless existing items are not rewritten or indexed.
- Internal fields: `registeredCount` (number), `registrationCounterReady`
  (boolean).
- Created events start with `registeredCount = 0` and readiness `true`.

### Registrations
- Partition key: `eventId` (string).
- Sort key: `email` (string, normalized to lowercase).
- Attributes: registrationId, name, ownerEmail, userId, createdAt, status.
- GSI `OwnerEmailIndex`: partition key `ownerEmail`, sort key `eventId`,
  projection ALL.
- The composite key enforces one registration per account per event.

### Access patterns
| Need | Access |
| ---- | ------ |
| List events | Scan Events (then sort by date, eventId in the store) |
| List organization events | Query `OrganizationOwnerIndex` by trusted Cognito `sub` |
| Get event | GetItem Events by `eventId` |
| Create event | PutItem Events with counter fields and optional trusted `ownerSub` |
| Update event | Conditional UpdateItem; organization updates require matching `ownerSub` |
| Register | TransactWriteItems: conditional UpdateItem Events + conditional PutItem Registrations |
| Admin registrations | Scan Registrations, or Query by `eventId` when filtered |
| Student registrations | Query GSI `OwnerEmailIndex` by `ownerEmail` |
| Organization registrations | Query registrations by each event ID returned from `OrganizationOwnerIndex` |

Category/date filtering is still client-side; Phase 4 does not add filters to
`GET /events`.

## Registration atomicity
One transaction contains:

1. Update the event counter:
   `SET #count = if_not_exists(#count, :zero) + :one, #ready = :true`
   with the condition
   `attribute_exists(#eventId) AND (attribute_not_exists(#capacity) OR (#ready = :true AND attribute_exists(#count) AND #count < #capacity))`
2. Put the registration with
   `attribute_not_exists(#eventId) AND attribute_not_exists(#email)`.

The transaction is the sole authority for duplicate and capacity checks. The
handler only performs a precheck for event existence so an unknown event still
returns `404`.

Failure mapping:
| Condition | Result |
| --------- | ------ |
| Registration item exists | `DUPLICATE_REGISTRATION` → `409` |
| Event missing | `EVENT_NOT_FOUND` → `404` |
| Capacity reached | `EVENT_FULL` → `409` |
| Capacity event missing/false readiness or count | `EVENT_NOT_READY` → `409` |
| Unexplained conditional failure | `REGISTRATION_CONFLICT` → `500` |

Duplicate wins when both conditions fail. Retryable transaction conflicts are
retried a bounded number of times with exponential backoff.

## Identity and ownership
- `email` and `ownerEmail` are normalized from the authenticated principal.
- `userId` is the principal `sub`.
- New organization events store their `ownerSub` from the authenticated
  Cognito `sub`; client-supplied ownership fields are ignored.
- Organization update and registration-list checks are enforced by handlers
  and a conditional DynamoDB update, not React route guards.
- Body ownership fields are ignored. The body email must match the principal.
- A principal without an email is rejected with `403`.
- Students query their own registrations through the GSI; admins may scan all
  or query by event.

## IAM
Each function gets its own least-privilege role when
`LambdaExecutionRoleArn` is left at its default sentinel value:

| Function | Permissions |
| -------- | ----------- |
| GetEvents / organization event list | `dynamodb:Scan` on Events; `dynamodb:Query` on `OrganizationOwnerIndex` |
| Create/list/update events | `dynamodb:PutItem`, `GetItem`, `UpdateItem` on Events; `Query` on `OrganizationOwnerIndex` |
| Register | `dynamodb:GetItem`, `UpdateItem`, and `TransactWriteItems` on Events; `dynamodb:PutItem` and `TransactWriteItems` on Registrations |
| GetRegistrations | `dynamodb:GetItem` on Events; `dynamodb:Query` on `OrganizationOwnerIndex`, Registrations and `OwnerEmailIndex`; `dynamodb:Scan` on Registrations |

The roles attach `AWSLambdaBasicExecutionRole` for CloudWatch Logs.
`TransactWriteItems` must be allowed on both tables participating in the
transaction in addition to the regular item-level actions.

To use an existing role (for example AWS Academy `LabRole`), pass its ARN as
`LambdaExecutionRoleArn`. That role must already allow the required DynamoDB
actions, and the deploying account needs `iam:PassRole` (and `CAPABILITY_IAM`
when creating roles).

## Seeding and reconciliation
Both scripts are manual and never run from a Lambda handler.

Seed sample events idempotently (existing events are skipped; counters match
confirmed registrations at insert time):

```bash
npm --prefix backend run seed:dynamodb -- \
  --events-table <EventsTableName> --registrations-table <RegistrationsTableName>
```

Initialize missing counters and report drift:

```bash
npm --prefix backend run reconcile:dynamodb -- \
  --events-table <EventsTableName> --registrations-table <RegistrationsTableName>
```

Use the `EventsTableName` and `RegistrationsTableName` stack outputs for the
placeholders; the template lets CloudFormation generate the physical names.

Add `--dry-run` to report without writing. Existing initialized counters are
only overwritten with `--force`; pause registration writes first. The forced
update is conditioned on the observed counter and readiness so a concurrent
change is not silently overwritten.

Both scripts accept `--endpoint http://127.0.0.1:8000` and use dummy
credentials when an endpoint is supplied. Without an endpoint they use the
normal AWS credential chain.

## Local verification
Install the SDK dependencies once (SAM build also does this automatically):

```bash
npm --prefix backend/functions install
```

Unit tests (memory handlers + DynamoDB store with a fake client):

```bash
npm --prefix backend test
```

DynamoDB Local integration tests (DynamoDB Local on port 8000):

```bash
docker run --rm -d --name univent-dynamodb-local -p 8000:8000 amazon/dynamodb-local
npm --prefix backend run test:integration
docker stop univent-dynamodb-local
```

The integration suite creates unique tables, uses dummy credentials, and
checks concurrent capacity, concurrent duplicates, fail-closed unready
counters, the owner GSI, idempotent seeding, missing-counter initialization,
uncapped events, forced counter repair, and all four handlers through the
env-selected DynamoDB store. It fails on setup errors and only skips when the
local endpoint is unreachable.

For `sam local start-api` against DynamoDB Local, set the table names,
`DYNAMODB_ENDPOINT`, `AWS_REGION`, and dummy `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` values in the local environment. Do not use those
local credentials or identity settings in a deployment.

SAM validation and build:

```bash
sam validate --lint --template-file infrastructure/template.yaml
sam build --template-file infrastructure/template.yaml
```

On Windows, the default `.aws-sam` path can exceed the legacy path limit while
copying SDK type files. Use a short build directory:

```powershell
sam build --template-file infrastructure/template.yaml --build-dir C:\Users\<you>\AppData\Local\Temp\ubuild
```

## Limitations / follow-ups
- List-all-events and admin list-all-registrations use Scan; acceptable for the
  mini-project scale. Revisit with projections or a different key design if the
  dataset grows.
- The owner GSI is eventually consistent.
- Organization registration listing performs one registrations query per
  owned event because registrations have no event-owner GSI. This is adequate
  at mini-project scale but may need a denormalized index for organizations
  with many events.
- Existing seeded/admin events have no trusted `ownerSub`; do not assign them
  automatically by matching the `organizer` display field. They remain
  Admin-managed unless an explicit reviewed ownership migration is designed.
- Reconcile/seed scripts require table names or environment variables.
- The supplied-role path cannot enforce least privilege; it depends on the
  permissions of the provided role.
- A transaction is not given an explicit `ClientRequestToken`. A network
  failure after a successful commit can surface as `500`; a later client retry
  may then receive `409` duplicate even though the original registration exists.
