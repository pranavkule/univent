const {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUserPoolClientsCommand,
} = require('@aws-sdk/client-cognito-identity-provider')

let client = null

function getClient() {
  const region = process.env.AWS_REGION
  if (!region) throw new Error('AWS_REGION must be set for Cognito account classification.')
  if (!client) client = new CognitoIdentityProviderClient({ region })
  return client
}

async function accountTypeForClient(userPoolId, clientId) {
  let nextToken
  do {
    const result = await getClient().send(
      new ListUserPoolClientsCommand({
        UserPoolId: userPoolId,
        MaxResults: 60,
        ...(nextToken ? { NextToken: nextToken } : {}),
      }),
    )
    const clientDetails = (result.UserPoolClients || []).find((item) => item.ClientId === clientId)
    if (clientDetails) {
      if (clientDetails.ClientName === process.env.ORGANIZATION_APPLICANT_CLIENT_NAME) {
        return 'ORGANIZATION_APPLICANT'
      }
      if (clientDetails.ClientName === process.env.STUDENT_CLIENT_NAME) return 'STUDENT'
      return null
    }
    nextToken = result.NextToken
  } while (nextToken)
  return null
}

exports.handler = async (event) => {
  if (event?.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event

  const userPoolId = event.userPoolId
  const username = event.userName
  const clientId = event.callerContext?.clientId
  const sub = event.request?.userAttributes?.sub
  if (!userPoolId || !username || !clientId || !sub) {
    throw new Error('Cognito confirmation event is missing its trusted user identity.')
  }

  const accountType = await accountTypeForClient(userPoolId, clientId)
  if (!accountType) return event

  await getClient().send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: username,
      UserAttributes: [{ Name: 'custom:account_type', Value: accountType }],
    }),
  )
  return event
}

exports.accountTypeForClient = accountTypeForClient
