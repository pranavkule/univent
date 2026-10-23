const DEFAULT_ALLOWED_DOMAIN = 'ves.ac.in'

function allowedDomain() {
  return String(process.env.ALLOWED_SIGNUP_DOMAIN || DEFAULT_ALLOWED_DOMAIN)
    .trim()
    .toLowerCase()
}

function isAllowedEmail(email) {
  const clean = String(email || '').trim().toLowerCase()
  const parts = clean.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false
  return parts[1] === allowedDomain()
}

function emailFrom(event) {
  const attributes = (event && event.request && event.request.userAttributes) || {}
  return attributes.email || ''
}

exports.handler = async (event) => {
  const source = event && event.triggerSource

  if (source === 'PreSignUp_AdminCreateUser') return event
  if (source !== 'PreSignUp_SignUp') {
    throw new Error('Sign-up is not available for this identity provider.')
  }

  if (!isAllowedEmail(emailFrom(event))) {
    throw new Error(`Only @${allowedDomain()} email addresses can sign up.`)
  }

  return event
}

exports.isAllowedEmail = isAllowedEmail
