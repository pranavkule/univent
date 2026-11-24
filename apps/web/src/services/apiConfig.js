const env = import.meta.env || {}

const apiUrl = String(env.VITE_API_URL || '').trim().replace(/\/+$/, '')

if (!apiUrl) {
  throw new Error(
    'VITE_API_URL is required. Configure the AWS API Gateway endpoint before starting the app.',
  )
}

export const API_BASE_URL = apiUrl
