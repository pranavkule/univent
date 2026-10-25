const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createDynamoStore, COUNTER_READY, REGISTERED_COUNT } = require('../functions/lib/dynamoStore')
const { CODES } = require('../functions/lib/storeError')

class FakeClient {
  constructor(handler) {
    this.handler = handler
    this.calls = []
  }

  async send(command) {
    this.calls.push(command)
    return this.handler(command, this.calls.length)
  }
}

function reason(code) {
  return { Code: code, Message: code }
}

function canceled(reasons) {
  const err = new Error('transaction canceled')
  err.name = 'TransactionCanceledException'
  err.CancellationReasons = reasons
  return err
}

function makeStore(fake, options = {}) {
  return createDynamoStore({
    client: fake,
    eventsTable: 'Events',
    registrationsTable: 'Registrations',
    retryBaseDelayMs: 0,
    ...options,
  })
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code)
    return true
  })
}

describe('DynamoDB store', () => {
  it('writes the registration and counter in one transaction', async () => {
    const fake = new FakeClient(() => ({}))
    const store = makeStore(fake)

    const result = await store.createRegistration({
      eventId: 'e1',
      name: 'Asha Sharma',
      email: ' ASHA@College.edu ',
      userId: 'sub-1',
    })

    assert.equal(result.email, 'asha@college.edu')
    assert.equal(result.ownerEmail, 'asha@college.edu')
    assert.equal(result.userId, 'sub-1')

    const transact = fake.calls[0].input
    const update = transact.TransactItems[0].Update
    const put = transact.TransactItems[1].Put

    assert.equal(transact.TransactItems.length, 2)
    assert.equal(update.TableName, 'Events')
    assert.equal(update.ExpressionAttributeNames['#count'], 'registeredCount')
    assert.equal(update.ExpressionAttributeNames['#ready'], 'registrationCounterReady')
    assert.match(update.ConditionExpression, /attribute_not_exists\(#capacity\)/)
    assert.match(update.ConditionExpression, /#ready = :true/)
    assert.match(update.ConditionExpression, /#count < #capacity/)
    assert.equal(put.TableName, 'Registrations')
    assert.equal(put.Item.eventId, 'e1')
    assert.equal(put.Item.email, 'asha@college.edu')
  })

  it('maps a duplicate registration condition to DUPLICATE_REGISTRATION', async () => {
    const fake = new FakeClient(() => {
      throw canceled([reason('None'), reason('ConditionalCheckFailed')])
    })
    const store = makeStore(fake)

    await expectCode(
      store.createRegistration({ eventId: 'e1', name: 'Asha', email: 'asha@college.edu' }),
      CODES.DUPLICATE_REGISTRATION,
    )
  })

  it('reports duplicate before full when both transaction conditions fail', async () => {
    const fake = new FakeClient(() => {
      throw canceled([reason('ConditionalCheckFailed'), reason('ConditionalCheckFailed')])
    })
    const store = makeStore(fake)

    await expectCode(
      store.createRegistration({ eventId: 'e1', name: 'Asha', email: 'asha@college.edu' }),
      CODES.DUPLICATE_REGISTRATION,
    )
  })

  it('maps a missing event to EVENT_NOT_FOUND', async () => {
    const fake = new FakeClient((command) => {
      if (command.constructor.name === 'GetCommand') return { Item: undefined }
      throw canceled([reason('ConditionalCheckFailed'), reason('None')])
    })
    const store = makeStore(fake)

    await expectCode(
      store.createRegistration({ eventId: 'missing', name: 'Asha', email: 'asha@college.edu' }),
      CODES.EVENT_NOT_FOUND,
    )
  })

  it('fails closed when a capacity-limited event has no ready counter', async () => {
    const fake = new FakeClient((command) => {
      if (command.constructor.name === 'GetCommand') {
        return {
          Item: {
            eventId: 'e1',
            capacity: 10,
            [REGISTERED_COUNT]: 3,
            [COUNTER_READY]: false,
          },
        }
      }
      throw canceled([reason('ConditionalCheckFailed'), reason('None')])
    })
    const store = makeStore(fake)

    await expectCode(
      store.createRegistration({ eventId: 'e1', name: 'Asha', email: 'asha@college.edu' }),
      CODES.EVENT_NOT_READY,
    )
  })

  it('maps a full event to EVENT_FULL', async () => {
    const fake = new FakeClient((command) => {
      if (command.constructor.name === 'GetCommand') {
        return {
          Item: {
            eventId: 'e1',
            capacity: 2,
            [REGISTERED_COUNT]: 2,
            [COUNTER_READY]: true,
          },
        }
      }
      throw canceled([reason('ConditionalCheckFailed'), reason('None')])
    })
    const store = makeStore(fake)

    await expectCode(
      store.createRegistration({ eventId: 'e1', name: 'Asha', email: 'asha@college.edu' }),
      CODES.EVENT_FULL,
    )
  })

  it('retries a transaction conflict and then succeeds', async () => {
    const fake = new FakeClient((command, call) => {
      if (command.constructor.name !== 'TransactWriteCommand') return {}
      if (call === 1) throw canceled([reason('TransactionConflict'), reason('None')])
      return {}
    })
    const store = makeStore(fake)

    const result = await store.createRegistration({
      eventId: 'e1',
      name: 'Asha',
      email: 'asha@college.edu',
    })

    assert.equal(result.eventId, 'e1')
    assert.equal(fake.calls.length, 2)
  })

  it('returns REGISTRATION_CONFLICT after exhausting transaction retries', async () => {
    const fake = new FakeClient((command) => {
      if (command.constructor.name === 'TransactWriteCommand') {
        throw canceled([reason('TransactionConflict'), reason('None')])
      }
      return {}
    })
    const store = makeStore(fake, { maxTransactionAttempts: 3 })

    await expectCode(
      store.createRegistration({ eventId: 'e1', name: 'Asha', email: 'asha@college.edu' }),
      CODES.REGISTRATION_CONFLICT,
    )
    assert.equal(fake.calls.length, 3)
  })

  it('propagates non-retryable upstream errors', async () => {
    const upstream = new Error('validation failed')
    upstream.name = 'ValidationException'
    const fake = new FakeClient(() => {
      throw upstream
    })
    const store = makeStore(fake)

    await assert.rejects(
      store.createRegistration({ eventId: 'e1', name: 'Asha', email: 'asha@college.edu' }),
      (err) => err === upstream,
    )
  })

  it('maps an unexplained event conditional failure to REGISTRATION_CONFLICT', async () => {
    const fake = new FakeClient((command) => {
      if (command.constructor.name === 'GetCommand') {
        return {
          Item: {
            eventId: 'e1',
            [REGISTERED_COUNT]: 0,
            [COUNTER_READY]: true,
          },
        }
      }
      throw canceled([reason('ConditionalCheckFailed'), reason('None')])
    })
    const store = makeStore(fake)

    await expectCode(
      store.createRegistration({ eventId: 'e1', name: 'Asha', email: 'asha@college.edu' }),
      CODES.REGISTRATION_CONFLICT,
    )
  })

  it('scans all pages and sorts events by date then eventId', async () => {
    const fake = new FakeClient((command, call) => {
      assert.equal(command.constructor.name, 'ScanCommand')
      if (call === 1) {
        return {
          Items: [
            { eventId: 'b', date: '2026-11-02' },
            { eventId: 'c', date: '2026-11-01' },
          ],
          LastEvaluatedKey: { eventId: 'c' },
        }
      }
      return { Items: [{ eventId: 'a', date: '2026-11-02' }] }
    })
    const store = makeStore(fake, { pageLimit: 2 })

    const result = await store.listEvents()

    assert.deepEqual(result.map((row) => row.eventId), ['c', 'a', 'b'])
    assert.equal(fake.calls[0].input.Limit, 2)
    assert.ok(fake.calls[1].input.ExclusiveStartKey)
  })

  it('queries owned registrations through the owner index', async () => {
    const fake = new FakeClient(() => ({ Items: [] }))
    const store = makeStore(fake, { ownerIndex: 'OwnerEmailIndex' })

    await store.listRegistrations({ ownerEmail: ' ASHA@College.edu ' })

    const input = fake.calls[0].input
    assert.equal(input.IndexName, 'OwnerEmailIndex')
    assert.equal(input.ExpressionAttributeValues[':ownerEmail'], 'asha@college.edu')
  })

  it('queries by event and filters by owner without the index', async () => {
    const fake = new FakeClient(() => ({ Items: [] }))
    const store = makeStore(fake)

    await store.listRegistrations({ eventId: 'e1', ownerEmail: 'asha@college.edu' })

    const input = fake.calls[0].input
    assert.equal(input.IndexName, undefined)
    assert.match(input.KeyConditionExpression, /#eventId/)
    assert.match(input.FilterExpression, /#ownerEmail/)
  })

  it('initializes counters when creating an event', async () => {
    const fake = new FakeClient(() => ({}))
    const store = makeStore(fake)

    const event = await store.createEvent(
      { title: 'Cloud Meetup', date: '2026-12-01' },
      { ownerSub: 'trusted-cognito-sub' },
    )

    assert.equal(event[REGISTERED_COUNT], 0)
    assert.equal(event[COUNTER_READY], true)
    assert.equal(fake.calls[0].input.Item[REGISTERED_COUNT], 0)
    assert.equal(fake.calls[0].input.Item.ownerSub, 'trusted-cognito-sub')
  })

  it('queries organization events by the trusted owner-sub index', async () => {
    const fake = new FakeClient(() => ({ Items: [{ eventId: 'evt-1', date: '2026-12-01' }] }))
    const store = makeStore(fake, { eventOwnerIndex: 'OrganizationOwnerIndex' })

    const events = await store.listEventsByOwner('cognito-sub')

    assert.equal(events[0].eventId, 'evt-1')
    assert.equal(fake.calls[0].input.IndexName, 'OrganizationOwnerIndex')
    assert.equal(fake.calls[0].input.ExpressionAttributeValues[':ownerSub'], 'cognito-sub')
  })

  it('updates an owned event with an atomic owner and capacity condition', async () => {
    const fake = new FakeClient((command) => {
      if (command.constructor.name === 'GetCommand') {
        return { Item: { eventId: 'evt-1', ownerSub: 'owner-a', registeredCount: 2 } }
      }
      if (command.constructor.name === 'UpdateCommand') {
        return {
          Attributes: {
            eventId: 'evt-1',
            ownerSub: 'owner-a',
            title: 'Changed',
            capacity: 5,
          },
        }
      }
      throw new Error(`Unexpected command: ${command.constructor.name}`)
    })
    const store = makeStore(fake)

    const updated = await store.updateEvent(
      'evt-1',
      { title: 'Changed', capacity: 5, description: null },
      { ownerSub: 'owner-a' },
    )

    assert.equal(updated.title, 'Changed')
    const input = fake.calls[1].input
    assert.match(input.ConditionExpression, /#ownerSub = :ownerSub/)
    assert.match(input.ConditionExpression, /#count <= :capacity/)
    assert.match(input.UpdateExpression, /REMOVE #field2/)
    assert.equal(input.ExpressionAttributeValues[':ownerSub'], 'owner-a')
  })

  it('does not issue an update when the requested organization is not the owner', async () => {
    const fake = new FakeClient(() => ({
      Item: { eventId: 'evt-1', ownerSub: 'owner-a', registeredCount: 0 },
    }))
    const store = makeStore(fake)

    const result = await store.updateEvent(
      'evt-1',
      { title: 'Changed', capacity: 5 },
      { ownerSub: 'owner-b' },
    )

    assert.equal(result, false)
    assert.equal(fake.calls.length, 1)
  })

  it('refuses to lower capacity below the current counter', async () => {
    const fake = new FakeClient(() => ({
      Item: { eventId: 'evt-1', ownerSub: 'owner-a', registeredCount: 3 },
    }))
    const store = makeStore(fake)

    await assert.rejects(
      store.updateEvent('evt-1', { title: 'Changed', capacity: 2 }, { ownerSub: 'owner-a' }),
      (err) => err.code === CODES.CAPACITY_BELOW_REGISTRATIONS,
    )
    assert.equal(fake.calls.length, 1)
  })

  it('refuses to reset DynamoDB storage in place', () => {
    const store = makeStore(new FakeClient(() => ({})))
    assert.throws(() => store.reset(), /cannot be reset/)
  })
})
