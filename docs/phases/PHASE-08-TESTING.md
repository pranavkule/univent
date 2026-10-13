# Phase 8 — Testing and Final Submission

Goal: test the complete workflow, capture screenshots, update docs, prepare the lab demo.

## Prerequisites
- Phase 7 deployed and publicly reachable.

## Steps
1. Test the workflow (record results in `docs/testing.md`):
   - Event listing → details → registration → confirmation.
   - Auth: signed-out redirect, user register, admin create-event, unauthorized `POST /events` rejected.
   - Negative cases: invalid email, duplicate registration, missing fields, unknown event id.
2. Screenshots (`docs/screenshots/`):
   - At least: list, details, register form, confirmation, login, admin view, sample CloudWatch logs, deployed URL bar.
   - Name descriptively (`01-event-list.png`, `02-event-details.png`, ...).
3. Docs pass:
   - `README.md` — what UniVent is, stack, links to docs.
   - `docs/architecture.md`, `docs/api.md`, `docs/aws-setup.md`, `docs/testing.md` — all match the deployed state.
   - `phases.md` — mark completed phases.
4. Demo prep:
   - Fresh test user + test event ready; incognito walkthrough rehearsed; rollback note (which `sam deploy` / frontend build to redo if live demo fails).

## Done when
- `docs/testing.md` has pass/fail per case; screenshots present; docs match production; team can demo end-to-end in the lab.
