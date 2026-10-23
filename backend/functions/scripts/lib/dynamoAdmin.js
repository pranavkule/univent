// Shared DynamoDB administrative helpers for manual seed/reconcile scripts.
// These scripts never run from Lambda handlers.
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb')
const { seedEvents } = require('../../lib/seedEvents')

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const [rawKey, inlineValue] = token.slice(2).split('=', 2)
    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      args[rawKey] = argv[index + 1]
      index += 1
    } else {
      args[rawKey] = true
    }
  }
  return args
}

function flag(value) {
  return value === true || value === 'true'
}

function configFromArgs(argv) {
  const args = parseArgs(argv)
  const config = {
    eventsTable: args['events-table'] || process.env.EVENTS_TABLE,
    registrationsTable: args['registrations-table'] || process.env.REGISTRATIONS_TABLE,
    endpoint: args.endpoint || process.env.DYNAMODB_ENDPOINT,
    region: args.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
    force: flag(args.force),
    dryRun: flag(args['dry-run']),
  }

  if (!config.eventsTable || !config.registrationsTable) {
    throw new Error('Set --events-table and --registrations-table or EVENTS_TABLE and REGISTRATIONS_TABLE.')
  }

  return config
}

function createClient(config) {
  const clientConfig = {}
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint
    clientConfig.credentials = { accessKeyId: 'local', secretAccessKey: 'local' }
  }
  if (config.region) clientConfig.region = config.region
  const baseClient = new DynamoDBClient(clientConfig)
  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: { removeUndefinedValues: true },
  })
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

async function scanAll(client, table, inputFactory = () => ({})) {
  const items = []
  let ExclusiveStartKey
  do {
    const input = { TableName: table, ConsistentRead: true, ...inputFactory() }
    if (ExclusiveStartKey) input.ExclusiveStartKey = ExclusiveStartKey
    const result = await client.send(new ScanCommand(input))
    items.push(...(result.Items || []))
    ExclusiveStartKey = result.LastEvaluatedKey
  } while (ExclusiveStartKey)
  return items
}

async function queryAll(client, inputFactory) {
  const items = []
  let ExclusiveStartKey
  do {
    const input = inputFactory()
    if (ExclusiveStartKey) input.ExclusiveStartKey = ExclusiveStartKey
    const result = await client.send(new QueryCommand(input))
    items.push(...(result.Items || []))
    ExclusiveStartKey = result.LastEvaluatedKey
  } while (ExclusiveStartKey)
  return items
}

async function getEvent(client, eventsTable, eventId) {
  const result = await client.send(
    new GetCommand({
      TableName: eventsTable,
      Key: { eventId },
      ConsistentRead: true,
    }),
  )
  return result.Item || null
}

async function countConfirmedRegistrations(client, registrationsTable, eventId) {
  const rows = await queryAll(client, () => ({
    TableName: registrationsTable,
    KeyConditionExpression: '#eventId = :eventId',
    ExpressionAttributeNames: { '#eventId': 'eventId' },
    ExpressionAttributeValues: { ':eventId': eventId },
    ConsistentRead: true,
  }))
  return rows.filter((row) => row.status === 'Confirmed').length
}

async function seedSampleEvents(config) {
  const client = createClient(config)
  const summary = { inserted: 0, skipped: 0, failed: 0 }

  for (const event of seedEvents) {
    const existing = await getEvent(client, config.eventsTable, event.eventId)
    if (existing) {
      summary.skipped += 1
      console.log(`skip ${event.eventId}: already exists`)
      continue
    }

    const registeredCount = await countConfirmedRegistrations(
      client,
      config.registrationsTable,
      event.eventId,
    )

    try {
      await client.send(
        new PutCommand({
          TableName: config.eventsTable,
          Item: {
            ...event,
            registeredCount,
            registrationCounterReady: true,
          },
          ConditionExpression: 'attribute_not_exists(#eventId)',
          ExpressionAttributeNames: { '#eventId': 'eventId' },
        }),
      )
      summary.inserted += 1
      console.log(`insert ${event.eventId}: registeredCount=${registeredCount}`)
    } catch (err) {
      if (err && err.name === 'ConditionalCheckFailedException') {
        summary.skipped += 1
        console.log(`skip ${event.eventId}: created concurrently`)
      } else {
        summary.failed += 1
        console.error(`fail ${event.eventId}: ${err && err.message}`)
      }
    }
  }

  return summary
}

function isReady(event) {
  return event.registrationCounterReady === true && Number.isInteger(event.registeredCount)
}

async function reconcileCounts(config) {
  const client = createClient(config)
  const events = await scanAll(client, config.eventsTable)
  const summary = {
    checked: events.length,
    initialized: 0,
    repaired: 0,
    drift: 0,
    failed: 0,
    dryRun: config.dryRun,
  }
  const remainingProblems = []

  for (const event of events) {
    const registeredCount = await countConfirmedRegistrations(
      client,
      config.registrationsTable,
      event.eventId,
    )

    if (!isReady(event)) {
      if (config.dryRun) {
        console.log(`would initialize ${event.eventId}: registeredCount=${registeredCount}`)
        summary.initialized += 1
        continue
      }

      try {
        await client.send(
          new UpdateCommand({
            TableName: config.eventsTable,
            Key: { eventId: event.eventId },
            UpdateExpression: 'SET #count = :count, #ready = :true',
            ConditionExpression: 'attribute_not_exists(#ready) OR #ready = :false',
            ExpressionAttributeNames: { '#count': 'registeredCount', '#ready': 'registrationCounterReady' },
            ExpressionAttributeValues: { ':count': registeredCount, ':true': true, ':false': false },
          }),
        )
        summary.initialized += 1
        console.log(`initialize ${event.eventId}: registeredCount=${registeredCount}`)
      } catch (err) {
        summary.failed += 1
        remainingProblems.push(event.eventId)
        console.error(`fail initialize ${event.eventId}: ${err && err.message}`)
      }
      continue
    }

    if (event.registeredCount === registeredCount) continue

    summary.drift += 1
    console.warn(
      `drift ${event.eventId}: stored=${event.registeredCount} actual=${registeredCount}`,
    )

    if (!config.force) {
      remainingProblems.push(event.eventId)
      continue
    }

    if (config.dryRun) {
      console.log(`would repair ${event.eventId}: registeredCount=${registeredCount}`)
      continue
    }

    try {
      // Writes must be paused before a forced repair. The condition ensures the
      // stored counter and readiness did not change while the repair was built.
      await client.send(
        new UpdateCommand({
          TableName: config.eventsTable,
          Key: { eventId: event.eventId },
          UpdateExpression: 'SET #count = :count',
          ConditionExpression: '#count = :expected AND #ready = :true',
          ExpressionAttributeNames: { '#count': 'registeredCount', '#ready': 'registrationCounterReady' },
          ExpressionAttributeValues: {
            ':count': registeredCount,
            ':expected': event.registeredCount,
            ':true': true,
          },
        }),
      )
      summary.repaired += 1
      console.log(`repair ${event.eventId}: registeredCount=${registeredCount}`)
    } catch (err) {
      summary.failed += 1
      remainingProblems.push(event.eventId)
      console.error(`fail repair ${event.eventId}: ${err && err.message}`)
    }
  }

  const after = await scanAll(client, config.eventsTable)
  for (const event of after) {
    if (event.capacity !== undefined && event.capacity !== null && !isReady(event)) {
      if (!remainingProblems.includes(event.eventId)) remainingProblems.push(event.eventId)
    }
  }

  summary.remainingProblems = remainingProblems
  return summary
}

module.exports = {
  configFromArgs,
  createClient,
  scanAll,
  queryAll,
  getEvent,
  countConfirmedRegistrations,
  seedSampleEvents,
  reconcileCounts,
  normalizeEmail,
}
