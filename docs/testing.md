# Testing

How we will verify UniVent. Manual first, in this order.

## 1. Frontend (Phase 2, mock data)
- `npm run dev` in `apps/web`; check list, details, register form,
  confirmation render with no backend.

## 2. Backend (Phase 3, `sam local start-api`)
- Each route with curl/Postman: happy path + bad input
  (missing email, unknown event) → expect `400`/`404` with JSON message.

## 3. Auth (Phase 5–6)
- Signed-out user hitting protected pages → redirected to login.
- Non-admin calling `POST /events` → `403`.

## 4. End-to-end (Phase 6–8)
- List → details → login → register → confirmation → admin registrations,
  first locally then against the deployed URLs from an incognito window.

## 5. Evidence
- Results recorded here (pass/fail per case).
- Screenshots in `docs/screenshots/` (list, details, form, confirmation,
  login, admin view, CloudWatch logs).
