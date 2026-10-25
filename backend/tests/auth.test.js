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
const { isAllowedEmail, handler: preSignUp } = require('../functions/preSignUp')

const originalEnv = { ...process.env }
const ENV_KEYS = [
  'UNIVENT_DEV_AUTH',
  'AWS_EXECUTION_ENV',
  'AWS_SAM_LOCAL',
  'ALLOWED_SIGNUP_DOMAIN',
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

function devEvent(headers) {
  return { headers, requestContext: {} }
}

beforeEach(() => {
  restoreEnv()
  delete process.env.UNIVENT_DEV_AUTH
  delete process.env.AWS_EXECUTION_ENV
  delete process.env.AWS_SAM_LOCAL
  delete process.env.ALLOWED_SIGNUP_DOMAIN
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

  it('prefers trusted authorizer claims over development headers', () => {
    process.env.UNIVENT_DEV_AUTH = 'true'

    const principal = resolvePrincipal({
      headers: {
        'x-univent-role': 'admin',
        'x-univent-email': 'mallory@ves.ac.in',
      },
      requestContext: {
        authorizer: {
          claims: { sub: 'sub-5', email: 'asha@ves.ac.in' },
        },
      },
    })

    assert.equal(principal.role, ROLES.STUDENT)
    assert.equal(principal.email, 'asha@ves.ac.in')
    assert.equal(principal.source, 'authorizer-claims')
  })

  it('honours development headers only with explicit local opt-in', () => {
    process.env.UNIVENT_DEV_AUTH = 'true'

    const principal = resolvePrincipal(
      devEvent({
        'x-univent-role': 'admin',
        'x-univent-email': 'admin@ves.ac.in',
        'x-univent-name': 'Admin',
      }),
    )

    assert.equal(principal.authenticated, true)
    assert.equal(principal.role, ROLES.ADMIN)
    assert.equal(principal.source, 'dev-header')
  })

  it('ignores development headers when dev auth is off', () => {
    const principal = resolvePrincipal(
      devEvent({ 'x-univent-role': 'admin', 'x-univent-email': 'admin@ves.ac.in' }),
    )

    assert.equal(principal.authenticated, false)
    assert.equal(principal.role, null)
  })

  it('ignores development headers inside deployed Lambda', () => {
    process.env.UNIVENT_DEV_AUTH = 'true'
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs22.x'

    const principal = resolvePrincipal(
      devEvent({ 'x-univent-role': 'admin', 'x-univent-email': 'admin@ves.ac.in' }),
    )

    assert.equal(principal.authenticated, false)
  })

  it('allows development headers in SAM local', () => {
    process.env.UNIVENT_DEV_AUTH = 'true'
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs22.x'
    process.env.AWS_SAM_LOCAL = 'true'

    const principal = resolvePrincipal(
      devEvent({ 'x-univent-role': 'organization', 'x-univent-email': 'codecell@ves.ac.in' }),
    )

    assert.equal(principal.authenticated, true)
    assert.equal(principal.role, ROLES.ORGANIZATION)
  })
})

describe('PreSignUp domain enforcement', () => {
  function signUpEvent(email, triggerSource = 'PreSignUp_SignUp') {
    return {
      triggerSource,
      request: { userAttributes: { email } },
      response: {},
    }
  }

  it('accepts a ves.ac.in student self sign-up without auto-confirming', async () => {
    const event = signUpEvent('Asha.Sharma@VES.ac.in')
    const result = await preSignUp(event)

    assert.equal(result, event)
    assert.equal(result.response.autoConfirmUser, undefined)
    assert.equal(result.response.autoVerifyEmail, undefined)
  })

  it('rejects a non-college email domain', async () => {
    await assert.rejects(
      () => preSignUp(signUpEvent('asha@gmail.com')),
      /ves\.ac\.in/i,
    )
  })

  it('rejects lookalike and subdomain addresses', async () => {
    await assert.rejects(() => preSignUp(signUpEvent('asha@ves.ac.in.evil.com')))
    await assert.rejects(() => preSignUp(signUpEvent('asha@sub.ves.ac.in')))
  })

  it('rejects missing or malformed email attributes', async () => {
    await assert.rejects(() => preSignUp(signUpEvent('')))
    await assert.rejects(() => preSignUp(signUpEvent('asha')))
  })

  it('allows controlled admin-created accounts outside the student domain', async () => {
    const event = signUpEvent('admin@univent.demo', 'PreSignUp_AdminCreateUser')
    const result = await preSignUp(event)

    assert.equal(result, event)
  })

  it('rejects unsupported external identity providers', async () => {
    await assert.rejects(
      () => preSignUp(signUpEvent('asha@ves.ac.in', 'PreSignUp_ExternalProvider')),
      /not available/i,
    )
  })

  it('exposes the domain helper for focused checks', () => {
    assert.equal(isAllowedEmail('asha@ves.ac.in'), true)
    assert.equal(isAllowedEmail('asha@ves.ac.in.evil.com'), false)
    assert.equal(isAllowedEmail(''), false)
  })
})
