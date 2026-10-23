# UniVent — Serverless Event Registration and Management System

UniVent is a cloud-based event registration and management application designed for colleges, universities, and organizations. It allows users to explore events, register online, and receive registration confirmations through a simple web interface.

Serverless college event registration and management system built with React + Vite on the frontend and AWS serverless on the backend. The Phase 3 API, Phase 4 DynamoDB storage, and Phase 5 Cognito authentication are implemented and verified locally. Phase 6 connects the frontend data seam to that API while keeping a browser-local mock mode; auth can run in mock or Cognito mode. The project demonstrates how AWS serverless services can be integrated to build a scalable application without managing traditional servers.

## What it does (scope)
- Students browse college events, view details, and register after signing in.
- Participants view their own registration history; cancellation remains a
  mock-mode demo feature until the backend exposes a cancel route.
- The frontend data seam supports the API Gateway/Lambda API or browser-local
  mock data. DynamoDB storage and Cognito auth are implemented locally.
  Deployment and live checks remain Phase 7.

## Project Overview

**Project Name:** UniVent  
**Project Type:** Cloud Computing Mini Project  
**Platform:** Amazon Web Services (AWS)  
**Frontend:** React.js + Vite  
**Backend:** AWS Lambda + Amazon API Gateway  
**Database:** Amazon DynamoDB  

## Objectives

- Develop a web-based event registration and management system.
- Implement a serverless backend using AWS Lambda and API Gateway.
- Store event and registration data using Amazon DynamoDB.
- Implement authentication and access control using Amazon Cognito.
- Host the frontend using Amazon S3.
- Monitor backend activity and errors using Amazon CloudWatch.
- Demonstrate the practical application of cloud computing concepts.

## Features

### User Features
- Browse available college events.
- View event details, including date, venue, and description.
- Register for events using an online registration form.
- Receive a unique registration ID upon successful registration.
- Sign in and sign out using the authentication system.

### Organizer Features
- Create and manage event listings.
- View registrations for individual events.
- Access organizer functionality based on assigned permissions.

### Cloud Features
- Serverless backend execution.
- Persistent storage of event and registration data.
- Managed user authentication.
- Centralized backend logs and error monitoring.
- Cloud-hosted frontend accessible through a web browser.

*Feature availability depends on the current implementation status. See the project roadmap in [`phases.md`](phases.md).*

## AWS Services Used

| AWS Service | Purpose |
|---|---|
| Amazon S3 | Hosts the frontend application files. |
| Amazon API Gateway | Provides HTTP endpoints for frontend-to-backend communication. |
| AWS Lambda | Executes backend logic for event and registration operations. |
| Amazon DynamoDB | Stores event details and participant registrations. |
| Amazon Cognito | Handles user authentication and supports access control. |
| Amazon CloudWatch | Collects Lambda logs and helps monitor application errors. |

## System Architecture

```text
                 Users / Organizers
                         |
                         v
                React + Vite Frontend
                         |
                    Amazon S3
                  (Static Hosting)
                         |
                         v
                  Amazon API Gateway
                         |
                         v
                    AWS Lambda
                         |
                         v
                  Amazon DynamoDB
             (Events and Registrations)

        Amazon Cognito
        Authentication and Access Control

        Amazon CloudWatch
        Logs and Monitoring
```

## Docs (read in this order)
1. `docs/architecture.md` — scope, services, how a request flows.
2. `docs/api.md` — routes, auth/role rules, and data shapes.
3. `docs/aws-setup.md` — what to create in AWS and in which order.
4. `docs/testing.md` — how we will test it.
5. `phases.md` + `docs/phases/` — implementation roadmap (Phases 1–6 done locally).

## Run the frontend
```bash
cd apps/web
npm install
npm run dev      # http://localhost:5173
```
Routes: `/` landing, `/events`, `/events/:id`, `/events/:id/register`
(student sign-in required), `/confirmation/:id`, `/signup`,
`/confirm-signup`, `/signin`, `/dashboard` (student hub), `/registrations`,
`/profile`, `/org/*` (organization role), `/admin/*` (admin role).

Default local mode is mock data plus mock auth: seed events and demo accounts
ship with the app, while created events, accounts, and registrations are stored
in this browser's localStorage. Demo accounts are available for student,
organization (CodeCell), and admin (mock password `Demo@123`).

To call the backend, copy `.env.example` to `.env.local`, set
`VITE_API_MODE=live` and `VITE_API_URL` to the API Gateway (or
`http://localhost:3000` for `scripts/dev-api.js`). For local SAM testing with
development identity headers, also set `VITE_DEV_AUTH=true`. For Cognito, set
`VITE_AUTH_MODE=cognito` plus the pool/client/region values.

`npm test` covers auth validation, role mapping, the mock auth flow, and the
live API transport with mocked HTTP; `npm run build` is the production check.

## Request flow
**Request flow:**

1. Users open the UniVent website hosted on Amazon S3.
2. The frontend retrieves event information through Amazon API Gateway.

1. Users open the UniVent website hosted on Amazon S3.
2. The frontend retrieves event information through Amazon API Gateway.
3. API Gateway invokes the appropriate AWS Lambda function.
4. Lambda validates requests and performs the required operation.
5. DynamoDB stores or retrieves the requested information.
6. The backend returns a response to the frontend.
7. The application displays the result, including a registration confirmation when successful.

## Status
Phases 1–6 complete locally (foundation, frontend, API, DynamoDB storage,
Cognito auth, frontend API integration). No AWS deployment yet; Phase 7
deploys and runs the live auth checks. See `phases.md`.

Amazon Cognito supports authentication and protected operations, while CloudWatch provides backend execution logs for troubleshooting.

## Technology Stack

- **Frontend:** React.js, Vite, JavaScript, CSS
- **Backend:** Node.js, AWS Lambda
- **API:** Amazon API Gateway
- **Database:** Amazon DynamoDB
- **Authentication:** Amazon Cognito
- **Hosting:** Amazon S3
- **Monitoring:** Amazon CloudWatch
- **Infrastructure as Code:** AWS Serverless Application Model (AWS SAM)
- **Version Control:** Git and GitHub

## Project Structure

```text
UniVent/
├── apps/
│   └── web/                  # React + Vite frontend
├── backend/
│   └── functions/            # AWS Lambda handlers
├── infrastructure/
│   └── template.yaml         # AWS SAM configuration
├── docs/
│   ├── architecture.md       # System architecture
│   ├── api.md                # API documentation
│   ├── aws-setup.md           # AWS setup and deployment
│   ├── testing.md             # Testing instructions and results
│   └── screenshots/           # Application screenshots
├── scripts/                  # Optional helper scripts
├── phases.md                 # Implementation roadmap
├── .gitignore
└── README.md
```

The structure may evolve as implementation progresses. Only files that exist in the repository should be treated as implemented deliverables.

## Getting Started

### Prerequisites

Install the following tools before running the application:

- [Node.js](https://nodejs.org/) — compatible with the project's dependencies.
- npm — included with Node.js.
- [Git](https://git-scm.com/) — for cloning the repository.
- [AWS CLI](https://aws.amazon.com/cli/) — for AWS configuration and deployment.
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) — for serverless deployment.

An AWS account with the required permissions is needed for cloud deployment.

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd UniVent
```

Replace the placeholder with your actual GitHub repository URL.

### 2. Run the Frontend

Navigate to the frontend directory:

```bash
cd apps/web
npm install
npm run dev
```

Open the local URL printed by Vite in your terminal.

Without `VITE_API_MODE=live`, the frontend uses browser-local mock data. Set the API and auth variables described above to use the real backend.

### 3. Configure the AWS Backend

Once the backend and infrastructure files are implemented:

1. Configure the AWS CLI with an appropriately authorized account.
2. Review the AWS resources defined in `infrastructure/template.yaml`.
3. Configure the required environment variables.
4. Install dependencies: `npm --prefix backend/functions install` and,
   only if provisioning users, `npm --prefix scripts install`.
5. Build and test the application using the project's documented commands.
6. Record the stack outputs `ApiUrl`, `UserPoolId`, `UserPoolClientId`, and
   `CognitoRegion`; use the Cognito values in the frontend `.env.local`.
   Create privileged users only with `scripts/provision-cognito-user.js`.

Example AWS CLI configuration:

```bash
aws configure
aws sts get-caller-identity
```

Do not commit AWS access keys, secret keys, passwords, or `.env` files to GitHub.

### 4. Deploy the Backend

From the repository root, use the AWS SAM workflow after the template and backend are ready:

```bash
sam validate --template-file infrastructure/template.yaml
sam build --template-file infrastructure/template.yaml
sam deploy --guided --template-file infrastructure/template.yaml
```

Follow the prompts to configure the deployment stack, AWS Region, and required deployment settings. Review the resources and possible costs before deployment.

### 5. Deploy the Frontend

After the backend is deployed:

1. Configure the production API URL and Cognito settings as required.
2. Build the frontend.
3. Create or configure the intended S3 hosting destination.
4. Upload the production build files.
5. Open the deployed website and test its API connectivity.

Use the actual deployment instructions in [`docs/aws-setup.md`](docs/aws-setup.md) once the infrastructure is finalized.

## Project Roadmap

UniVent is developed in small, testable phases.

| Phase | Description |
|---|---|
| 1 | Repository setup, folder structure, and documentation |
| 2 | Frontend prototype using mock data |
| 3 | Serverless backend and API development |
| 4 | DynamoDB integration |
| 5 | Cognito authentication and access control |
| 6 | Application integration and security checks |
| 7 | AWS deployment and CloudWatch monitoring |
| 8 | Testing, documentation, and final demonstration |

Refer to [`phases.md`](phases.md) for current progress, deliverables, and completion criteria.

## Testing

Locally verified so far:

- Frontend auth validation, role mapping, mock sign-up/sign-in, and live API
  transport with mocked HTTP for mock/dev and Cognito auth modes
  (`npm --prefix apps/web test`).
- Event retrieval/creation and registration API endpoints plus the
  student/org/admin role matrix, including public registration counts
  (`npm --prefix backend test`).
- Persistence, concurrency, duplicate prevention, and owner-scoped reads
  against DynamoDB Local (`npm --prefix backend run test:integration`).
- SAM template validation/build and the production frontend build.

Deployment-dependent checks remain: real Cognito email confirmation, live
group claims, API Gateway `401`/`403` CORS, token refresh, and CloudWatch logs.

See [`docs/testing.md`](docs/testing.md) for commands and results.

## Security Considerations

- Use IAM roles with least-privilege permissions.
- Protect organizer-only operations on the backend.
- Enforce the role matrix in Lambda, not only in React route guards.
- Restrict student self sign-up to exact `@ves.ac.in` addresses.
- Require email-code confirmation before first sign-in.
- Provision admin/organization accounts with the operator script, not public sign-up.
- Validate and sanitize user input.
- Keep credentials and secrets out of source control; never log provisioning passwords.
- Configure API CORS rules for the intended frontend origin.
- Avoid exposing sensitive participant information.
- Review AWS resource permissions and costs before deployment.

## Learning Outcomes

Through this project, we aim to understand:

- Serverless computing and event-driven execution.
- Cloud-based static website hosting.
- API development and integration.
- NoSQL database design and persistence.
- User authentication and authorization.
- Cloud logging, monitoring, and troubleshooting.
- Infrastructure deployment using AWS SAM.
- Collaborative development using Git and GitHub.

## Future Enhancements

Potential enhancements, depending on project scope and available time, include:

- Event capacity limits and waitlists.
- Registration cancellation.
- Email confirmation notifications.
- Search and filtering for events.
- Organizer analytics and registration statistics.
- QR-code-based attendance verification.

These are optional enhancements and are not considered implemented unless documented and tested.

## Team

**Project:** UniVent — Serverless Event Registration and Management System
**Course:** Cloud Computing Lab

## Acknowledgement

This project is developed as part of the Cloud Computing Lab to demonstrate the integration of AWS services in a practical serverless application.

---

*UniVent — Simplifying College Event Registration with AWS.*
