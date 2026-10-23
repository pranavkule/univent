// Input validation rules. Kept out of the handlers so request validation is
// independent of the selected storage implementation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const DEFAULT_CAPACITY = 100
const MAX_CAPACITY = 5000
const MAX_TITLE = 120
const MAX_VENUE = 120
const MAX_DESCRIPTION = 2000
const MAX_CATEGORY = 40
const MAX_NAME = 100
const MAX_EMAIL = 254

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === value
}

function isValidTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// Event rules. `title`, `date` and `venue` are required (Phase 3 spec).
// The remaining fields are optional and exist because the existing frontend
// renders them: category, organizer, startTime, endTime, regDeadline.
function validateEventInput(body) {
  const source = body || {}
  const errors = {}

  const title = trimmed(source.title)
  const date = trimmed(source.date)
  const venue = trimmed(source.venue)
  const description = trimmed(source.description)
  const category = trimmed(source.category)
  const organizer = trimmed(source.organizer)
  const startTime = trimmed(source.startTime)
  const endTime = trimmed(source.endTime)
  const regDeadline = trimmed(source.regDeadline)

  if (!title) errors.title = 'Title is required.'
  else if (title.length < 3) errors.title = 'Title must be at least 3 characters.'
  else if (title.length > MAX_TITLE) errors.title = `Title must be at most ${MAX_TITLE} characters.`

  if (!date) errors.date = 'Date is required.'
  else if (!isValidDate(date)) errors.date = 'Date must be a valid YYYY-MM-DD date.'

  if (!venue) errors.venue = 'Venue is required.'
  else if (venue.length < 2) errors.venue = 'Venue must be at least 2 characters.'
  else if (venue.length > MAX_VENUE) errors.venue = `Venue must be at most ${MAX_VENUE} characters.`

  if (description.length > MAX_DESCRIPTION) {
    errors.description = `Description must be at most ${MAX_DESCRIPTION} characters.`
  }
  if (category.length > MAX_CATEGORY) {
    errors.category = `Category must be at most ${MAX_CATEGORY} characters.`
  }
  if (organizer.length > MAX_VENUE) {
    errors.organizer = `Organizer must be at most ${MAX_VENUE} characters.`
  }
  if (startTime && !isValidTime(startTime)) errors.startTime = 'Start time must be HH:MM (24-hour).'
  if (endTime && !isValidTime(endTime)) errors.endTime = 'End time must be HH:MM (24-hour).'
  if (startTime && endTime && endTime <= startTime) {
    errors.endTime = 'End time must be after the start time.'
  }
  if (regDeadline && !isValidDate(regDeadline)) {
    errors.regDeadline = 'Registration deadline must be a valid YYYY-MM-DD date.'
  } else if (regDeadline && date && isValidDate(date) && regDeadline > date) {
    errors.regDeadline = 'Registration deadline cannot be after the event date.'
  }

  let capacity = DEFAULT_CAPACITY
  if (!isBlank(source.capacity)) {
    const numeric = Number(source.capacity)
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > MAX_CAPACITY) {
      errors.capacity = `Capacity must be a whole number between 1 and ${MAX_CAPACITY}.`
    } else {
      capacity = numeric
    }
  }

  const values = { title, date, venue, description, capacity }
  if (category) values.category = category
  if (organizer) values.organizer = organizer
  if (startTime) values.startTime = startTime
  if (endTime) values.endTime = endTime
  if (regDeadline) values.regDeadline = regDeadline

  return { values, errors }
}

// Registration rules. `eventId`, `name` and `email` are required.
function validateRegistrationInput(body) {
  const source = body || {}
  const errors = {}

  const eventId = trimmed(source.eventId)
  const name = trimmed(source.name)
  const email = trimmed(source.email).toLowerCase()

  if (!eventId) errors.eventId = 'Event id is required.'
  else if (eventId.length > 120) errors.eventId = 'Event id is too long.'

  if (!name) errors.name = 'Name is required.'
  else if (name.length < 2) errors.name = 'Name must be at least 2 characters.'
  else if (name.length > MAX_NAME) errors.name = `Name must be at most ${MAX_NAME} characters.`

  if (!email) errors.email = 'Email is required.'
  else if (email.length > MAX_EMAIL) errors.email = `Email must be at most ${MAX_EMAIL} characters.`
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Email must be a valid email address.'

  return { values: { eventId, name, email }, errors }
}

function firstError(errors) {
  const keys = Object.keys(errors || {})
  return keys.length > 0 ? errors[keys[0]] : 'Invalid request.'
}

module.exports = {
  DEFAULT_CAPACITY,
  MAX_CAPACITY,
  isValidDate,
  isValidTime,
  validateEventInput,
  validateRegistrationInput,
  firstError,
}
