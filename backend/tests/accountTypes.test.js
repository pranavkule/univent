const { after, beforeEach, describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const requireFromFunctions = createRequire(require.resolve('../functions/package.json'))
const {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUserPoolClientsCommand,
} = requireFromFunctions('@aws-sdk/client-cognito-identity-provider')

const cognitoAccountType = require('../functions/lib/cognitoAccountType')
const postConfirmation = require('../functions/postConfirmation')

const originalEnv = { ...process.env }
const originalSend = CognitoIdentityProviderClient.prototype.send

function restoreEnv() {
  for (const key of [
    'AWS_REGION',
    'COGNITO_USER_POOL_ID',
    'STUDENT_CLIENT_NAME',
    'ORGANIZATION_APPLICANT_CLIENT_NAME',
  ]) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
}

beforeEach(() => {
  restoreEnv()
  process.env.AWS_REGION = 'us-east-1'
  process.env.COGNITO_USER_POOL_ID = 'pool-id'
  process.env.STUDENT_CLIENT_NAME = 'univent-web'
  process.env.ORGANIZATION_APPLICANT_CLIENT_NAME = 'univent-organization-applicant'
})

after(() => {
  restoreEnv()
  CognitoIdentityProviderClient.prototype.send = originalSend
})

describe('persisted Cognito account types', () => {
  it('resolves only a recognized account type belonging to the JWT sub', async () => {
    CognitoIdentityProviderClient.prototype.send = async (command) => {
      assert.equal(command.input.Username, 'rep@ves.ac.in')
      return {
        UserAttributes: [
          { Name: 'sub', Value: 'verified-sub' },
          { Name: 'custom:account_type', Value: 'ORGANIZATION_APPLICANT' },
        ],
      }
    }

    assert.equal(
      await cognitoAccountType.getAccountType({
        sub: 'verified-sub',
        email: 'rep@ves.ac.in',
      }),
      'ORGANIZATION_APPLICANT',
    )
    assert.equal(
      await cognitoAccountType.getAccountType({
        sub: 'different-sub',
        email: 'rep@ves.ac.in',
      }),
      null,
    )
  })

  it('assigns account type based on Cognito confirmation client context', async () => {
    const calls = []
    CognitoIdentityProviderClient.prototype.send = async (command) => {
      calls.push(command)
      if (command instanceof ListUserPoolClientsCommand) {
        return {
          UserPoolClients: [
            { ClientId: 'applicant-client', ClientName: 'univent-organization-applicant' },
            { ClientId: 'student-client', ClientName: 'univent-web' },
          ],
        }
      }
      assert.ok(command instanceof AdminUpdateUserAttributesCommand)
      return {}
    }

    const event = {
      triggerSource: 'PostConfirmation_ConfirmSignUp',
      userPoolId: 'pool-id',
      userName: 'rep@ves.ac.in',
      callerContext: { clientId: 'applicant-client' },
      request: { userAttributes: { sub: 'verified-sub' } },
    }
    assert.equal(await postConfirmation.handler(event), event)
    assert.deepEqual(calls[1].input.UserAttributes, [
      { Name: 'custom:account_type', Value: 'ORGANIZATION_APPLICANT' },
    ])
    assert.equal(calls[1].input.Username, 'rep@ves.ac.in')

    await postConfirmation.handler({
      ...event,
      userName: 'student@ves.ac.in',
      callerContext: { clientId: 'student-client' },
      request: { userAttributes: { sub: 'student-sub' } },
    })
    assert.deepEqual(calls[3].input.UserAttributes, [
      { Name: 'custom:account_type', Value: 'STUDENT' },
    ])
  })

  it('leaves users confirmed through unrecognized clients unclassified', async () => {
    let updated = false
    CognitoIdentityProviderClient.prototype.send = async (command) => {
      if (command instanceof AdminUpdateUserAttributesCommand) updated = true
      else assert.ok(command instanceof ListUserPoolClientsCommand)
      return { UserPoolClients: [{ ClientId: 'other-client', ClientName: 'other-app' }] }
    }
    const event = {
      triggerSource: 'PostConfirmation_ConfirmSignUp',
      userPoolId: 'pool-id',
      userName: 'user@ves.ac.in',
      callerContext: { clientId: 'other-client' },
      request: { userAttributes: { sub: 'user-sub' } },
    }

    await postConfirmation.handler(event)
    assert.equal(updated, false)
  })
})
