// GET /registrations - list registrations (signed-in user only).
//
// Admins see every registration; any other signed-in user sees only their own
// rows. An optional ?eventId= query parameter filters the list, and an
// unknown event id is a 404.
const { json, error, requestMethod, queryParams } = require('./lib/http')
const { resolvePrincipal, isAdmin } = require('./lib/principal')
const { getStore } = require('./lib/store')
const { publicRegistration } = require('./lib/serializers')

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (method !== 'GET') {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use GET.`, { Allow: 'GET' })
  }

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to view registrations.')

  const rawEventId = queryParams(event).eventId
  let eventId = null
  if (rawEventId !== undefined && rawEventId !== null) {
    eventId = String(rawEventId).trim()
    if (!eventId) return error(400, 'The eventId query parameter must not be empty.')
  }

  try {
    const store = getStore()
    if (eventId && !(await store.getEvent(eventId))) return error(404, 'Event not found.')

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
