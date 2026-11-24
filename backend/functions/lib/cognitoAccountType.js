const {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider')

const ACCOUNT_TYPES = {
  STUDENT: 'STUDENT',
  ORGANIZATION_APPLICANT: 'ORGANIZATION_APPLICANT',
}
const VALID_ACCOUNT_TYPES = new Set(Object.values(ACCOUNT_TYPES))

let client = null

function getClient() {
  const region = process.env.AWS_REGION
  if (!region) throw new Error('AWS_REGION must be set for Cognito account lookup.')
  if (!client) client = new CognitoIdentityProviderClient({ region })
  return client
}

function userPoolId() {
  const id = process.env.COGNITO_USER_POOL_ID
  if (!id) throw new Error('COGNITO_USER_POOL_ID must be set for Cognito account lookup.')
  return id
}

async function getAccountType(principal) {
  if (!principal?.sub || !principal.email) return null

  const result = await getClient().send(
    new AdminGetUserCommand({
      UserPoolId: userPoolId(),
      Username: principal.email,
    }),
  )
  const attributes = Object.fromEntries(
    (result.UserAttributes || []).map(({ Name, Value }) => [Name, Value]),
  )
  if (attributes.sub !== principal.sub) return null

  const accountType = attributes['custom:account_type']
  return VALID_ACCOUNT_TYPES.has(accountType) ? accountType : null
}

module.exports = { ACCOUNT_TYPES, getAccountType }
