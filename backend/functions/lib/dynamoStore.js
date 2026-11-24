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
const { randomUUID } = require('node:crypto')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb')
const { makeId } = require('./ids')
const { duplicateKeyForApplication } = require('./organizationApplicationIdentity')
const { CODES, StoreError } = require('./storeError')

const OWNER_INDEX_DEFAULT = 'OwnerEmailIndex'
const EVENT_OWNER_INDEX_DEFAULT = 'OrganizationOwnerIndex'
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
  const organizationApplicationsTable =
    options.organizationApplicationsTable ||
    process.env.ORGANIZATION_APPLICATIONS_TABLE ||
    'OrganizationApplications'
  const publicOrganizationApplicationsTable =
    options.publicOrganizationApplicationsTable ||
    process.env.PUBLIC_ORGANIZATION_APPLICATIONS_TABLE ||
    'OrganizationApplicationsPublic'
  const organizationApplicationLocksTable =
    options.organizationApplicationLocksTable ||
    process.env.ORGANIZATION_APPLICATION_LOCKS_TABLE ||
    'OrganizationApplicationLocks'
  const organizationApplicationsCognitoSubIndex =
    options.organizationApplicationsCognitoSubIndex ||
    process.env.ORGANIZATION_APPLICATIONS_COGNITO_SUB_INDEX ||
    'CognitoSubIndex'
  const ownerIndex = options.ownerIndex || process.env.REGISTRATIONS_OWNER_INDEX || OWNER_INDEX_DEFAULT
  const eventOwnerIndex =
    options.eventOwnerIndex || process.env.EVENTS_OWNER_INDEX || EVENT_OWNER_INDEX_DEFAULT
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

  async function createEvent(values, { ownerSub = null } = {}) {
    const event = {
      eventId: makeId('evt'),
      ...values,
      ...(ownerSub ? { ownerSub } : {}),
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

  async function listEventsByOwner(ownerSub) {
    if (!ownerSub) return []
    const items = await queryAll(() => ({
      TableName: eventsTable,
      IndexName: eventOwnerIndex,
      KeyConditionExpression: '#ownerSub = :ownerSub',
      ExpressionAttributeNames: { '#ownerSub': 'ownerSub' },
      ExpressionAttributeValues: { ':ownerSub': ownerSub },
    }))
    return items.sort((left, right) => {
      const byDate = String(left.date || '').localeCompare(String(right.date || ''))
      if (byDate !== 0) return byDate
      return String(left.eventId || '').localeCompare(String(right.eventId || ''))
    })
  }

  async function updateEvent(eventId, values, { ownerSub = null } = {}) {
    const current = await getEvent(eventId)
    if (!current) return null
    if (ownerSub && current.ownerSub !== ownerSub) return false
    if (
      Number.isInteger(current[REGISTERED_COUNT]) &&
      values.capacity < current[REGISTERED_COUNT]
    ) {
      throw new StoreError(CODES.CAPACITY_BELOW_REGISTRATIONS)
    }

    const names = { '#eventId': 'eventId', '#count': REGISTERED_COUNT }
    const attributeValues = { ':capacity': values.capacity }
    const setExpressions = []
    const removeExpressions = []
    let index = 0
    for (const [key, value] of Object.entries(values)) {
      const nameKey = `#field${index}`
      names[nameKey] = key
      if (value === null) {
        removeExpressions.push(nameKey)
      } else {
        const valueKey = `:value${index}`
        attributeValues[valueKey] = value
        setExpressions.push(`${nameKey} = ${valueKey}`)
      }
      index += 1
    }
    names['#updatedAt'] = 'updatedAt'
    attributeValues[':updatedAt'] = new Date().toISOString()
    setExpressions.push('#updatedAt = :updatedAt')

    const expressions = [`SET ${setExpressions.join(', ')}`]
    if (removeExpressions.length > 0) expressions.push(`REMOVE ${removeExpressions.join(', ')}`)
    const conditions = [
      'attribute_exists(#eventId)',
      '(attribute_not_exists(#count) OR #count <= :capacity)',
    ]
    if (ownerSub) {
      names['#ownerSub'] = 'ownerSub'
      attributeValues[':ownerSub'] = ownerSub
      conditions.push('#ownerSub = :ownerSub')
    }

    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: eventsTable,
          Key: { eventId },
          UpdateExpression: expressions.join(' '),
          ConditionExpression: conditions.join(' AND '),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: attributeValues,
          ReturnValues: 'ALL_NEW',
        }),
      )
      return result.Attributes || null
    } catch (err) {
      if (!err || err.name !== 'ConditionalCheckFailedException') throw err
      const latest = await getEvent(eventId)
      if (!latest) return null
      if (ownerSub && latest.ownerSub !== ownerSub) return false
      if (
        Number.isInteger(latest[REGISTERED_COUNT]) &&
        values.capacity < latest[REGISTERED_COUNT]
      ) {
        throw new StoreError(CODES.CAPACITY_BELOW_REGISTRATIONS)
      }
      throw err
    }
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

  async function getOrganizationApplication(userSub) {
    const result = await ddb.send(
      new GetCommand({
        TableName: organizationApplicationsTable,
        Key: { userSub },
        ConsistentRead: true,
      }),
    )
    if (result.Item) return { ...result.Item, isLegacy: true, applicationId: result.Item.userSub }
    const candidates = await listPublicOrganizationApplicationsByCognitoSub(userSub)
    const linked = (await Promise.all(
      candidates.map((item) => getPublicOrganizationApplication(item.applicationId)),
    )).filter((item) => item && item.cognitoSub === userSub)
    linked.sort((left, right) => {
      if (left.status === 'APPROVED' && right.status !== 'APPROVED') return -1
      if (right.status === 'APPROVED' && left.status !== 'APPROVED') return 1
      return String(right.appliedAt || '').localeCompare(String(left.appliedAt || ''))
    })
    return linked[0] || null
  }

  async function listOrganizationApplications() {
    const [legacyItems, publicItems] = await Promise.all([
      scanAll(() => ({
        TableName: organizationApplicationsTable,
        ConsistentRead: true,
      })),
      listPublicOrganizationApplications(),
    ])
    return [
      ...legacyItems.map((item) => ({
        ...item,
        isLegacy: true,
        applicationId: item.userSub,
        applicantEmail: item.officialEmail,
      })),
      ...publicItems,
    ].sort((left, right) =>
      String(left.appliedAt || '').localeCompare(String(right.appliedAt || '')),
    )
  }

  async function getPublicOrganizationApplication(applicationId) {
    const result = await ddb.send(
      new GetCommand({
        TableName: publicOrganizationApplicationsTable,
        Key: { applicationId },
        ConsistentRead: true,
      }),
    )
    return result.Item || null
  }

  async function listPublicOrganizationApplications() {
    return scanAll(() => ({
      TableName: publicOrganizationApplicationsTable,
      ConsistentRead: true,
    }))
  }

  async function listPublicOrganizationApplicationsByCognitoSub(cognitoSub) {
    if (!cognitoSub) return []
    return queryAll(() => ({
      TableName: publicOrganizationApplicationsTable,
      IndexName: organizationApplicationsCognitoSubIndex,
      KeyConditionExpression: '#cognitoSub = :cognitoSub',
      ExpressionAttributeNames: { '#cognitoSub': 'cognitoSub' },
      ExpressionAttributeValues: { ':cognitoSub': cognitoSub },
    }))
  }

  async function createPendingOrganizationApplication(values, { passwordExpiresAt } = {}) {
    const duplicateKey = duplicateKeyForApplication(values)
    const lockResult = await ddb.send(
      new GetCommand({
        TableName: organizationApplicationLocksTable,
        Key: { duplicateKey },
        ConsistentRead: true,
      }),
    )
    const previousLock = lockResult.Item || null
    if (previousLock && previousLock.status !== 'REJECTED') {
      throw new StoreError(CODES.ORGANIZATION_APPLICATION_EXISTS)
    }

    const now = new Date().toISOString()
    const application = {
      ...values,
      applicationId: randomUUID(),
      duplicateKey,
      status: 'PENDING_APPROVAL',
      passwordExpiresAt,
      appliedAt: now,
      updatedAt: now,
      auditLog: [{ action: 'SUBMITTED', at: now, actorSub: 'PUBLIC' }],
    }

    const putApplication = {
      TableName: publicOrganizationApplicationsTable,
      Item: application,
      ConditionExpression: 'attribute_not_exists(#applicationId)',
      ExpressionAttributeNames: { '#applicationId': 'applicationId' },
    }
    const lockWrite = previousLock
      ? {
          Update: {
            TableName: organizationApplicationLocksTable,
            Key: { duplicateKey },
            UpdateExpression:
              'SET #applicationId = :applicationId, #status = :status, #updatedAt = :updatedAt',
            ConditionExpression:
              '#applicationId = :previousApplicationId AND #status = :rejected',
            ExpressionAttributeNames: {
              '#applicationId': 'applicationId',
              '#status': 'status',
              '#updatedAt': 'updatedAt',
            },
            ExpressionAttributeValues: {
              ':applicationId': application.applicationId,
              ':status': application.status,
              ':updatedAt': now,
              ':previousApplicationId': previousLock.applicationId,
              ':rejected': 'REJECTED',
            },
          },
        }
      : {
          Put: {
            TableName: organizationApplicationLocksTable,
            Item: {
              duplicateKey,
              applicationId: application.applicationId,
              status: application.status,
              updatedAt: now,
            },
            ConditionExpression: 'attribute_not_exists(#duplicateKey)',
            ExpressionAttributeNames: { '#duplicateKey': 'duplicateKey' },
          },
        }

    try {
      await ddb.send(new TransactWriteCommand({
        TransactItems: [{ Put: putApplication }, lockWrite],
      }))
      return { ...application }
    } catch (err) {
      const currentLock = await ddb.send(
        new GetCommand({
          TableName: organizationApplicationLocksTable,
          Key: { duplicateKey },
          ConsistentRead: true,
        }),
      )
      if (currentLock.Item && currentLock.Item.status !== 'REJECTED') {
        throw new StoreError(CODES.ORGANIZATION_APPLICATION_EXISTS)
      }
      if (err && err.name === 'TransactionCanceledException') {
        throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
      }
      throw err
    }
  }

  async function deletePendingOrganizationApplication(applicationId) {
    const application = await getPublicOrganizationApplication(applicationId)
    if (
      !application
      || application.status !== 'PENDING_APPROVAL'
      || application.cognitoSub
    ) return false

    try {
      await ddb.send(new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: publicOrganizationApplicationsTable,
              Key: { applicationId },
              ConditionExpression:
                'attribute_exists(#applicationId) AND #status = :pending AND attribute_not_exists(#cognitoSub)',
              ExpressionAttributeNames: {
                '#applicationId': 'applicationId',
                '#status': 'status',
                '#cognitoSub': 'cognitoSub',
              },
              ExpressionAttributeValues: { ':pending': 'PENDING_APPROVAL' },
            },
          },
          {
            Delete: {
              TableName: organizationApplicationLocksTable,
              Key: { duplicateKey: application.duplicateKey },
              ConditionExpression:
                '#applicationId = :applicationId AND #status = :pending',
              ExpressionAttributeNames: {
                '#applicationId': 'applicationId',
                '#status': 'status',
              },
              ExpressionAttributeValues: {
                ':applicationId': applicationId,
                ':pending': 'PENDING_APPROVAL',
              },
            },
          },
        ],
      }))
      return true
    } catch (err) {
      if (err && err.name === 'TransactionCanceledException') return false
      throw err
    }
  }

  async function updatePublicOrganizationApplication(applicationId, updates, expectedStatuses) {
    const current = await getPublicOrganizationApplication(applicationId)
    if (!current) return null
    if (!expectedStatuses.includes(current.status)) {
      throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
    }

    const { auditEntry, ...fields } = updates
    const now = new Date().toISOString()
    const names = {
      '#applicationId': 'applicationId',
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#auditLog': 'auditLog',
    }
    const values = {
      ':status': fields.status,
      ':updatedAt': now,
      ':empty': [],
      ':auditEntry': [auditEntry],
    }
    const assignments = [
      '#status = :status',
      '#updatedAt = :updatedAt',
      '#auditLog = list_append(if_not_exists(#auditLog, :empty), :auditEntry)',
    ]
    for (const [field, value] of Object.entries(fields)) {
      if (field === 'status') continue
      const nameKey = `#field${Object.keys(names).length}`
      const valueKey = `:field${Object.keys(values).length}`
      names[nameKey] = field
      values[valueKey] = value
      assignments.push(`${nameKey} = ${valueKey}`)
    }
    const expectedKeys = expectedStatuses.map((status, index) => {
      const key = `:expected${index}`
      values[key] = status
      return key
    })
    try {
      await ddb.send(new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: publicOrganizationApplicationsTable,
              Key: { applicationId },
              UpdateExpression: `SET ${assignments.join(', ')}`,
              ConditionExpression:
                `attribute_exists(#applicationId) AND #status IN (${expectedKeys.join(', ')})`,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
            },
          },
          {
            Update: {
              TableName: organizationApplicationLocksTable,
              Key: { duplicateKey: current.duplicateKey },
              UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
              ConditionExpression:
                '#applicationId = :applicationId AND #status IN (' +
                expectedKeys.join(', ') +
                ')',
              ExpressionAttributeNames: {
                '#applicationId': 'applicationId',
                '#status': 'status',
                '#updatedAt': 'updatedAt',
              },
              ExpressionAttributeValues: {
                ':applicationId': applicationId,
                ':status': fields.status,
                ':updatedAt': now,
                ...Object.fromEntries(expectedKeys.map((key) => [key, values[key]])),
              },
            },
          },
        ],
      }))
      return getPublicOrganizationApplication(applicationId)
    } catch (err) {
      if (err && err.name === 'TransactionCanceledException') {
        const latest = await getPublicOrganizationApplication(applicationId)
        if (!latest) return null
        throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
      }
      throw err
    }
  }

  async function createOrganizationApplication(values) {
    const application = {
      ...values,
      status: 'PENDING',
      appliedAt: new Date().toISOString(),
    }
    try {
      await ddb.send(
        new PutCommand({
          TableName: organizationApplicationsTable,
          Item: application,
          ConditionExpression: 'attribute_not_exists(#userSub)',
          ExpressionAttributeNames: { '#userSub': 'userSub' },
        }),
      )
      return { ...application }
    } catch (err) {
      if (err && err.name === 'ConditionalCheckFailedException') {
        throw new StoreError(CODES.ORGANIZATION_APPLICATION_EXISTS)
      }
      throw err
    }
  }

  async function reapplyOrganizationApplication(userSub, values, rejectedApplication) {
    const now = new Date().toISOString()
    const previous = rejectedApplication || await getOrganizationApplication(userSub)
    if (!previous) return null
    if (previous.status !== 'REJECTED') {
      throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
    }
    const names = {
      '#userSub': 'userSub',
      '#organizationName': 'organizationName',
      '#officialEmail': 'officialEmail',
      '#representativeName': 'representativeName',
      '#representativeTitle': 'representativeTitle',
      '#representativePhone': 'representativePhone',
      '#status': 'status',
      '#appliedAt': 'appliedAt',
      '#decisionReason': 'decisionReason',
      '#decidedAt': 'decidedAt',
      '#decidedBy': 'decidedBy',
      '#previousDecisions': 'previousDecisions',
    }
    const valuesByName = {
      ':organizationName': values.organizationName,
      ':officialEmail': values.officialEmail,
      ':representativeName': values.representativeName,
      ':representativeTitle': values.representativeTitle,
      ':representativePhone': values.representativePhone,
      ':pending': 'PENDING',
      ':rejected': 'REJECTED',
      ':appliedAt': now,
      ':empty': [],
      ':previousDecision': [{
        status: previous.status,
        decisionReason: previous.decisionReason || '',
        decidedAt: previous.decidedAt || '',
        decidedBy: previous.decidedBy || '',
      }],
    }
    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: organizationApplicationsTable,
          Key: { userSub },
          UpdateExpression:
            'SET #organizationName = :organizationName, #officialEmail = :officialEmail, #representativeName = :representativeName, #representativeTitle = :representativeTitle, #representativePhone = :representativePhone, #status = :pending, #appliedAt = :appliedAt, #previousDecisions = list_append(if_not_exists(#previousDecisions, :empty), :previousDecision) REMOVE #decisionReason, #decidedAt, #decidedBy',
          ConditionExpression: 'attribute_exists(#userSub) AND #status = :rejected',
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: valuesByName,
          ReturnValues: 'ALL_NEW',
        }),
      )
      return result.Attributes || null
    } catch (err) {
      if (err && err.name === 'ConditionalCheckFailedException') {
        const current = await getOrganizationApplication(userSub)
        if (!current) return null
        throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
      }
      throw err
    }
  }

  async function updateOrganizationApplicationStatus(
    userSub,
    { status, decisionReason = '', decidedBy = '' },
    expectedStatuses,
  ) {
    const now = new Date().toISOString()
    const names = {
      '#userSub': 'userSub',
      '#status': 'status',
      '#decisionReason': 'decisionReason',
      '#decidedAt': 'decidedAt',
      '#decidedBy': 'decidedBy',
      '#updatedAt': 'updatedAt',
    }
    const values = {
      ':status': status,
      ':decisionReason': status === 'REJECTED' ? decisionReason : '',
      ':decidedAt': now,
      ':decidedBy': decidedBy,
      ':updatedAt': now,
    }
    const expected = expectedStatuses.map((expectedStatus, index) => {
      const key = `:expected${index}`
      values[key] = expectedStatus
      return key
    })
    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: organizationApplicationsTable,
          Key: { userSub },
          UpdateExpression:
            'SET #status = :status, #decisionReason = :decisionReason, #decidedAt = :decidedAt, #decidedBy = :decidedBy, #updatedAt = :updatedAt',
          ConditionExpression:
            `attribute_exists(#userSub) AND #status IN (${expected.join(', ')})`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: 'ALL_NEW',
        }),
      )
      return result.Attributes || null
    } catch (err) {
      if (err && err.name === 'ConditionalCheckFailedException') {
        const current = await getOrganizationApplication(userSub)
        if (!current) return null
        throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
      }
      throw err
    }
  }

  function reset() {
    throw new Error('DynamoDB storage cannot be reset in place; recreate tables or reseed explicitly.')
  }

  return {
    listEvents,
    getEvent,
    createEvent,
    listEventsByOwner,
    updateEvent,
    listRegistrations,
    countRegistrations,
    findRegistration,
    createRegistration,
    getOrganizationApplication,
    listOrganizationApplications,
    createOrganizationApplication,
    reapplyOrganizationApplication,
    updateOrganizationApplicationStatus,
    createPendingOrganizationApplication,
    deletePendingOrganizationApplication,
    getPublicOrganizationApplication,
    listPublicOrganizationApplicationsByCognitoSub,
    updatePublicOrganizationApplication,
    reset,
  }
}

module.exports = {
  createDynamoStore,
  COUNTER_READY,
  REGISTERED_COUNT,
}
