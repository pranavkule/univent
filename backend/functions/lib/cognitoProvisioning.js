const {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider')
const { randomBytes } = require('node:crypto')
const { CODES, StoreError } = require('./storeError')

let client = null

function getClient() {
  const region = process.env.AWS_REGION
  if (!region) throw new Error('AWS_REGION must be set for Cognito account provisioning.')
  if (!client) client = new CognitoIdentityProviderClient({ region })
  return client
}

function getUserPoolId() {
  const id = process.env.COGNITO_USER_POOL_ID
  if (!id) throw new Error('COGNITO_USER_POOL_ID must be set for Cognito account provisioning.')
  return id
}

function attributeMap(user) {
  return Object.fromEntries(
    (user?.Attributes || user?.UserAttributes || [])
      .map((attribute) => [attribute.Name, attribute.Value]),
  )
}

function applicationBinding(application) {
  if (!application?.applicationId || !application?.officialEmail) {
    throw new Error('The organization application is missing its account binding.')
  }
  return {
    email: String(application.officialEmail).trim().toLowerCase(),
    marker: `univent-org-application-${application.applicationId}`,
  }
}

async function getBoundUser(application, client, userPoolId) {
  const { email, marker } = applicationBinding(application)
  let user
  try {
    user = await client.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }),
    )
  } catch (err) {
    if (err?.name === 'UserNotFoundException') return null
    throw err
  }
  const attributes = attributeMap(user)
  if (
    attributes.email?.toLowerCase() !== email
    || attributes.preferred_username !== marker
    || !attributes.sub
  ) {
    throw new StoreError(CODES.ORGANIZATION_ACCOUNT_EXISTS)
  }
  return { user, attributes, email }
}

async function discardNewUser(email, client, userPoolId) {
  try {
    await client.send(
      new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email }),
    )
  } catch (err) {
    console.error('organization account cleanup failed:', err && err.name)
  }
}

async function createOrganizationAccount(
  application,
  password,
  client = getClient(),
  userPoolId = getUserPoolId(),
) {
  const { email, marker } = applicationBinding(application)
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('An organization password is required for account provisioning.')
  }

  let created = false
  let user
  try {
    const result = await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: application.applicantName },
          { Name: 'preferred_username', Value: marker },
        ],
        MessageAction: 'SUPPRESS',
        TemporaryPassword: `${randomBytes(32).toString('base64')}A1a!`,
        ForceAliasCreation: false,
      }),
    )
    created = true
    user = result.User
  } catch (err) {
    if (!err || err.name !== 'UsernameExistsException') throw err
  }

  try {
    if (!created) {
      const existing = await getBoundUser(application, client, userPoolId)
      if (!existing) throw new StoreError(CODES.ORGANIZATION_ACCOUNT_EXISTS)
      user = existing.user
    }

    const sub = attributeMap(user).sub
    if (!sub) throw new Error('Cognito did not return the provisioned user identifier.')
    await client.send(
      new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: email }),
    )
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      }),
    )
    return sub
  } catch (err) {
    if (created) await discardNewUser(email, client, userPoolId)
    throw err
  }
}

async function enableOrganizationAccount(application, client = getClient(), userPoolId = getUserPoolId()) {
  const bound = await getBoundUser(application, client, userPoolId)
  if (!bound) throw new Error('The approved organization account was not found.')
  if (bound.user.Enabled !== true) {
    await client.send(
      new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: bound.email }),
    )
  }
  return bound.attributes.sub
}

async function disableOrganizationAccount(application, client = getClient(), userPoolId = getUserPoolId()) {
  const bound = await getBoundUser(application, client, userPoolId)
  if (!bound) return false
  await client.send(
    new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: bound.email }),
  )
  await client.send(
    new AdminUserGlobalSignOutCommand({ UserPoolId: userPoolId, Username: bound.email }),
  )
  return true
}

module.exports = {
  createOrganizationAccount,
  enableOrganizationAccount,
  disableOrganizationAccount,
}
