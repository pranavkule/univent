// Organization event service. Ownership and persistence are handled by the
// authenticated AWS API; there is no browser-local fallback.
import {
  ApiError,
  createEvent,
  listOrganizationEvents,
  listRegistrations,
  updateEvent,
} from './api.js'
import { eventCategories } from './eventCategories.js'

export function validateOrgEventInput(input) {
  const errors = {}
  if (!input.title || input.title.trim().length < 3) errors.title = 'Enter an event title (min 3 characters).'
  if (!input.description || input.description.trim().length < 10) {
    errors.description = 'Enter a description (min 10 characters).'
  }
  if (!input.category || !eventCategories.includes(input.category)) errors.category = 'Choose a category.'
  if (!isValidDate(input.date)) errors.date = 'Choose a valid event date.'
  if (input.startTime && !isValidTime(input.startTime)) errors.startTime = 'Start time must be HH:MM (24h).'
  if (input.endTime && !isValidTime(input.endTime)) errors.endTime = 'End time must be HH:MM (24h).'
  if (input.startTime && input.endTime && input.endTime <= input.startTime) {
    errors.endTime = 'End time must be after the start time.'
  }
  if (!input.venue || input.venue.trim().length < 2) errors.venue = 'Enter a venue (min 2 characters).'
  if (input.regDeadline) {
    if (!isValidDate(input.regDeadline)) {
      errors.regDeadline = 'Registration deadline must be a valid date.'
    } else if (isValidDate(input.date) && input.regDeadline > input.date) {
      errors.regDeadline = 'Registration deadline cannot be after the event date.'
    }
  }
  const capacity = Number(input.capacity)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) {
    errors.capacity = 'Capacity must be a whole number between 1 and 5000.'
  }
  if (input.bannerUrl && input.bannerUrl.trim() !== '' && !/^https?:\/\/.+/i.test(input.bannerUrl.trim())) {
    errors.bannerUrl = 'Banner URL must start with http:// or https://.'
  }
  return errors
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
}

function cleanInput(input) {
  return {
    title: (input.title || '').trim(),
    description: (input.description || '').trim(),
    category: (input.category || '').trim(),
    bannerUrl: (input.bannerUrl || '').trim(),
    date: (input.date || '').trim(),
    startTime: (input.startTime || '').trim(),
    endTime: (input.endTime || '').trim(),
    venue: (input.venue || '').trim(),
    regDeadline: (input.regDeadline || '').trim(),
    capacity: Number(input.capacity),
  }
}

function validateOrThrow(input) {
  const clean = cleanInput(input)
  const errors = validateOrgEventInput(clean)
  if (Object.keys(errors).length > 0) {
    const err = new ApiError(Object.values(errors)[0], 400)
    err.fields = errors
    throw err
  }
  return clean
}

function asPublished(event) {
  return { ...event, status: 'published' }
}

// Only events owned by this organization. The API scopes the response to the
// authenticated caller.
export async function listOrgEvents() {
  const events = await listOrganizationEvents()
  return events.map(asPublished)
}

export async function getOrgEvent(orgEmail, eventId) {
  const events = await listOrganizationEvents()
  const event = events.find((row) => row.eventId === eventId)
  if (!event) throw new ApiError('Event not found.', 404)
  return asPublished(event)
}

export async function createOrgEvent(orgEmail, orgName, input) {
  const clean = validateOrThrow(input)
  const created = await createEvent(clean)
  return asPublished(created)
}

export function isEditableStatus() {
  return true
}

export async function updateOrgEvent(orgEmail, eventId, input) {
  const clean = validateOrThrow(input)
  const updated = await updateEvent(eventId, clean)
  return asPublished(updated)
}

// Registrations are scoped to the authenticated organization by the API.
export async function listOrgRegistrations() {
  return listRegistrations()
}

// Admin workspace: the API returns all events for administrator callers.
export async function listAllOrgEvents() {
  const events = await listOrganizationEvents()
  return events.map(asPublished)
}

export function countRegistrationsByEvent(registrations) {
  const map = {}
  for (const r of registrations || []) map[r.eventId] = (map[r.eventId] || 0) + 1
  return map
}
