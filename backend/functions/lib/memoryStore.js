// In-memory storage used by unit tests and the quick local server.
//
// IMPORTANT: this is NOT persistent storage. The maps live in the process
// memory, so data is lost on restart and is not shared between instances.
// DynamoDB storage (lib/dynamoStore.js) is selected in the deployed template
// through UNIVENT_STORE=dynamodb and implements the same interface.
const { randomUUID } = require('node:crypto')
const { makeId } = require('./ids')
const { duplicateKeyForApplication } = require('./organizationApplicationIdentity')
const { seedEvents } = require('./seedEvents')
const { CODES, StoreError } = require('./storeError')

const events = new Map()
const registrations = new Map()
const organizationApplications = new Map()
const publicOrganizationApplications = new Map()
const organizationApplicationLocks = new Map()

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function seed() {
  events.clear()
  registrations.clear()
  organizationApplications.clear()
  publicOrganizationApplications.clear()
  organizationApplicationLocks.clear()
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

function getOrganizationApplication(userSub) {
  const application = organizationApplications.get(userSub)
  if (application) return { ...application, isLegacy: true, applicationId: application.userSub }
  const linked = Array.from(publicOrganizationApplications.values())
    .filter((item) => item.cognitoSub === userSub)
    .sort((left, right) => {
      if (left.status === 'APPROVED' && right.status !== 'APPROVED') return -1
      if (right.status === 'APPROVED' && left.status !== 'APPROVED') return 1
      return String(right.appliedAt).localeCompare(String(left.appliedAt))
    })
  return linked.length ? { ...linked[0] } : null
}

function listOrganizationApplications() {
  const legacy = Array.from(organizationApplications.values())
    .map((application) => ({
      ...application,
      isLegacy: true,
      applicationId: application.userSub,
      applicantEmail: application.officialEmail,
    }))
  const current = Array.from(publicOrganizationApplications.values())
  return [...legacy, ...current]
    .sort((left, right) => String(left.appliedAt).localeCompare(String(right.appliedAt)))
    .map((application) => ({ ...application }))
}

function createOrganizationApplication(values) {
  if (organizationApplications.has(values.userSub)) {
    throw new StoreError(CODES.ORGANIZATION_APPLICATION_EXISTS)
  }
  const application = {
    ...values,
    status: 'PENDING',
    appliedAt: new Date().toISOString(),
  }
  organizationApplications.set(application.userSub, application)
  return { ...application }
}

function reapplyOrganizationApplication(userSub, values, rejectedApplication) {
  const application = organizationApplications.get(userSub) || rejectedApplication
  if (!application) return null
  if (application.status !== 'REJECTED') {
    throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
  }
  const updated = {
    ...application,
    ...values,
    status: 'PENDING',
    appliedAt: new Date().toISOString(),
    previousDecisions: [
      ...(application.previousDecisions || []),
      {
        status: application.status,
        decisionReason: application.decisionReason || '',
        decidedAt: application.decidedAt || '',
        decidedBy: application.decidedBy || '',
      },
    ],
    decisionReason: '',
    decidedAt: '',
    decidedBy: '',
  }
  organizationApplications.set(userSub, updated)
  return { ...updated }
}

function updateOrganizationApplicationStatus(
  userSub,
  { status, decisionReason = '', decidedBy = '' },
  expectedStatuses,
) {
  const application = organizationApplications.get(userSub)
  if (!application) return null
  if (!expectedStatuses.includes(application.status)) {
    throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
  }
  const updated = {
    ...application,
    status,
    decisionReason: status === 'REJECTED' ? decisionReason : '',
    decidedAt: new Date().toISOString(),
    decidedBy,
  }
  organizationApplications.set(userSub, updated)
  return { ...updated }
}

function createPendingOrganizationApplication(values, { passwordExpiresAt } = {}) {
  const duplicateKey = duplicateKeyForApplication(values)
  const lock = organizationApplicationLocks.get(duplicateKey)
  if (lock && lock.status !== 'REJECTED') {
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
  publicOrganizationApplications.set(application.applicationId, application)
  organizationApplicationLocks.set(duplicateKey, {
    applicationId: application.applicationId,
    status: application.status,
  })
  return { ...application }
}

function deletePendingOrganizationApplication(applicationId) {
  const application = publicOrganizationApplications.get(applicationId)
  if (!application || application.status !== 'PENDING_APPROVAL' || application.cognitoSub) {
    return false
  }
  const lock = organizationApplicationLocks.get(application.duplicateKey)
  if (lock?.applicationId !== applicationId || lock.status !== 'PENDING_APPROVAL') return false
  publicOrganizationApplications.delete(applicationId)
  organizationApplicationLocks.delete(application.duplicateKey)
  return true
}

function getPublicOrganizationApplication(applicationId) {
  const application = publicOrganizationApplications.get(applicationId)
  return application ? { ...application } : null
}

function updatePublicOrganizationApplication(applicationId, updates, expectedStatuses) {
  const application = publicOrganizationApplications.get(applicationId)
  if (!application) return null
  if (!expectedStatuses.includes(application.status)) {
    throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
  }

  const lock = organizationApplicationLocks.get(application.duplicateKey)
  if (
    !lock
    || lock.applicationId !== applicationId
    || !expectedStatuses.includes(lock.status)
  ) {
    throw new StoreError(CODES.ORGANIZATION_APPLICATION_CONFLICT)
  }

  const { auditEntry, ...fields } = updates
  const updated = {
    ...application,
    ...fields,
    updatedAt: new Date().toISOString(),
    auditLog: [...(application.auditLog || []), auditEntry],
  }
  publicOrganizationApplications.set(applicationId, updated)
  organizationApplicationLocks.set(application.duplicateKey, {
    applicationId,
    status: updated.status,
  })
  return { ...updated }
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
    getOrganizationApplication,
    listOrganizationApplications,
    createOrganizationApplication,
    reapplyOrganizationApplication,
    updateOrganizationApplicationStatus,
    createPendingOrganizationApplication,
    deletePendingOrganizationApplication,
    getPublicOrganizationApplication,
    updatePublicOrganizationApplication,
    reset: seed,
  }
}

module.exports = { createMemoryStore }
