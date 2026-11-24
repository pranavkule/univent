const { describe, it, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')

const {
  ROLES,
  resolvePrincipal,
  isAdmin,
  isStudent,
  isOrganization,
  hasRole,
} = require('../functions/lib/principal')
const { isAllowedEmail, createHandler } = require('../functions/preSignUp')

const originalEnv = { ...process.env }
const ENV_KEYS = [
  'ALLOWED_SIGNUP_DOMAIN',
  'STUDENT_CLIENT_NAME',
]

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
}

function claimsEvent(claims) {
  return { headers: {}, requestContext: { authorizer: { claims } } }
}

function jwtClaimsEvent(claims) {
  return { headers: {}, requestContext: { authorizer: { jwt: { claims } } } }
}

function requestWithHeaders(headers) {
  return { headers, requestContext: {} }
}

beforeEach(() => {
  restoreEnv()
  delete process.env.ALLOWED_SIGNUP_DOMAIN
  process.env.STUDENT_CLIENT_NAME = 'univent-web'
})

after(() => {
  restoreEnv()
})

describe('principal resolution', () => {
  it('maps Cognito admin groups to the admin role', () => {
    const principal = resolvePrincipal(
      claimsEvent({ sub: 'sub-1', email: 'Admin@VES.ac.in', groups: ['admins'] }),
    )

    assert.equal(principal.authenticated, true)
    assert.equal(principal.role, ROLES.ADMIN)
    assert.equal(principal.email, 'admin@ves.ac.in')
    assert.equal(isAdmin(principal), true)
    assert.equal(isStudent(principal), false)
  })

  it('maps Cognito organization groups to the organization role', () => {
    const principal = resolvePrincipal(
      claimsEvent({
        sub: 'sub-2',
        email: 'codecell@ves.ac.in',
        email_verified: 'true',
        'cognito:groups': 'organizations',
      }),
    )

    assert.equal(principal.role, ROLES.ORGANIZATION)
    assert.equal(isOrganization(principal), true)
    assert.equal(hasRole(principal, ROLES.ORGANIZATION), true)
    assert.equal(principal.emailVerified, true)
  })

  it('defaults users without a privileged group to student', () => {
    const principal = resolvePrincipal(
      claimsEvent({ sub: 'sub-3', email: 'asha@ves.ac.in' }),
    )

    assert.equal(principal.role, ROLES.STUDENT)
    assert.equal(isStudent(principal), true)
  })

  it('supports the HTTP API JWT authorizer claim shape', () => {
    const principal = resolvePrincipal(
      jwtClaimsEvent({
        sub: 'sub-4',
        email: 'admin@ves.ac.in',
        'cognito:groups': ['admins', 'organizations'],
      }),
    )

    assert.equal(principal.role, ROLES.ADMIN)
    assert.equal(principal.source, 'authorizer-claims')
  })

  it('ignores client-supplied identity headers without Cognito claims', () => {
    const principal = resolvePrincipal(requestWithHeaders({
      'x-univent-role': 'admin',
      'x-univent-email': 'mallory@ves.ac.in',
    }))

    assert.equal(principal.authenticated, false)
    assert.equal(principal.role, null)
  })
})

describe('PreSignUp domain enforcement', () => {
  function signUpHandler(clients = [{
    ClientId: 'student-client',
    ClientName: 'univent-web',
  }]) {
    const cognitoClient = {
      async send(command) {
        assert.equal(command.input.UserPoolId, 'pool-id')
        return { UserPoolClients: clients }
      },
    }
    return createHandler(cognitoClient)
  }

  function signUpEvent(email, triggerSource = 'PreSignUp_SignUp') {
    return {
      triggerSource,
      userPoolId: 'pool-id',
      callerContext: { clientId: 'student-client' },
      request: { userAttributes: { email } },
      response: {},
    }
  }

  it('accepts a ves.ac.in student self sign-up without auto-confirming', async () => {
    const event = signUpEvent('Asha.Sharma@VES.ac.in')
    const result = await signUpHandler()(event)

    assert.equal(result, event)
    assert.equal(result.response.autoConfirmUser, undefined)
    assert.equal(result.response.autoVerifyEmail, undefined)
  })

  it('rejects a non-college email domain', async () => {
    await assert.rejects(
      () => signUpHandler()(signUpEvent('asha@gmail.com')),
      /ves\.ac\.in/i,
    )
  })

  it('rejects lookalike and subdomain addresses', async () => {
    await assert.rejects(() => signUpHandler()(signUpEvent('asha@ves.ac.in.evil.com')))
    await assert.rejects(() => signUpHandler()(signUpEvent('asha@sub.ves.ac.in')))
  })

  it('rejects missing or malformed email attributes', async () => {
    await assert.rejects(() => signUpHandler()(signUpEvent('')))
    await assert.rejects(() => signUpHandler()(signUpEvent('asha')))
  })

  it('allows controlled admin-created accounts outside the student domain', async () => {
    const event = signUpEvent('admin@example.net', 'PreSignUp_AdminCreateUser')
    const result = await signUpHandler()(event)

    assert.equal(result, event)
  })

  it('rejects unsupported external identity providers', async () => {
    await assert.rejects(
      () => signUpHandler()(signUpEvent('asha@ves.ac.in', 'PreSignUp_ExternalProvider')),
      /not available/i,
    )
  })

  it('rejects self sign-up through the legacy organization app client', async () => {
    const event = signUpEvent('codecell@ves.ac.in')
    event.callerContext.clientId = 'organization-client'
    await assert.rejects(
      () => signUpHandler([
        { ClientId: 'student-client', ClientName: 'univent-web' },
        { ClientId: 'organization-client', ClientName: 'univent-organization-applicant' },
      ])(event),
      /administrator-approved/i,
    )
  })

  it('exposes the domain helper for focused checks', () => {
    assert.equal(isAllowedEmail('asha@ves.ac.in'), true)
    assert.equal(isAllowedEmail('asha@ves.ac.in.evil.com'), false)
    assert.equal(isAllowedEmail(''), false)
  })
})
