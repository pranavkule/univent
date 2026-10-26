# UniVent

**A Serverless College Event Management Platform on AWS**

UniVent is a college event discovery and registration platform developed as a Cloud Computing Lab mini-project. It enables students to discover campus events and register online, while authorized organizations manage events and administrators oversee organization applications.

The application uses AWS serverless services to provide API-driven functionality, authentication, and persistent data storage.

## Features

- **Student portal:** Browse events, view event details, and register for events.
- **Organization portal:** Apply for organization access and manage events after approval.
- **Admin portal:** Review organization applications and approve, reject, or suspend organizations.
- **Email verification:** Verify college email addresses through Amazon Cognito.
- **Role-based authorization:** Restrict organization and administrative operations to authorized users.
- **Event registration:** Validate registrations and enforce event capacity rules.
- **Responsive interface:** Web interface built with React and Vite.
- **Monitoring:** AWS CloudWatch integration for backend logs and operational troubleshooting.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | AWS Lambda, Node.js |
| API | Amazon API Gateway HTTP API |
| Database | Amazon DynamoDB |
| Authentication | Amazon Cognito |
| Monitoring | Amazon CloudWatch |
| Infrastructure | AWS SAM, AWS CloudFormation |
| Version control | Git and GitHub |

## Architecture

```text
                 Students / Organizations / Admins
                              |
                              v
                     React + Vite Frontend
                              |
                       HTTPS API Requests
                              |
                              v
                    Amazon API Gateway
                              |
                              v
                       AWS Lambda
                              |
                 +------------+------------+
                 |            |            |
                 v            v            v
             DynamoDB      Cognito     CloudWatch
             Data Store    Identity     Logs and
                           Management   Monitoring
```

The frontend communicates with the backend through API Gateway. Lambda functions implement application logic, DynamoDB stores application records, Cognito manages user authentication, and CloudWatch provides logging.

## User Roles

### Student
- Register with a college email address.
- Verify the email address and sign in.
- Browse available events.
- Register for events subject to eligibility and capacity rules.

### Organization
- Register and verify a college email address.
- Submit an organization access application.
- Wait for administrator approval.
- Manage events after approval and authorization.

### Administrator
- Sign in through an authorized administrator account.
- View organization applications.
- Approve, reject, or suspend applications.
- Control access to organization functionality through the backend authorization workflow.

Organization privileges are not granted merely because a user registers. The backend checks the required Cognito group membership and persisted approval status.

## Project Structure

```text
univent/
├── apps/
│   └── web/                  # React + Vite frontend
├── infrastructure/
│   └── template.yaml         # AWS SAM infrastructure template
├── README.md
└── ...
```

The repository may contain additional documentation, backend source files, tests, and configuration files. Refer to the repository for the complete structure.

## Prerequisites

To run the frontend locally, install:

- [Node.js](https://nodejs.org/) (Node.js 22 is the project's development environment)
- npm
- [Git](https://git-scm.com/)
- A modern web browser

The frontend can communicate with the deployed backend without requiring the developer to configure AWS credentials locally.

AWS CLI and AWS SAM CLI are required for developers who need to work on or deploy the infrastructure.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/pranavkule/univent.git
cd univent
```

### 2. Install frontend dependencies

```bash
cd apps/web
npm install
```

### 3. Configure the frontend

Create a `.env.local` file inside `apps/web/`:

```dotenv
VITE_API_MODE=live
VITE_API_URL=https://ng4iz34pfb.execute-api.us-east-1.amazonaws.com/Prod

VITE_AUTH_MODE=cognito
VITE_ALLOWED_EMAIL_DOMAIN=ves.ac.in
VITE_DEV_AUTH=false

VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_KGPCzB46L
VITE_COGNITO_CLIENT_ID=215vq2fi0hif59jpn4700mb6ar
```

These settings point the frontend to the configured UniVent AWS backend and Cognito user pool.

The values above identify the frontend's API and authentication configuration. They are not AWS access keys. Never put AWS secret keys, session tokens, or other private credentials in frontend environment variables.

### 4. Start the development server

From the `apps/web` directory:

```bash
npm run dev
```

Vite will print a local development URL, usually:

```text
http://localhost:5173
```

Open that URL in your browser.

### 5. Test authentication and functionality

- Register with an eligible `ves.ac.in` email address.
- Complete email verification.
- Sign in and browse events.
- Test event registration.
- Submit an organization application using a separate test account.
- Sign in using an authorized administrator account to review the application.
- Verify that organization functionality becomes available only after approval.

The organization workflow requires the backend's authorization checks to pass. Do not manually grant organization privileges to bypass the approval process.

## API Endpoints

The deployed API base URL is:

```text
https://ng4iz34pfb.execute-api.us-east-1.amazonaws.com/Prod
```

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/events` | Retrieve events |
| POST | `/events` | Create an event with appropriate authorization |
| POST | `/register` | Register for an event |
| GET | `/registrations` | Retrieve registrations subject to authorization |
| GET | `/organization-applications` | Retrieve organization applications with appropriate authorization |
| POST | `/organization-applications` | Submit an organization application |
| PATCH | `/admin/organization-applications/{userSub}` | Update an organization's application status |

Protected endpoints require the appropriate authentication and authorization. Refer to the backend implementation for request schemas, response formats, validation rules, and error codes.

## Testing

Run the frontend tests from `apps/web` using the test script configured in that package:

```bash
npm test
```

If the package does not define a `test` script, inspect `apps/web/package.json` for the available test commands.

Backend tests and local API testing should be run using the scripts and instructions provided in the repository.

Before a release, verify:

- Student registration and email verification.
- Login and logout.
- Event listing and registration.
- Event capacity validation.
- Organization application submission.
- Administrator approval and rejection.
- Organization access restrictions.
- Error handling and empty states.
- Production frontend build.

Automated tests and live AWS workflow tests are different; both should be checked before considering a deployment fully verified.

## AWS Deployment

The backend infrastructure is defined using AWS SAM and AWS CloudFormation.

The deployed environment uses:

- Amazon API Gateway
- AWS Lambda
- Amazon DynamoDB
- Amazon Cognito
- Amazon CloudWatch

The frontend can be built for production using:

```bash
cd apps/web
npm run build
```

Vite generates the production build in the `dist/` directory by default. This build can be hosted on Amazon S3, with CloudFront recommended for public HTTPS access and frontend delivery.

Before deploying, verify the production environment variables, API CORS configuration, routing behavior, and AWS resource permissions.

**Note:** The frontend build and backend deployment do not, by themselves, mean the frontend is publicly hosted. Use the deployment configuration and current AWS resource status to determine which components are publicly accessible.

## Security Considerations

- Do not commit AWS access keys, secret keys, or session tokens.
- Do not commit private local environment files.
- Keep the frontend authentication configuration separate from AWS infrastructure credentials.
- Enforce authorization in backend handlers, not only in the user interface.
- Do not grant organization or administrator privileges through public registration.
- Do not expose DynamoDB tables directly to public clients.
- Review CloudWatch logs for sensitive information before sharing them.

## Development Workflow

1. Clone the repository.
2. Create a local environment file.
3. Install dependencies.
4. Run the frontend locally.
5. Test changes against the appropriate backend environment.
6. Run relevant tests and the production build.
7. Review the changes before committing.
8. Deploy only after the changes have been verified.

## Project Status

UniVent has an implemented React frontend and an AWS serverless backend with Cognito-based authentication and organization approval workflows.

The current development and deployment status should be verified against the latest repository, test results, and AWS resources. Public frontend hosting and end-to-end live testing should be documented as complete only after they have been verified.

## Academic Context

This project was developed as part of a Cloud Computing Lab mini-project to explore serverless application development, cloud-hosted APIs, managed databases, identity management, and cloud monitoring using AWS.

## Repository

GitHub: https://github.com/pranavkule/univent
