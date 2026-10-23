#!/usr/bin/env node
const {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider')

const ALLOWED_ROLES = {
  admin: 'admins',
  organization: 'organizations',
}
const PRIVILEGED_GROUPS = new Set(Object.values(ALLOWED_ROLES))
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function usage() {
  return [
    'Usage:',
    '  node scripts/provision-cognito-user.js --email <email> --role <admin|organization> [options]',
    '',
    'Required:',
    '  --email <email>              Account email (also the Cognito username).',
    '  --role <admin|organization>  Cognito group to assign.',
    '',
    'Options:',
    '  --name <name>                Display name (defaults to the email local part).',
    '  --user-pool-id <id>          Cognito User Pool ID (or COGNITO_USER_POOL_ID).',
    '  --region <region>            AWS region (or AWS_REGION / AWS_DEFAULT_REGION).',
    '  --update-existing            Explicitly allow updating an existing user.',
    '  --help                       Show this message.',
    '',
    'New users, and existing users with a temporary password, require',
    'UNIVENT_PROVISION_PASSWORD in the environment.',
    'Passwords are never accepted on the command line or printed.',
  ].join('\n')
}

function parseArgs(argv) {
  const options = { updateExisting: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`)
      i += 1
      return value
    }
    switch (arg) {
      case '--email':
        options.email = next()
        break
      case '--role':
        options.role = next()
        break
      case '--name':
        options.name = next()
        break
      case '--user-pool-id':
        options.userPoolId = next()
        break
      case '--region':
        options.region = next()
        break
      case '--update-existing':
        options.updateExisting = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`Unknown option: ${arg}`)
    }
  }
  return options
}

function validatePassword(password, purpose = 'for a new user') {
  if (!password) throw new Error(`UNIVENT_PROVISION_PASSWORD is required ${purpose}.`)
  if (password.length < 8) throw new Error('UNIVENT_PROVISION_PASSWORD must be at least 8 characters.')
  if (!/[a-z]/.test(password)) throw new Error('UNIVENT_PROVISION_PASSWORD needs a lowercase letter.')
  if (!/[A-Z]/.test(password)) throw new Error('UNIVENT_PROVISION_PASSWORD needs an uppercase letter.')
  if (!/[0-9]/.test(password)) throw new Error('UNIVENT_PROVISION_PASSWORD needs a number.')
}

async function ensureExistingUserUsable(client, userPoolId, email, existing) {
  const status = existing && existing.UserStatus
  if (status === 'CONFIRMED') return false

  if (status === 'FORCE_CHANGE_PASSWORD' || status === 'RESET_REQUIRED') {
    const password = process.env.UNIVENT_PROVISION_PASSWORD
    validatePassword(password, 'to replace a temporary password on an existing user')
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      }),
    )
    return true
  }

  if (status === 'UNCONFIRMED') {
    throw new Error(
      'That account is not confirmed. Confirm its email in Cognito before provisioning a privileged role.',
    )
  }

  throw new Error(
    `That account is not usable for provisioning (status: ${status || 'unknown'}).`,
  )
}

async function findUser(client, userPoolId, email) {
  try {
    const result = await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }))
    return result
  } catch (err) {
    if (err && err.name === 'UserNotFoundException') return null
    throw err
  }
}

async function listGroups(client, userPoolId, email) {
  const groups = []
  let nextToken
  do {
    const result = await client.send(
      new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: email, NextToken: nextToken }),
    )
    for (const group of result.Groups || []) groups.push(group.GroupName)
    nextToken = result.NextToken
  } while (nextToken)
  return groups
}

async function createUser(client, userPoolId, email, name, password) {
  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
      ],
      MessageAction: 'SUPPRESS',
    }),
  )
  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    }),
  )
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err.message)
    console.error(usage())
    process.exitCode = 1
    return
  }

  if (options.help) {
    console.log(usage())
    return
  }

  const email = String(options.email || '').trim().toLowerCase()
  const role = String(options.role || '').trim().toLowerCase()
  const targetGroup = ALLOWED_ROLES[role]
  const userPoolId = String(options.userPoolId || process.env.COGNITO_USER_POOL_ID || '').trim()
  const region = String(
    options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '',
  ).trim()

  if (!email || !EMAIL_PATTERN.test(email)) throw new Error('--email must be a valid email address.')
  if (!targetGroup) throw new Error('--role must be either "admin" or "organization".')
  if (!userPoolId) throw new Error('Pass --user-pool-id or set COGNITO_USER_POOL_ID.')
  if (!region) throw new Error('Pass --region or set AWS_REGION / AWS_DEFAULT_REGION.')

  const name = String(options.name || email.split('@')[0]).trim() || email.split('@')[0]
  const client = new CognitoIdentityProviderClient({ region })
  const existing = await findUser(client, userPoolId, email)

  if (existing) {
    if (!options.updateExisting) {
      throw new Error(
        'That account already exists. Rerun with --update-existing to add the requested group explicitly.',
      )
    }
    if (existing.Enabled === false) {
      throw new Error('That account is disabled. Enable it in Cognito before provisioning a role.')
    }
    const groups = await listGroups(client, userPoolId, email)
    const otherPrivileged = groups.filter(
      (group) => PRIVILEGED_GROUPS.has(group) && group !== targetGroup,
    )
    if (otherPrivileged.length > 0) {
      throw new Error(
        `Account already belongs to ${otherPrivileged.join(', ')}. Remove the conflicting group manually before assigning ${targetGroup}.`,
      )
    }
    const repairedPassword = await ensureExistingUserUsable(client, userPoolId, email, existing)
    if (groups.includes(targetGroup)) {
      console.log(
        `${email} is already in ${targetGroup}${repairedPassword ? '; password updated.' : '; no change.'}`,
      )
      return
    }
    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: targetGroup,
      }),
    )
    console.log(`${email} updated: ${repairedPassword ? 'password reset and ' : ''}added to ${targetGroup}.`)
    return
  }

  const password = process.env.UNIVENT_PROVISION_PASSWORD
  validatePassword(password)
  await createUser(client, userPoolId, email, name, password)
  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: email,
      GroupName: targetGroup,
    }),
  )
  console.log(`${email} created and added to ${targetGroup}.`)
}

main().catch((err) => {
  console.error(`Provisioning failed: ${err.name || 'Error'}${err.message ? `: ${err.message}` : ''}`)
  process.exitCode = 1
})
