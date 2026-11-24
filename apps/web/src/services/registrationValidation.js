export function validateRegistrationInput({ eventId, name, email }) {
  const errors = {}
  if (!eventId) errors.eventId = 'Please choose an event.'
  if (!name || name.trim().length < 2) errors.name = 'Enter your full name (min 2 characters).'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  return errors
}
