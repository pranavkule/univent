const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  CLOSED_DEADLINE,
  CLOSED_PAST_EVENT,
  CLOSED_STARTED,
  CLOSED_ENDED,
  registrationClosedReason,
} = require('../functions/lib/eventTiming')

function at(iso) {
  return new Date(iso)
}

describe('registration window', () => {
  it('allows registration for a future event before its deadline', () => {
    const event = {
      date: '2026-12-10',
      startTime: '10:00',
      endTime: '12:00',
      regDeadline: '2026-12-09',
    }

    assert.equal(registrationClosedReason(event, at('2026-12-01T00:00:00.000Z')), null)
  })

  it('rejects an expired registration deadline', () => {
    const event = { date: '2026-12-10', regDeadline: '2026-12-01' }

    assert.equal(
      registrationClosedReason(event, at('2026-12-02T00:00:00.000Z')),
      CLOSED_DEADLINE,
    )
  })

  it('keeps the deadline open through the end of its UTC calendar day', () => {
    const event = { date: '2026-12-10', regDeadline: '2026-12-01' }

    assert.equal(registrationClosedReason(event, at('2026-12-01T23:59:59.999Z')), null)
    assert.equal(
      registrationClosedReason(event, at('2026-12-02T00:00:00.000Z')),
      CLOSED_DEADLINE,
    )
  })

  it('rejects a past event even when it has no deadline', () => {
    const event = { date: '2026-12-01', startTime: '10:00', endTime: '12:00' }

    assert.equal(
      registrationClosedReason(event, at('2026-12-02T00:00:00.000Z')),
      CLOSED_PAST_EVENT,
    )
  })

  it('treats a date-only event today as open for the whole UTC day', () => {
    const event = { date: '2026-12-01' }

    assert.equal(registrationClosedReason(event, at('2026-12-01T00:00:00.000Z')), null)
    assert.equal(registrationClosedReason(event, at('2026-12-01T23:59:59.999Z')), null)
  })

  it('rejects a timed event at its exact start time', () => {
    const event = { date: '2026-12-01', startTime: '10:00', endTime: '12:00' }

    assert.equal(registrationClosedReason(event, at('2026-12-01T09:59:59.999Z')), null)
    assert.equal(
      registrationClosedReason(event, at('2026-12-01T10:00:00.000Z')),
      CLOSED_STARTED,
    )
  })

  it('rejects an event that has already ended when no start time is stored', () => {
    const event = { date: '2026-12-01', endTime: '10:00' }

    assert.equal(registrationClosedReason(event, at('2026-12-01T09:59:59.999Z')), null)
    assert.equal(
      registrationClosedReason(event, at('2026-12-01T10:00:00.000Z')),
      CLOSED_ENDED,
    )
  })

  it('reports an ended timed event at its exact end time', () => {
    const event = { date: '2026-12-01', startTime: '10:00', endTime: '12:00' }

    assert.equal(
      registrationClosedReason(event, at('2026-12-01T11:59:59.999Z')),
      CLOSED_STARTED,
    )
    assert.equal(
      registrationClosedReason(event, at('2026-12-01T12:00:00.000Z')),
      CLOSED_ENDED,
    )
  })
})
