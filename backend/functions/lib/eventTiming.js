// Registration-window checks for stored events.
//
// Event dates and times are stored as timezone-less calendar values. The
// project already compares date-only values in UTC (validation and the
// frontend use ISO dates), so these checks use UTC as well. This avoids any
// dependency on the Lambda container's local timezone.
const { isValidDate, isValidTime } = require('./validation')

const CLOSED_DEADLINE = 'Registration for this event has closed.'
const CLOSED_PAST_EVENT = 'This event has already started or ended.'
const CLOSED_STARTED = 'This event has already started.'
const CLOSED_ENDED = 'This event has already ended.'

function eventMoment(date, time) {
  if (!isValidDate(date) || !isValidTime(time)) return null
  return Date.parse(`${date}T${time}:00.000Z`)
}

function registrationClosedReason(event, now = new Date()) {
  if (!event) return null

  const today = now.toISOString().slice(0, 10)
  const deadline = typeof event.regDeadline === 'string' ? event.regDeadline : ''
  if (deadline && isValidDate(deadline) && deadline < today) return CLOSED_DEADLINE

  const date = typeof event.date === 'string' ? event.date : ''
  if (date && isValidDate(date) && date < today) return CLOSED_PAST_EVENT

  const endAt = eventMoment(date, event.endTime)
  if (endAt !== null && now.getTime() >= endAt) return CLOSED_ENDED

  const startAt = eventMoment(date, event.startTime)
  if (startAt !== null && now.getTime() >= startAt) return CLOSED_STARTED

  return null
}

module.exports = {
  CLOSED_DEADLINE,
  CLOSED_PAST_EVENT,
  CLOSED_STARTED,
  CLOSED_ENDED,
  registrationClosedReason,
}
