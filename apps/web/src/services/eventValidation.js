const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DEFAULT_CAPACITY = 100
const MAX_CAPACITY = 5000

function isValidDate(value) {
  if (!DATE_PATTERN.test(value || '')) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isValidTime(value) {
  return TIME_PATTERN.test(value || '')
}

export function cleanEventInput(input) {
  return {
    title: (input?.title || '').trim(),
    date: (input?.date || '').trim(),
    venue: (input?.venue || '').trim(),
    description: (input?.description || '').trim(),
    capacity: input?.capacity === undefined || input?.capacity === null || input?.capacity === ''
      ? DEFAULT_CAPACITY
      : Number(input.capacity),
    category: (input?.category || '').trim(),
    organizer: (input?.organizer || '').trim(),
    startTime: (input?.startTime || '').trim(),
    endTime: (input?.endTime || '').trim(),
    regDeadline: (input?.regDeadline || '').trim(),
  }
}

export function validateEventInput(input) {
  const values = cleanEventInput(input)
  const errors = {}

  if (!values.title) errors.title = 'Title is required.'
  else if (values.title.length < 3) errors.title = 'Title must be at least 3 characters.'
  else if (values.title.length > 120) errors.title = 'Title must be at most 120 characters.'

  if (!values.date) errors.date = 'Date is required.'
  else if (!isValidDate(values.date)) errors.date = 'Date must be a valid YYYY-MM-DD date.'

  if (!values.venue) errors.venue = 'Venue is required.'
  else if (values.venue.length < 2) errors.venue = 'Venue must be at least 2 characters.'
  else if (values.venue.length > 120) errors.venue = 'Venue must be at most 120 characters.'

  if (values.description.length > 2000) errors.description = 'Description must be at most 2000 characters.'
  if (values.category.length > 40) errors.category = 'Category must be at most 40 characters.'
  if (values.organizer.length > 120) errors.organizer = 'Organizer must be at most 120 characters.'
  if (values.startTime && !isValidTime(values.startTime)) errors.startTime = 'Start time must be HH:MM (24-hour).'
  if (values.endTime && !isValidTime(values.endTime)) errors.endTime = 'End time must be HH:MM (24-hour).'
  if (values.startTime && values.endTime && values.endTime <= values.startTime) {
    errors.endTime = 'End time must be after the start time.'
  }
  if (values.regDeadline && !isValidDate(values.regDeadline)) {
    errors.regDeadline = 'Registration deadline must be a valid YYYY-MM-DD date.'
  } else if (values.regDeadline && isValidDate(values.date) && values.regDeadline > values.date) {
    errors.regDeadline = 'Registration deadline cannot be after the event date.'
  }
  if (!Number.isInteger(values.capacity) || values.capacity < 1 || values.capacity > MAX_CAPACITY) {
    errors.capacity = `Capacity must be a whole number between 1 and ${MAX_CAPACITY}.`
  }

  return errors
}
