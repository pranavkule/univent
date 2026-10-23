// Handler tests. Run with `npm test` from the backend folder.
// Uses the Node.js built-in test runner (no test framework dependency).
const { describe, it, before, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { invoke, devHeaders, cognitoAuthorizer } = require('./helpers')
const { getStore, resetStore } = require('../functions/lib/store')

const getEvents = require('../functions/getEvents')
const createEvent = require('../functions/createEvent')
const register = require('../functions/register')
const getRegistrations = require('../functions/getRegistrations')

const ADMIN = devHeaders('admin', 'admin@univent.demo', 'Demo Admin')
const STUDENT_A = devHeaders('student', 'asha@college.edu', 'Asha Sharma')
const STUDENT_B = devHeaders('student', 'rohan@college.edu', 'Rohan Patil')

const originalEnv = { ...process.env }

before(() => {
  process.env.UNIVENT_DEV_AUTH = 'true'
  process.env.CORS_ORIGIN = '*'
})

after(() => {
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

  it('rejects an organization account with 403 in Phase 3', async () => {
    const res = await invoke(createEvent.handler, {
      method: 'POST',
      headers: devHeaders('organization', 'codecell@ves.ac.in', 'CodeCell'),
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

  it('rejects an organization account with 403', async () => {
    const res = await invoke(getRegistrations.handler, {
      method: 'GET',
      path: '/registrations',
      headers: devHeaders('organization', 'codecell@ves.ac.in', 'CodeCell'),
    })

    assert.equal(res.statusCode, 403)
    assert.match(res.json.message, /organization/i)
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
