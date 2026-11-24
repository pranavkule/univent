// Read/compose layer for the Admin workspace. All rows come from the live
// AWS API; there is no browser-local fallback. The API has no user directory
// or event-moderation endpoints, so those screens state that rather than
// inventing data.
import { listEvents, listRegistrations } from './api.js'
import { listOrganizations } from './organizations.js'

export async function getPlatformSummary() {
  const [orgs, regs, events] = await Promise.all([
    listOrganizations(),
    listRegistrations(),
    listEvents(),
  ])
  return {
    totalOrganizations: orgs.length,
    pendingOrgApprovals: orgs.filter((o) =>
      ['pending', 'pending_verification', 'pending_approval'].includes(o.approvalStatus),
    ).length,
    approvedOrganizations: orgs.filter((o) => o.approvalStatus === 'approved').length,
    totalEvents: events.length,
    totalRegistrations: regs.length,
  }
}

export async function listPlatformEvents() {
  const events = await listEvents()
  return [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

// Registrations joined with event titles, newest first.
export async function getRegistrationsByEvent() {
  const [regs, events] = await Promise.all([listRegistrations(), listEvents()])
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

// Recent platform activity derived from live registrations and events. There is
// no audit-log API, so admin actions themselves are not recorded.
export async function listRecentActivity(limit = 8) {
  const [regs, events] = await Promise.all([listRegistrations(), listEvents()])
  const titles = {}
  for (const e of events) titles[e.eventId] = e.title
  const items = [
    ...regs.map((r) => ({
      kind: 'registration',
      text: `${r.name} registered for ${titles[r.eventId] || r.eventId}`,
      at: r.createdAt,
    })),
    ...events.map((e) => ({
      kind: 'event',
      text: `Event "${e.title}" was created`,
      at: e.createdAt,
    })),
  ]
  return items
    .filter((i) => i.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit)
}
