# Phase 5 — Cognito Authentication (Teammate 2)

Owner: Teammate 2. Goal: sign-in + auth configuration.

## Prerequisites
- Frontend prototype (Phase 2) and API routes (Phase 3) exist.

## Steps
1. Create Cognito resources (in `infrastructure/template.yaml` or console — template preferred):
   - `AWS::Cognito::UserPool` + `UserPoolClient` (public client, `ALLOW_USER_SRP_AUTH` / `ALLOW_REFRESH_TOKEN_AUTH`).
   - Optional `UserPoolDomain` for hosted UI; note app client id, user pool id, region in `docs/aws-setup.md` (no secrets in git).
2. Protect API:
   - Add `CognitoAuthorizer` on `POST /events` (admin) and `POST /register` + `GET /registrations` as decided; leave `GET /events` public.
   - Handlers read claims (`sub`, `email`, groups) for ownership/audit.
3. Frontend (`apps/web/src/`):
   - Add `services/auth.js` (sign-up, sign-in, sign-out, token refresh, `getIdToken()`).
   - Add `pages/Login.jsx` + auth context/guard; attach `Authorization: Bearer <idToken>` in `services/api.js`.
   - Define admin concept (Cognito group `admins` or custom attribute) for create-event UI gating.
4. Document in `docs/aws-setup.md`: pool setup, callback URLs, test users, how to assign admin.

## Done when
- Signed-in user can register; signed-out user is redirected to login for protected actions.
- Only admin can hit `POST /events` (verified with and without token).
