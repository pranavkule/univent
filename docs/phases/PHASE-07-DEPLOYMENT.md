# Phase 7 — AWS Deployment and Monitoring

Goal: deploy frontend + backend, configure CloudWatch, verify the public application.

## Prerequisites
- Phase 6 integration passing locally.

## Steps
1. Backend (`infrastructure/template.yaml`):
   - `sam build && sam deploy --guided` (first time), then plain `sam deploy` after.
   - Record API Gateway URL, Cognito ids, table names in `docs/aws-setup.md`.
2. Frontend (`apps/web/`):
   - Set `VITE_API_URL` to the deployed API; `npm run build`.
   - Upload `dist/` to S3 + serve via CloudFront (or Amplify/S3 static hosting — pick one, document it).
   - Update Cognito callback/logout URLs to the public frontend URL.
3. Monitoring:
   - Enable CloudWatch Logs for all Lambdas + API Gateway access logs (in `template.yaml`).
   - Note key alarms/log groups in `docs/aws-setup.md` (e.g. 5xx rate, Lambda errors).
4. Verify public app:
   - Hit public URL: list, details, login, register, confirmation, admin registrations — all against deployed backend.

## Done when
- Public frontend + API URLs work from an incognito browser.
- CloudWatch shows logs for each Lambda; deployment steps reproducible from `docs/aws-setup.md`.
