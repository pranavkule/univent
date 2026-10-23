import { ApiError } from './apiError.js'
import { cleanEventInput, validateEventInput } from './eventValidation.js'
import { mockEvents } from './mockEvents.js'

const LATENCY_MS = 250
const REGISTRATIONS_KEY = 'univent.registrations.v1'
const EVENTS_KEY = 'univent.created-events.v1'

const delay = (ms = LATENCY_MS) => new Promise((res) => setTimeout(res, ms))

function storage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function readStored(key) {
  try {
    const raw = storage()?.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStored(key, rows) {
  try {
    storage()?.setItem(key, JSON.stringify(rows))
  } catch {
  }
}

function seedRegistrations() {
  return [
    {
      registrationId: 'REG-A1B2C3',
      eventId: 'e1',
      name: 'Rohan Patil',
      email: 'rohan@college.edu',
      createdAt: '2026-10-01T10:00:00.000Z',
      status: 'Confirmed',
    },
    {
      registrationId: 'REG-D4E5F6',
      eventId: 'e4',
      name: 'Sneha Kulkarni',
      email: 'sneha@college.edu',
      createdAt: '2026-10-02T11:30:00.000Z',
      status: 'Confirmed',
    },
    {
      registrationId: 'REG-O1G2H3',
      eventId: 'org-e1',
      name: 'Aarav Mehta',
      email: 'aarav@college.edu',
      createdAt: '2026-10-20T09:15:00.000Z',
      status: 'Confirmed',
    },
    {
      registrationId: 'REG-O4J5K6',
      eventId: 'org-e1',
      name: 'Diya Nair',
      email: 'diya@college.edu',
      createdAt: '2026-10-21T14:40:00.000Z',
      status: 'Confirmed',
    },
    {
      registrationId: 'REG-O7L8M9',
      eventId: 'org-e2',
      name: 'Kabir Shah',
      email: 'kabir@college.edu',
      createdAt: '2026-10-22T11:05:00.000Z',
      status: 'Confirmed',
    },
  ]
}

function loadRegistrations() {
  const stored = readStored(REGISTRATIONS_KEY)
  const list = stored || seedRegistrations()
  const normalized = list.map((r) => ({ status: 'Confirmed', ...r }))
  if (!stored) writeStored(REGISTRATIONS_KEY, normalized)
  return normalized
}

function loadCreatedEvents() {
  return readStored(EVENTS_KEY) || []
}

function allEvents() {
  return [...mockEvents, ...loadCreatedEvents()]
}

function withCounts(events, registrations = loadRegistrations()) {
  const counts = {}
  for (const registration of registrations) {
    counts[registration.eventId] = (counts[registration.eventId] || 0) + 1
  }
  return events.map((event) => ({
    ...event,
    registeredCount: counts[event.eventId] || 0,
  }))
}

function makeId(prefix, length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < length; i += 1) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `${prefix}-${suffix}`
}

export function validateRegistrationInput({ eventId, name, email }) {
  const errors = {}
  if (!eventId) errors.eventId = 'Please choose an event.'
  if (!name || name.trim().length < 2) errors.name = 'Enter your full name (min 2 characters).'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  return errors
}

export async function listEvents() {
  await delay()
  return withCounts(allEvents())
}

export async function getEvent(eventId) {
  await delay()
  const event = withCounts(allEvents()).find((row) => row.eventId === eventId)
  if (!event) throw new ApiError('Event not found.', 404)
  return { ...event }
}

export async function createEvent(input) {
  await delay()
  const values = cleanEventInput(input)
  const errors = validateEventInput(values)
  if (Object.keys(errors).length > 0) {
    const err = new ApiError(Object.values(errors)[0], 400)
    err.fields = errors
    throw err
  }
  const event = {
    eventId: makeId('evt', 12).toLowerCase(),
    ...values,
    registeredCount: 0,
    createdAt: new Date().toISOString(),
  }
  writeStored(EVENTS_KEY, [...loadCreatedEvents(), event])
  return { ...event }
}

export async function createRegistration({ eventId, name, email }) {
  await delay()
  const clean = {
    eventId: (eventId || '').trim(),
    name: (name || '').trim(),
    email: (email || '').trim().toLowerCase(),
  }
  const errors = validateRegistrationInput(clean)
  if (Object.keys(errors).length > 0) {
    throw new ApiError(Object.values(errors)[0], 400)
  }

  const registrations = loadRegistrations()
  const event = withCounts(allEvents(), registrations).find((row) => row.eventId === clean.eventId)
  if (!event) throw new ApiError('Event not found.', 404)

  const duplicate = registrations.some(
    (r) => r.eventId === clean.eventId && r.email.toLowerCase() === clean.email,
  )
  if (duplicate) throw new ApiError('This email is already registered for the event.', 409)

  if (event.registeredCount >= event.capacity) {
    throw new ApiError('This event is full.', 409)
  }

  const registration = {
    registrationId: makeId('REG', 6),
    ...clean,
    createdAt: new Date().toISOString(),
    status: 'Confirmed',
  }
  writeStored(REGISTRATIONS_KEY, [...registrations, registration])
  return registration
}

export async function listRegistrations(eventId) {
  await delay()
  const registrations = loadRegistrations()
  if (eventId) return registrations.filter((r) => r.eventId === eventId)
  return [...registrations]
}

export async function listMockRegistrations() {
  return listRegistrations()
}

export async function getRegistration(registrationId) {
  await delay()
  const registration = loadRegistrations().find((r) => r.registrationId === registrationId)
  if (!registration) throw new ApiError('Registration not found.', 404)
  return { ...registration }
}

export async function cancelRegistration(registrationId) {
  await delay()
  const registrations = loadRegistrations()
  const exists = registrations.some((r) => r.registrationId === registrationId)
  if (!exists) throw new ApiError('Registration not found.', 404)
  writeStored(REGISTRATIONS_KEY, registrations.filter((r) => r.registrationId !== registrationId))
  return { registrationId }
}
