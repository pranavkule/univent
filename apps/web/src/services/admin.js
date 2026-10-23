// MOCK ADMIN SERVICE — Phase 2 prototype only (same limits as services/api.js).
// ---------------------------------------------------------------------------
// Read/compose layer for the Admin workspace. All data is browser-local mock
// data; nothing is persisted to AWS and nothing here is production
// authorization. Summaries are computed from available mock records only —
// no invented statistics.
//
// - Users: safe fields (name, email, role) via auth.js. Passwords/tokens are
//   never exposed. The mock backend has no account-status field, so user
//   suspend/reactivate is NOT offered (needs Cognito/backend).
// - Organizations: via organizations.js (approve/reject/suspend/reactivate).
// - Events: public mock events (read-only system rows) + all org-store
//   events (moderated via orgEvents.js).
//
// Seam: pages import only the functions below. Phase 6 can replace the
// internals with fetch() against API Gateway/Lambda/DynamoDB without
// rewriting the UI.

import { API_MODE, listEvents, listRegistrations } from './api.js'
import { listMockUsers } from './auth.js'
import { listAllOrgEvents } from './orgEvents.js'
import { listOrganizations } from './organizations.js'

function mockOrgEvents() {
  return API_MODE === 'mock' ? listAllOrgEvents() : Promise.resolve([])
}

export async function getPlatformSummary() {
  const [users, orgs, orgEvents, regs, pubEvents] = await Promise.all([
    Promise.resolve(listMockUsers()),
    listOrganizations(),
    mockOrgEvents(),
    listRegistrations(),
    listEvents(),
  ])
  return {
    totalUsers: users.length,
    totalOrganizations: orgs.length,
    pendingOrgApprovals: orgs.filter((o) => o.approvalStatus === 'pending').length,
    pendingEventApprovals: orgEvents.filter((e) => e.status === 'pending').length,
    totalEvents: pubEvents.length + orgEvents.length,
    totalRegistrations: regs.length,
  }
}

// Every event on the platform: public mock events (published system rows,
// read-only) plus all organization-store events with their workflow status.
export async function listPlatformEvents() {
  const [pubEvents, orgEvents] = await Promise.all([listEvents(), mockOrgEvents()])
  const system = pubEvents.map((e) => ({
    ...e,
    source: 'system',
    status: 'published',
    organizer: e.organizer || 'UniVent',
    orgEmail: '',
  }))
  const org = orgEvents.map((e) => ({ ...e, source: 'organization' }))
  return [...system, ...org].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

export async function listAdminUsers() {
  return listMockUsers()
}

// Registrations joined with event titles, newest first.
export async function getRegistrationsByEvent() {
  const [regs, events] = await Promise.all([listRegistrations(), listPlatformEvents()])
  const titles = {}
  for (const e of events) titles[e.eventId] = e.title
  const byEvent = {}
  for (const r of regs) {
    if (!byEvent[r.eventId]) {
      byEvent[r.eventId] = { eventId: r.eventId, title: titles[r.eventId] || r.eventId, count: 0 }
    }
    byEvent[r.eventId].count += 1
  }
  return Object.values(byEvent).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
}

export async function getEventStatusDistribution() {
  const events = await listPlatformEvents()
  const dist = {}
  for (const e of events) dist[e.status] = (dist[e.status] || 0) + 1
  return Object.entries(dist)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

// Recent platform activity, derived from available mock records only
// (latest registrations + latest org event updates). There is no audit-log
// API in the mock backend, so admin actions themselves are not logged.
export async function listRecentActivity(limit = 8) {
  const [regs, orgEvents, events] = await Promise.all([
    listRegistrations(),
    mockOrgEvents(),
    listEvents(),
  ])
  const titles = {}
  for (const e of [...events, ...orgEvents]) titles[e.eventId] = e.title
  const items = [
    ...regs.map((r) => ({
      kind: 'registration',
      text: `${r.name} registered for ${titles[r.eventId] || r.eventId}`,
      at: r.createdAt,
    })),
    ...orgEvents.map((e) => ({
      kind: 'event',
      text: `${e.orgName || e.orgEmail} event "${e.title}" is ${e.status}`,
      at: e.updatedAt || e.createdAt,
    })),
  ]
  return items
    .filter((i) => i.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit)
}
