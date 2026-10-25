// GET /organization/events - list events owned by this organization.
const { json, error, requestMethod } = require('./lib/http')
const { resolvePrincipal, isAdmin, isOrganization } = require('./lib/principal')
const { getStore } = require('./lib/store')
const { publicEvent } = require('./lib/serializers')

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (method !== 'GET') {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use GET.`, { Allow: 'GET' })
  }

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to view organization events.')
  if (!isAdmin(principal) && !isOrganization(principal)) {
    return error(403, 'Only administrators and organization accounts can view organization events.')
  }
  if (isOrganization(principal) && !principal.sub) {
    return error(403, 'The organization account has no trusted user identifier.')
  }

  try {
    const store = getStore()
    const events = isAdmin(principal)
      ? await store.listEvents()
      : await store.listEventsByOwner(principal.sub)
    return json(200, { events: events.map(publicEvent) })
  } catch (err) {
    console.error('getOrganizationEvents failed:', err && err.message)
    return error(500, 'Unable to list organization events right now.')
  }
}
