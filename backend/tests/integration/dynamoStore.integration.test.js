const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')

const requireFunctions = createRequire(require.resolve('../../functions/package.json'))
const {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} = requireFunctions('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, UpdateCommand } = requireFunctions('@aws-sdk/lib-dynamodb')

const { createDynamoStore } = require('../../functions/lib/dynamoStore')
const { resetStore } = require('../../functions/lib/store')
const { CODES } = require('../../functions/lib/storeError')
const {
  seedSampleEvents,
  reconcileCounts,
} = require('../../functions/scripts/lib/dynamoAdmin')
const getEvents = require('../../functions/getEvents')
const createEvent = require('../../functions/createEvent')
const register = require('../../functions/register')
const getRegistrations = require('../../functions/getRegistrations')
const { invoke, devHeaders } = require('../helpers')

const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:8000'
const region = process.env.AWS_REGION || 'us-east-1'
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
const eventsTable = `UniventEvents${suffix}`
const registrationsTable = `UniventRegistrations${suffix}`

const lowLevel = new DynamoDBClient({
  endpoint,
  region,
  maxAttempts: 1,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

function docClient() {
  return DynamoDBDocumentClient.from(lowLevel, {
    marshallOptions: { removeUndefinedValues: true },
  })
}

async function waitForActive(table) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await lowLevel.send(new DescribeTableCommand({ TableName: table }))
    if (result.Table && result.Table.TableStatus === 'ACTIVE') return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`table ${table} did not become active`)
}

async function tablesExist() {
  try {
    await lowLevel.send(new DescribeTableCommand({ TableName: eventsTable }))
    return true
  } catch {
    return false
  }
}

async function deleteTable(name) {
  try {
    await lowLevel.send(new DeleteTableCommand({ TableName: name }))
  } catch {
    // Best-effort cleanup for a local test table.
  }
}

const CONNECTIVITY_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ECONNRESET',
])

function isConnectivityError(err) {
  const code = String((err && (err.code || err.name)) || '')
  if (CONNECTIVITY_CODES.has(code)) return true
  return /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|socket hang up/i.test(
    String((err && err.message) || ''),
  )
}

async function withEnv(overrides, fn) {
  const original = new Map()
  for (const key of Object.keys(overrides)) {
    original.set(key, process.env[key])
    if (overrides[key] === undefined) delete process.env[key]
    else process.env[key] = overrides[key]
  }
  try {
    return await fn()
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function withDynamoEnv(fn) {
  return withEnv(
    {
      UNIVENT_STORE: 'dynamodb',
      EVENTS_TABLE: eventsTable,
      REGISTRATIONS_TABLE: registrationsTable,
      REGISTRATIONS_OWNER_INDEX: 'OwnerEmailIndex',
      DYNAMODB_ENDPOINT: endpoint,
      AWS_REGION: region,
      AWS_ACCESS_KEY_ID: 'local',
      AWS_SECRET_ACCESS_KEY: 'local',
      UNIVENT_DEV_AUTH: 'true',
      AWS_EXECUTION_ENV: undefined,
      AWS_SAM_LOCAL: undefined,
    },
    async () => {
      resetStore()
      try {
        return await fn()
      } finally {
        resetStore()
      }
    },
  )
}

function adminConfig(overrides = {}) {
  return {
    eventsTable,
    registrationsTable,
    endpoint,
    region,
    force: false,
    dryRun: false,
    ...overrides,
  }
}

let available = false
let store

before(async () => {
  try {
    await lowLevel.send(new ListTablesCommand({}))
  } catch (err) {
    if (!isConnectivityError(err)) throw err
    available = false
    return
  }

  try {
    await lowLevel.send(
      new CreateTableCommand({
        TableName: eventsTable,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [{ AttributeName: 'eventId', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'eventId', KeyType: 'HASH' }],
      }),
    )
    await waitForActive(eventsTable)

    await lowLevel.send(
      new CreateTableCommand({
        TableName: registrationsTable,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'eventId', AttributeType: 'S' },
          { AttributeName: 'email', AttributeType: 'S' },
          { AttributeName: 'ownerEmail', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'eventId', KeyType: 'HASH' },
          { AttributeName: 'email', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'OwnerEmailIndex',
            KeySchema: [
              { AttributeName: 'ownerEmail', KeyType: 'HASH' },
              { AttributeName: 'eventId', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    )
    await waitForActive(registrationsTable)

    store = createDynamoStore({
      client: docClient(),
      eventsTable,
      registrationsTable,
      retryBaseDelayMs: 10,
    })
    available = true
  } catch (err) {
    await deleteTable(eventsTable)
    await deleteTable(registrationsTable)
    throw err
  }
})

after(async () => {
  if (available && (await tablesExist())) {
    await deleteTable(registrationsTable)
    await deleteTable(eventsTable)
  }
  lowLevel.destroy()
})

function requireLocal(t) {
  if (!available) t.skip(`DynamoDB Local is not available at ${endpoint}`)
  return available
}

async function createCapacityEvent(capacity) {
  return store.createEvent({
    title: `Capacity ${capacity}`,
    date: '2026-12-01',
    venue: 'Lab',
    capacity,
  })
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code)
    return true
  })
}

describe('DynamoDB store integration (DynamoDB Local)', () => {
  it('never exceeds capacity under concurrent registrations', async (t) => {
    if (!requireLocal(t)) return

    const event = await createCapacityEvent(3)
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        store.createRegistration({
          eventId: event.eventId,
          name: `Student ${index}`,
          email: `student${index}@college.edu`,
        }),
      ),
    )

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    assert.equal(fulfilled.length, 3)
    assert.equal(rejected.length, 7)
    for (const result of rejected) assert.equal(result.reason.code, CODES.EVENT_FULL)

    const stored = await store.getEvent(event.eventId)
    assert.equal(stored.registeredCount, 3)
    assert.equal(stored.registrationCounterReady, true)
    assert.equal((await store.listRegistrations({ eventId: event.eventId })).length, 3)
  })

  it('accepts exactly one of many concurrent duplicate registrations', async (t) => {
    if (!requireLocal(t)) return

    const event = await createCapacityEvent(10)
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        store.createRegistration({
          eventId: event.eventId,
          name: 'Asha Sharma',
          email: 'ASHA@College.edu',
        }),
      ),
    )

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    assert.equal(fulfilled.length, 1)
    assert.equal(rejected.length, 9)
    for (const result of rejected) {
      assert.equal(result.reason.code, CODES.DUPLICATE_REGISTRATION)
    }

    const stored = await store.getEvent(event.eventId)
    assert.equal(stored.registeredCount, 1)
    assert.equal(await store.countRegistrations(event.eventId), 1)
  })

  it('fails closed when a capacity event has no ready counter', async (t) => {
    if (!requireLocal(t)) return

    const event = await createCapacityEvent(5)
    await deleteCounter(event.eventId)

    await expectCode(
      store.createRegistration({
        eventId: event.eventId,
        name: 'Asha Sharma',
        email: 'asha@college.edu',
      }),
      CODES.EVENT_NOT_READY,
    )
  })

  it('returns only the owner registrations from the GSI', async (t) => {
    if (!requireLocal(t)) return

    const first = await createCapacityEvent(5)
    const second = await createCapacityEvent(5)
    const owner = `owner.${suffix}@college.edu`
    await store.createRegistration({
      eventId: first.eventId,
      name: 'Asha Sharma',
      email: owner,
    })
    await store.createRegistration({
      eventId: second.eventId,
      name: 'Rohan Patil',
      email: 'rohan@college.edu',
    })

    const rows = await store.listRegistrations({ ownerEmail: owner.toUpperCase() })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].eventId, first.eventId)
    assert.equal(rows[0].email, owner)
  })

  it('seeds idempotently and repairs counter drift only with force', async (t) => {
    if (!requireLocal(t)) return

    const config = adminConfig()

    const firstSeed = await seedSampleEvents(config)
    assert.equal(firstSeed.inserted, 7)
    assert.equal(firstSeed.failed, 0)

    const secondSeed = await seedSampleEvents(config)
    assert.equal(secondSeed.inserted, 0)
    assert.equal(secondSeed.skipped, 7)

    await docClient().send(
      new UpdateCommand({
        TableName: eventsTable,
        Key: { eventId: 'e1' },
        UpdateExpression: 'SET #count = :count',
        ExpressionAttributeNames: { '#count': 'registeredCount' },
        ExpressionAttributeValues: { ':count': 999 },
      }),
    )

    const withoutForce = await reconcileCounts(config)
    assert.ok(withoutForce.drift >= 1)
    assert.ok(withoutForce.remainingProblems.includes('e1'))

    const repaired = await reconcileCounts({ ...config, force: true })
    assert.ok(repaired.repaired >= 1)
    const event = await store.getEvent('e1')
    assert.equal(event.registeredCount, 0)
    assert.equal(event.registrationCounterReady, true)
  })

  it('initializes a missing counter so registrations can resume', async (t) => {
    if (!requireLocal(t)) return

    const event = await createCapacityEvent(2)
    await deleteCounter(event.eventId)

    const summary = await reconcileCounts(adminConfig())
    assert.ok(summary.initialized >= 1)

    const stored = await store.getEvent(event.eventId)
    assert.equal(stored.registeredCount, 0)
    assert.equal(stored.registrationCounterReady, true)

    await store.createRegistration({
      eventId: event.eventId,
      name: 'Asha Sharma',
      email: `initialized.${suffix}@college.edu`,
    })
    const after = await store.getEvent(event.eventId)
    assert.equal(after.registeredCount, 1)
  })

  it('registers for an uncapped event and initializes its counter', async (t) => {
    if (!requireLocal(t)) return

    const event = await store.createEvent({
      title: 'Open Meetup',
      date: '2026-12-09',
      venue: 'Open Ground',
    })
    assert.equal(event.capacity, undefined)

    const registration = await store.createRegistration({
      eventId: event.eventId,
      name: 'Rohan Patil',
      email: `uncapped.${suffix}@college.edu`,
    })
    assert.equal(registration.eventId, event.eventId)

    const stored = await store.getEvent(event.eventId)
    assert.equal(stored.registeredCount, 1)
    assert.equal(stored.registrationCounterReady, true)
  })

  it('serves all four routes through the env-selected DynamoDB store', async (t) => {
    if (!requireLocal(t)) return

    const email = `handler.${suffix}@college.edu`
    const admin = devHeaders('admin', 'admin@univent.demo', 'Demo Admin')
    const student = devHeaders('student', email, 'Handler Student')

    await withDynamoEnv(async () => {
      const created = await invoke(createEvent.handler, {
        method: 'POST',
        headers: admin,
        body: {
          title: 'Handler Meetup',
          date: '2026-12-10',
          venue: 'Seminar Hall',
          capacity: 3,
        },
      })
      assert.equal(created.statusCode, 201)
      assert.match(created.json.eventId, /^evt-/)

      const listed = await invoke(getEvents.handler, { method: 'GET', path: '/events' })
      assert.equal(listed.statusCode, 200)
      assert.ok(listed.json.events.some((row) => row.eventId === created.json.eventId))

      const registered = await invoke(register.handler, {
        method: 'POST',
        headers: student,
        body: {
          eventId: created.json.eventId,
          name: 'Handler Student',
          email,
        },
      })
      assert.equal(registered.statusCode, 201)
      assert.equal(registered.json.eventId, created.json.eventId)
      assert.equal(registered.json.email, email)

      const missing = await invoke(register.handler, {
        method: 'POST',
        headers: student,
        body: {
          eventId: 'does-not-exist',
          name: 'Handler Student',
          email,
        },
      })
      assert.equal(missing.statusCode, 404)

      const rows = await invoke(getRegistrations.handler, {
        method: 'GET',
        path: '/registrations',
        headers: student,
        query: { eventId: created.json.eventId },
      })
      assert.equal(rows.statusCode, 200)
      assert.equal(rows.json.registrations.length, 1)
      assert.equal(rows.json.registrations[0].email, email)

      const missingEvent = await invoke(getRegistrations.handler, {
        method: 'GET',
        path: '/registrations',
        headers: student,
        query: { eventId: 'does-not-exist' },
      })
      assert.equal(missingEvent.statusCode, 404)
    })
  })

  it('maps an unready counter to 409 through the env-selected store and handler', async (t) => {
    if (!requireLocal(t)) return

    const event = await createCapacityEvent(2)
    await deleteCounter(event.eventId)

    await withDynamoEnv(async () => {
      const res = await invoke(register.handler, {
        method: 'POST',
        headers: devHeaders('student', 'asha@college.edu', 'Asha Sharma'),
        body: {
          eventId: event.eventId,
          name: 'Asha Sharma',
          email: 'asha@college.edu',
        },
      })
      assert.equal(res.statusCode, 409)
      assert.match(res.json.message, /not ready/i)
    })

    assert.equal((await store.listRegistrations({ eventId: event.eventId })).length, 0)
  })
})

async function deleteCounter(eventId) {
  await docClient().send(
    new UpdateCommand({
      TableName: eventsTable,
      Key: { eventId },
      UpdateExpression: 'REMOVE registeredCount, registrationCounterReady',
    }),
  )
}
