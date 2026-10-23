export const DEFAULT_ALLOWED_EMAIL_DOMAIN = 'ves.ac.in'

export function isAllowedStudentEmail(email, domain = DEFAULT_ALLOWED_EMAIL_DOMAIN) {
  const clean = String(email || '').trim().toLowerCase()
  const allowed = String(domain || '').trim().toLowerCase()
  const parts = clean.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false
  return parts[1] === allowed
}

export function validateSignUpInput(
  { name, email, password },
  domain = DEFAULT_ALLOWED_EMAIL_DOMAIN,
) {
  const errors = {}
  if (!name || name.trim().length < 2) {
    errors.name = 'Enter your full name (min 2 characters).'
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  } else if (!isAllowedStudentEmail(email, domain)) {
    errors.email = `Use your @${domain} email address.`
  }
  if (!password || password.length < 8) {
    errors.password = 'Password needs at least 8 characters.'
  } else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Use uppercase, lowercase, and a number.'
  }
  return errors
}

export function validateSignInInput({ email, password }) {
  const errors = {}
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (!password) errors.password = 'Enter your password.'
  return errors
}

export function validateConfirmationInput({ code }) {
  const errors = {}
  if (!/^\d{6}$/.test(String(code || '').trim())) {
    errors.code = 'Enter the 6-digit code from your email.'
  }
  return errors
}
