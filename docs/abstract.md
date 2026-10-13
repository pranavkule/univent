# Abstract — UniVent

UniVent is a serverless web application for college event registration
and management. Students can browse events, view details, and register
online; admins can create events and view registrations. Signed-in access
protects registration and admin actions.

The frontend is built with React + Vite and hosted on Amazon S3
(+ CloudFront). The backend uses Amazon API Gateway to route requests to
four AWS Lambda functions, with Amazon DynamoDB storing events and
registrations, Amazon Cognito handling authentication, and Amazon
CloudWatch providing logs and monitoring. Infrastructure is defined as
code with AWS SAM.

The goal is a low-cost, scalable system with no servers to manage,
suitable as a cloud computing mini-project and easy to explain,
deploy, and demo.
