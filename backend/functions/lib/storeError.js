// Typed storage errors. Handlers map these to HTTP responses; the storage
// layer never constructs HTTP responses itself.
const CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EVENT_NOT_READY: 'EVENT_NOT_READY',
  EVENT_FULL: 'EVENT_FULL',
  DUPLICATE_REGISTRATION: 'DUPLICATE_REGISTRATION',
  REGISTRATION_CONFLICT: 'REGISTRATION_CONFLICT',
  CAPACITY_BELOW_REGISTRATIONS: 'CAPACITY_BELOW_REGISTRATIONS',
  ORGANIZATION_APPLICATION_EXISTS: 'ORGANIZATION_APPLICATION_EXISTS',
  ORGANIZATION_APPLICATION_CONFLICT: 'ORGANIZATION_APPLICATION_CONFLICT',
}

const MESSAGES = {
  [CODES.EVENT_NOT_FOUND]: 'Event not found.',
  [CODES.EVENT_NOT_READY]: 'This event is not ready for registration.',
  [CODES.EVENT_FULL]: 'This event is full.',
  [CODES.DUPLICATE_REGISTRATION]: 'This email is already registered for the event.',
  [CODES.REGISTRATION_CONFLICT]: 'Unable to complete the registration right now.',
  [CODES.CAPACITY_BELOW_REGISTRATIONS]:
    'Capacity cannot be lower than the number of confirmed registrations.',
  [CODES.ORGANIZATION_APPLICATION_EXISTS]:
    'An organization application already exists for this account.',
  [CODES.ORGANIZATION_APPLICATION_CONFLICT]:
    'The organization application changed before this request completed.',
}

class StoreError extends Error {
  constructor(code) {
    super(MESSAGES[code] || 'Storage operation failed.')
    this.name = 'StoreError'
    this.code = code
  }
}

module.exports = { CODES, StoreError }
