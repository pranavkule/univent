# UniVent — Serverless Event Registration and Management System

# UniVent — Serverless Event Registration and Management System

UniVent is a cloud-based event registration and management application designed for colleges, universities, and organizations. It allows users to explore events, register online, and receive registration confirmations through a simple web interface.

Serverless college event registration and management system built with React + Vite on the frontend and AWS serverless on the backend. The current Phase 2 frontend prototype uses mock data and browser-only mock sign-in. The project demonstrates how AWS serverless services can be integrated to build a scalable application without managing traditional servers.

## What it does (scope)
- Students browse college events, view details, and register (mock sign-in required).
- Participants view and cancel their own mock registrations on a dashboard.
- Everything runs on browser-local mock data for now; real backend (API Gateway,
  Lambda, DynamoDB) and real sign-in (Cognito) come in later phases.

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
2. `docs/api.md` — planned endpoints and data shapes.
3. `docs/aws-setup.md` — what to create in AWS and in which order.
4. `docs/testing.md` — how we will test it.
5. `phases.md` + `docs/phases/` — implementation roadmap (Phases 1–2 done).

## Run the frontend (Phase 2, mock data)
```bash
cd apps/web
npm install
npm run dev      # http://localhost:5173
```
Routes: `/` landing, `/events`, `/events/:id`, `/events/:id/register`
(sign-in required), `/confirmation/:id`, `/signup`, `/signin`, `/dashboard`
(student hub), `/registrations`, `/profile`, `/org/*` (organization role),
`/admin/*` (admin role).
`npm run build` + `npm run preview` verified. Mock users/registrations live
only in this browser's localStorage — temporary prototype storage, not a
backend. Demo accounts: student, organization (CodeCell), and admin, all with
mock password `Demo@123`. No test suite exists yet; the production build is
the current check.

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
Phases 1–2 completed (foundation + mock-data frontend). Phases 3–8 not started.
See `phases.md`.

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

The frontend may initially use mock data, depending on the implementation phase.

### 3. Configure the AWS Backend

Once the backend and infrastructure files are implemented:

1. Configure the AWS CLI with an appropriately authorized account.
2. Review the AWS resources defined in `infrastructure/template.yaml`.
3. Configure the required environment variables.
4. Install the backend dependencies.
5. Build and test the application using the project's documented commands.

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

Testing will cover the following areas as the corresponding features are implemented:

- Frontend rendering and form validation.
- Event retrieval and registration API endpoints.
- Successful and invalid registration requests.
- Persistence and retrieval of DynamoDB records.
- Authentication and organizer authorization.
- Error handling and unauthorized API requests.
- Deployed application availability.
- Lambda execution logs in CloudWatch.

See [`docs/testing.md`](docs/testing.md) for the actual test procedures and results.

## Security Considerations

- Use IAM roles with least-privilege permissions.
- Protect organizer-only operations on the backend.
- Validate and sanitize user input.
- Keep credentials and secrets out of source control.
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
