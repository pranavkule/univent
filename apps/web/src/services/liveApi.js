import { ApiError } from './apiError.js'

function statusMessage(status) {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.'
  if (status === 401) return 'Sign in again to continue.'
  if (status === 403) return 'This account cannot do that.'
  if (status === 404) return 'The requested item was not found.'
  if (status === 409) return 'The request could not be completed.'
  if (status === 500) return 'The server could not complete the request.'
  return 'The request failed. Try again.'
}

async function readPayload(response) {
  if (!response || typeof response.text !== 'function') return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function createLiveApi({ baseUrl, getAuthHeaders, fetchImpl = globalThis.fetch }) {
  const root = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!root) throw new Error('An API base URL is required.')
  if (typeof getAuthHeaders !== 'function') throw new Error('getAuthHeaders must be a function.')
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.')

  async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    if (auth) {
      let authHeaders
      try {
        authHeaders = await getAuthHeaders()
      } catch (err) {
        throw new ApiError(err?.message || 'Your session has expired. Sign in again.', 401)
      }
      Object.assign(headers, authHeaders || {})
    }

    let response
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch {
      throw new ApiError(statusMessage(0), 0)
    }

    const payload = await readPayload(response)
    if (!response.ok) {
      throw new ApiError(payload?.message || statusMessage(response.status), response.status)
    }
    return payload
  }

  async function listEvents() {
    const payload = await request('/events')
    if (!Array.isArray(payload?.events)) {
      throw new ApiError('The server returned an invalid events response.', 502)
    }
    return payload.events
  }

  async function getEvent(eventId) {
    const events = await listEvents()
    const event = events.find((row) => row.eventId === eventId)
    if (!event) throw new ApiError('Event not found.', 404)
    return { ...event }
  }

  async function createEvent(input) {
    return request('/events', { method: 'POST', body: input, auth: true })
  }

  async function listOrganizationEvents() {
    const payload = await request('/organization/events', { auth: true })
    if (!Array.isArray(payload?.events)) {
      throw new ApiError('The server returned an invalid organization events response.', 502)
    }
    return payload.events
  }

  async function updateEvent(eventId, input) {
    return request(`/events/${encodeURIComponent(eventId)}`, {
      method: 'PUT',
      body: input,
      auth: true,
    })
  }

  async function createRegistration({ eventId, name, email }) {
    return request('/register', {
      method: 'POST',
      auth: true,
      body: {
        eventId: (eventId || '').trim(),
        name: (name || '').trim(),
        email: (email || '').trim().toLowerCase(),
      },
    })
  }

  async function listRegistrations(eventId) {
    const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''
    const payload = await request(`/registrations${query}`, { auth: true })
    if (!Array.isArray(payload?.registrations)) {
      throw new ApiError('The server returned an invalid registrations response.', 502)
    }
    return payload.registrations
  }

  async function getRegistration(registrationId) {
    const registrations = await listRegistrations()
    const registration = registrations.find((row) => row.registrationId === registrationId)
    if (!registration) throw new ApiError('Registration not found.', 404)
    return { ...registration }
  }

  async function cancelRegistration() {
    throw new ApiError('Cancelling registrations is not available yet.', 501)
  }

  return {
    listEvents,
    getEvent,
    createEvent,
    listOrganizationEvents,
    updateEvent,
    createRegistration,
    listRegistrations,
    getRegistration,
    cancelRegistration,
  }
}
