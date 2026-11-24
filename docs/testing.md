# Testing

## Frontend

Run the frontend service tests and production build:

```bash
npm --prefix apps/web test
npm --prefix apps/web run build
```

The unit tests cover separate student/organization form validation,
authentication and role mapping, event availability, live API transport, and
registration status. The production build requires `VITE_API_URL` and Cognito
configuration.

The browser smoke test checks the public presentation and sign-in page without
logging in or making AWS requests:

```bash
npm --prefix apps/web run test:e2e
```

It uses Microsoft Edge in headless mode.

## Backend

Run handler, storage, Cognito provisioning, password encryption, and
authorization tests:

```bash
npm --prefix backend test
```

Handler identity in tests is provided as API Gateway Cognito authorizer
claims. Caller-supplied role headers do not authenticate requests.
Organization application tests verify that passwords are absent from stored
application records and logs, pending/rejected applications do not provision
an active account, and repeated approval is safe.

Validate the infrastructure template without deploying:

```bash
sam validate --lint --template-file infrastructure/template.yaml
```

The optional DynamoDB Local integration suite requires an explicitly started
local DynamoDB instance:

```bash
npm --prefix backend run test:integration
```

The lightweight local API server exposes only public `GET /events`:

```bash
node scripts/dev-api.js
```

Protected endpoints require API Gateway with a valid Cognito authorizer.

## Deployment-dependent checks

The tests above do not verify AWS resources or live records. Cognito email
delivery, deployed API Gateway authorization, DynamoDB permissions, and
organization approval/group changes require a separate acceptance test in an
authorized AWS environment.
