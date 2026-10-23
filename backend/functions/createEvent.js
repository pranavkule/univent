// POST /events - create a new event (admin only).
const { json, error, requestMethod, parseBody } = require('./lib/http')
const { resolvePrincipal, isAdmin } = require('./lib/principal')
const { validateEventInput, firstError } = require('./lib/validation')
const { getStore } = require('./lib/store')
const { publicEvent } = require('./lib/serializers')

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (method !== 'POST') {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use POST.`, { Allow: 'POST' })
  }

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to create an event.')
  if (!isAdmin(principal)) return error(403, 'Only administrators can create events.')

  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)

  const { values, errors } = validateEventInput(parsed.value)
  if (Object.keys(errors).length > 0) return error(400, firstError(errors))

  try {
    const created = await getStore().createEvent(values)
    return json(201, publicEvent(created))
  } catch (err) {
    console.error('createEvent failed:', err && err.message)
    return error(500, 'Unable to create the event right now.')
  }
}
