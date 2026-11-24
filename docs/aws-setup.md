# AWS Setup

Order of work. Details per phase live in `docs/phases/`. The project owner
reports that the backend is deployed in `us-east-1` and the Cognito student
login/event-registration flow has passed a live test. This repository audit
does not access AWS; the organization application workflow, table, IAM
permissions, and APIs described here still need to be deployed and tested.
`sam local` does not exercise the Cognito authorizer or AWS Academy IAM
permissions.

## Prereqs
- AWS account + AWS CLI configured, SAM CLI installed, Node 22 (Lambda runtime
  `nodejs22.x`).
- Repo cloned; `apps/web`, `backend/functions`, and `scripts` as in this repo.
- Docker if running DynamoDB Local or `sam local`.

## Order
1. **API + Lambda (Phase 3)** — define the routes in
   `infrastructure/template.yaml`; test with `sam local start-api`.
2. **DynamoDB (Phase 4)** — implemented in the template: `Events`,
   `Registrations`, and `OrganizationApplications` tables, the
   registration-owner GSI and organization-event owner GSI, per-function
   least-privilege roles,
   table env vars and `UNIVENT_STORE=dynamodb`. Deploy happens in Phase 7.
   - Leave `LambdaExecutionRoleArn` at its default sentinel to create the
     least-privilege roles (requires `CAPABILITY_IAM`).
   - The checked-in `samconfig.toml` currently overrides that sentinel with an
     AWS Academy `LabRole`, which is shared by every Lambda and bypasses the
     template's per-function least-privilege policies. For that role, confirm
     its access to all application, lock, event, and registration tables and
     indexes, plus `cognito-idp:AdminCreateUser`, `AdminGetUser`,
     `AdminAddUserToGroup`, and `AdminRemoveUserFromGroup` on this User Pool.
     The caller needs `iam:PassRole`. Learner Lab permissions are not verified
     by local checks. Remove the override only if the account can create and
     pass the template's per-function roles.
     With the supplied role, `OrganizationApplicationsFunction` uses that same
     role and does not create `OrganizationApplicationsRole`. The password
     key's resource policy grants that role only `kms:Encrypt` and `kms:Decrypt`
     with the expected purpose and a non-empty application ID. Because LabRole
     is shared, any Lambda using it can make those context-bound KMS calls if
     it can obtain the ciphertext; separate per-function roles provide stronger
     isolation where IAM role creation is available.
   - After deployment, run the idempotent seed script and then reconcile
     counters if you imported pre-existing data. See
     `docs/phases/PHASE-04-DYNAMODB.md`.
3. **Cognito (Phase 5)** — implemented in the template:
   - User Pool, public app client, `admins`/`organizations` groups.
   - PreSignUp permits self-sign-up only through the student app client and
     restricts it to exact `@ves.ac.in`. The retained legacy organization
     applicant client cannot create new self-service accounts.
   - Student email verification behavior is unchanged. Organization
     applications do not use Cognito email OTP or require access to the shared
     inbox.
   - `GET /events` and the rate-limited `POST /organization-applications`
     submission route are public. Organization application reads and Admin
     review, along with other private API routes, require Cognito authorization.
   - Application submission stores `PENDING_APPROVAL` and places the submitted
     password only in a separate KMS-encrypted, TTL-backed secret table.
     Approval provisions a separate Cognito account under the official
     organization email, sets the submitted password, suppresses email
     delivery, and grants the `organizations` group. Rejection preserves the
     application history and removes the encrypted password.
   - Organization event APIs require both the Cognito group and a persisted
     `APPROVED` application state. Rejection/suspension remains effective even
     before a stale ID token loses its group claim.
   - The Events table's `OrganizationOwnerIndex` is sparse. Creating this GSI
     does not rewrite seeded events; only events created after the change have
     the trusted `ownerSub` field and appear in organization listings.
   - Deploy-time outputs include `UserPoolId`, `UserPoolClientId`,
     `CognitoRegion`, the organization application and duplicate-lock table
     names, and the existing event/registration table outputs. The encrypted
     password table and KMS key are internal stack resources. The applicant
     client output is retained for compatibility; new applications do not use
     it.
4. **Deploy (Phase 7)** — follow the PowerShell preflight, deployment gates,
   output handling, and acceptance checklist in
   `docs/phases/PHASE-07-DEPLOYMENT.md`. Do not deploy until the AWS Academy
   account identity, region, execution role, hosting, and CORS choices are
   confirmed.
5. **Monitor** — CloudWatch Logs for each Lambda + API Gateway access logs.

## Frontend configuration
Copy `apps/web/.env.example` to `apps/web/.env.local` for local development.
For a production build, use the deployed API and Cognito outputs in
`apps/web/.env.production.local` as described in the Phase 7 deployment guide.
Configure `VITE_API_URL`, the Cognito region, user pool ID, and student client
ID. The organization-applicant client ID is optional and is only needed to
confirm accounts created through the retired signup flow.

```dotenv
VITE_ALLOWED_EMAIL_DOMAIN=ves.ac.in
VITE_API_URL=
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
# Optional: legacy account migration only; new applications do not use this.
VITE_COGNITO_ORGANIZATION_APPLICANT_CLIENT_ID=
```

- The frontend requires a real API URL and Cognito configuration; it has no
  mock-auth or mock-API mode.
- New organization applications do not use Cognito until an administrator
  approves them. The legacy applicant client is retained in the stack but
  cannot create new self-service accounts.

## Organization applications and private Admin provisioning
Organizations apply at `/org/signup` with the official `@ves.ac.in` email,
contact details, and a distinct organization password. The workflow does not
send or require email OTP. The application is `PENDING_APPROVAL`; no Cognito
user is created until an Admin approves it. The selected password is encrypted
with KMS in a separate table and expires after 30 days. Admins review
applications in Admin > Organizations. Approval provisions the distinct
organization account and grants the Cognito `organizations` group; rejection
keeps the application history but removes the secret. Do not manually add an
organization to the group as a substitute for approval. Historical legacy
application records and group-only accounts do not grant organization access
through the new workflow; coordinate an Admin-led migration rather than
reusing a student's Cognito identity.

Admin accounts are provisioned privately through the operator script. The
commands below use PowerShell:

```powershell
$env:COGNITO_USER_POOL_ID = '<pool-id>'
$env:AWS_REGION = '<region>'
$securePassword = Read-Host 'Temporary account password' -AsSecureString
$env:UNIVENT_PROVISION_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
node scripts/provision-cognito-user.js --email 'admin@ves.ac.in' --name 'UniVent Admin' --role admin
Remove-Item Env:UNIVENT_PROVISION_PASSWORD
```

- Public sign-up never grants a privileged group.
- Existing accounts require `--update-existing`; the script refuses to replace
  a conflicting privileged group silently.
- The password is taken from the environment, set as permanent, and never
  printed. Rerun with `--update-existing` to repair an account left in
  `FORCE_CHANGE_PASSWORD` after an interrupted first run.
- Install the script dependency once: `npm --prefix scripts install`.
- For existing confirmed accounts, pass `--update-existing`; users should
  sign out and back in after group assignment to receive the updated group
  claim in their ID token. Organization APIs still check the saved approval
  state for every request.

New organization events are publicly visible immediately. Event moderation,
cancellation, and organization profile management are not implemented.
Ownership is attached to the Cognito user `sub`; separate representative
accounts do not share event access until a reviewed shared organization
identifier is added to the identity model.

## What to record here later
- API Gateway URL, User Pool ID, app client ID, region, table names.
- Never commit secrets or tokens — IDs and URLs only.
- The owner reports successful live student login and event registration.
  Organization applications, group synchronization, event ownership, access
  denial, and the new application table/GSI behavior remain to be verified
  after updating the stack.
