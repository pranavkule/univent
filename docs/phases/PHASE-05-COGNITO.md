# Phase 5 — Cognito Authentication

Goal: students can create and confirm an account, sign in with Cognito, and the
API enforces the approved role matrix.

## Implemented

### Infrastructure
- `AWS::Cognito::UserPool` with email as the case-insensitive username.
- Email is the only auto-verified attribute; MFA is off for this project.
- Password policy: at least 8 characters with uppercase, lowercase, and a
  number. Symbols are optional to match the Cognito template policy.
- `AWS::Cognito::UserPoolClient`: public client (no secret), SRP and refresh
  flows, no hosted UI. Access/ID tokens last 60 minutes; refresh token 7 days.
- Groups: `admins` and `organizations`. No privileged group means `student`.
- `preSignUp.js` is wired as the PreSignUp trigger:
  - allows normal self sign-up only for an exact `@ves.ac.in` address;
  - allows admin-created accounts outside the student domain;
  - rejects external identity providers;
  - does **not** auto-confirm or auto-verify email.
- API Gateway `CognitoAuthorizer` protects:
  - `POST /events`
  - `POST /register`
  - `GET /registrations`
- `GET /events` remains public.
- Gateway `401`/`403` responses include CORS headers so the browser can read
  auth failures.
- Stack outputs: `UserPoolId`, `UserPoolClientId`, `CognitoRegion`.

### Backend authorization
| Action | Student | Organization | Admin |
| ------ | ------- | ------------ | ----- |
| `GET /events` | Yes | Yes | Yes |
| `POST /register` | Yes, own email only | `403` | `403` |
| `GET /registrations` | Own rows only | `403` | All rows |
| `POST /events` | `403` | `403` | Yes |

Identity comes from trusted authorizer claims, never body fields. The Lambda
re-checks the role even though the frontend also gates workspaces. Phase 4
transactions, counters, and owner-scoped queries are unchanged.

### Frontend
- `VITE_AUTH_MODE=mock` preserves the browser-local demo accounts.
- `VITE_AUTH_MODE=cognito` uses `amazon-cognito-identity-js`; production
  defaults to Cognito and fails closed when pool/client/region config is
  missing.
- Sign-up validates `@ves.ac.in` before calling Cognito, then routes to
  `/confirm-signup` when a code is required.
- `/confirm-signup` enters/resends the email code and then sends the user to
  sign-in with the email prefilled.
- `AuthProvider` restores a Cognito session asynchronously, exposes loading,
  role, sign-up/confirm/sign-in/sign-out, and attaches the ID token through
  `getAuthHeaders()` for Phase 6.
- Student-only routes are role-gated; existing organization/admin workspaces
  keep their gates.

### Provisioning
Run privileged accounts only through the operator script:

```bash
export COGNITO_USER_POOL_ID=<pool-id>
export AWS_REGION=<region>
export UNIVENT_PROVISION_PASSWORD='<strong-initial-password>'
node scripts/provision-cognito-user.js \
  --email codecell@ves.ac.in \
  --name 'CodeCell' \
  --role organization
```

- Roles allowed by the script: `organization` and `admin`.
- Student self sign-up remains the only way to create a student account.
- Existing users require `--update-existing`; conflicting privileged groups are
  refused instead of being silently replaced.
- The environment password is set as the user's permanent password, not a
  temporary password. If a previous run created the account but failed before
  setting it, rerun with `--update-existing` and the same env var to repair the
  `FORCE_CHANGE_PASSWORD` state.
- Passwords come from the environment and are never logged or accepted on the
  command line.

## Local checks
- `npm --prefix backend test`
- `npm --prefix apps/web test`
- `npm --prefix apps/web run build`
- `sam validate --lint --template-file infrastructure/template.yaml`
- `sam build --template-file infrastructure/template.yaml --build-dir <short-path>`

## Deployment-dependent checks
These need a real Cognito pool and API Gateway stage:
- confirmation email delivery and code entry;
- rejection of non-`ves.ac.in` self sign-up at the Cognito trigger;
- provisioning an organization/admin account and seeing the group in the ID
  token;
- missing/expired token → `401`;
- student calling admin/org action → `403`;
- CORS headers on authorizer failures;
- token refresh after the 60-minute ID-token lifetime.

## Security notes
- `amazon-cognito-identity-js` stores tokens in browser storage, so XSS can
  steal a session. Serve only the known app bundle over HTTPS and avoid
  untrusted third-party scripts. HttpOnly-cookie sessions would be a later
  hardening step.
- The ID token is sent only to the API; never put it in URLs or logs.
- Admin/organization accounts are provisioned out of band. Public sign-up can
  only ever create a student, and only with an exact college-domain address.
- Group changes do not rewrite an already-issued ID token. The API sees the new
  group only after the SDK refreshes the token, up to the 60-minute ID-token
  lifetime; sign out/in (or reload after refresh) to update the UI role and
  workspace menu sooner.

## Out of scope
- Organization event CRUD (current backend returns `403` for organization
  accounts).
- MFA, password reset UI, global sign-out, and custom email branding.
- Hosted UI/callback URLs.
