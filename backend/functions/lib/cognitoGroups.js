const {
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider')

let client = null

function getClient() {
  const region = process.env.AWS_REGION
  if (!region) throw new Error('AWS_REGION must be set for Cognito group management.')
  if (!client) client = new CognitoIdentityProviderClient({ region })
  return client
}

function userPoolId() {
  const id = process.env.COGNITO_USER_POOL_ID
  if (!id) throw new Error('COGNITO_USER_POOL_ID must be set for Cognito group management.')
  return id
}

async function addOrganizationGroup(userSub) {
  await getClient().send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId(),
      Username: userSub,
      GroupName: 'organizations',
    }),
  )
}

async function removeOrganizationGroup(userSub) {
  await getClient().send(
    new AdminRemoveUserFromGroupCommand({
      UserPoolId: userPoolId(),
      Username: userSub,
      GroupName: 'organizations',
    }),
  )
}

module.exports = { addOrganizationGroup, removeOrganizationGroup }
