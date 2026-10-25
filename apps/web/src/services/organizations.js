// MOCK ORGANIZATIONS — Phase 2 prototype only (same limits as services/auth.js).
// ---------------------------------------------------------------------------
// Frontend-only mock data for the Organization workspace. Nothing is sent to
// AWS; everything lives in this browser's localStorage and is lost when it
// is cleared. Approval of organizations is an Admin concern — this module
// never approves anything, it only reads the seeded approval status.
//
// Seam: pages import only the functions below. Phase 6 can replace the
// internals with fetch() against API Gateway/Lambda/DynamoDB without
// rewriting the UI.

import {
  API_MODE,
  decideOrganizationApplication,
  getOrganizationApplication,
  listOrganizationApplications,
  submitOrganizationApplication as submitApplicationApi,
} from './api.js'

const ORGS_KEY = 'univent.organizations.v1'

function readStored() {
  try {
    const raw = localStorage.getItem(ORGS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStored(orgs) {
  try {
    localStorage.setItem(ORGS_KEY, JSON.stringify(orgs))
  } catch {
    // private mode / quota — mock keeps working in memory for this load
  }
}

function seedOrganizations() {
  return [
    {
      id: 'org-codecell',
      name: 'CodeCell',
      description:
        'The coding club of the college. We run hackathons, hands-on workshops, and peer-led build nights for builders of all levels.',
      contactEmail: 'codecell@ves.ac.in',
      contactName: 'CodeCell Core Team',
      approvalStatus: 'approved',
      appliedAt: '2026-09-10T10:00:00.000Z',
      decisionReason: '',
    },
    {
      id: 'org-robotics',
      name: 'Robotics Club',
      description:
        'Student group for robotics enthusiasts. Applies to host Arduino workshops and inter-college bot competitions.',
      contactEmail: 'robotics@ves.ac.in',
      contactName: 'Aarav Mehta',
      approvalStatus: 'pending',
      appliedAt: '2026-10-11T09:30:00.000Z',
      decisionReason: '',
    },
    {
      id: 'org-music',
      name: 'Music Society',
      description:
        'Vocal and instrumental collective seeking approval to organize open-mic nights and the annual battle of bands.',
      contactEmail: 'music.society@ves.ac.in',
      contactName: 'Diya Nair',
      approvalStatus: 'pending',
      appliedAt: '2026-10-12T15:45:00.000Z',
      decisionReason: '',
    },
  ]
}

function normalizeOrg(o) {
  return {
    contactName: '',
    appliedAt: '',
    decisionReason: '',
    ...o,
  }
}

function loadOrganizations() {
  const stored = readStored()
  if (stored) {
    // Merge in any seeds missing from browsers stored before they existed
    // (e.g. pending applications added later). Never overwrites edits.
    const seeded = seedOrganizations()
    const ids = new Set(stored.map((o) => o.id))
    const missing = seeded.filter((o) => !ids.has(o.id))
    const merged = [...stored.map(normalizeOrg), ...missing]
    if (missing.length > 0) writeStored(merged)
    return merged
  }
  const seeded = seedOrganizations()
  writeStored(seeded)
  return seeded
}

export async function getOrganizationByEmail(email) {
  const clean = (email || '').trim().toLowerCase()
  if (API_MODE === 'live') {
    const application = await getOrganizationApplication()
    return application && application.officialEmail.toLowerCase() === clean
      ? normalizeLiveApplication(application)
      : null
  }
  const orgs = loadOrganizations()
  const org = orgs.find((o) => o.contactEmail.toLowerCase() === clean)
  return org ? { ...org } : null
}

// Admin workspace: list every organization application.
export async function listOrganizations() {
  if (API_MODE === 'live') {
    const applications = await listOrganizationApplications()
    return applications.map(normalizeLiveApplication)
  }
  return loadOrganizations().map((o) => ({ ...o }))
}

export const ORG_APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'suspended']

function normalizeLiveApplication(application) {
  return {
    id: application.userSub || application.officialEmail,
    userSub: application.userSub || '',
    name: application.organizationName,
    description: '',
    contactEmail: application.officialEmail,
    contactName: application.representativeName,
    representativeTitle: application.representativeTitle,
    representativePhone: application.representativePhone,
    approvalStatus: String(application.status || '').toLowerCase(),
    appliedAt: application.appliedAt || '',
    decisionReason: application.decisionReason || '',
  }
}

export async function getMyOrganizationApplication(email) {
  const clean = (email || '').trim().toLowerCase()
  if (API_MODE === 'live') {
    const application = await getOrganizationApplication()
    return application ? normalizeLiveApplication(application) : null
  }
  return getOrganizationByEmail(clean)
}

export async function submitOrganizationApplication(input) {
  if (API_MODE === 'live') {
    return normalizeLiveApplication(await submitApplicationApi(input))
  }
  const email = String(input.officialEmail || '').trim().toLowerCase()
  const orgs = loadOrganizations()
  if (orgs.some((org) => org.contactEmail.toLowerCase() === email)) {
    throw new Error('An organization application already exists for this account.')
  }
  const application = normalizeOrg({
    id: `mock-${email}`,
    name: input.organizationName,
    representativeTitle: input.representativeTitle,
    representativePhone: input.representativePhone,
    contactEmail: email,
    contactName: input.representativeName,
    approvalStatus: 'pending',
    appliedAt: new Date().toISOString(),
    decisionReason: '',
  })
  writeStored([...orgs, application])
  return { ...application }
}

// Admin-only status transition (mock). Approving/suspending/reactivating
// takes effect immediately in this browser; rejecting requires a reason so
// the organization knows what to fix. The real backend must enforce this.
export async function setOrganizationStatus(organization, status, reason = '') {
  if (API_MODE === 'live') {
    const userSub = typeof organization === 'string' ? organization : organization?.userSub
    if (!userSub) throw new Error('The application is missing its trusted user identifier.')
    return normalizeLiveApplication(
      await decideOrganizationApplication(userSub, status.toUpperCase(), reason),
    )
  }
  const cleanEmail = String(
    typeof organization === 'string' ? organization : organization?.contactEmail || '',
  ).trim().toLowerCase()
  const next = (status || '').trim().toLowerCase()
  if (!ORG_APPROVAL_STATUSES.includes(next)) {
    throw new Error('Unknown approval status.')
  }
  const cleanReason = (reason || '').trim()
  if ((next === 'rejected') && cleanReason.length < 3) {
    throw new Error('A reason is required when rejecting an application (min 3 characters).')
  }
  const orgs = loadOrganizations()
  const idx = orgs.findIndex((o) => o.contactEmail.toLowerCase() === cleanEmail)
  if (idx === -1) throw new Error('Organization not found.')
  orgs[idx] = { ...orgs[idx], approvalStatus: next, decisionReason: next === 'rejected' ? cleanReason : '' }
  writeStored(orgs)
  return { ...orgs[idx] }
}

// Only `name` and `description` are editable in the current application.
// `contactEmail` and `approvalStatus` are read-only here — approval is
// controlled by the Admin role (future backend).
export const ORG_EDITABLE_FIELDS = ['name', 'description']

export function validateOrganizationInput({ name, description }) {
  const errors = {}
  if (!name || name.trim().length < 2) errors.name = 'Enter the organization name (min 2 characters).'
  if (!description || description.trim().length < 10) {
    errors.description = 'Enter a short description (min 10 characters).'
  }
  return errors
}

export async function updateOrganization(email, patch) {
  if (API_MODE === 'live') {
    throw new Error('Organization profile edits are not supported by the live API.')
  }
  const cleanEmail = (email || '').trim().toLowerCase()
  const input = {
    name: (patch?.name || '').trim(),
    description: (patch?.description || '').trim(),
  }
  const errors = validateOrganizationInput(input)
  if (Object.keys(errors).length > 0) {
    const err = new Error(Object.values(errors)[0])
    err.fields = errors
    throw err
  }
  const orgs = loadOrganizations()
  const idx = orgs.findIndex((o) => o.contactEmail.toLowerCase() === cleanEmail)
  if (idx === -1) throw new Error('Organization profile not found.')
  // Explicitly ignore contactEmail / approvalStatus even if provided.
  orgs[idx] = { ...orgs[idx], name: input.name, description: input.description }
  writeStored(orgs)
  return { ...orgs[idx] }
}
