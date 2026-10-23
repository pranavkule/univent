# AWS Setup

Order of work. Details per phase live in `docs/phases/`. Nothing here is
deployed yet; Phases 3–5 are verified locally, and live Cognito/API checks
remain for Phase 7. `sam local` does not exercise the Cognito authorizer, so
token rejection and group-claim behavior need a deployed stage.

## Prereqs
- AWS account + AWS CLI configured, SAM CLI installed, Node 22 (Lambda runtime
  `nodejs22.x`).
- Repo cloned; `apps/web`, `backend/functions`, and `scripts` as in this repo.
- Docker if running DynamoDB Local or `sam local`.

## Order
1. **API + Lambda (Phase 3)** — define the 4 routes in
   `infrastructure/template.yaml`; test with `sam local start-api`.
2. **DynamoDB (Phase 4)** — implemented in the template: `Events` and
   `Registrations` tables, owner GSI, per-function least-privilege roles,
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
   - Authorizer protects `POST /events`, `POST /register`,
     `GET /registrations`; `GET /events` stays public.
   - Deploy-time outputs: `UserPoolId`, `UserPoolClientId`, `CognitoRegion`.
4. **Deploy (Phase 7)** — `sam build && sam deploy --guided`; on Windows use a
   short `--build-dir` if SDK type paths hit the legacy path limit. Build the
   frontend (`npm run build` in `apps/web`) and upload `dist/` to
   S3/CloudFront.
5. **Monitor** — CloudWatch Logs for each Lambda + API Gateway access logs.

## Frontend auth configuration
Copy `apps/web/.env.example` to `apps/web/.env.local` (ignored by git):

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
Create organization/admin users with the operator script, not public sign-up:

```bash
export COGNITO_USER_POOL_ID=<pool-id>
export AWS_REGION=<region>
export UNIVENT_PROVISION_PASSWORD='<strong-initial-password>'
node scripts/provision-cognito-user.js \
  --email codecell@ves.ac.in \
  --name 'CodeCell' \
  --role organization
```

- Use `--role admin` for platform administrators.
- Existing accounts require `--update-existing`; the script refuses to replace
  a conflicting privileged group silently.
- The password is taken from the environment, set as permanent, and never
  printed. Rerun with `--update-existing` to repair an account left in
  `FORCE_CHANGE_PASSWORD` after an interrupted first run.
- Install the script dependency once: `npm --prefix scripts install`.

## What to record here later
- API Gateway URL, User Pool ID, app client ID, region, table names.
- Never commit secrets or tokens — IDs and URLs only.
- Live checks still pending: email delivery, group claims, `401`/`403` CORS,
  and token refresh.
