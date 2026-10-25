# AWS Setup

Order of work. Details per phase live in `docs/phases/`. The project owner
reports that the backend is deployed in `us-east-1` and the Cognito student
login/event-registration flow has passed a live test. This repository audit
does not access AWS; the organization API additions and Events-table GSI still
need to be deployed and tested. `sam local` does not exercise the Cognito
authorizer.

## Prereqs
- AWS account + AWS CLI configured, SAM CLI installed, Node 22 (Lambda runtime
  `nodejs22.x`).
- Repo cloned; `apps/web`, `backend/functions`, and `scripts` as in this repo.
- Docker if running DynamoDB Local or `sam local`.

## Order
1. **API + Lambda (Phase 3)** — define the routes in
   `infrastructure/template.yaml`; test with `sam local start-api`.
2. **DynamoDB (Phase 4)** — implemented in the template: `Events` and
   `Registrations` tables, the registration-owner GSI and organization-event
   owner GSI, per-function least-privilege roles,
   table env vars and `UNIVENT_STORE=dynamodb`. Deploy happens in Phase 7.
   - Leave `LambdaExecutionRoleArn` at its default sentinel to create the
     least-privilege roles (requires `CAPABILITY_IAM`).
   - For AWS Academy, pass the `LabRole` ARN; that role must already allow the
     required DynamoDB actions and the caller needs `iam:PassRole`.
   - After deployment, run the idempotent seed script and then reconcile
     counters if you imported pre-existing data. See
     `docs/phases/PHASE-04-DYNAMODB.md`.
3. **Cognito (Phase 5)** — implemented in the template:
   - User Pool, public app client, `admins`/`organizations` groups.
   - PreSignUp trigger restricts student self sign-up to exact `@ves.ac.in`.
   - Email-code confirmation is required; there is no auto-confirm.
   - The authorizer protects `POST /events`, `GET /organization/events`,
     `PUT /events/{eventId}`, `POST /register`, and `GET /registrations`;
     `GET /events` stays public.
   - The Events table's `OrganizationOwnerIndex` is sparse. Creating this GSI
     does not rewrite seeded events; only events created after the change have
     the trusted `ownerSub` field and appear in organization listings.
   - Deploy-time outputs: `UserPoolId`, `UserPoolClientId`, `CognitoRegion`.
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

## Privileged account provisioning
There is no in-app organization approval portal. An Admin must first verify
the organization and its representative through the college's normal process,
then create the account or assign the Cognito `organizations` group with the
operator script. This group membership—not a frontend role label—authorizes
organization API calls.

Create organization/admin users with the operator script, not public sign-up.
The commands below use PowerShell:

```powershell
$env:COGNITO_USER_POOL_ID = '<pool-id>'
$env:AWS_REGION = '<region>'
$securePassword = Read-Host 'Temporary account password' -AsSecureString
$env:UNIVENT_PROVISION_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
node scripts/provision-cognito-user.js --email 'codecell@ves.ac.in' --name 'CodeCell' --role organization
Remove-Item Env:UNIVENT_PROVISION_PASSWORD
```

- Use `--role admin` for platform administrators.
- Existing accounts require `--update-existing`; the script refuses to replace
  a conflicting privileged group silently.
- The password is taken from the environment, set as permanent, and never
  printed. Rerun with `--update-existing` to repair an account left in
  `FORCE_CHANGE_PASSWORD` after an interrupted first run.
- Install the script dependency once: `npm --prefix scripts install`.
- For existing confirmed accounts, pass `--update-existing`; users should
  sign out and back in after group assignment to receive the updated group
  claim in their ID token.

New organization events are publicly visible immediately. Event moderation,
cancellation, and organization profile management are not implemented.
Ownership is attached to the Cognito user `sub`; separate representative
accounts do not share event access until a reviewed shared organization
identifier is added to the identity model.

## What to record here later
- API Gateway URL, User Pool ID, app client ID, region, table names.
- Never commit secrets or tokens — IDs and URLs only.
- The owner reports successful live student login and event registration.
  Organization event ownership, access denial, and the new GSI remain to be
  verified after updating the stack.
