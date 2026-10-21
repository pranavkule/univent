// Shared HTTP helpers: JSON responses, CORS headers, body parsing.
// Every response (including errors) is JSON and carries CORS headers so the
// S3-hosted frontend can call the API (docs/api.md).
const { devAuthEnabled } = require('./principal')

const DEFAULT_ORIGIN = '*'
const BASE_ALLOWED_HEADERS = 'Content-Type,Authorization'
const DEV_ALLOWED_HEADERS = 'X-Univent-Role,X-Univent-Email,X-Univent-Name,X-Univent-Sub'
const MAX_BODY_LENGTH = 100000

function corsOrigin() {
  const configured = (process.env.CORS_ORIGIN || '').trim()
  return configured || DEFAULT_ORIGIN
}

function corsHeaders() {
  const allowedHeaders = devAuthEnabled()
    ? `${BASE_ALLOWED_HEADERS},${DEV_ALLOWED_HEADERS}`
    : BASE_ALLOWED_HEADERS
  return {
    'Access-Control-Allow-Origin': corsOrigin(),
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '600',
  }
}

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }
}

function json(statusCode, body) {
  return response(statusCode, body)
}

function error(statusCode, message, extraHeaders = {}) {
  return response(statusCode, { message }, extraHeaders)
}

function requestMethod(event) {
  const context = (event && event.requestContext) || {}
  if (context.http && context.http.method) return String(context.http.method).toUpperCase()
  return String((event && event.httpMethod) || '').toUpperCase()
}

function parseBody(event) {
  const raw = event ? event.body : null
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: {} }
  if (typeof raw === 'object') {
    if (Array.isArray(raw)) return { ok: false, message: 'Request body must be a JSON object.' }
    return { ok: true, value: raw }
  }
  if (typeof raw === 'string') {
    if (raw.length > MAX_BODY_LENGTH) return { ok: false, message: 'Request body is too large.' }
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, message: 'Request body must be a JSON object.' }
      }
      return { ok: true, value: parsed }
    } catch {
      return { ok: false, message: 'Request body must be valid JSON.' }
    }
  }
  return { ok: false, message: 'Request body must be a JSON object.' }
}

function queryParams(event) {
  return (event && event.queryStringParameters) || {}
}

module.exports = {
  corsOrigin,
  corsHeaders,
  response,
  json,
  error,
  requestMethod,
  parseBody,
  queryParams,
}
