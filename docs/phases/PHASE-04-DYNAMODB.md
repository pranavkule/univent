# Phase 4 — DynamoDB Integration (Teammate 1)

Owner: Teammate 1. Goal: database design + connect backend to DynamoDB.

## Prerequisites
- Phase 3 handlers working with sample data.

## Steps
1. Design tables (document in `docs/architecture.md`):
   - `Events`: partition key `eventId`, attributes `title`, `date`, `venue`, `description`, `capacity`, `createdAt`.
   - `Registrations`: partition key `registrationId`, sort key or GSI on `eventId`, attributes `name`, `email`, `createdAt`.
   - Note access patterns: list events, get event, create event, register, list registrations by event.
2. Add to `infrastructure/template.yaml`:
   - Two `AWS::DynamoDB::Table` resources with pay-per-request billing.
   - Pass table names to Lambdas via `Environment.Variables`; grant `DynamoDBCrudPolicy` (least privilege per function).
3. Update handlers in `backend/functions/`:
   - Replace in-memory logic with DynamoDB SDK calls (`getEvents`, `createEvent`, `register`, `getRegistrations`).
   - Add `backend/package.json` dependency if needed (`aws-sdk` is present; use `@aws-sdk/client-dynamodb` / `lib-dynamodb` if moving to v3 — pick one and stay consistent).
   - Validate capacity/duplicates on register where applicable.
4. Test with `sam local start-api` against real tables (dev tables) or `sam build && sam deploy --guided` to a dev stack.

## Done when
- Events and registrations persist in DynamoDB across restarts.
- Table names/keys documented; no hardcoded table names in code (env vars only).
