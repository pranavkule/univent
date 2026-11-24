const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  createOrganizationAccount,
  enableOrganizationAccount,
} = require('../functions/lib/cognitoProvisioning')
const { CODES } = require('../functions/lib/storeError')

const APPLICATION = {
  applicationId: '79c672f8-b1e3-4f13-a67b-7848da20ff09',
  applicantName: 'Aarav Mehta',
  officialEmail: 'CODECELL@VES.AC.IN',
}
const PASSWORD = 'StrongPass123'
const POOL_ID = 'us-east-1_example'
const MARKER = `univent-org-application-${APPLICATION.applicationId}`

function commandName(command) {
  return command.constructor.name
}

describe('Cognito organization account provisioning', () => {
  it('creates an email-suppressed, disabled account with the selected permanent password', async () => {
    const calls = []
    const client = {
      async send(command) {
        calls.push(command)
        if (commandName(command) === 'AdminCreateUserCommand') {
          return {
            User: {
              Attributes: [{ Name: 'sub', Value: 'cognito-sub' }],
            },
          }
        }
        return {}
      },
    }

    const sub = await createOrganizationAccount(APPLICATION, PASSWORD, client, POOL_ID)

    assert.equal(sub, 'cognito-sub')
    assert.equal(commandName(calls[0]), 'AdminCreateUserCommand')
    assert.equal(calls[0].input.UserPoolId, POOL_ID)
    assert.equal(calls[0].input.Username, 'codecell@ves.ac.in')
    assert.equal(calls[0].input.MessageAction, 'SUPPRESS')
    assert.equal(calls[0].input.DesiredDeliveryMediums, undefined)
    assert.notEqual(calls[0].input.TemporaryPassword, PASSWORD)
    const attributes = Object.fromEntries(
      calls[0].input.UserAttributes.map(({ Name, Value }) => [Name, Value]),
    )
    assert.equal(attributes.email, 'codecell@ves.ac.in')
    assert.equal(attributes.email_verified, 'true')
    assert.equal(attributes.name, 'Aarav Mehta')
    assert.equal(attributes.preferred_username, MARKER)
    assert.equal(attributes['custom:account_type'], undefined)
    assert.equal(commandName(calls[1]), 'AdminDisableUserCommand')
    assert.equal(commandName(calls[2]), 'AdminSetUserPasswordCommand')
    assert.equal(calls[2].input.Password, PASSWORD)
    assert.equal(calls[2].input.Permanent, true)
  })

  it('reuses only the Cognito user bound to the same application on an approval retry', async () => {
    const calls = []
    const client = {
      async send(command) {
        calls.push(command)
        if (commandName(command) === 'AdminCreateUserCommand') {
          const error = new Error('Already exists')
          error.name = 'UsernameExistsException'
          throw error
        }
        if (commandName(command) === 'AdminGetUserCommand') {
          return {
            Enabled: false,
            UserAttributes: [
              { Name: 'sub', Value: 'cognito-sub' },
              { Name: 'email', Value: 'codecell@ves.ac.in' },
              { Name: 'preferred_username', Value: MARKER },
            ],
          }
        }
        return {}
      },
    }

    assert.equal(
      await createOrganizationAccount(APPLICATION, PASSWORD, client, POOL_ID),
      'cognito-sub',
    )
    assert.deepEqual(calls.map(commandName), [
      'AdminCreateUserCommand',
      'AdminGetUserCommand',
      'AdminDisableUserCommand',
      'AdminSetUserPasswordCommand',
    ])
    assert.equal(calls[3].input.Password, PASSWORD)
  })

  it('never adopts an existing student account with the same email', async () => {
    const calls = []
    const client = {
      async send(command) {
        calls.push(command)
        if (commandName(command) === 'AdminCreateUserCommand') {
          const error = new Error('Already exists')
          error.name = 'UsernameExistsException'
          throw error
        }
        return {
          Enabled: true,
          UserAttributes: [
            { Name: 'sub', Value: 'student-sub' },
            { Name: 'email', Value: 'codecell@ves.ac.in' },
          ],
        }
      },
    }

    await assert.rejects(
      () => createOrganizationAccount(APPLICATION, PASSWORD, client, POOL_ID),
      (error) => error.code === CODES.ORGANIZATION_ACCOUNT_EXISTS,
    )
    assert.deepEqual(calls.map(commandName), ['AdminCreateUserCommand', 'AdminGetUserCommand'])
  })

  it('enables only a Cognito user whose organization application binding matches', async () => {
    const calls = []
    const client = {
      async send(command) {
        calls.push(command)
        if (commandName(command) === 'AdminGetUserCommand') {
          return {
            Enabled: false,
            UserAttributes: [
              { Name: 'sub', Value: 'cognito-sub' },
              { Name: 'email', Value: 'codecell@ves.ac.in' },
              { Name: 'preferred_username', Value: MARKER },
            ],
          }
        }
        return {}
      },
    }

    assert.equal(
      await enableOrganizationAccount(APPLICATION, client, POOL_ID),
      'cognito-sub',
    )
    assert.deepEqual(calls.map(commandName), ['AdminGetUserCommand', 'AdminEnableUserCommand'])

    const unrelated = {
      async send(command) {
        if (commandName(command) === 'AdminGetUserCommand') {
          return {
            Enabled: false,
            UserAttributes: [
              { Name: 'sub', Value: 'student-sub' },
              { Name: 'email', Value: 'codecell@ves.ac.in' },
              { Name: 'preferred_username', Value: 'not-this-application' },
            ],
          }
        }
        return {}
      },
    }
    await assert.rejects(
      () => enableOrganizationAccount(APPLICATION, unrelated, POOL_ID),
      (error) => error.code === CODES.ORGANIZATION_ACCOUNT_EXISTS,
    )
  })
})
