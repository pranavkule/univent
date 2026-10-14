// MOCK ORG EVENTS — Phase 2 prototype only (same limits as services/api.js).
// ---------------------------------------------------------------------------
// Frontend-only event management for approved organizations. Stored in this
// browser's localStorage; nothing is persisted to AWS. Statuses model the
// future approval flow: draft → pending → published, with rejected /
// cancelled as terminal states set by Admin action (simulated here) or by
// cancelling a live submission. Approval itself is an Admin concern.
//
// Event shape extends docs/api.md with mock-only management fields:
//   { eventId, title, date, venue, description, capacity, category,
//     orgEmail, orgName, status, startTime, endTime, regDeadline,
//     bannerUrl, createdAt, updatedAt }
//
// Seam: pages import only the functions below. Phase 6 can replace the
// internals with fetch() against API Gateway/Lambda/DynamoDB without
// rewriting the UI.

import { ApiError, listRegistrations } from './api.js'
import { mockCategories } from './mockEvents.js'

const ORG_EVENTS_KEY = 'univent.org-events.v1'
const LATENCY_MS = 250

export const ORG_STATUSES = ['draft', 'pending', 'published', 'rejected', 'cancelled']

const delay = (ms = LATENCY_MS) => new Promise((res) => setTimeout(res, ms))

function readStored() {
  try {
    const raw = localStorage.getItem(ORG_EVENTS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStored(events) {
  try {
    localStorage.setItem(ORG_EVENTS_KEY, JSON.stringify(events))
  } catch {
    // private mode / quota — mock keeps working in memory for this load
  }
}

function seedOrgEvents() {
  const now = '2026-10-14T10:00:00.000Z'
  return [
    {
      eventId: 'org-e1',
      title: 'CodeCell Hack Night',
      description: 'Overnight campus hackathon hosted by CodeCell. Form a team, build something, demo at dawn.',
      category: 'Technical',
      bannerUrl: '',
      date: '2026-11-02',
      startTime: '18:00',
      endTime: '23:59',
      venue: 'Seminar Hall A',
      regDeadline: '2026-11-01',
      capacity: 100,
      status: 'published',
      orgEmail: 'codecell@ves.ac.in',
      orgName: 'CodeCell',
      createdAt: now,
      updatedAt: now,
    },
    {
      eventId: 'org-e2',
      title: 'Intro to Git & GitHub',
      description: 'Hands-on workshop covering commits, branches, pull requests, and collaborative workflows.',
      category: 'Technical',
      bannerUrl: '',
      date: '2026-11-09',
      startTime: '10:00',
      endTime: '13:00',
      venue: 'CSE Lab 3',
      regDeadline: '2026-11-08',
      capacity: 60,
      status: 'pending',
      orgEmail: 'codecell@ves.ac.in',
      orgName: 'CodeCell',
      createdAt: now,
      updatedAt: now,
    },
    {
      eventId: 'org-e3',
      title: 'Design Systems 101',
      description: 'Draft workshop on tokens, components, and documentation for consistent UI.',
      category: 'Technical',
      bannerUrl: '',
      date: '2026-11-16',
      startTime: '11:00',
      endTime: '14:00',
      venue: 'Seminar Hall B',
      regDeadline: '2026-11-15',
      capacity: 50,
      status: 'draft',
      orgEmail: 'codecell@ves.ac.in',
      orgName: 'CodeCell',
      createdAt: now,
      updatedAt: now,
    },
    {
      eventId: 'org-e4',
      title: 'Late-Night LAN Party',
      description: 'Submitted without a venue booking — returned by the admin team.',
      category: 'Technical',
      bannerUrl: '',
      date: '2026-11-23',
      startTime: '20:00',
      endTime: '23:00',
      venue: 'Open Yard',
      regDeadline: '2026-11-22',
      capacity: 80,
      status: 'rejected',
      orgEmail: 'codecell@ves.ac.in',
      orgName: 'CodeCell',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function loadOrgEvents() {
  const stored = readStored()
  if (stored) return stored
  const seeded = seedOrgEvents()
  writeStored(seeded)
  return seeded
}

function makeEventId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i += 1) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `org-${suffix}`
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
}

export function validateOrgEventInput(input) {
  const errors = {}
  if (!input.title || input.title.trim().length < 3) errors.title = 'Enter an event title (min 3 characters).'
  if (!input.description || input.description.trim().length < 10) {
    errors.description = 'Enter a description (min 10 characters).'
  }
  if (!input.category || !mockCategories.includes(input.category)) errors.category = 'Choose a category.'
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

// Only events owned by this organization. Never returns other orgs' events.
export async function listOrgEvents(orgEmail) {
  await delay()
  const clean = (orgEmail || '').trim().toLowerCase()
  return loadOrgEvents().filter((e) => e.orgEmail.toLowerCase() === clean).map((e) => ({ ...e }))
}

export async function getOrgEvent(orgEmail, eventId) {
  await delay()
  const clean = (orgEmail || '').trim().toLowerCase()
  const event = loadOrgEvents().find((e) => e.eventId === eventId)
  if (!event) throw new ApiError('Event not found.', 404)
  if (event.orgEmail.toLowerCase() !== clean) throw new ApiError('Not allowed: this event belongs to another organization.', 403)
  return { ...event }
}

export async function createOrgEvent(orgEmail, orgName, input, { submit = false } = {}) {
  await delay()
  const clean = cleanInput(input)
  const errors = validateOrgEventInput(clean)
  if (Object.keys(errors).length > 0) {
    const err = new ApiError(Object.values(errors)[0], 400)
    err.fields = errors
    throw err
  }
  const now = new Date().toISOString()
  const event = {
    eventId: makeEventId(),
    ...clean,
    status: submit ? 'pending' : 'draft',
    orgEmail: (orgEmail || '').trim().toLowerCase(),
    orgName: orgName || '',
    createdAt: now,
    updatedAt: now,
  }
  const all = loadOrgEvents()
  writeStored([...all, event])
  return { ...event }
}

const EDITABLE_STATUSES = ['draft', 'rejected', 'pending']

export function isEditableStatus(status) {
  return EDITABLE_STATUSES.includes(status)
}

export async function updateOrgEvent(orgEmail, eventId, input, { submit = false } = {}) {
  await delay()
  const event = await getOrgEventNoDelay(orgEmail, eventId)
  if (!isEditableStatus(event.status)) {
    throw new ApiError('This event can no longer be edited (it is live or closed).', 403)
  }
  const clean = cleanInput(input)
  const errors = validateOrgEventInput(clean)
  if (Object.keys(errors).length > 0) {
    const err = new ApiError(Object.values(errors)[0], 400)
    err.fields = errors
    throw err
  }
  const all = loadOrgEvents()
  const idx = all.findIndex((e) => e.eventId === eventId)
  // Drafts (and rejected resubmits with submit=true) move to pending;
  // otherwise the current status is preserved.
  const nextStatus = submit ? 'pending' : all[idx].status
  all[idx] = { ...all[idx], ...clean, status: nextStatus, updatedAt: new Date().toISOString() }
  writeStored(all)
  return { ...all[idx] }
}

function getOrgEventNoDelay(orgEmail, eventId) {
  const clean = (orgEmail || '').trim().toLowerCase()
  const event = loadOrgEvents().find((e) => e.eventId === eventId)
  if (!event) throw new ApiError('Event not found.', 404)
  if (event.orgEmail.toLowerCase() !== clean) throw new ApiError('Not allowed: this event belongs to another organization.', 403)
  return event
}

export async function submitOrgEventForApproval(orgEmail, eventId) {
  await delay()
  const event = getOrgEventNoDelay(orgEmail, eventId)
  if (event.status !== 'draft' && event.status !== 'rejected') {
    throw new ApiError('Only drafts or rejected events can be submitted for approval.', 400)
  }
  const all = loadOrgEvents()
  const idx = all.findIndex((e) => e.eventId === eventId)
  all[idx] = { ...all[idx], status: 'pending', updatedAt: new Date().toISOString() }
  writeStored(all)
  return { ...all[idx] }
}

export async function cancelOrgEvent(orgEmail, eventId) {
  await delay()
  const event = getOrgEventNoDelay(orgEmail, eventId)
  if (event.status !== 'published' && event.status !== 'pending') {
    throw new ApiError('Only published or pending events can be cancelled.', 400)
  }
  const all = loadOrgEvents()
  const idx = all.findIndex((e) => e.eventId === eventId)
  all[idx] = { ...all[idx], status: 'cancelled', updatedAt: new Date().toISOString() }
  writeStored(all)
  return { ...all[idx] }
}

// Registrations scoped to this organization's events only. Participant rows
// for other organizations' events are never included.
export async function listOrgRegistrations(orgEmail) {
  const events = await listOrgEvents(orgEmail)
  const ids = new Set(events.map((e) => e.eventId))
  const regs = await listRegistrations()
  return regs.filter((r) => ids.has(r.eventId))
}

// --- Admin workspace (mock). These bypass the per-organization ownership
// check on purpose: admins moderate every organization's events. The real
// backend must enforce this server-side; the AdminRoute frontend gate alone
// is not authorization.
export async function listAllOrgEvents() {
  await delay()
  return loadOrgEvents().map((e) => ({ ...e }))
}

export const ADMIN_EVENT_ACTIONS = ['approve', 'reject', 'cancel']

// approve: pending → published. reject: pending → rejected (reason required).
// cancel: published/pending → cancelled (reason required). The reason is kept
// as `moderationNote` (mock-only field) so orgs can see why.
export async function moderateOrgEvent(eventId, action, reason = '') {
  await delay()
  const cleanAction = (action || '').trim().toLowerCase()
  if (!ADMIN_EVENT_ACTIONS.includes(cleanAction)) {
    throw new ApiError('Unknown moderation action.', 400)
  }
  const cleanReason = (reason || '').trim()
  if ((cleanAction === 'reject' || cleanAction === 'cancel') && cleanReason.length < 3) {
    throw new ApiError('A reason is required (min 3 characters).', 400)
  }
  const all = loadOrgEvents()
  const idx = all.findIndex((e) => e.eventId === eventId)
  if (idx === -1) throw new ApiError('Event not found.', 404)
  const current = all[idx].status
  if (cleanAction === 'approve' && current !== 'pending') {
    throw new ApiError('Only events pending approval can be approved.', 400)
  }
  if (cleanAction === 'reject' && current !== 'pending') {
    throw new ApiError('Only events pending approval can be rejected.', 400)
  }
  if (cleanAction === 'cancel' && current !== 'published' && current !== 'pending') {
    throw new ApiError('Only published or pending events can be cancelled.', 400)
  }
  const next = cleanAction === 'approve' ? 'published' : cleanAction === 'reject' ? 'rejected' : 'cancelled'
  all[idx] = {
    ...all[idx],
    status: next,
    moderationNote: cleanAction === 'approve' ? '' : cleanReason,
    updatedAt: new Date().toISOString(),
  }
  writeStored(all)
  return { ...all[idx] }
}

export function countRegistrationsByEvent(registrations) {
  const map = {}
  for (const r of registrations || []) map[r.eventId] = (map[r.eventId] || 0) + 1
  return map
}
