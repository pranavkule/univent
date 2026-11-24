const env = import.meta.env || {}

export const ALLOWED_EMAIL_DOMAIN = String(
  env.VITE_ALLOWED_EMAIL_DOMAIN || 'ves.ac.in',
)
  .trim()
  .toLowerCase()

export const COGNITO = {
  region: String(env.VITE_COGNITO_REGION || '').trim(),
  userPoolId: String(env.VITE_COGNITO_USER_POOL_ID || '').trim(),
  clientId: String(env.VITE_COGNITO_CLIENT_ID || '').trim(),
}

export function assertCognitoConfig() {
  const missing = []
  if (!COGNITO.region) missing.push('VITE_COGNITO_REGION')
  if (!COGNITO.userPoolId) missing.push('VITE_COGNITO_USER_POOL_ID')
  if (!COGNITO.clientId) missing.push('VITE_COGNITO_CLIENT_ID')
  if (missing.length > 0) {
    throw new Error(`Cognito configuration is missing: ${missing.join(', ')}.`)
  }
}
