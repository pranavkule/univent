// Temporary in-memory storage (Phase 3).
//
// IMPORTANT: this is NOT persistent storage. The maps live in the Lambda
// process memory, so the data is lost when the container is recycled and it
// is NOT shared between concurrent Lambda instances. Duplicate and capacity
// checks are therefore reliable only inside a single warm container.
//
// Phase 4 replaces this file with a DynamoDB-backed store that implements the
// same interface (lib/store.js). The handlers do not change.
const { makeId } = require('./ids')
const { seedEvents } = require('./seedEvents')

const events = new Map()
const registrations = new Map()

function seed() {
  events.clear()
  registrations.clear()
  for (const event of seedEvents) {
    events.set(event.eventId, { ...event })
  }
}

function listEvents() {
  return Array.from(events.values()).map((event) => ({ ...event }))
}

function getEvent(eventId) {
  const event = events.get(eventId)
  return event ? { ...event } : null
}

function createEvent(values) {
  const event = {
    eventId: makeId('evt'),
    ...values,
    createdAt: new Date().toISOString(),
  }
  events.set(event.eventId, event)
  return { ...event }
}

function listRegistrations(filter = {}) {
  const all = Array.from(registrations.values())
  const filtered = filter.eventId ? all.filter((row) => row.eventId === filter.eventId) : all
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
  const target = String(email || '').toLowerCase()
  for (const row of registrations.values()) {
    if (row.eventId === eventId && row.ownerEmail === target) return { ...row }
  }
  return null
}

function createRegistration({ eventId, name, email, userId = null }) {
  const ownerEmail = String(email || '').toLowerCase()
  const registration = {
    registrationId: makeId('reg'),
    eventId,
    name,
    email: ownerEmail,
    ownerEmail,
    userId,
    createdAt: new Date().toISOString(),
    status: 'Confirmed',
  }
  registrations.set(registration.registrationId, registration)
  return { ...registration }
}

function createMemoryStore() {
  seed()
  return {
    listEvents,
    getEvent,
    createEvent,
    listRegistrations,
    countRegistrations,
    findRegistration,
    createRegistration,
    reset: seed,
  }
}

module.exports = { createMemoryStore }
