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
  - allows public student and organization-representative self sign-up only
    for an exact `@ves.ac.in` address;
  - allows admin-created accounts outside the student domain;
  - rejects external identity providers;
  - does **not** auto-confirm or auto-verify email.
- Self-sign-up never adds a Cognito group. A newly registered user is not an
  organization until an Admin approves a persisted application.
- API Gateway `CognitoAuthorizer` protects:
  - `POST /events`, `GET /organization/events`, and `PUT /events/{eventId}`
  - `POST /register`
  - `GET /registrations`
  - `GET /organization-applications`, `POST /organization-applications`, and
    `PATCH /admin/organization-applications/{userSub}`
- `GET /events` remains public.
- Gateway `401`/`403` responses include CORS headers so the browser can read
  auth failures.
- Stack outputs: `UserPoolId`, `UserPoolClientId`, `CognitoRegion`.

### Backend authorization
| Action | Student | Organization | Admin |
| ------ | ------- | ------------ | ----- |
| `GET /events` | Yes | Yes | Yes |
| `POST /register` | Yes, own email only | `403` | `403` |
| `GET /registrations` | Own rows only | Approved application + group; own events | All rows |
| `POST /events` | `403` | Approved application + group only | Yes |
| `GET /organization/events` | `403` | Approved application + group; own only | All events |
| `PUT /events/{eventId}` | `403` | Approved application + group; own event only | Any event |
| Application submission | Verified email required | Own verified account | `403` |
| Application list/decision | Own application only | Own application only | All / decide |

Identity comes from trusted authorizer claims, never body fields. The Lambda
re-checks the role and persisted application status even though the frontend
also gates workspaces. Organization event ownership is the trusted Cognito
`sub`; an `ownerSub` match is required for event edits and registration reads.
Phase 4 transactions, counters, and owner-scoped queries are unchanged.

### Organization application and approval workflow
- `/org/signup` creates a normal Cognito account with representative name,
  official college email, and password. The user confirms the email and signs
  in before submitting organization name, representative role, and phone at
  `/org/apply`.
- `POST /organization-applications` requires the Cognito email to be verified
  and match the submitted official email, and checks the configured exact
  college domain. The handler takes `userSub` only from the authorizer claim.
- `OrganizationApplicationsTable` stores one application per `userSub` with
  `PENDING`, `APPROVED`, `REJECTED`, or `SUSPENDED` state. Conditional writes
  prevent duplicate submissions and conflicting decisions.
- Admins review applications in the live Admin Organizations screen. Only an
  Admin can list all applications and call the decision API. Approval adds
  the `organizations` Cognito group; rejection/suspension removes it.
- Each organization event-management/registration request checks both the
  group claim and a consistent read of the saved `APPROVED` application.
  Rejected/suspended accounts therefore fail closed even if an ID token still
  contains an old group claim. Users must refresh their session/sign in again
  for the frontend to display the new group role.
- Existing group-only organization users have no approval record and cannot
  use organization APIs. They must submit an application and be approved;
  no bulk data migration or group-only bypass is provided.

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
  --email admin@ves.ac.in \
  --name 'UniVent Admin' \
  --role admin
```

- Use the script only for private Admin accounts. Organization representatives
  self-register at `/org/signup` and become privileged only after approval.
- The script's `organization` option is not an approval path; group membership
  alone does not authorize organization APIs without an `APPROVED` application.
- Student self sign-up remains available. Public sign-up never grants either
  privileged group.
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
- applying as an organization, Admin review, group assignment, and the
  approved organization seeing its role after session refresh;
- checking that pending/rejected/suspended applications are denied on
  organization endpoints, including with a stale organization group claim;
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
- Admin accounts are provisioned out of band. Organization representatives
  self-register at the organization signup route, but public sign-up cannot
  grant a privileged group and approval is required for organization features.
- Group changes do not rewrite an already-issued ID token. The API sees the new
  group only after the SDK refreshes the token, up to the 60-minute ID-token
  lifetime. Every organization data request also checks the persisted
  application status, so a stale organization group claim cannot retain access
  after rejection or suspension. Sign out/in (or reload after refresh) to
  update the UI role and workspace menu sooner.

The Admin decision Lambda requires
`cognito-idp:AdminAddUserToGroup` and
`cognito-idp:AdminRemoveUserFromGroup` on the configured User Pool. AWS Academy
Learner Lab permission for these operations is account-specific and must be
verified before deployment; it has not been verified by local tests.

## Out of scope
- Shared organization identity across multiple representatives; ownership is
  per Cognito `sub`.
- Organization application list pagination/indexing; the Admin API currently
  scans the small applications table.
- MFA, password reset UI, global sign-out, and custom email branding.
- Hosted UI/callback URLs.
