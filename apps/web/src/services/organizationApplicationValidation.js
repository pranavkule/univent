const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateOrganizationApplicationInput(values, domain = 'ves.ac.in') {
  const errors = {}
  const organizationName = String(values.organizationName || '').trim()
  const applicantName = String(values.applicantName || '').trim()
  const officialEmail = String(values.officialEmail || '').trim().toLowerCase()
  const department = String(values.department || '').trim()
  const representativeTitle = String(values.representativeTitle || '').trim()
  const representativePhone = String(values.representativePhone || '').trim()
  const reason = String(values.reason || '').trim()
  const password = typeof values.password === 'string' ? values.password : ''
  const confirmPassword = typeof values.confirmPassword === 'string' ? values.confirmPassword : ''
  const allowedDomain = String(domain || 'ves.ac.in').trim().toLowerCase()

  if (organizationName.length < 2 || organizationName.length > 120) {
    errors.organizationName = 'Organization name must be between 2 and 120 characters.'
  }
  if (applicantName.length < 2 || applicantName.length > 100) {
    errors.applicantName = 'Enter the contact person’s full name (2 to 100 characters).'
  }
  if (!EMAIL_PATTERN.test(officialEmail) || officialEmail.length > 254) {
    errors.officialEmail = 'Enter a valid official organization email address.'
  } else if (officialEmail.split('@')[1] !== allowedDomain) {
    errors.officialEmail = `Use an @${allowedDomain} organization email address.`
  }
  if (department.length < 2 || department.length > 100) {
    errors.department = 'Department or category must be between 2 and 100 characters.'
  }
  if (representativeTitle.length < 2 || representativeTitle.length > 100) {
    errors.representativeTitle = 'Position must be between 2 and 100 characters.'
  }
  if (reason.length < 10 || reason.length > 1000) {
    errors.reason = 'Explain the access request in 10 to 1000 characters.'
  }
  if (representativePhone && !/^[+()\d .-]{7,32}$/.test(representativePhone)) {
    errors.representativePhone = 'Enter a valid contact phone number.'
  }
  if (password.length < 8 || password.length > 256) {
    errors.password = 'Password must be between 8 and 256 characters.'
  } else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Use uppercase, lowercase, and a number.'
  }
  if (password !== confirmPassword) errors.confirmPassword = 'The passwords do not match.'
  return errors
}

