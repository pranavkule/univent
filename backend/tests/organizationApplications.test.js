const { afterEach, beforeEach, describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { invoke, cognitoAuthorizer } = require('./helpers')
const { getStore, resetStore } = require('../functions/lib/store')
const cognitoGroups = require('../functions/lib/cognitoGroups')
const cognitoProvisioning = require('../functions/lib/cognitoProvisioning')
const organizationApplicationSecrets = require('../functions/lib/organizationApplicationSecrets')
const organizationApplications = require('../functions/organizationApplications')
const getOrganizationEvents = require('../functions/getOrganizationEvents')
const getRegistrations = require('../functions/getRegistrations')

const ADMIN = cognitoAuthorizer({
  sub: 'admin-sub',
  email: 'admin@ves.ac.in',
  groups: ['admins'],
})
const STUDENT = cognitoAuthorizer({
  sub: 'student-sub',
  email: 'student@ves.ac.in',
})
const ORGANIZATION = (sub) => cognitoAuthorizer({
  sub,
  email: 'codecell@ves.ac.in',
  groups: ['organizations'],
})
const VALID_APPLICATION = {
  organizationName: 'Robotics Club',
  applicantName: 'Aarav Mehta',
  officialEmail: 'CODECELL@VES.AC.IN',
  department: 'Engineering',
  representativeTitle: 'Secretary',
  representativePhone: '+1 555 010 1234',
  reason: 'Manage events and registrations for the club.',
  password: 'StrongPass123',
}

const originalSecrets = {
  storePassword: organizationApplicationSecrets.storePassword,
  getPassword: organizationApplicationSecrets.getPassword,
  deletePassword: organizationApplicationSecrets.deletePassword,
}
let passwordSecrets

async function withMocks(module, replacements, action) {
  const originals = {}
  for (const [name, implementation] of Object.entries(replacements)) {
    originals[name] = module[name]
    module[name] = implementation
  }
  try {
    return await action()
  } finally {
    Object.assign(module, originals)
  }
}

async function submit(body = VALID_APPLICATION) {
  return invoke(organizationApplications.handler, {
    method: 'POST',
    path: '/organization-applications',
    body,
  })
}

async function act(applicationId, action, body = {}, authorizer = ADMIN) {
  return invoke(organizationApplications.handler, {
    method: 'PATCH',
    path: `/admin/organization-applications/${applicationId}`,
    pathParameters: { applicationId },
    authorizer,
    body: { action, ...body },
  })
}

describe('separate organization application and approval workflow', () => {
  beforeEach(() => {
    resetStore()
    passwordSecrets = new Map()
    organizationApplicationSecrets.storePassword = async (id, password) => {
      passwordSecrets.set(id, password)
    }
    organizationApplicationSecrets.getPassword = async (id) => passwordSecrets.get(id) || null
    organizationApplicationSecrets.deletePassword = async (id) => {
      passwordSecrets.delete(id)
    }
  })

  afterEach(() => {
    resetStore()
    Object.assign(organizationApplicationSecrets, originalSecrets)
  })

  it('accepts the official organization email and stores no password in the application', async () => {
    let provisionCalls = 0
    const result = await withMocks(cognitoProvisioning, {
      createOrganizationAccount: async () => {
        provisionCalls += 1
        return 'unexpected-sub'
      },
    }, () => submit())

    assert.equal(result.statusCode, 201)
    assert.match(result.json.application.applicationId, /^[0-9a-f-]{36}$/i)
    assert.equal(result.json.application.status, 'PENDING_APPROVAL')
    assert.equal(provisionCalls, 0)
    assert.equal(passwordSecrets.get(result.json.application.applicationId), VALID_APPLICATION.password)
    const saved = getStore().getPublicOrganizationApplication(result.json.application.applicationId)
    assert.equal(saved.officialEmail, 'codecell@ves.ac.in')
    assert.equal(saved.applicantEmail, undefined)
    assert.equal(saved.password, undefined)
    assert.equal(JSON.stringify(saved).includes(VALID_APPLICATION.password), false)
    assert.equal(JSON.stringify(result.json).includes(VALID_APPLICATION.password), false)
    assert.equal(saved.status, 'PENDING_APPROVAL')
  })

  it('validates organization email, password strength, and rejects student-email identity fields', async () => {
    const invalidEmail = await submit({
      ...VALID_APPLICATION,
      officialEmail: 'student@gmail.com',
    })
    const weakPassword = await submit({
      ...VALID_APPLICATION,
      officialEmail: 'codecell@ves.ac.in',
      password: 'weak',
    })
    const studentIdentity = await submit({
      ...VALID_APPLICATION,
      applicantEmail: 'student@ves.ac.in',
    })

    assert.equal(invalidEmail.statusCode, 400)
    assert.match(invalidEmail.json.message, /@ves\.ac\.in/)
    assert.equal(weakPassword.statusCode, 400)
    assert.match(weakPassword.json.message, /password/i)
    assert.equal(studentIdentity.statusCode, 400)
    assert.match(studentIdentity.json.message, /not allowed/i)
    assert.equal(getStore().listOrganizationApplications().length, 0)
  })

  it('atomically prevents duplicate applications by official email regardless of organization name', async () => {
    const first = await submit()
    const duplicate = await submit({
      ...VALID_APPLICATION,
      organizationName: 'Different Organization Name',
      officialEmail: 'codecell@VES.AC.IN',
    })

    assert.equal(first.statusCode, 201)
    assert.equal(duplicate.statusCode, 409)
    assert.equal(getStore().listOrganizationApplications().length, 1)
  })

  it('does not provision or authorize an organization before admin approval', async () => {
    let provisioningCalls = 0
    const created = await withMocks(cognitoProvisioning, {
      createOrganizationAccount: async () => {
        provisioningCalls += 1
        return 'new-org-sub'
      },
    }, () => submit())
    const applicationId = created.json.application.applicationId
    const pendingOrganization = await invoke(getOrganizationEvents.handler, {
      method: 'GET',
      authorizer: ORGANIZATION('new-org-sub'),
    })

    assert.equal(created.json.application.status, 'PENDING_APPROVAL')
    assert.equal(provisioningCalls, 0)
    assert.equal(pendingOrganization.statusCode, 403)
  })

  it('requires an administrator to approve and grants access only after status is saved', async () => {
    const created = await submit()
    const applicationId = created.json.application.applicationId
    const forbidden = await act(applicationId, 'APPROVE', {}, STUDENT)
    let provisionedPassword = ''
    let groupedSub = ''
    let enabledApplicationId = ''

    const result = await withMocks(cognitoProvisioning, {
      createOrganizationAccount: async (application, password) => {
        assert.equal(application.officialEmail, 'codecell@ves.ac.in')
        assert.equal(application.applicantEmail, undefined)
        provisionedPassword = password
        return 'new-org-sub'
      },
      enableOrganizationAccount: async (application) => {
        enabledApplicationId = application.applicationId
        return 'new-org-sub'
      },
    }, () => withMocks(cognitoGroups, {
      addOrganizationGroup: async (sub) => {
        assert.equal(getStore().getPublicOrganizationApplication(applicationId).status, 'APPROVED')
        groupedSub = sub
      },
    }, () => act(applicationId, 'APPROVE')))

    assert.equal(forbidden.statusCode, 403)
    assert.equal(result.statusCode, 200)
    assert.equal(result.json.application.status, 'APPROVED')
    assert.equal(result.json.application.cognitoSub, 'new-org-sub')
    assert.equal(provisionedPassword, VALID_APPLICATION.password)
    assert.equal(groupedSub, 'new-org-sub')
    assert.equal(enabledApplicationId, applicationId)
    assert.equal(passwordSecrets.has(applicationId), false)

    const afterApproval = await invoke(getOrganizationEvents.handler, {
      method: 'GET',
      authorizer: ORGANIZATION('new-org-sub'),
    })
    assert.equal(afterApproval.statusCode, 200)
  })

  it('does not provision an account when password expiry validation fails', async () => {
    const created = await submit()
    const applicationId = created.json.application.applicationId
    let provisioningCalls = 0

    const result = await withMocks(organizationApplicationSecrets, {
      getPassword: async () => null,
    }, () => withMocks(cognitoProvisioning, {
      createOrganizationAccount: async () => {
        provisioningCalls += 1
        return 'unexpected-sub'
      },
    }, () => act(applicationId, 'APPROVE')))

    assert.equal(result.statusCode, 409)
    assert.match(result.json.message, /password setup expired/i)
    assert.equal(provisioningCalls, 0)
    assert.equal(getStore().getPublicOrganizationApplication(applicationId).status, 'PENDING_APPROVAL')
  })

  it('keeps approval idempotent and completes a retry after the account status was saved', async () => {
    const created = await submit()
    const applicationId = created.json.application.applicationId
    let createCalls = 0
    let enableCalls = 0

    const replacements = {
      createOrganizationAccount: async () => {
        createCalls += 1
        return 'retry-org-sub'
      },
      enableOrganizationAccount: async () => {
        enableCalls += 1
        return 'retry-org-sub'
      },
    }
    const first = await withMocks(cognitoProvisioning, replacements, () =>
      withMocks(cognitoGroups, { addOrganizationGroup: async () => {} }, () =>
        act(applicationId, 'APPROVE')))
    const second = await withMocks(cognitoProvisioning, replacements, () =>
      withMocks(cognitoGroups, { addOrganizationGroup: async () => {} }, () =>
        act(applicationId, 'APPROVE')))

    assert.equal(first.statusCode, 200)
    assert.equal(second.statusCode, 200)
    assert.equal(createCalls, 1)
    assert.equal(enableCalls, 2)
    assert.equal(second.json.application.status, 'APPROVED')
  })

  it('leaves approval pending after Cognito failure and safely retries with the encrypted password', async () => {
    const created = await submit()
    const applicationId = created.json.application.applicationId
    let attempts = 0

    const failed = await withMocks(cognitoProvisioning, {
      createOrganizationAccount: async () => {
        attempts += 1
        throw new Error('Cognito unavailable')
      },
    }, () => act(applicationId, 'APPROVE'))
    assert.equal(failed.statusCode, 502)
    assert.equal(getStore().getPublicOrganizationApplication(applicationId).status, 'PENDING_APPROVAL')
    assert.equal(passwordSecrets.get(applicationId), VALID_APPLICATION.password)

    const retry = await withMocks(cognitoProvisioning, {
      createOrganizationAccount: async (application, password) => {
        attempts += 1
        assert.equal(password, VALID_APPLICATION.password)
        return 'retry-sub'
      },
      enableOrganizationAccount: async () => 'retry-sub',
    }, () => withMocks(cognitoGroups, {
      addOrganizationGroup: async () => {},
    }, () => act(applicationId, 'APPROVE')))

    assert.equal(retry.statusCode, 200)
    assert.equal(attempts, 2)
    assert.equal(getStore().getPublicOrganizationApplication(applicationId).status, 'APPROVED')
    assert.equal(passwordSecrets.has(applicationId), false)
  })

  it('rejects without creating a Cognito account and preserves history', async () => {
    const created = await submit()
    const applicationId = created.json.application.applicationId
    let provisionCalls = 0
    const rejected = await withMocks(cognitoProvisioning, {
      createOrganizationAccount: async () => {
        provisionCalls += 1
        return 'unexpected-sub'
      },
    }, () => act(applicationId, 'REJECT', { reason: 'Please provide advisor details.' }))
    const resubmitted = await submit()

    assert.equal(rejected.statusCode, 200)
    assert.equal(rejected.json.application.status, 'REJECTED')
    assert.equal(rejected.json.application.decisionReason, 'Please provide advisor details.')
    assert.equal(provisionCalls, 0)
    assert.equal(passwordSecrets.has(applicationId), false)
    assert.equal(resubmitted.statusCode, 201)
    assert.notEqual(resubmitted.json.application.applicationId, applicationId)
    assert.equal(getStore().listOrganizationApplications().length, 2)
  })

  it('limits complete application history to administrators', async () => {
    await submit()
    const unauthorized = await invoke(organizationApplications.handler, {
      method: 'GET',
      path: '/organization-applications',
      authorizer: STUDENT,
    })
    const admin = await invoke(organizationApplications.handler, {
      method: 'GET',
      path: '/organization-applications',
      authorizer: ADMIN,
    })

    assert.equal(unauthorized.statusCode, 200)
    assert.equal(unauthorized.json.application, null)
    assert.equal(admin.statusCode, 200)
    assert.equal(admin.json.applications.length, 1)
    assert.equal(admin.json.applications[0].officialEmail, 'codecell@ves.ac.in')
    assert.equal(admin.json.applications[0].applicantEmail, 'codecell@ves.ac.in')
    assert.equal(JSON.stringify(admin.json).includes(VALID_APPLICATION.password), false)
  })

  it('never logs an application password when secret storage fails', async () => {
    const errors = []
    const originalConsoleError = console.error
    console.error = (...args) => errors.push(args.join(' '))
    try {
      const result = await withMocks(organizationApplicationSecrets, {
        storePassword: async () => {
          throw new Error(`Sensitive payload: ${VALID_APPLICATION.password}`)
        },
      }, () => submit())
      assert.equal(result.statusCode, 500)
      assert.equal(errors.join(' ').includes(VALID_APPLICATION.password), false)
      assert.equal(getStore().listOrganizationApplications().length, 0)
    } finally {
      console.error = originalConsoleError
    }
  })

  it('does not allow historical student-linked applications to grant organization access', async () => {
    getStore().createOrganizationApplication({
      userSub: 'student-sub',
      organizationName: 'Legacy Robotics Club',
      officialEmail: 'student@ves.ac.in',
      representativeName: 'Aarav Mehta',
      representativeTitle: 'Secretary',
      representativePhone: '+1 555 010 1234',
    })
    let grantedSub = ''

    const result = await withMocks(cognitoGroups, {
      addOrganizationGroup: async (sub) => { grantedSub = sub },
    }, () => act('student-sub', 'APPROVE'))
    const legacyOrganizationAccess = await invoke(getOrganizationEvents.handler, {
      method: 'GET',
      authorizer: ORGANIZATION('student-sub'),
    })
    const studentRegistrations = await invoke(getRegistrations.handler, {
      method: 'GET',
      authorizer: STUDENT,
    })

    assert.equal(result.statusCode, 409)
    assert.equal(grantedSub, '')
    assert.equal(legacyOrganizationAccess.statusCode, 403)
    assert.equal(studentRegistrations.statusCode, 200)
  })
})
