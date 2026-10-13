# AWS Setup

Order of work. Details per phase live in `docs/phases/`.
Nothing here is deployed yet (foundation stage).

## Prereqs
- AWS account + AWS CLI configured, SAM CLI installed, Node 20.
- Repo cloned; `apps/web` and `backend/functions` as in this repo.

## Order
1. **API + Lambda (Phase 3)** — define the 4 routes in
   `infrastructure/template.yaml`; test with `sam local start-api`.
2. **DynamoDB (Phase 4)** — create `Events` and `Registrations` tables in
   the template; pass table names via env vars; least-privilege IAM per Lambda.
3. **Cognito (Phase 5)** — User Pool + app client; authorizer on
   `POST /events`, `POST /register`, `GET /registrations`; `GET /events` stays public.
4. **Deploy (Phase 7)** — `sam build && sam deploy --guided`; build frontend
   (`npm run build` in `apps/web`) and upload `dist/` to S3/CloudFront;
   update Cognito callback URLs to the public site.
5. **Monitor** — CloudWatch Logs for each Lambda + API Gateway access logs.

## What to record here later
- API Gateway URL, User Pool ID, app client ID, region, table names.
- Never commit secrets or tokens — IDs and URLs only.
