// Data seam for the UI. Every page/component imports from here — never
// from mockEvents.js directly (except this file).
//
// Phase 2: mock implementation backed by mockEvents.js + localStorage.
// Phase 6: replace the internals with fetch() against VITE_API_URL.
// The exported function names, arguments, and return shapes stay the same,
// so no page or component needs rewriting.
//
// Event shape (see docs/api.md):
//   { eventId, title, date, venue, description, capacity }
// Registration shape:
//   { registrationId, eventId, name, email, createdAt, status }
// `status` is a mock-only display field for the Phase 2 dashboard
// (always 'Confirmed'); the real API design in docs/api.md is unchanged.

import { mockEvents } from './mockEvents.js'

const LATENCY_MS = 250
const STORAGE_KEY = 'univent.registrations.v1'

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const delay = (ms = LATENCY_MS) => new Promise((res) => setTimeout(res, ms))

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStored(regs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(regs))
  } catch {
    // storage full / private mode — mock still works in memory for this load
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
  ]
}

function loadRegistrations() {
  const stored = readStored()
  const list = stored || seedRegistrations()
  // Normalize older mock entries that predate the `status` field.
  const normalized = list.map((r) => ({ status: 'Confirmed', ...r }))
  if (!stored) writeStored(normalized)
  return normalized
}

function makeRegistrationId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 6; i += 1) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `REG-${suffix}`
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
  return [...mockEvents]
}

export async function getEvent(eventId) {
  await delay()
  const event = mockEvents.find((e) => e.eventId === eventId)
  if (!event) throw new ApiError('Event not found.', 404)
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
  const event = mockEvents.find((e) => e.eventId === clean.eventId)
  if (!event) throw new ApiError('Event not found.', 404)

  const regs = loadRegistrations()
  const duplicate = regs.some(
    (r) => r.eventId === clean.eventId && r.email.toLowerCase() === clean.email,
  )
  if (duplicate) throw new ApiError('This email is already registered for the event.', 409)

  const registration = {
    registrationId: makeRegistrationId(),
    ...clean,
    createdAt: new Date().toISOString(),
    status: 'Confirmed',
  }
  writeStored([...regs, registration])
  return registration
}

export async function listRegistrations(eventId) {
  await delay()
  const regs = loadRegistrations()
  if (eventId) return regs.filter((r) => r.eventId === eventId)
  return [...regs]
}

export async function getRegistration(registrationId) {
  await delay()
  const regs = loadRegistrations()
  const reg = regs.find((r) => r.registrationId === registrationId)
  if (!reg) throw new ApiError('Registration not found.', 404)
  return { ...reg }
}

// Mock-only: cancel a registration (removes it from browser-local storage).
export async function cancelRegistration(registrationId) {
  await delay()
  const regs = loadRegistrations()
  const exists = regs.some((r) => r.registrationId === registrationId)
  if (!exists) throw new ApiError('Registration not found.', 404)
  writeStored(regs.filter((r) => r.registrationId !== registrationId))
  return { registrationId }
}
