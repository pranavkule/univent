import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ApiError } from './apiError.js'
import { createLiveApi } from './liveApi.js'

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (payload === undefined ? '' : JSON.stringify(payload)),
  }
}

function recorder(status, payload) {
  const calls = []
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return jsonResponse(status, payload)
    },
  }
}

const cognitoHeaders = async () => ({ Authorization: 'Bearer id-token' })
const devHeaders = async () => ({
  'X-Univent-Role': 'student',
  'X-Univent-Email': 'asha@ves.ac.in',
})

describe('live API transport', () => {
  it('loads public events without requesting auth headers', async () => {
    const { calls, fetchImpl } = recorder(200, { events: [{ eventId: 'e1' }] })
    let authCalls = 0
    const api = createLiveApi({
      baseUrl: 'https://api.example.test/',
      getAuthHeaders: async () => {
        authCalls += 1
        return cognitoHeaders()
      },
      fetchImpl,
    })

    const events = await api.listEvents()

    assert.deepEqual(events, [{ eventId: 'e1' }])
    assert.equal(authCalls, 0)
    assert.equal(calls[0].url, 'https://api.example.test/events')
    assert.equal(calls[0].init.headers.Authorization, undefined)
  })

  it('accepts valid empty list envelopes but rejects malformed event and registration envelopes', async () => {
    const emptyEvents = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl: recorder(200, { events: [] }).fetchImpl,
    })
    assert.deepEqual(await emptyEvents.listEvents(), [])

    const malformedEvents = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl: recorder(200, {}).fetchImpl,
    })
    await assert.rejects(
      () => malformedEvents.listEvents(),
      (err) => err instanceof ApiError && err.status === 502 && /invalid events response/i.test(err.message),
    )

    const emptyRegistrations = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl: recorder(200, { registrations: [] }).fetchImpl,
    })
    assert.deepEqual(await emptyRegistrations.listRegistrations(), [])

    const malformedRegistrations = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl: recorder(200, {}).fetchImpl,
    })
    await assert.rejects(
      () => malformedRegistrations.listRegistrations(),
      (err) => err instanceof ApiError && err.status === 502 && /invalid registrations response/i.test(err.message),
    )
  })

  it('sends a Cognito ID token on registration and maps 201', async () => {
    const created = {
      registrationId: 'reg-1',
      eventId: 'e1',
      name: 'Asha Sharma',
      email: 'asha@ves.ac.in',
      status: 'Confirmed',
    }
    const { calls, fetchImpl } = recorder(201, created)
    const api = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl,
    })

    const result = await api.createRegistration({
      eventId: ' e1 ',
      name: ' Asha Sharma ',
      email: ' ASHA@VES.AC.IN ',
    })

    assert.deepEqual(result, created)
    assert.equal(calls[0].url, 'https://api.example.test/register')
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.headers.Authorization, 'Bearer id-token')
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      eventId: 'e1',
      name: 'Asha Sharma',
      email: 'asha@ves.ac.in',
    })
  })

  it('supports dev identity headers and encodes the registration filter', async () => {
    const { calls, fetchImpl } = recorder(200, { registrations: [{ registrationId: 'reg-1' }] })
    const api = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: devHeaders,
      fetchImpl,
    })

    const rows = await api.listRegistrations('event 1')

    assert.equal(rows.length, 1)
    assert.equal(calls[0].url, 'https://api.example.test/registrations?eventId=event%201')
    assert.equal(calls[0].init.headers['X-Univent-Role'], 'student')
  })

  it('creates events through the admin route', async () => {
    const { calls, fetchImpl } = recorder(201, { eventId: 'evt-1', title: 'Cloud Day' })
    const api = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl,
    })

    const result = await api.createEvent({ title: 'Cloud Day', date: '2026-12-01', venue: 'Lab 1' })

    assert.equal(result.eventId, 'evt-1')
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].url, 'https://api.example.test/events')
    assert.equal(calls[0].init.headers.Authorization, 'Bearer id-token')
  })

  it('surfaces backend messages and status codes', async () => {
    const api = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl: recorder(409, { message: 'This event is full.' }).fetchImpl,
    })

    await assert.rejects(
      () => api.createRegistration({ eventId: 'e1', name: 'Asha', email: 'asha@ves.ac.in' }),
      (err) => err instanceof ApiError && err.status === 409 && err.message === 'This event is full.',
    )
  })

  it('uses a sign-in message for 401 and a connection message for network failures', async () => {
    const unauthorized = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl: recorder(401, {}).fetchImpl,
    })
    await assert.rejects(
      () => unauthorized.listRegistrations(),
      (err) => err.status === 401 && /sign in again/i.test(err.message),
    )

    const offline = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl: async () => {
        throw new Error('offline')
      },
    })
    await assert.rejects(
      () => offline.listEvents(),
      (err) => err.status === 0 && /reach the server/i.test(err.message),
    )
  })

  it('maps an expired local session to 401 without calling the network', async () => {
    let called = false
    const api = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: async () => {
        throw new Error('Your session has expired. Sign in again.')
      },
      fetchImpl: async () => {
        called = true
        return jsonResponse(200, {})
      },
    })

    await assert.rejects(
      () => api.listRegistrations(),
      (err) => err.status === 401 && /session has expired/i.test(err.message),
    )
    assert.equal(called, false)
  })

  it('finds a confirmation from the registration history and refuses cancellation', async () => {
    const api = createLiveApi({
      baseUrl: 'https://api.example.test',
      getAuthHeaders: cognitoHeaders,
      fetchImpl: recorder(200, {
        registrations: [
          { registrationId: 'reg-1', eventId: 'e1' },
          { registrationId: 'reg-2', eventId: 'e2' },
        ],
      }).fetchImpl,
    })

    assert.equal((await api.getRegistration('reg-2')).eventId, 'e2')
    await assert.rejects(
      () => api.cancelRegistration('reg-2'),
      (err) => err.status === 501 && /not available/i.test(err.message),
    )
  })
})
