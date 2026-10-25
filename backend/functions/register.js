// POST /register - register for an event (students only).
//
// Ownership: the signed-in account owns the registration. email and
// ownerEmail come from the authenticated principal, and userId comes from the
// principal's trusted subject. The body email is only checked for agreement;
// no ownership field is ever taken from the request body. The storage layer's
// transaction is the sole authority for duplicate and capacity checks.
const { json, error, requestMethod, parseBody } = require('./lib/http')
const { resolvePrincipal, isStudent } = require('./lib/principal')
const { validateRegistrationInput, firstError } = require('./lib/validation')
const { getStore } = require('./lib/store')
const { publicRegistration } = require('./lib/serializers')
const { registrationClosedReason } = require('./lib/eventTiming')
const { CODES, StoreError } = require('./lib/storeError')

function storeErrorResponse(err) {
  if (!(err instanceof StoreError)) return null
  if (err.code === CODES.EVENT_NOT_FOUND) return error(404, err.message)
  if (
    err.code === CODES.DUPLICATE_REGISTRATION ||
    err.code === CODES.EVENT_FULL ||
    err.code === CODES.EVENT_NOT_READY
  ) {
    return error(409, err.message)
  }
  return null
}

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (method !== 'POST') {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use POST.`, { Allow: 'POST' })
  }

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to register for an event.')
  if (!isStudent(principal)) return error(403, 'Only students can register for events.')

  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)

  const { values, errors } = validateRegistrationInput(parsed.value)
  if (Object.keys(errors).length > 0) return error(400, firstError(errors))

  const ownerEmail = String(principal.email || '').trim().toLowerCase()
  if (!ownerEmail) return error(403, 'Signed-in account has no email address.')

  if (values.email !== ownerEmail) {
    return error(403, 'Email must match the signed-in account.')
  }

  try {
    const store = getStore()

    const eventRecord = await store.getEvent(values.eventId)
    if (!eventRecord) return error(404, 'Event not found.')

    const closedReason = registrationClosedReason(eventRecord)
    if (closedReason) return error(409, closedReason)

    // Duplicate and capacity enforcement happens in the storage transaction,
    // which is authoritative under concurrency.
    const registration = await store.createRegistration({
      eventId: values.eventId,
      name: values.name,
      email: ownerEmail,
      userId: principal.sub || null,
    })
    return json(201, publicRegistration(registration))
  } catch (err) {
    const mapped = storeErrorResponse(err)
    if (mapped) return mapped

    console.error('register failed:', err && err.message)
    return error(500, 'Unable to complete the registration right now.')
  }
}
