import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  loadStudentRegistrationStatus,
  registrationStatusView,
} from './registrationStatus.js'

describe('student registration status', () => {
  it('distinguishes a successfully loaded empty list from an unavailable status', async () => {
    const result = await loadStudentRegistrationStatus(async () => [], 'student@ves.ac.in')

    assert.equal(result.status, 'loaded')
    assert.deepEqual([...result.registeredEventIds], [])
    assert.equal(result.registration, null)
    assert.equal(result.message, '')
    assert.deepEqual(registrationStatusView(result.status, result.registration), {
      isChecking: false,
      isUnavailable: false,
      isKnown: true,
      isRegistered: false,
      canOfferRegistration: true,
    })
  })

  it('returns the matching student registration when status loads successfully', async () => {
    const ownRegistration = {
      eventId: 'e1',
      email: 'student@ves.ac.in',
      registrationId: 'reg-1',
    }
    const result = await loadStudentRegistrationStatus(
      async () => [
        { eventId: 'e2', email: 'other@ves.ac.in', registrationId: 'reg-2' },
        ownRegistration,
      ],
      'STUDENT@VES.AC.IN',
      'e1',
    )

    assert.equal(result.status, 'loaded')
    assert.deepEqual([...result.registeredEventIds], ['e1'])
    assert.equal(result.registration, ownRegistration)
    assert.deepEqual(registrationStatusView(result.status, result.registration), {
      isChecking: false,
      isUnavailable: false,
      isKnown: true,
      isRegistered: true,
      canOfferRegistration: false,
    })
  })

  it('preserves a failed registration request as unavailable, not empty', async () => {
    const result = await loadStudentRegistrationStatus(
      async () => { throw new Error('Sign in again to continue.') },
      'student@ves.ac.in',
    )

    assert.equal(result.status, 'unavailable')
    assert.deepEqual([...result.registeredEventIds], [])
    assert.equal(result.registration, null)
    assert.equal(result.message, 'Sign in again to continue.')
    assert.deepEqual(registrationStatusView(result.status, result.registration), {
      isChecking: false,
      isUnavailable: true,
      isKnown: false,
      isRegistered: false,
      canOfferRegistration: false,
    })
  })
})
