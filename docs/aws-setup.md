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
   - For AWS Academy, pass the `LabRole` ARN only after confirming it allows
     the required DynamoDB actions and the organization decision operations
     `cognito-idp:AdminAddUserToGroup` and
     `cognito-idp:AdminRemoveUserFromGroup` on this User Pool. The caller needs
     `iam:PassRole`. Learner Lab permissions are not verified by local checks.
   - After deployment, run the idempotent seed script and then reconcile
     counters if you imported pre-existing data. See
     `docs/phases/PHASE-04-DYNAMODB.md`.
3. **Cognito (Phase 5)** — implemented in the template:
   - User Pool, public app client, `admins`/`organizations` groups.
   - PreSignUp trigger restricts student and organization representative
     self-sign-up to exact `@ves.ac.in`.
   - Email-code confirmation is required; there is no auto-confirm.
   - `GET /events` stays public. The authorizer protects all other API routes,
     including organization application submission/review.
   - `POST /organization-applications` ties an application to the verified
     Cognito `sub` and verified official email. Admins review and decide
     applications at `/admin/organizations`; the API grants the `organizations`
     group only after approval.
   - Organization event APIs require both the Cognito group and a persisted
     `APPROVED` application state. Rejection/suspension remains effective even
     before a stale ID token loses its group claim.
   - The Events table's `OrganizationOwnerIndex` is sparse. Creating this GSI
     does not rewrite seeded events; only events created after the change have
     the trusted `ownerSub` field and appear in organization listings.
   - Deploy-time outputs: `UserPoolId`, `UserPoolClientId`, `CognitoRegion`,
     `OrganizationApplicationsTableName`, and the existing event/registration
     table outputs.
4. **Deploy (Phase 7)** — follow the PowerShell preflight, deployment gates,
   output handling, and acceptance checklist in
   `docs/phases/PHASE-07-DEPLOYMENT.md`. Do not deploy until the AWS Academy
   account identity, region, execution role, hosting, and CORS choices are
   confirmed.
5. **Monitor** — CloudWatch Logs for each Lambda + API Gateway access logs.

## Frontend auth configuration
For local/mock use, copy `apps/web/.env.example` to
`apps/web/.env.local` (ignored by git). For a production build, use the
deployed API and Cognito outputs in `apps/web/.env.production.local` as
described in the Phase 7 deployment guide. The production configuration must
set `VITE_API_MODE=live`, `VITE_AUTH_MODE=cognito`, `VITE_API_URL`, and the
Cognito region, user pool ID, and client ID.

```dotenv
VITE_AUTH_MODE=mock
VITE_ALLOWED_EMAIL_DOMAIN=ves.ac.in
VITE_DEV_AUTH=false
# Required only when VITE_AUTH_MODE=cognito
VITE_COGNITO_REGION=ap-south-1
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
```

- Mock mode keeps the local demo accounts and needs no AWS.
- Cognito mode fails closed if the pool ID, client ID, or region is missing.
- Set `VITE_DEV_AUTH=true` only when the frontend talks to
  `scripts/dev-api.js`; deployed Lambda ignores dev identity headers.

## Organization applications and private Admin provisioning
Organization representatives self-register at `/org/signup` with an official
`@ves.ac.in` email and password, confirm the email, then sign in and submit
organization and representative details at `/org/apply`. An Admin reviews
applications in the Admin > Organizations screen. The backend persists
`PENDING`/`APPROVED`/`REJECTED`/`SUSPENDED` state and only grants the Cognito
`organizations` group after approval. Do not manually add an organization to
the group as a substitute for approval. Existing group-only organization
accounts remain blocked until they submit an application and an Admin approves
it.

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
