// POST /register - register for an event (signed-in user only).
//
// Ownership: the signed-in account owns the registration. The body email must
// match the email of the authenticated principal, so a user cannot register
// somebody else's address. The stored owner is taken from the principal, not
// from the request body.
const { json, error, requestMethod, parseBody } = require('./lib/http')
const { resolvePrincipal } = require('./lib/principal')
const { validateRegistrationInput, firstError } = require('./lib/validation')
const { getStore } = require('./lib/store')
const { publicRegistration } = require('./lib/serializers')

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (method !== 'POST') {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use POST.`, { Allow: 'POST' })
  }

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to register for an event.')

  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)

  const { values, errors } = validateRegistrationInput(parsed.value)
  if (Object.keys(errors).length > 0) return error(400, firstError(errors))

  try {
    const store = getStore()
    const targetEvent = store.getEvent(values.eventId)
    if (!targetEvent) return error(404, 'Event not found.')

    if (principal.email && principal.email !== values.email) {
      return error(403, 'Email must match the signed-in account.')
    }
    const ownerEmail = principal.email || values.email

    if (store.findRegistration(values.eventId, ownerEmail)) {
      return error(409, 'This email is already registered for the event.')
    }
    if (targetEvent.capacity && store.countRegistrations(values.eventId) >= targetEvent.capacity) {
      return error(409, 'This event is full.')
    }

    const registration = store.createRegistration({
      eventId: values.eventId,
      name: values.name,
      email: ownerEmail,
      userId: principal.sub,
    })
    return json(201, publicRegistration(registration))
  } catch (err) {
    console.error('register failed:', err && err.message)
    return error(500, 'Unable to complete the registration right now.')
  }
}
