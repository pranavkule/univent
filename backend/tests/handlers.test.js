// Handler tests. Run with `npm test` from the backend folder.
// Uses the Node.js built-in test runner (no test framework dependency).
const { describe, it, before, beforeEach, after, mock } = require('node:test')
const assert = require('node:assert/strict')

const { invoke, devHeaders, cognitoAuthorizer } = require('./helpers')
const { getStore, resetStore } = require('../functions/lib/store')

const getEvents = require('../functions/getEvents')
const createEvent = require('../functions/createEvent')
const getOrganizationEvents = require('../functions/getOrganizationEvents')
const updateEvent = require('../functions/updateEvent')
const register = require('../functions/register')
const getRegistrations = require('../functions/getRegistrations')
const organizationApplications = require('../functions/organizationApplications')
const cognitoGroups = require('../functions/lib/cognitoGroups')
const { CODES, StoreError } = require('../functions/lib/storeError')

const ADMIN = devHeaders('admin', 'admin@univent.demo', 'Demo Admin')
const STUDENT_A = devHeaders('student', 'asha@college.edu', 'Asha Sharma')
const STUDENT_B = devHeaders('student', 'rohan@college.edu', 'Rohan Patil')
const ORGANIZATION_A = cognitoAuthorizer({
  sub: 'organization-sub-a',
  email: 'codecell@ves.ac.in',
  name: 'CodeCell',
  groups: ['organizations'],
})
const ORGANIZATION_B = cognitoAuthorizer({
  sub: 'organization-sub-b',
  email: 'robotics@ves.ac.in',
  name: 'Robotics Club',
  groups: ['organizations'],
})
const ADMIN_COGNITO = cognitoAuthorizer({
  sub: 'admin-sub',
  email: 'admin@univent.demo',
  name: 'Platform Admin',
  groups: ['admins'],
})

function seedApprovedOrganization(userSub, officialEmail, organizationName) {
  const store = getStore()
  store.createOrganizationApplication({
    userSub,
    organizationName,
    officialEmail,
    representativeName: organizationName,
    representativeTitle: 'Club Representative',
    representativePhone: '+1 555 010 1234',
  })
  return store.updateOrganizationApplicationStatus(
    userSub,
    { status: 'APPROVED', decidedBy: 'admin-sub' },
    ['PENDING'],
  )
}

async function withCognitoGroupMocks(replacements, action) {
  const original = {}
  for (const [name, implementation] of Object.entries(replacements)) {
    original[name] = cognitoGroups[name]
    cognitoGroups[name] = implementation
  }
  try {
    return await action()
  } finally {
    Object.assign(cognitoGroups, original)
  }
}

const originalEnv = { ...process.env }

before(() => {
  process.env.UNIVENT_DEV_AUTH = 'true'
  process.env.CORS_ORIGIN = '*'
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-25T12:00:00.000Z') })
})

after(() => {
  mock.timers.reset()
  for (const key of ['UNIVENT_DEV_AUTH', 'CORS_ORIGIN']) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

beforeEach(() => {
  resetStore()
})

describe('GET /events', () => {
  it('returns the seeded events with every field the frontend renders', async () => {
    const res = await invoke(getEvents.handler, { method: 'GET', path: '/events' })

    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json.events))
    assert.equal(res.json.events.length, 7)

    const event = res.json.events[0]
    for (const field of [
      'eventId',
      'title',
      'date',
      'venue',
      'description',
      'capacity',
      'registeredCount',
      'category',
      'organizer',
      'startTime',
      'endTime',
      'regDeadline',
    ]) {
      assert.ok(field in event, `missing field: ${field}`)
    }
    assert.equal(event.eventId, 'e1')
    assert.equal(event.category, 'Technical')
    assert.equal(event.startTime, '18:00')
  })

  it('returns CORS headers so the hosted site can call the API', async () => {
    const res = await invoke(getEvents.handler, { method: 'GET' })

    assert.equal(res.headers['Access-Control-Allow-Origin'], '*')
    assert.equal(res.headers['Content-Type'], 'application/json')
    assert.ok(res.headers['Access-Control-Allow-Headers'].includes('Authorization'))
  })

  it('is public - no identity is required', async () => {
    const res = await invoke(getEvents.handler, { method: 'GET' })
    assert.equal(res.statusCode, 200)
  })

  it('reports the confirmed registration count for availability', async () => {
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })

    const res = await invoke(getEvents.handler, { method: 'GET' })
    const event = res.json.events.find((row) => row.eventId === 'e1')
    assert.equal(event.registeredCount, 1)
  })

  it('rejects a wrong method with 405', async () => {
    const res = await invoke(getEvents.handler, { method: 'POST' })
    assert.equal(res.statusCode, 405)
    assert.equal(res.headers.Allow, 'GET')
  })
})

describe('POST /events', () => {
  it('rejects a signed-out caller with 401', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      body: { title: 'Hack Night', date: '2026-11-02', venue: 'Seminar Hall A' },
    })

    assert.equal(res.statusCode, 401)
    assert.match(res.json.message, /sign in/i)
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*')
  })

  it('rejects a signed-in non-admin with 403', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { title: 'Hack Night', date: '2026-11-02', venue: 'Seminar Hall A' },
    })

    assert.equal(res.statusCode, 403)
    assert.match(res.json.message, /administrator/i)
  })

  it('allows an organization to create an event with trusted Cognito ownership', async () => {
    seedApprovedOrganization('organization-sub-a', 'codecell@ves.ac.in', 'CodeCell')
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      authorizer: ORGANIZATION_A,
      body: {
        title: 'Organization Event',
        date: '2099-11-02',
        venue: 'Seminar Hall A',
        ownerSub: 'attacker-sub',
        organizer: 'Forged Organizer',
      },
    })

    assert.equal(res.statusCode, 201)
    const stored = getStore().getEvent(res.json.eventId)
    assert.equal(stored.ownerSub, 'organization-sub-a')
    assert.equal(stored.organizer, 'CodeCell')
    assert.equal(res.json.ownerSub, undefined)
  })

  it('keeps students from creating events', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { title: 'Hack Night', date: '2026-11-02', venue: 'Seminar Hall A' },
    })
    assert.equal(res.statusCode, 403)
  })

  it('creates an event for an admin and returns 201 with the created object', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: {
        title: 'Distributed Systems Meetup',
        date: '2026-12-05',
        venue: 'CSE Seminar Room',
        description: 'Lightning talks on consensus protocols.',
        capacity: 60,
        category: 'Technical',
        organizer: 'CodeCell',
        startTime: '16:00',
        endTime: '18:00',
        regDeadline: '2026-12-04',
      },
    })

    assert.equal(res.statusCode, 201)
    assert.match(res.json.eventId, /^evt-/)
    assert.equal(res.json.title, 'Distributed Systems Meetup')
    assert.equal(res.json.capacity, 60)
    assert.equal(res.json.category, 'Technical')
    assert.ok(res.json.createdAt)

    const list = await invoke(getEvents.handler, { method: 'GET' })
    assert.ok(list.json.events.some((e) => e.eventId === res.json.eventId))
  })

  it('accepts an admin identified by Cognito authorizer claims', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      authorizer: cognitoAuthorizer({
        sub: 'cognito-sub-1',
        email: 'admin@univent.demo',
        name: 'Demo Admin',
        groups: ['admins'],
      }),
      body: { title: 'Cloud Meetup', date: '2026-12-06', venue: 'Lab 3' },
    })

    assert.equal(res.statusCode, 201)
  })

  it('rejects a missing title with 400', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: { date: '2026-12-06', venue: 'Lab 3' },
    })

    assert.equal(res.statusCode, 400)
    assert.match(res.json.message, /title/i)
  })

  it('rejects an invalid date with 400', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: { title: 'Cloud Meetup', date: '2026-13-45', venue: 'Lab 3' },
    })

    assert.equal(res.statusCode, 400)
    assert.match(res.json.message, /date/i)
  })

  it('rejects an invalid capacity with 400', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: { title: 'Cloud Meetup', date: '2026-12-06', venue: 'Lab 3', capacity: 0 },
    })

    assert.equal(res.statusCode, 400)
    assert.match(res.json.message, /capacity/i)
  })

  it('rejects a malformed JSON body with 400', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: '{ not json',
    })

    assert.equal(res.statusCode, 400)
    assert.match(res.json.message, /json/i)
  })
})

describe('organization application workflow', () => {
  const validApplication = {
    organizationName: 'Robotics Club',
    officialEmail: 'robotics@ves.ac.in',
    representativeName: 'Aarav Mehta',
    representativeTitle: 'Club Secretary',
    representativePhone: '+1 555 010 1234',
  }
  const applicant = cognitoAuthorizer({
    sub: 'applicant-sub',
    email: 'robotics@ves.ac.in',
    name: 'Aarav Mehta',
  })

  async function submitApplication(authorizer = applicant, body = validApplication) {
    return invoke(organizationApplications.handler, {
      method: 'POST',
      path: '/organization-applications',
      authorizer,
      body,
    })
  }

  async function decide(userSub, status, decisionReason = '') {
    return invoke(organizationApplications.handler, {
      method: 'PATCH',
      path: `/admin/organization-applications/${userSub}`,
      pathParameters: { userSub },
      authorizer: ADMIN_COGNITO,
      body: { status, decisionReason },
    })
  }

  it('creates an application only for a verified Cognito identity and binds it to its sub', async () => {
    const result = await submitApplication(applicant, {
      ...validApplication,
      userSub: 'forged-sub',
    })
    assert.equal(result.statusCode, 400)
    assert.match(result.json.message, /not allowed/i)

    const created = await submitApplication()
    assert.equal(created.statusCode, 201)
    assert.equal(created.json.application.status, 'PENDING')
    assert.equal(created.json.application.userSub, undefined)
    assert.equal(getStore().getOrganizationApplication('applicant-sub').userSub, 'applicant-sub')
    assert.equal(getStore().getOrganizationApplication('forged-sub'), null)
  })

  it('rejects unverified, mismatched, non-Cognito, and wrong-domain application submissions', async () => {
    const unverified = await submitApplication(
      cognitoAuthorizer({
        sub: 'unverified-sub',
        email: 'robotics@ves.ac.in',
        emailVerified: false,
      }),
    )
    const mismatched = await submitApplication(applicant, {
      ...validApplication,
      officialEmail: 'other@ves.ac.in',
    })
    const wrongDomain = await submitApplication(
      cognitoAuthorizer({ sub: 'wrong-domain', email: 'robotics@gmail.com' }),
      { ...validApplication, officialEmail: 'robotics@gmail.com' },
    )
    const devIdentity = await submitApplication(
      null,
      validApplication,
    )
    assert.equal(unverified.statusCode, 403)
    assert.equal(mismatched.statusCode, 400)
    assert.equal(wrongDomain.statusCode, 400)
    assert.equal(devIdentity.statusCode, 401)
  })

  it('prevents duplicate applications for the same Cognito account', async () => {
    assert.equal((await submitApplication()).statusCode, 201)
    const duplicate = await submitApplication()
    assert.equal(duplicate.statusCode, 409)
    assert.match(duplicate.json.message, /already exists/i)
  })

  it('lets applicants read only their own application and admins list applications', async () => {
    await submitApplication()
    const own = await invoke(organizationApplications.handler, {
      method: 'GET',
      path: '/organization-applications',
      authorizer: applicant,
    })
    const admin = await invoke(organizationApplications.handler, {
      method: 'GET',
      path: '/organization-applications',
      authorizer: ADMIN_COGNITO,
    })
    const anonymous = await invoke(organizationApplications.handler, {
      method: 'GET',
      path: '/organization-applications',
    })
    assert.equal(own.statusCode, 200)
    assert.equal(own.json.application.status, 'PENDING')
    assert.equal(own.json.application.userSub, undefined)
    assert.equal(admin.statusCode, 200)
    assert.equal(admin.json.applications.length, 1)
    assert.equal(admin.json.applications[0].userSub, 'applicant-sub')
    assert.equal(anonymous.statusCode, 401)
  })

  it('allows only an admin to decide applications and requires a rejection reason', async () => {
    await submitApplication()
    const forbidden = await invoke(organizationApplications.handler, {
      method: 'PATCH',
      pathParameters: { userSub: 'applicant-sub' },
      authorizer: applicant,
      body: { status: 'APPROVED' },
    })
    const missingReason = await decide('applicant-sub', 'REJECTED')
    assert.equal(forbidden.statusCode, 403)
    assert.equal(missingReason.statusCode, 400)
  })

  it('grants the organizations group only after approval and is retry-safe for group failure', async () => {
    await submitApplication()
    let grantedSub = ''
    const result = await withCognitoGroupMocks({
      addOrganizationGroup: async (sub) => { grantedSub = sub },
    }, () => decide('applicant-sub', 'APPROVED'))
    assert.equal(result.statusCode, 200)
    assert.equal(grantedSub, 'applicant-sub')
    assert.equal(getStore().getOrganizationApplication('applicant-sub').status, 'APPROVED')

    await submitApplication(
      cognitoAuthorizer({ sub: 'grant-fails', email: 'fail@ves.ac.in' }),
      { ...validApplication, officialEmail: 'fail@ves.ac.in' },
    )
    const failed = await withCognitoGroupMocks({
      addOrganizationGroup: async () => { throw new Error('permission denied') },
    }, () => decide('grant-fails', 'APPROVED'))
    assert.equal(failed.statusCode, 502)
    assert.equal(getStore().getOrganizationApplication('grant-fails').status, 'PENDING')
  })

  it('allows retrying approval after Cognito group grant failure', async () => {
    await submitApplication()
    const failed = await withCognitoGroupMocks({
      addOrganizationGroup: async () => { throw new Error('temporary permission failure') },
    }, () => decide('applicant-sub', 'APPROVED'))
    assert.equal(failed.statusCode, 502)
    assert.match(failed.json.message, /Cognito access could not be granted/i)
    assert.equal(getStore().getOrganizationApplication('applicant-sub').status, 'PENDING')

    const retry = await withCognitoGroupMocks({
      addOrganizationGroup: async () => {},
    }, () => decide('applicant-sub', 'APPROVED'))
    assert.equal(retry.statusCode, 200)
    assert.equal(getStore().getOrganizationApplication('applicant-sub').status, 'APPROVED')
  })

  for (const status of ['REJECTED', 'SUSPENDED']) {
    it(`allows retrying ${status.toLowerCase()} after Cognito group removal failure`, async () => {
      const userSub = `${status.toLowerCase()}-retry-sub`
      const email = `${status.toLowerCase()}-retry@ves.ac.in`
      if (status === 'REJECTED') {
        await submitApplication(
          cognitoAuthorizer({ sub: userSub, email }),
          { ...validApplication, officialEmail: email },
        )
      } else {
        seedApprovedOrganization(userSub, email, 'Retry Club')
      }

      let removeAttempts = 0
      const decisionReason = status === 'REJECTED' ? 'Application requires correction' : ''
      const failed = await withCognitoGroupMocks({
        removeOrganizationGroup: async () => {
          removeAttempts += 1
          throw new Error('temporary permission failure')
        },
      }, () => decide(userSub, status, decisionReason))
      assert.equal(failed.statusCode, 502)
      assert.match(failed.json.message, /decision is saved and access is blocked/i)
      assert.equal(getStore().getOrganizationApplication(userSub).status, status)

      const retry = await withCognitoGroupMocks({
        removeOrganizationGroup: async () => { removeAttempts += 1 },
      }, () => decide(userSub, status, decisionReason))
      assert.equal(retry.statusCode, 200)
      assert.equal(retry.json.application.status, status)
      assert.equal(removeAttempts, 2)
    })
  }

  it('does not roll back a concurrent Admin approval after a status conflict', async () => {
    await submitApplication()
    const store = getStore()
    const updateStatus = store.updateOrganizationApplicationStatus
    let removedGroup = false
    store.updateOrganizationApplicationStatus = async (...args) => {
      await updateStatus(...args)
      throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
    }

    try {
      const result = await withCognitoGroupMocks({
        addOrganizationGroup: async () => {},
        removeOrganizationGroup: async () => { removedGroup = true },
      }, () => decide('applicant-sub', 'APPROVED'))
      assert.equal(result.statusCode, 409)
      assert.equal(getStore().getOrganizationApplication('applicant-sub').status, 'APPROVED')
      assert.equal(removedGroup, false)
    } finally {
      store.updateOrganizationApplicationStatus = updateStatus
    }
  })

  it('blocks pending, rejected, and suspended organizations despite stale group claims', async () => {
    await submitApplication()
    const pending = await invoke(getOrganizationEvents.handler, {
      method: 'GET',
      authorizer: applicant,
    })
    assert.equal(pending.statusCode, 403)

    for (const [sub, email, status] of [
      ['rejected-sub', 'rejected@ves.ac.in', 'REJECTED'],
      ['suspended-sub', 'suspended@ves.ac.in', 'SUSPENDED'],
    ]) {
      seedApprovedOrganization(sub, email, `${status} Club`)
      await withCognitoGroupMocks({
        removeOrganizationGroup: async () => {},
      }, async () => {
        const rejected = await decide(
          sub,
          status,
          status === 'REJECTED' ? 'Insufficient verification' : '',
        )
        assert.equal(rejected.statusCode, 200)
        const staleTokenAccess = await invoke(getOrganizationEvents.handler, {
          method: 'GET',
          authorizer: cognitoAuthorizer({
            sub,
            email,
            groups: ['organizations'],
          }),
        })
        assert.equal(staleTokenAccess.statusCode, 403)
      })
    }
  })

  for (const status of ['PENDING', 'REJECTED', 'SUSPENDED']) {
    it(`denies all protected organization operations for ${status} applications with a stale organizations claim`, async () => {
      const userSub = `stale-${status.toLowerCase()}-sub`
      const email = `stale-${status.toLowerCase()}@ves.ac.in`
      const store = getStore()
      store.createOrganizationApplication({
        userSub,
        organizationName: `${status} Club`,
        officialEmail: email,
        representativeName: `${status} Representative`,
        representativeTitle: 'Club Representative',
        representativePhone: '+1 555 010 1234',
      })
      if (status !== 'PENDING') {
        store.updateOrganizationApplicationStatus(
          userSub,
          {
            status,
            decisionReason: status === 'REJECTED' ? 'Application requires correction' : '',
            decidedBy: 'admin-sub',
          },
          ['PENDING'],
        )
      }

      const staleOrganizationToken = cognitoAuthorizer({
        sub: userSub,
        email,
        groups: ['organizations'],
      })
      const checks = [
        ['event creation', createEvent.handler, {
          method: 'POST',
          authorizer: staleOrganizationToken,
          body: { title: 'Blocked Event', date: '2099-11-02', venue: 'Hall 9' },
        }],
        ['event listing', getOrganizationEvents.handler, {
          method: 'GET',
          authorizer: staleOrganizationToken,
        }],
        ['event update', updateEvent.handler, {
          method: 'PUT',
          pathParameters: { eventId: 'e1' },
          authorizer: staleOrganizationToken,
          body: { title: 'Blocked Update', date: '2099-11-02', venue: 'Hall 9' },
        }],
        ['registration listing', getRegistrations.handler, {
          method: 'GET',
          authorizer: staleOrganizationToken,
        }],
      ]

      for (const [operation, handler, event] of checks) {
        const result = await invoke(handler, event)
        assert.equal(result.statusCode, 403, `${status} application should deny ${operation}`)
      }
    })
  }

  it('persists rejection before group cleanup and continues denying access if cleanup fails', async () => {
    seedApprovedOrganization('revoke-sub', 'revoke@ves.ac.in', 'Revoke Club')
    const decision = await withCognitoGroupMocks({
      removeOrganizationGroup: async () => { throw new Error('permission denied') },
    }, () => decide('revoke-sub', 'REJECTED', 'Application did not meet requirements'))
    assert.equal(decision.statusCode, 502)
    assert.equal(getStore().getOrganizationApplication('revoke-sub').status, 'REJECTED')

    const denied = await invoke(getOrganizationEvents.handler, {
      method: 'GET',
      authorizer: cognitoAuthorizer({
        sub: 'revoke-sub',
        email: 'revoke@ves.ac.in',
        groups: ['organizations'],
      }),
    })
    assert.equal(denied.statusCode, 403)
  })

  it('prevents organization applicants from using Student registration APIs', async () => {
    await submitApplication()
    const registration = await invoke(register.handler, {
      method: 'POST',
      path: '/register',
      authorizer: applicant,
      body: { eventId: 'e1', name: 'Aarav Mehta', email: 'robotics@ves.ac.in' },
    })
    const registrations = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      authorizer: applicant,
    })
    assert.equal(registration.statusCode, 403)
    assert.equal(registrations.statusCode, 403)
  })
})

describe('GET /organization/events', () => {
  it('lists only the organization owner events and allows admin oversight', async () => {
    seedApprovedOrganization('organization-sub-a', 'codecell@ves.ac.in', 'CodeCell')
    seedApprovedOrganization('organization-sub-b', 'robotics@ves.ac.in', 'Robotics Club')
    const createdA = await invoke(createEvent.handler, {
      method: 'POST',
      authorizer: ORGANIZATION_A,
      body: { title: 'CodeCell Event', date: '2099-11-02', venue: 'Lab 1' },
    })
    const createdB = await invoke(createEvent.handler, {
      method: 'POST',
      authorizer: ORGANIZATION_B,
      body: { title: 'Robotics Event', date: '2099-11-03', venue: 'Lab 2' },
    })

    const orgList = await invoke(getOrganizationEvents.handler, {
      method: 'GET',
      authorizer: ORGANIZATION_A,
    })
    assert.equal(orgList.statusCode, 200)
    assert.deepEqual(orgList.json.events.map((row) => row.eventId), [createdA.json.eventId])

    const adminList = await invoke(getOrganizationEvents.handler, {
      method: 'GET',
      authorizer: cognitoAuthorizer({
        sub: 'admin-sub',
        email: 'admin@univent.demo',
        groups: ['admins'],
      }),
    })
    assert.equal(adminList.statusCode, 200)
    assert.ok(adminList.json.events.some((row) => row.eventId === createdA.json.eventId))
    assert.ok(adminList.json.events.some((row) => row.eventId === createdB.json.eventId))
  })

  it('rejects anonymous and student callers', async () => {
    const anonymous = await invoke(getOrganizationEvents.handler, { method: 'GET' })
    const student = await invoke(getOrganizationEvents.handler, {
      method: 'GET',
      headers: STUDENT_A,
    })
    assert.equal(anonymous.statusCode, 401)
    assert.equal(student.statusCode, 403)
  })
})

describe('PUT /events/{eventId}', () => {
  const updatedValues = {
    title: 'Updated Organization Event',
    date: '2099-11-02',
    venue: 'Updated Hall',
    description: 'Updated description for the event.',
    capacity: 20,
    category: 'Technical',
    startTime: '10:00',
    endTime: '12:00',
    regDeadline: '2099-11-01',
  }

  async function createOwnedEvent(authorizer = ORGANIZATION_A) {
    const sub = authorizer.claims.sub
    const email = authorizer.claims.email
    seedApprovedOrganization(sub, email, authorizer.claims.name)
    return invoke(createEvent.handler, {
      method: 'POST',
      authorizer,
      body: { title: 'Organization Event', date: '2099-11-02', venue: 'Hall 1' },
    })
  }

  it('allows an organization to update its own event but ignores forged ownership', async () => {
    const created = await createOwnedEvent()
    const result = await invoke(updateEvent.handler, {
      method: 'PUT',
      path: `/events/${created.json.eventId}`,
      pathParameters: { eventId: created.json.eventId },
      authorizer: ORGANIZATION_A,
      body: { ...updatedValues, ownerSub: 'organization-sub-b' },
    })
    assert.equal(result.statusCode, 200)
    assert.equal(result.json.title, updatedValues.title)
    assert.equal(getStore().getEvent(created.json.eventId).ownerSub, 'organization-sub-a')
  })

  it('denies another organization and keeps admin update access', async () => {
    const created = await createOwnedEvent()
    seedApprovedOrganization('organization-sub-b', 'robotics@ves.ac.in', 'Robotics Club')
    const denied = await invoke(updateEvent.handler, {
      method: 'PUT',
      pathParameters: { eventId: created.json.eventId },
      authorizer: ORGANIZATION_B,
      body: updatedValues,
    })
    assert.equal(denied.statusCode, 403)

    const adminUpdate = await invoke(updateEvent.handler, {
      method: 'PUT',
      pathParameters: { eventId: created.json.eventId },
      authorizer: cognitoAuthorizer({
        sub: 'admin-sub',
        email: 'admin@univent.demo',
        groups: ['admins'],
      }),
      body: updatedValues,
    })
    assert.equal(adminUpdate.statusCode, 200)
    assert.equal(adminUpdate.json.title, updatedValues.title)
  })

  it('rejects capacity changes below existing registrations', async () => {
    const created = await createOwnedEvent()
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: created.json.eventId, name: 'Asha Sharma', email: 'asha@college.edu' },
    })
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_B,
      body: { eventId: created.json.eventId, name: 'Rohan Patil', email: 'rohan@college.edu' },
    })

    const result = await invoke(updateEvent.handler, {
      method: 'PUT',
      pathParameters: { eventId: created.json.eventId },
      authorizer: ORGANIZATION_A,
      body: { ...updatedValues, capacity: 1 },
    })
    assert.equal(result.statusCode, 409)
    assert.match(result.json.message, /capacity/i)
  })
})

describe('POST /register', () => {
  it('rejects a signed-out caller with 401', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })

    assert.equal(res.statusCode, 401)
  })

  it('rejects an organization account with 403', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      headers: devHeaders('organization', 'codecell@ves.ac.in', 'CodeCell'),
      body: { eventId: 'e1', name: 'CodeCell', email: 'codecell@ves.ac.in' },
    })

    assert.equal(res.statusCode, 403)
    assert.match(res.json.message, /students/i)
  })

  it('rejects an administrator account with 403', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      headers: ADMIN,
      body: { eventId: 'e1', name: 'Demo Admin', email: 'admin@univent.demo' },
    })

    assert.equal(res.statusCode, 403)
    assert.match(res.json.message, /students/i)
  })

  it('does not accept a body role as authorization', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: {
        eventId: 'e1',
        name: 'Asha Sharma',
        email: 'asha@college.edu',
        role: 'admin',
        ownerEmail: 'mallory@college.edu',
      },
    })

    assert.equal(res.statusCode, 201)
    const stored = getStore().findRegistration('e1', 'asha@college.edu')
    assert.equal(stored.ownerEmail, 'asha@college.edu')
  })

  it('rejects a missing email with 400', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma' },
    })

    assert.equal(res.statusCode, 400)
    assert.match(res.json.message, /email/i)
  })

  it('rejects an invalid email with 400', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'not-an-email' },
    })

    assert.equal(res.statusCode, 400)
    assert.match(res.json.message, /email/i)
  })

  it('rejects an unknown event with 404', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'does-not-exist', name: 'Asha Sharma', email: 'asha@college.edu' },
    })

    assert.equal(res.statusCode, 404)
    assert.match(res.json.message, /event not found/i)
  })

  it('rejects a registration after the deadline with 409', async () => {
    const created = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: {
        title: 'Expired Deadline Event',
        date: '2099-12-31',
        venue: 'Lab 6',
        regDeadline: '2000-01-01',
      },
    })

    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: {
        eventId: created.json.eventId,
        name: 'Asha Sharma',
        email: 'asha@college.edu',
      },
    })

    assert.equal(res.statusCode, 409)
    assert.match(res.json.message, /closed/i)
  })

  it('rejects a registration for a past event with 409', async () => {
    const created = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: {
        title: 'Past Event',
        date: '2000-01-01',
        venue: 'Old Hall',
      },
    })

    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: {
        eventId: created.json.eventId,
        name: 'Asha Sharma',
        email: 'asha@college.edu',
      },
    })

    assert.equal(res.statusCode, 409)
    assert.match(res.json.message, /started|ended/i)
  })

  it('rejects a registration for an event that has already started today', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const created = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: {
        title: 'Started Today',
        date: today,
        venue: 'Lab 7',
        startTime: '00:00',
      },
    })

    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: {
        eventId: created.json.eventId,
        name: 'Asha Sharma',
        email: 'asha@college.edu',
      },
    })

    assert.equal(res.statusCode, 409)
    assert.match(res.json.message, /started/i)
  })

  it('accepts a registration for an event that is still open', async () => {
    const created = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: {
        title: 'Open Future Event',
        date: '2099-12-31',
        venue: 'Lab 8',
        startTime: '10:00',
        endTime: '12:00',
        regDeadline: '2099-12-30',
      },
    })

    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: {
        eventId: created.json.eventId,
        name: 'Asha Sharma',
        email: 'asha@college.edu',
      },
    })

    assert.equal(res.statusCode, 201)
    assert.equal(res.json.eventId, created.json.eventId)
  })

  it('rejects an email that does not match the signed-in account with 403', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Someone Else', email: 'someone@college.edu' },
    })

    assert.equal(res.statusCode, 403)
    assert.match(res.json.message, /signed-in/i)
  })

  it('creates a registration and returns 201 with the registration object', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })

    assert.equal(res.statusCode, 201)
    assert.match(res.json.registrationId, /^reg-/)
    assert.equal(res.json.eventId, 'e1')
    assert.equal(res.json.name, 'Asha Sharma')
    assert.equal(res.json.email, 'asha@college.edu')
    assert.equal(res.json.status, 'Confirmed')
    assert.ok(res.json.createdAt)
  })

  it('stores trusted principal identity instead of body ownership fields', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      authorizer: cognitoAuthorizer({
        sub: 'cognito-asha',
        email: 'ASHA@College.edu',
        name: 'Asha Sharma',
      }),
      body: {
        eventId: 'e1',
        name: 'Asha Sharma',
        email: 'asha@college.edu',
        ownerEmail: 'mallory@college.edu',
        userId: 'spoofed-user',
      },
    })

    assert.equal(res.statusCode, 201)
    const stored = getStore().findRegistration('e1', 'asha@college.edu')
    assert.equal(stored.ownerEmail, 'asha@college.edu')
    assert.equal(stored.userId, 'cognito-asha')
  })

  it('rejects a principal without an email address with 403', async () => {
    const res = await invoke(register.handler, {
      method: 'POST',
      authorizer: cognitoAuthorizer({ sub: 'no-email', email: '' }),
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })

    assert.equal(res.statusCode, 403)
    assert.match(res.json.message, /no email/i)
  })

  it('rejects a duplicate registration with 409', async () => {
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })

    const res = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })

    assert.equal(res.statusCode, 409)
    assert.match(res.json.message, /already registered/i)
  })

  it('rejects a registration for a full event with 409', async () => {
    const created = await invoke(createEvent.handler, {
      method: 'POST',
      headers: ADMIN,
      body: { title: 'Tiny Workshop', date: '2026-12-07', venue: 'Lab 4', capacity: 1 },
    })
    const eventId = created.json.eventId

    const first = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId, name: 'Asha Sharma', email: 'asha@college.edu' },
    })
    assert.equal(first.statusCode, 201)

    const second = await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_B,
      body: { eventId, name: 'Rohan Patil', email: 'rohan@college.edu' },
    })
    assert.equal(second.statusCode, 409)
    assert.match(second.json.message, /full/i)
  })
})

describe('GET /registrations', () => {
  it('rejects a signed-out caller with 401', async () => {
    const res = await invoke(getRegistrations.handler, { method: 'GET', path: '/registrations' })
    assert.equal(res.statusCode, 401)
  })

  it('returns every registration to an admin', async () => {
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_B,
      body: { eventId: 'e2', name: 'Rohan Patil', email: 'rohan@college.edu' },
    })

    const res = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      headers: ADMIN,
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.json.registrations.length, 2)
  })

  it('returns only the caller registrations to a signed-in student', async () => {
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_B,
      body: { eventId: 'e1', name: 'Rohan Patil', email: 'rohan@college.edu' },
    })

    const res = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      headers: STUDENT_A,
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.json.registrations.length, 1)
    assert.equal(res.json.registrations[0].email, 'asha@college.edu')
  })

  it('limits organization registrations to its own events and denies another org event filter', async () => {
    seedApprovedOrganization('organization-sub-a', 'codecell@ves.ac.in', 'CodeCell')
    seedApprovedOrganization('organization-sub-b', 'robotics@ves.ac.in', 'Robotics Club')
    const eventA = await invoke(createEvent.handler, {
      method: 'POST',
      authorizer: ORGANIZATION_A,
      body: { title: 'CodeCell Workshop', date: '2099-11-02', venue: 'Lab 1' },
    })
    const eventB = await invoke(createEvent.handler, {
      method: 'POST',
      authorizer: ORGANIZATION_B,
      body: { title: 'Robotics Workshop', date: '2099-11-03', venue: 'Lab 2' },
    })

    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: eventA.json.eventId, name: 'Asha Sharma', email: 'asha@college.edu' },
    })
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_B,
      body: { eventId: eventB.json.eventId, name: 'Rohan Patil', email: 'rohan@college.edu' },
    })

    const orgRows = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      authorizer: ORGANIZATION_A,
    })
    assert.equal(orgRows.statusCode, 200)
    assert.equal(orgRows.json.registrations.length, 1)
    assert.equal(orgRows.json.registrations[0].eventId, eventA.json.eventId)

    const denied = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      authorizer: ORGANIZATION_A,
      query: { eventId: eventB.json.eventId },
    })
    assert.equal(denied.statusCode, 403)
  })

  it('keeps the owner filter when a student also filters by eventId', async () => {
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_B,
      body: { eventId: 'e1', name: 'Rohan Patil', email: 'rohan@college.edu' },
    })

    const res = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      headers: STUDENT_A,
      query: { eventId: 'e1' },
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.json.registrations.length, 1)
    assert.equal(res.json.registrations[0].email, 'asha@college.edu')
  })

  it('returns an empty list for a signed-in account without an email', async () => {
    const res = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      authorizer: cognitoAuthorizer({ sub: 'no-email', email: '' }),
    })

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json.registrations, [])
  })

  it('filters by the eventId query parameter', async () => {
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_A,
      body: { eventId: 'e1', name: 'Asha Sharma', email: 'asha@college.edu' },
    })
    await invoke(register.handler, {
      method: 'POST',
      headers: STUDENT_B,
      body: { eventId: 'e2', name: 'Rohan Patil', email: 'rohan@college.edu' },
    })

    const res = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      headers: ADMIN,
      query: { eventId: 'e2' },
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.json.registrations.length, 1)
    assert.equal(res.json.registrations[0].eventId, 'e2')
  })

  it('returns 404 for an unknown eventId', async () => {
    const res = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      headers: ADMIN,
      query: { eventId: 'does-not-exist' },
    })

    assert.equal(res.statusCode, 404)
    assert.match(res.json.message, /event not found/i)
  })

  it('returns 400 for an empty eventId query parameter', async () => {
    const res = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      headers: ADMIN,
      query: { eventId: '  ' },
    })

    assert.equal(res.statusCode, 400)
    assert.match(res.json.message, /eventid/i)
  })
})

describe('deployed-environment safety', () => {
  it('ignores the development identity headers inside AWS Lambda', async () => {
    const originalExecutionEnv = process.env.AWS_EXECUTION_ENV
    const originalSamLocal = process.env.AWS_SAM_LOCAL
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x'
    delete process.env.AWS_SAM_LOCAL
    try {
      const res = await invoke(createEvent.handler, {
        method: 'POST',
        headers: ADMIN,
        body: { title: 'Spoofed Event', date: '2026-12-08', venue: 'Lab 5' },
      })

      assert.equal(res.statusCode, 401)
    } finally {
      if (originalExecutionEnv === undefined) delete process.env.AWS_EXECUTION_ENV
      else process.env.AWS_EXECUTION_ENV = originalExecutionEnv
      if (originalSamLocal === undefined) delete process.env.AWS_SAM_LOCAL
      else process.env.AWS_SAM_LOCAL = originalSamLocal
    }
  })

  it('allows development identity headers only in an explicitly enabled SAM local runtime', async () => {
    const originalExecutionEnv = process.env.AWS_EXECUTION_ENV
    const originalSamLocal = process.env.AWS_SAM_LOCAL
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x'
    process.env.AWS_SAM_LOCAL = 'true'
    try {
      const res = await invoke(createEvent.handler, {
        method: 'POST',
        headers: ADMIN,
        body: { title: 'SAM Local Event', date: '2026-12-08', venue: 'Lab 5' },
      })

      assert.equal(res.statusCode, 201)
    } finally {
      if (originalExecutionEnv === undefined) delete process.env.AWS_EXECUTION_ENV
      else process.env.AWS_EXECUTION_ENV = originalExecutionEnv
      if (originalSamLocal === undefined) delete process.env.AWS_SAM_LOCAL
      else process.env.AWS_SAM_LOCAL = originalSamLocal
    }
  })
})
