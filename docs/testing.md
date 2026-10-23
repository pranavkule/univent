# Testing

How we verify UniVent. Manual first, in this order.

## 1. Frontend (Phase 2, mock data)
- `npm run dev` in `apps/web`; walk landing → events (search + category
  filter) → details → sign-up → sign-in → register → confirmation → dashboard.
- Check validation feedback (short name, bad email, short password, wrong
  credentials, duplicate registration) and loading/empty/error states.
- `npm run build` must succeed (no test suite exists yet; build is the check).

## 2. Backend (Phase 3, `sam local start-api`)
- Each route with curl/Postman: happy path + bad input
  (missing email, unknown event) → expect `400`/`404` with JSON message.
- The quick memory-mode server needs no AWS:
  `UNIVENT_DEV_AUTH=true node scripts/dev-api.js`.

## 3. Backend storage (Phase 4)
Verified locally on 2026-10-23:

| Check | Command | Result |
| ----- | ------- | ------ |
| Install backend dependencies | `npm --prefix backend/functions install` | once per clone |
| Handler + DynamoDB store unit tests | `npm --prefix backend test` | 48/48 pass |
| DynamoDB Local integration | `npm --prefix backend run test:integration` | 9/9 pass, 0 skipped |
| SAM template lint | `sam validate --lint --template-file infrastructure/template.yaml` | valid |
| SAM build | `sam build --template-file infrastructure/template.yaml --build-dir <short path>` | succeeds |
| Frontend build | `npm --prefix apps/web run build` | passes (78 modules) |

The integration suite starts from Docker:

```bash
docker run --rm -d --name univent-dynamodb-local -p 8000:8000 amazon/dynamodb-local
npm --prefix backend run test:integration
docker stop univent-dynamodb-local
```

The suite fails on setup errors and only skips when the local endpoint is
unreachable. A passing run must report `0 skipped`.

Covered cases:
- concurrent registrations never exceed capacity;
- concurrent duplicate registrations create exactly one row;
- missing/false counter readiness fails closed with `409`;
- a student's registrations come from the `OwnerEmailIndex` GSI;
- sample seeding is idempotent;
- initialization repairs a missing counter so registrations resume;
- uncapped events increment their initialized counter;
- drift is only repaired with `--force`;
- all four handlers use the env-selected DynamoDB store and await it.

Windows note: if `sam build` hits the path-length error while copying SDK
types, pass a short `--build-dir` such as
`C:\Users\<you>\AppData\Local\Temp\ubuild`.

## 4. Auth (Phase 5–6)
- Signed-out user hitting protected pages → redirected to login.
- Non-admin calling `POST /events` → `403`.
- Registering with an email other than the signed-in account → `403`.

## 5. End-to-end (Phase 6–8)
- List → details → login → register → confirmation → admin registrations,
  first locally then against the deployed URLs from an incognito window.

## 6. Evidence
- Results recorded here (pass/fail per case).
- Screenshots in `docs/screenshots/` (list, details, form, confirmation,
  login, admin view, CloudWatch logs).
