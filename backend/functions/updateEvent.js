// PUT /events/{eventId} - update an event (admin or its owning organization).
const { json, error, requestMethod, parseBody } = require('./lib/http')
const {
  resolvePrincipal,
  isAdmin,
  isOrganization,
} = require('./lib/principal')
const { validateEventInput, firstError } = require('./lib/validation')
const { getStore } = require('./lib/store')
const { publicEvent } = require('./lib/serializers')
const { CODES, StoreError } = require('./lib/storeError')
const { isApprovedOrganization } = require('./lib/organizationAccess')

const CLEARABLE_FIELDS = [
  'description',
  'category',
  'organizer',
  'startTime',
  'endTime',
  'regDeadline',
]

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (method !== 'PUT') {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use PUT.`, { Allow: 'PUT' })
  }

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to update an event.')
  const isOrg = isOrganization(principal)
  const admin = isAdmin(principal)
  if (!admin && !isOrg) return error(403, 'Only administrators and organization accounts can update events.')
  const eventId = String(event.pathParameters?.eventId || '').trim()
  if (!eventId) return error(400, 'Event id is required.')

  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)

  const { values, errors } = validateEventInput(parsed.value)
  if (Object.keys(errors).length > 0) return error(400, firstError(errors))

  for (const field of CLEARABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(parsed.value, field) && !String(parsed.value[field] || '').trim()) {
      values[field] = null
    }
  }
  if (isOrg) values.organizer = principal.name || 'Organization'

  try {
    const store = getStore()
    if (isOrg && !(await isApprovedOrganization(principal, store))) {
      return error(403, 'An approved organization application is required to update events.')
    }
    const updated = await store.updateEvent(eventId, values, {
      ownerSub: isOrg ? principal.sub : null,
    })
    if (updated === null) return error(404, 'Event not found.')
    if (updated === false) return error(403, 'You can only update events owned by your organization.')
    return json(200, publicEvent(updated))
  } catch (err) {
    if (err instanceof StoreError && err.code === CODES.CAPACITY_BELOW_REGISTRATIONS) {
      return error(409, err.message)
    }
    console.error('updateEvent failed:', err && err.message)
    return error(500, 'Unable to update the event right now.')
  }
}
