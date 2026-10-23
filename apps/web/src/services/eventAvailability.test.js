import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { getRemainingSeats } from './eventAvailability.js'

describe('event availability', () => {
  it('calculates remaining seats from a valid registration counter', () => {
    assert.equal(getRemainingSeats({ capacity: 10, registeredCount: 4 }), 6)
    assert.equal(getRemainingSeats({ capacity: 10, registeredCount: 12 }), 0)
  })

  it('does not treat a missing or unavailable counter as zero registrations', () => {
    assert.equal(getRemainingSeats({ capacity: 10, registeredCount: null }), null)
    assert.equal(getRemainingSeats({ capacity: 10 }), null)
    assert.equal(getRemainingSeats({ capacity: 10, registeredCount: -1 }), null)
  })
})
