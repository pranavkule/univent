const env = import.meta.env || {}

const apiUrl = String(env.VITE_API_URL || '').trim().replace(/\/+$/, '')
const requestedMode = String(env.VITE_API_MODE || (apiUrl ? 'live' : 'mock'))
  .trim()
  .toLowerCase()

if (requestedMode !== 'mock' && requestedMode !== 'live') {
  throw new Error('VITE_API_MODE must be either "mock" or "live".')
}

if (requestedMode === 'live' && !apiUrl) {
  throw new Error('VITE_API_URL is required when VITE_API_MODE=live.')
}

export const API_MODE = requestedMode
export const API_BASE_URL = apiUrl
