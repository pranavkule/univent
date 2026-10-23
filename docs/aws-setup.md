# AWS Setup

Order of work. Details per phase live in `docs/phases/`.
Nothing here is deployed yet; Phases 3–4 are verified locally.

## Prereqs
- AWS account + AWS CLI configured, SAM CLI installed, Node 22 (Lambda runtime
  `nodejs22.x`).
- Repo cloned; `apps/web` and `backend/functions` as in this repo.
- Docker if running DynamoDB Local or `sam local`.

## Order
1. **API + Lambda (Phase 3)** — define the 4 routes in
   `infrastructure/template.yaml`; test with `sam local start-api`.
2. **DynamoDB (Phase 4)** — implemented in the template: `Events` and
   `Registrations` tables, owner GSI, per-function least-privilege roles,
   table env vars and `UNIVENT_STORE=dynamodb`. Deploy happens in Phase 7.
   - Leave `LambdaExecutionRoleArn` at its default sentinel to create the four
     least-privilege roles (requires `CAPABILITY_IAM`).
   - For AWS Academy, pass the `LabRole` ARN; that role must already allow the
     required DynamoDB actions and the caller needs `iam:PassRole`.
   - After deployment, run the idempotent seed script and then reconcile
     counters if you imported pre-existing data. See
     `docs/phases/PHASE-04-DYNAMODB.md`.
3. **Cognito (Phase 5)** — User Pool + app client; authorizer on
   `POST /events`, `POST /register`, `GET /registrations`; `GET /events` stays public.
4. **Deploy (Phase 7)** — `sam build && sam deploy --guided`; on Windows use a
   short `--build-dir` if SDK type paths hit the legacy path limit. Build the
   frontend (`npm run build` in `apps/web`) and upload `dist/` to
   S3/CloudFront; update Cognito callback URLs to the public site.
5. **Monitor** — CloudWatch Logs for each Lambda + API Gateway access logs.

## What to record here later
- API Gateway URL, User Pool ID, app client ID, region, table names.
- Never commit secrets or tokens — IDs and URLs only.
