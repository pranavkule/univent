// DynamoDB-backed storage (Phase 4).
//
// The two tables are:
//   Events          PK eventId
//   Registrations   PK eventId, SK email, GSI OwnerEmailIndex
//
// Registration creation is a single TransactWriteItems call. The transaction
// updates the event's confirmed-registration counter and inserts the
// registration atomically. Capacity-limited events must have a verified
// counter (registeredCount + registrationCounterReady). A missing or false
// readiness flag fails closed instead of treating the count as zero.
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb')
const { makeId } = require('./ids')
const { CODES, StoreError } = require('./storeError')

const OWNER_INDEX_DEFAULT = 'OwnerEmailIndex'
const MAX_TRANSACTION_ATTEMPTS = 5
const BASE_RETRY_DELAY_MS = 25

const COUNTER_READY = 'registrationCounterReady'
const REGISTERED_COUNT = 'registeredCount'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cancellationCode(reasons, index) {
  const reason = Array.isArray(reasons) ? reasons[index] : null
  return reason && reason.Code ? String(reason.Code) : ''
}

function isRetryableCode(code) {
  return [
    'TransactionConflict',
    'TransactionConflictException',
    'ThrottlingError',
    'ThrottlingException',
    'ProvisionedThroughputExceededException',
    'RequestLimitExceeded',
    'InternalServerError',
  ].includes(code)
}

function retryDelay(attempt, baseDelayMs) {
  if (baseDelayMs <= 0) return 0
  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), 500)
  return exponential + Math.floor(Math.random() * 25)
}

function createDynamoStore(options = {}) {
  const eventsTable = options.eventsTable || process.env.EVENTS_TABLE
  const registrationsTable = options.registrationsTable || process.env.REGISTRATIONS_TABLE
  const ownerIndex = options.ownerIndex || process.env.REGISTRATIONS_OWNER_INDEX || OWNER_INDEX_DEFAULT
  const pageLimit = options.pageLimit || null
  const maxAttempts = options.maxTransactionAttempts || MAX_TRANSACTION_ATTEMPTS
  const retryBaseDelayMs =
    options.retryBaseDelayMs === undefined ? BASE_RETRY_DELAY_MS : options.retryBaseDelayMs

  if (!eventsTable || !registrationsTable) {
    throw new Error('EVENTS_TABLE and REGISTRATIONS_TABLE must be set for DynamoDB storage.')
  }

  let ddb = options.client || null
  if (!ddb) {
    const clientConfig = {}
    if (process.env.DYNAMODB_ENDPOINT) clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT
    if (process.env.AWS_REGION) clientConfig.region = process.env.AWS_REGION
    const baseClient = new DynamoDBClient(clientConfig)
    ddb = DynamoDBDocumentClient.from(baseClient, {
      marshallOptions: { removeUndefinedValues: true },
    })
  }

  function withPageLimit(input) {
    if (pageLimit) input.Limit = pageLimit
    return input
  }

  async function scanAll(inputFactory) {
    const items = []
    let ExclusiveStartKey
    do {
      const input = withPageLimit(inputFactory())
      if (ExclusiveStartKey) input.ExclusiveStartKey = ExclusiveStartKey
      const result = await ddb.send(new ScanCommand(input))
      items.push(...(result.Items || []))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return items
  }

  async function queryAll(inputFactory) {
    const items = []
    let ExclusiveStartKey
    do {
      const input = withPageLimit(inputFactory())
      if (ExclusiveStartKey) input.ExclusiveStartKey = ExclusiveStartKey
      const result = await ddb.send(new QueryCommand(input))
      items.push(...(result.Items || []))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return items
  }

  async function listEvents() {
    const items = await scanAll(() => ({
      TableName: eventsTable,
      ConsistentRead: true,
    }))

    return items.sort((left, right) => {
      const byDate = String(left.date || '').localeCompare(String(right.date || ''))
      if (byDate !== 0) return byDate
      return String(left.eventId || '').localeCompare(String(right.eventId || ''))
    })
  }

  async function getEvent(eventId) {
    const result = await ddb.send(
      new GetCommand({
        TableName: eventsTable,
        Key: { eventId },
        ConsistentRead: true,
      }),
    )
    return result.Item || null
  }

  async function createEvent(values) {
    const event = {
      eventId: makeId('evt'),
      ...values,
      [REGISTERED_COUNT]: 0,
      [COUNTER_READY]: true,
      createdAt: new Date().toISOString(),
    }

    await ddb.send(
      new PutCommand({
        TableName: eventsTable,
        Item: event,
        ConditionExpression: 'attribute_not_exists(#eventId)',
        ExpressionAttributeNames: { '#eventId': 'eventId' },
      }),
    )

    return { ...event }
  }

  async function listRegistrations(filter = {}) {
    const eventId = filter.eventId ? String(filter.eventId).trim() : ''
    const hasOwnerFilter = filter.ownerEmail !== undefined && filter.ownerEmail !== null
    const ownerEmail = hasOwnerFilter ? normalizeEmail(filter.ownerEmail) : ''

    if (hasOwnerFilter && !ownerEmail) return []

    if (eventId) {
      const names = { '#eventId': 'eventId' }
      const values = { ':eventId': eventId }
      let filterExpression
      if (ownerEmail) {
        names['#ownerEmail'] = 'ownerEmail'
        values[':ownerEmail'] = ownerEmail
        filterExpression = '#ownerEmail = :ownerEmail'
      }

      return queryAll(() => {
        const input = {
          TableName: registrationsTable,
          KeyConditionExpression: '#eventId = :eventId',
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ConsistentRead: true,
        }
        if (filterExpression) input.FilterExpression = filterExpression
        return input
      })
    }

    if (ownerEmail) {
      return queryAll(() => ({
        TableName: registrationsTable,
        IndexName: ownerIndex,
        KeyConditionExpression: '#ownerEmail = :ownerEmail',
        ExpressionAttributeNames: { '#ownerEmail': 'ownerEmail' },
        ExpressionAttributeValues: { ':ownerEmail': ownerEmail },
      }))
    }

    return scanAll(() => ({
      TableName: registrationsTable,
      ConsistentRead: true,
    }))
  }

  async function countRegistrations(eventId) {
    const rows = await listRegistrations(eventId ? { eventId } : {})
    return rows.length
  }

  async function findRegistration(eventId, email) {
    const ownerEmail = normalizeEmail(email)
    if (!eventId || !ownerEmail) return null

    const result = await ddb.send(
      new GetCommand({
        TableName: registrationsTable,
        Key: { eventId, email: ownerEmail },
        ConsistentRead: true,
      }),
    )
    return result.Item || null
  }

  async function classifyEventFailure(eventId) {
    const event = await getEvent(eventId)
    if (!event) throw new StoreError(CODES.EVENT_NOT_FOUND)

    const capacity = event.capacity
    if (capacity !== undefined && capacity !== null) {
      const counterReady = event[COUNTER_READY] === true
      const hasCount = Number.isInteger(event[REGISTERED_COUNT])
      if (!counterReady || !hasCount) throw new StoreError(CODES.EVENT_NOT_READY)
      if (event[REGISTERED_COUNT] >= Number(capacity)) throw new StoreError(CODES.EVENT_FULL)
    }

    // The transaction reported a conditional failure that the current event
    // state does not explain. Do not guess; fail conservatively.
    throw new StoreError(CODES.REGISTRATION_CONFLICT)
  }

  async function createRegistration({ eventId, name, email, userId = null }) {
    const ownerEmail = normalizeEmail(email)
    const registration = {
      registrationId: makeId('reg'),
      eventId,
      name,
      email: ownerEmail,
      ownerEmail,
      userId: userId === undefined ? null : userId,
      createdAt: new Date().toISOString(),
      status: 'Confirmed',
    }

    const transaction = {
      TransactItems: [
        {
          Update: {
            TableName: eventsTable,
            Key: { eventId },
            UpdateExpression:
              'SET #count = if_not_exists(#count, :zero) + :one, #ready = :true',
            ConditionExpression:
              'attribute_exists(#eventId) AND (attribute_not_exists(#capacity) OR (#ready = :true AND attribute_exists(#count) AND #count < #capacity))',
            ExpressionAttributeNames: {
              '#eventId': 'eventId',
              '#capacity': 'capacity',
              '#count': REGISTERED_COUNT,
              '#ready': COUNTER_READY,
            },
            ExpressionAttributeValues: {
              ':zero': 0,
              ':one': 1,
              ':true': true,
            },
          },
        },
        {
          Put: {
            TableName: registrationsTable,
            Item: registration,
            ConditionExpression:
              'attribute_not_exists(#eventId) AND attribute_not_exists(#email)',
            ExpressionAttributeNames: {
              '#eventId': 'eventId',
              '#email': 'email',
            },
          },
        },
      ],
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await ddb.send(new TransactWriteCommand(transaction))
        return { ...registration }
      } catch (err) {
        if (err && err.name === 'TransactionCanceledException') {
          const reasons = err.CancellationReasons || []
          const registrationCode = cancellationCode(reasons, 1)
          const eventCode = cancellationCode(reasons, 0)

          // Duplicate wins when both the registration and event conditions
          // failed, matching the order of the Phase 3 checks.
          if (registrationCode === 'ConditionalCheckFailed') {
            throw new StoreError(CODES.DUPLICATE_REGISTRATION)
          }

          if (eventCode === 'ConditionalCheckFailed') {
            await classifyEventFailure(eventId)
          }

          const retryable =
            isRetryableCode(registrationCode) ||
            isRetryableCode(eventCode) ||
            (Array.isArray(reasons) && reasons.some((reason) => isRetryableCode(reason && reason.Code)))

          if (retryable && attempt < maxAttempts) {
            await sleep(retryDelay(attempt, retryBaseDelayMs))
            continue
          }

          throw new StoreError(CODES.REGISTRATION_CONFLICT)
        }

        if (err && isRetryableCode(err.name)) {
          if (attempt < maxAttempts) {
            await sleep(retryDelay(attempt, retryBaseDelayMs))
            continue
          }
          throw new StoreError(CODES.REGISTRATION_CONFLICT)
        }

        throw err
      }
    }

    throw new StoreError(CODES.REGISTRATION_CONFLICT)
  }

  function reset() {
    throw new Error('DynamoDB storage cannot be reset in place; recreate tables or reseed explicitly.')
  }

  return {
    listEvents,
    getEvent,
    createEvent,
    listRegistrations,
    countRegistrations,
    findRegistration,
    createRegistration,
    reset,
  }
}

module.exports = {
  createDynamoStore,
  COUNTER_READY,
  REGISTERED_COUNT,
}
