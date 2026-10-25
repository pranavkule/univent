// GET /registrations - list registrations by administrator, student, or event owner.
//
// Admins see every registration; students see only their own rows;
// organizations see registrations for their own events. An optional
// ?eventId= query parameter filters the list.
const { json, error, requestMethod, queryParams } = require('./lib/http')
const {
  ROLES,
  resolvePrincipal,
  hasRole,
  isAdmin,
  isOrganization,
} = require('./lib/principal')
const { getStore } = require('./lib/store')
const { publicRegistration } = require('./lib/serializers')
const {
  hasOrganizationApplication,
  isApprovedOrganization,
} = require('./lib/organizationAccess')

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (method !== 'GET') {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use GET.`, { Allow: 'GET' })
  }

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to view registrations.')
  if (!hasRole(principal, ROLES.ADMIN, ROLES.STUDENT, ROLES.ORGANIZATION)) {
    return error(403, 'This account cannot view registrations.')
  }
  const rawEventId = queryParams(event).eventId
  let eventId = null
  if (rawEventId !== undefined && rawEventId !== null) {
    eventId = String(rawEventId).trim()
    if (!eventId) return error(400, 'The eventId query parameter must not be empty.')
  }

  try {
    const store = getStore()
    if (
      isOrganization(principal) &&
      !(await isApprovedOrganization(principal, store))
    ) {
      return error(403, 'An approved organization application is required to view event registrations.')
    }
    if (
      hasRole(principal, ROLES.STUDENT) &&
      (await hasOrganizationApplication(principal, store))
    ) {
      return error(403, 'Organization applicants cannot view student registrations using this account.')
    }
    if (eventId) {
      const eventRecord = await store.getEvent(eventId)
      if (!eventRecord) return error(404, 'Event not found.')
      if (isOrganization(principal) && eventRecord.ownerSub !== principal.sub) {
        return error(403, 'You can only view registrations for your organization events.')
      }
    }

    if (isOrganization(principal)) {
      const ownedEvents = eventId
        ? [{ eventId }]
        : await store.listEventsByOwner(principal.sub)
      const registrations = (await Promise.all(
        ownedEvents.map((ownedEvent) => store.listRegistrations({ eventId: ownedEvent.eventId })),
      )).flat()
      return json(200, { registrations: registrations.map(publicRegistration) })
    }

    const ownerEmail = isAdmin(principal) ? null : principal.email
    if (!isAdmin(principal) && !ownerEmail) {
      return json(200, { registrations: [] })
    }

    const filter = {}
    if (eventId) filter.eventId = eventId
    if (ownerEmail) filter.ownerEmail = ownerEmail

    const registrations = await store.listRegistrations(filter)
    return json(200, { registrations: registrations.map(publicRegistration) })
  } catch (err) {
    console.error('getRegistrations failed:', err && err.message)
    return error(500, 'Unable to list registrations right now.')
  }
}
