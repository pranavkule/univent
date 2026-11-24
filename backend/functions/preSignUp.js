const {
  CognitoIdentityProviderClient,
  ListUserPoolClientsCommand,
} = require('@aws-sdk/client-cognito-identity-provider')

const DEFAULT_ALLOWED_DOMAIN = 'ves.ac.in'

function allowedDomain() {
  return String(process.env.ALLOWED_SIGNUP_DOMAIN || DEFAULT_ALLOWED_DOMAIN)
    .trim()
    .toLowerCase()
}

function isAllowedEmail(email) {
  const clean = String(email || '').trim().toLowerCase()
  const parts = clean.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false
  return parts[1] === allowedDomain()
}

function emailFrom(event) {
  const attributes = (event && event.request && event.request.userAttributes) || {}
  return attributes.email || ''
}

function getClient() {
  return new CognitoIdentityProviderClient({})
}

function createStudentClientChecker(cognitoClient) {
  const studentClientIdsByPool = new Map()
  return async (userPoolId, clientId) => {
    if (!userPoolId || !clientId) return false
    let studentClientIds = studentClientIdsByPool.get(userPoolId)
    if (!studentClientIds) {
      studentClientIds = new Set()
      let nextToken
      do {
        const result = await cognitoClient.send(
          new ListUserPoolClientsCommand({
            UserPoolId: userPoolId,
            MaxResults: 60,
            ...(nextToken ? { NextToken: nextToken } : {}),
          }),
        )
        for (const appClient of result.UserPoolClients || []) {
          if (appClient.ClientName === process.env.STUDENT_CLIENT_NAME) {
            studentClientIds.add(appClient.ClientId)
          }
        }
        nextToken = result.NextToken
      } while (nextToken)
      studentClientIdsByPool.set(userPoolId, studentClientIds)
    }
    return studentClientIds.has(clientId)
  }
}

function createHandler(cognitoClient = getClient()) {
  const isStudentClient = createStudentClientChecker(cognitoClient)
  return async (event) => {
    const source = event && event.triggerSource

    if (source === 'PreSignUp_AdminCreateUser') return event
    if (source !== 'PreSignUp_SignUp') {
      throw new Error('Sign-up is not available for this identity provider.')
    }

    if (!isAllowedEmail(emailFrom(event))) {
      throw new Error(`Only @${allowedDomain()} email addresses can sign up.`)
    }

    if (!(await isStudentClient(event.userPoolId, event.callerContext?.clientId))) {
      throw new Error('Organization accounts must use the administrator-approved application workflow.')
    }

    return event
  }
}

exports.handler = createHandler()
exports.isAllowedEmail = isAllowedEmail
exports.createHandler = createHandler
