# Phase 7 — AWS Deployment and Monitoring

The project owner reports an existing deployment in `us-east-1` and successful
live student login/registration. This guide does not independently verify AWS.
The organization application and approval changes in the current template
have not been deployed; check AWS Academy permissions and review the change
set before updating the existing stack.

## What the repository currently defines

- `infrastructure/template.yaml` creates a regional API Gateway **REST API**
  (`AWS::Serverless::Api`, stage `Prod`), Node.js 22 Lambda functions,
  three on-demand DynamoDB tables, the `OwnerEmailIndex` and
  `OrganizationOwnerIndex` GSIs, a Cognito user pool,
  a public app client, two groups, and the PreSignUp trigger.
- The API paths include public `GET /events` and Cognito-protected event,
  registration, and organization application routes:
  `POST /events`, `GET /organization/events`, `PUT /events/{eventId}`,
  `POST /register`, `GET /registrations`, `GET/POST /organization-applications`,
  and `PATCH /admin/organization-applications/{userSub}`. The API output
  includes `/Prod`.
- Lambda table names and `UNIVENT_STORE=dynamodb` are wired from CloudFormation
  references. Outputs provide the API URL, Cognito IDs/region, and table/index
  names, including `OrganizationApplicationsTableName`.
- The functions package AWS SDK v3 DynamoDB and Cognito identity-provider
  dependencies from
  `backend/functions/package-lock.json`. The runtime is `nodejs22.x`.
- DynamoDB uses on-demand billing and server-side encryption. The registration
  table has `eventId`/`email` keys and the `ownerEmail`/`eventId` GSI. The
  Events table has an `ownerSub`/`eventId` GSI; it is sparse, so existing
  ownerless seeded events remain intact and Admin-managed. The new
  `OrganizationApplications` table is keyed by `userSub`; the Admin list scans
  it and should be paginated/indexed if its volume grows.
- Cognito self-sign-up checks the exact `ves.ac.in` domain and requires email
  verification. The browser uses the Cognito SDK directly; it does not use a
  Hosted UI, so callback/logout URLs are not currently part of this flow.
- `CORS_ORIGIN` and API Gateway CORS currently allow `*`; the template does not
  expose a deploy-time origin parameter despite the comment saying Phase 7
  should pin it. This is usable for a classroom smoke test, but should be
  parameterized to the chosen frontend origin for a public production site.
- No frontend S3 bucket, CloudFront distribution, API Gateway access-log
  setting, explicit log retention, or CloudWatch alarm is defined. Lambda
  execution roles created by the template attach `AWSLambdaBasicExecutionRole`;
  a supplied Academy role must also allow the needed DynamoDB and Lambda Logs
  actions.

## Blockers and decisions before updating/deploying

1. **AWS Academy credentials and account:** Start the Learner Lab and refresh
   its temporary credentials. Confirm the identity and permitted region
   before updating the existing stack. No AWS change was performed for this
   repository task.
2. **Execution role:** The default SAM path creates per-function roles and
   requires IAM role/policy creation and `iam:PassRole`. Academy accounts may
   restrict these actions. If using `LabRole`, verify its ARN, trust
   relationship, DynamoDB table/index access, CloudWatch Logs permissions, and
   that the caller can pass it. It must allow the new owner-index queries and
   event updates, plus `dynamodb:TransactWriteItems` on both Events and
   Registrations for student registration. The application Lambda also needs
   `dynamodb:GetItem`, `PutItem`, `Scan`, and `UpdateItem` on the application
   table and `cognito-idp:AdminAddUserToGroup` /
   `cognito-idp:AdminRemoveUserFromGroup` on the configured User Pool. Verify
   the Learner Lab permits both Cognito actions; local SAM/tests do not prove
   account permissions. Supplying this role uses the same role for all
   functions and gives up the template's per-function least privilege.
3. **Hosting choice and URL:** The repository has no S3/CloudFront resources.
   Choose a bucket/hosting method and configure SPA fallback for React
   `BrowserRouter` deep links. An S3 website endpoint is simplest but is HTTP;
   CloudFront adds HTTPS but may be restricted or costly in the Learner Lab.
   Check whether Academy permits the required bucket policy/public access or
   CloudFront permissions.
4. **CORS origin:** Decide whether a temporary `*` is acceptable for a
   restricted classroom demo. To pin CORS to S3/CloudFront, the SAM template
   must first expose and use a configurable allowed origin; the current
   template cannot do this through a parameter.
5. **Organization approval:** Organization representatives self-register
   using `/org/signup`, confirm their college email, sign in, and apply at
   `/org/apply`. Admins review requests in Admin > Organizations; the backend
   grants/removes Cognito group membership as decisions are saved. Do not
   manually grant the organization group as a substitute for approval.
   Existing group-only accounts must submit an application and be approved
   before organization APIs work. New events publish immediately; event
   moderation and cancellation are not available.
6. **Monitoring:** Lambda logs can be emitted through the basic execution
   policy, but API Gateway access logs, retention, and alarms are not
   configured. Confirm Academy permissions and decide whether to add these
   resources before claiming Phase 7 monitoring complete.

## Safe preflight — read-only or local

In PowerShell, use the Learner Lab's current credentials without pasting or
committing them. Replace the region with one supported by the lab:

```powershell
$Region = '<academy-supported-region>'
aws sts get-caller-identity
aws configure get region
aws iam get-role --role-name LabRole --query 'Role.Arn' --output text
aws iam list-attached-role-policies --role-name LabRole --output table
aws iam list-role-policies --role-name LabRole --output table
sam validate --lint --template-file infrastructure/template.yaml
sam build --template-file infrastructure/template.yaml --build-dir "$env:TEMP\univent-sam-build"
```

These AWS commands are read-only; `sam validate` and `sam build` do not deploy.
A missing/denied `LabRole` query is not proof that role creation is
available—check IAM permissions in the Academy console. Do not paste temporary
credentials into chat or source files.

## Deployment order

Only proceed after the preflight succeeds and the role, region, CORS, and
hosting choices are settled.

1. **Deploy backend with SAM.** This creates or updates the CloudFormation
   stack and its Cognito, API Gateway, Lambda, DynamoDB, IAM, and permission
   resources. Guided deployment also uploads artifacts to an S3 deployment
   bucket. It is resource-changing and may incur charges.

   If the Academy `LabRole` was inspected and approved, set its ARN and pass it
   to the template:

   ```powershell
   $LabRoleArn = '<verified-LabRole-arn>'
   sam deploy --guided --template-file infrastructure/template.yaml --region $Region --capabilities CAPABILITY_IAM --parameter-overrides "LambdaExecutionRoleArn=$LabRoleArn"
   ```

   Otherwise, omit `--parameter-overrides` to use the default per-function
   roles. Do this only if the Academy account permits the role and policy
   creation requested by CloudFormation. Choose a unique stack name. Do not
   accept an unexpected change set.

2. **Read stack outputs** (read-only; use the exact stack name chosen above):

   ```powershell
   $StackName = '<stack-name>'
   aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
   ```

   Record the API URL, pool/client IDs, table names, and region locally. These
   identifiers are not passwords, but do not commit environment files.

3. **Seed sample events.** This writes items to the deployed events table:

   ```powershell
   $EventsTable = '<EventsTableName-output>'
   $RegistrationsTable = '<RegistrationsTableName-output>'
   $env:AWS_REGION = $Region
   npm --prefix backend run seed:dynamodb -- --events-table $EventsTable --registrations-table $RegistrationsTable
   ```

   Seeding is idempotent and does not overwrite existing events. Use the
   reconcile script only if counters need initialization; inspect its report
   first and do not use `--force` while registration writes are active.

4. **Configure and build the frontend.** The API URL and Cognito IDs are
   public client configuration, not secrets. Put them in the ignored
   `apps/web/.env.production.local` file, then build:

   ```dotenv
   VITE_API_MODE=live
   VITE_API_URL=<ApiUrl-output>
   VITE_AUTH_MODE=cognito
   VITE_ALLOWED_EMAIL_DOMAIN=ves.ac.in
   VITE_DEV_AUTH=false
   VITE_COGNITO_REGION=<CognitoRegion-output>
   VITE_COGNITO_USER_POOL_ID=<UserPoolId-output>
   VITE_COGNITO_CLIENT_ID=<UserPoolClientId-output>
   ```

   ```powershell
   npm --prefix apps/web run build
   ```

5. **Host the frontend.** Create/configure the chosen S3/CloudFront hosting
   outside this SAM template. In the S3 console, create a bucket in the
   selected region and configure either static website hosting (public read
   may be blocked by Academy policy) or a private bucket behind CloudFront.
   Configure `index.html` as the index and provide a fallback for React routes
   such as `/events/<id>`. Then upload without deleting unrelated bucket
   objects:

   ```powershell
   $BucketName = '<frontend-bucket-name>'
   aws s3 sync apps/web/dist "s3://$BucketName" --region $Region
   ```

   This sync writes/updates frontend objects. Restrict bucket access according
   to the chosen hosting design; never upload `.env*`, credentials, or
   `.aws-sam`.

6. **Provision Admin accounts.** Public self-sign-up never grants privileged
   groups. Create Admin accounts privately through the operator script. It
   requires Cognito administrative permissions, which may be blocked in
   Academy. If approved, install its dependency and provide the initial
   password through a temporary environment variable, not a command argument:

   ```powershell
   npm --prefix scripts install
   $env:COGNITO_USER_POOL_ID = '<UserPoolId-output>'
   $env:AWS_REGION = $Region
   $securePassword = Read-Host 'Temporary account password' -AsSecureString
   $env:UNIVENT_PROVISION_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
   node scripts/provision-cognito-user.js --email '<admin-email>' --name 'UniVent Admin' --role admin
   Remove-Item Env:UNIVENT_PROVISION_PASSWORD
   ```

   Do not use the script to provision organization group membership. The
   organization applies through the frontend; the decision API synchronizes
   the group only after the Admin approves. Clear the temporary variable even
   if provisioning fails.

## Deployed acceptance checks

Use the public API URL from the stack output and the browser app built with the
matching Cognito outputs:

- `GET /events` without a token returns `200` and an `{ "events": [...] }`
  envelope, including counts for seeded events.
- Protected `GET /registrations`, `POST /register`, and `POST /events` reject
  missing/invalid tokens with `401`; verify the response is readable from the
  frontend origin (CORS).
- Protected `GET /organization/events` and `PUT /events/{eventId}` also reject
  missing/invalid tokens with `401`.
- Submit an organization application. Before approval, verify it is `PENDING`
  and organization event/registration routes return `403`. As Admin, verify
  the application list, reject with a reason, and verify stale organization
  group claims still receive `403`. Approve it and verify the group and
  persisted state allow organization features.
- Sign up a student at the allowed domain, receive/enter the email code, sign
  in, and confirm the app sends the ID token. Check student registration
  history is limited to that student.
- As admin, create a test event with capacity `1`; verify student creation is
  denied (`403`), admin creation succeeds, student registration succeeds once,
  duplicate registration returns `409`, and a second student gets `409` when
  the event is full. Verify an admin can list all registrations and a student
  cannot create events.
- Verify an approved organization can create/list/edit only its own events
  and view only their registrations. A second organization must receive `403`
  when editing the first organization's event or filtering registrations by
  that event. Verify a student receives `403` on organization-only routes and
  an Admin can list/edit events and view all registrations.
- Verify events created before the ownership GSI have not been rewritten and
  are not included in organization lists; public browsing and student
  registration/capacity/duplicate checks still work.
- Check each Lambda's `/aws/lambda/<function-name>` CloudWatch log group for
  invocation/error records. API Gateway access logs are not available until
  explicitly configured. Avoid logging tokens or passwords.

Record actual outputs and results in `docs/aws-setup.md` after the tests. Phase
7 is complete only after the public frontend/API checks and the agreed
monitoring checks pass. Local SAM validation/build are not deployment evidence.
