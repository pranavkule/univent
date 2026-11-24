# Phase 5 — Cognito Authentication

Goal: preserve independent student and administrator sign-in while provisioning
organization accounts only after approval.

## Cognito configuration

- The existing User Pool uses email usernames and keeps the existing
  `admins` and `organizations` groups. The workflow does not create another
  pool or change existing users.
- Student self-sign-up is allowed only through the student app client and for
  an exact `@ves.ac.in` address. The `PreSignUp` trigger does not auto-confirm
  or auto-verify student email; the existing Cognito email-code flow remains.
- The legacy organization-applicant app client remains in the template for
  compatibility, but the `PreSignUp` trigger rejects new self-sign-up through
  it. New organization applications do not use Cognito email OTP.
- `PostConfirmation` is a no-op. Backend authorization relies on verified
  Cognito group claims and the persisted organization application, not a
  client-supplied role or a custom account-type attribute.
- The template's custom organization attribute is named `org_application_id`
  (within Cognito's 20-character limit). New account authorization uses a
  server-owned `preferred_username` application marker and persisted record
  binding; the flow does not depend on adding a custom attribute to the
  deployed pool.
- Student and organization sign-in use separate UI routes and accounts.
  Students continue using their personal email; organizations use their
  official organization email and a separately selected password.

## Organization approval and provisioning

- `/org/signup` stores an application in `PENDING_APPROVAL`. It validates the
  official email and password, but does not create a Cognito user.
- The password is encrypted by KMS and stored separately from application
  history in a TTL-enabled table for up to 30 days. It is removed after
  approval or rejection. Plaintext passwords are not stored in DynamoDB or
  application logs.
- Admin approval provisions a distinct account in the existing pool using
  the official email. Cognito email delivery is suppressed and the submitted
  password is set as permanent, so access to the shared inbox is not required.
  Approval then records the Cognito `sub`, adds the account to `organizations`,
  and enables it.
- Approval is idempotent and only reuses an account whose server-owned
  application marker matches the same application. Failed approval retries
  leave the user disabled until the application is saved and access is
  granted. Rejection preserves application history and removes the secret.
- Pending and rejected applications have no usable organization account.
  Legacy application records cannot grant organization access through this
  flow.

## Backend authorization

| Action | Student | Organization | Admin |
| ------ | ------- | ------------ | ----- |
| `GET /events` | Yes | Yes | Yes |
| `POST /register` | Yes, own email only | `403` | `403` |
| `GET /registrations` | Own rows only | Approved application + group; own events | All rows |
| `POST /events` | `403` | Approved application + group only | Yes |
| `GET /organization/events` | `403` | Approved application + group; own only | All events |
| `PUT /events/{eventId}` | `403` | Approved application + group; own event only | Any event |
| Application submission | Public | Public | Public |
| Application read | No login until approved | Own application only | All |
| Application decision | `403` | `403` | Yes |

Identity and ownership come from trusted Cognito claims, never request-body
fields. Every organization API call also checks that the Cognito `sub` is
bound to a non-legacy application with persisted `APPROVED` status; a group
claim alone is insufficient. Event ownership is the organization's Cognito
`sub`, so one organization cannot manage another organization's events or
registrations.

## Infrastructure and verification

- The Cognito groups and existing User Pool are retained. The template's
  `PreSignUp` function uses read-only `ListUserPoolClients` permission to
  identify the configured student client; organization provisioning uses
  backend-only Cognito administrative APIs.
- The organization-application Lambda receives scoped DynamoDB, KMS, and
  Cognito permissions when the template creates per-function roles. An
  externally supplied execution role must provide the corresponding actions.
- Unit tests cover student sign-up routing, separate organization provisioning,
  approval/rejection behavior, and organization ownership boundaries.
- Do not deploy from this phase. Review the current CloudFormation change set
  and existing pool configuration before any in-place update.
