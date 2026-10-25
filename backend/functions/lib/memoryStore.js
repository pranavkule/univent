// In-memory storage used by unit tests and the quick local server.
//
// IMPORTANT: this is NOT persistent storage. The maps live in the process
// memory, so data is lost on restart and is not shared between instances.
// DynamoDB storage (lib/dynamoStore.js) is selected in the deployed template
// through UNIVENT_STORE=dynamodb and implements the same interface.
const { makeId } = require('./ids')
const { seedEvents } = require('./seedEvents')
const { CODES, StoreError } = require('./storeError')

const events = new Map()
const registrations = new Map()

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function seed() {
  events.clear()
  registrations.clear()
  for (const event of seedEvents) {
    events.set(event.eventId, {
      ...event,
      registeredCount: 0,
      registrationCounterReady: true,
    })
  }
}

function listEvents() {
  return Array.from(events.values()).map((event) => ({ ...event }))
}

function getEvent(eventId) {
  const event = events.get(eventId)
  return event ? { ...event } : null
}

function createEvent(values, { ownerSub = null } = {}) {
  const event = {
    eventId: makeId('evt'),
    ...values,
    ...(ownerSub ? { ownerSub } : {}),
    registeredCount: 0,
    registrationCounterReady: true,
    createdAt: new Date().toISOString(),
  }
  events.set(event.eventId, event)
  return { ...event }
}

function listEventsByOwner(ownerSub) {
  return Array.from(events.values())
    .filter((event) => event.ownerSub === ownerSub)
    .map((event) => ({ ...event }))
}

function updateEvent(eventId, values, { ownerSub = null } = {}) {
  const event = events.get(eventId)
  if (!event) return null
  if (ownerSub && event.ownerSub !== ownerSub) return false
  if (Number.isInteger(event.registeredCount) && values.capacity < event.registeredCount) {
    throw new StoreError(CODES.CAPACITY_BELOW_REGISTRATIONS)
  }

  const updated = { ...event, ...values, updatedAt: new Date().toISOString() }
  for (const [key, value] of Object.entries(values)) {
    if (value === null) delete updated[key]
  }
  events.set(eventId, updated)
  return { ...updated }
}

function listRegistrations(filter = {}) {
  const all = Array.from(registrations.values())
  const eventId = filter.eventId ? String(filter.eventId).trim() : ''
  const hasOwnerFilter = filter.ownerEmail !== undefined && filter.ownerEmail !== null
  const ownerEmail = hasOwnerFilter ? normalizeEmail(filter.ownerEmail) : ''

  if (hasOwnerFilter && !ownerEmail) return []

  let filtered = all
  if (eventId) filtered = filtered.filter((row) => row.eventId === eventId)
  if (ownerEmail) filtered = filtered.filter((row) => row.ownerEmail === ownerEmail)
  return filtered.map((row) => ({ ...row }))
}

function countRegistrations(eventId) {
  let total = 0
  for (const row of registrations.values()) {
    if (!eventId || row.eventId === eventId) total += 1
  }
  return total
}

function findRegistration(eventId, email) {
  const target = normalizeEmail(email)
  for (const row of registrations.values()) {
    if (row.eventId === eventId && row.ownerEmail === target) return { ...row }
  }
  return null
}

function createRegistration({ eventId, name, email, userId = null }) {
  const ownerEmail = normalizeEmail(email)
  const event = events.get(eventId)
  if (!event) throw new StoreError(CODES.EVENT_NOT_FOUND)

  if (findRegistration(eventId, ownerEmail)) {
    throw new StoreError(CODES.DUPLICATE_REGISTRATION)
  }

  if (event.capacity !== undefined && event.capacity !== null) {
    const counterReady = event.registrationCounterReady === true
    const hasCount = Number.isInteger(event.registeredCount)
    if (!counterReady || !hasCount) throw new StoreError(CODES.EVENT_NOT_READY)
    if (event.registeredCount >= Number(event.capacity)) {
      throw new StoreError(CODES.EVENT_FULL)
    }
  }

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
  registrations.set(registration.registrationId, registration)
  event.registeredCount = (Number.isInteger(event.registeredCount) ? event.registeredCount : 0) + 1
  event.registrationCounterReady = true
  return { ...registration }
}

function createMemoryStore() {
  seed()
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
    reset: seed,
  }
}

module.exports = { createMemoryStore }
