# Testing

How we verify UniVent. Manual first, in this order.

## 1. Frontend (Phase 2, mock data)
- `npm run dev` in `apps/web`; walk landing → events (search + category
  filter) → details → sign-up → sign-in → register → confirmation → dashboard.
- Check validation feedback (short name, bad email, short password, wrong
  credentials, duplicate registration) and loading/empty/error states.
- `npm test` covers auth validation, role mapping, and the mock auth flow.
- `npm run build` must succeed (production build check).

## 2. Backend (Phase 3, `sam local start-api`)
- Each route with curl/Postman: happy path + bad input
  (missing email, unknown event) → expect `400`/`404` with JSON message.
- The quick memory-mode server needs no AWS:
  `UNIVENT_DEV_AUTH=true node scripts/dev-api.js`.

## 3. Backend storage and auth (Phases 4–5)
Verified locally on 2026-10-24 after Phase 5:

| Check | Command | Result |
| ----- | ------- | ------ |
| Install backend dependencies | `npm --prefix backend/functions install` | once per clone |
| Handler + DynamoDB store + auth unit tests | `npm --prefix backend test` | 68/68 pass |
| DynamoDB Local integration | `npm --prefix backend run test:integration` | 9/9 pass, 0 skipped |
| SAM template lint | `sam validate --lint --template-file infrastructure/template.yaml` | valid |
| SAM build | `sam build --template-file infrastructure/template.yaml --build-dir <short path>` | succeeds |
| Frontend auth tests | `npm --prefix apps/web test` | 12/12 pass |
| Frontend build | `npm --prefix apps/web run build` | passes (152 modules) |

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

## 4. Auth (Phase 5)
Automated locally:
- PreSignUp accepts exact `@ves.ac.in`, rejects other domains, lookalikes and
  subdomains, allows admin-created accounts, and does not auto-confirm.
- Claim resolution maps `admins` / `organizations` correctly, with admin
  precedence and student fallback.
- Dev identity headers are ignored unless explicitly enabled and outside
  deployed Lambda.
- Role matrix: student-only `POST /register`; org/admin `403`; admin-all vs
  student-own `GET /registrations`; org `403`; body role/ownership spoofing
  ignored.
- Frontend validation rejects non-college emails and weak passwords; mock
  student sign-up/sign-in still works.

Deployment-dependent (Phase 7):
- Cognito email-code delivery, confirmation, and resend.
- Real ID token claims and group membership from provisioning.
- API Gateway `401` for missing/invalid/expired tokens.
- CORS headers on `401`/`403`, and token refresh after 60 minutes.

Need Docker for the storage integration suite; `sam local` does not exercise
the Cognito authorizer.

## 5. End-to-end (Phase 6–8)
- List → details → login → register → confirmation → admin registrations,
  first locally then against the deployed URLs from an incognito window.

## 6. Evidence
- Results recorded here (pass/fail per case).
- Screenshots in `docs/screenshots/` (list, details, form, confirmation,
  login, admin view, CloudWatch logs).
