// Identity resolution for the UniVent handlers.
//
// Phase 3 has no Cognito authorizer yet, so a request may carry no identity
// at all. This module resolves the caller in two ways:
//
// 1. API Gateway authorizer claims (Cognito, Phase 5). Both the REST API
//    shape (`requestContext.authorizer.claims`) and the HTTP API shape
//    (`requestContext.authorizer.jwt.claims`) are supported.
// 2. A LOCAL DEVELOPMENT header, used only for local testing.
//
// The development fallback is deliberately hard to turn on:
//   - UNIVENT_DEV_AUTH must be exactly "true" (off by default), and
//   - AWS_EXECUTION_ENV blocks the headers in AWS Lambda. SAM local is the
//     only exception, identified by its AWS_SAM_LOCAL marker.
// Client-supplied roles are therefore never trusted in a deployed stack.

const ROLES = {
  ADMIN: 'admin',
  ORGANIZATION: 'organization',
  STUDENT: 'student',
}

const ADMIN_GROUP = 'admins'
const ORGANIZATION_GROUP = 'organizations'

function devAuthEnabled() {
  if (process.env.UNIVENT_DEV_AUTH !== 'true') return false
  if (process.env.AWS_EXECUTION_ENV && process.env.AWS_SAM_LOCAL !== 'true') return false
  return true
}

function headerValue(headers, name) {
  if (!headers) return ''
  const target = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) return String(headers[key] || '')
  }
  return ''
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim() !== '') return value.split(/[\s,]+/)
  return []
}

function roleFromGroups(groups) {
  const list = asArray(groups).map((group) => String(group).toLowerCase())
  if (list.includes(ADMIN_GROUP)) return ROLES.ADMIN
  if (list.includes(ORGANIZATION_GROUP)) return ROLES.ORGANIZATION
  return ROLES.STUDENT
}

function claimsFromEvent(event) {
  const authorizer = event && event.requestContext && event.requestContext.authorizer
  if (!authorizer) return null
  if (authorizer.jwt && authorizer.jwt.claims) return authorizer.jwt.claims
  if (authorizer.claims) return authorizer.claims
  return null
}

function principalFromClaims(claims) {
  if (!claims) return null
  const groups = claims['cognito:groups'] || claims.groups
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : ''
  const rawName = claims.name || claims.given_name || claims['cognito:username'] || ''
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  return {
    authenticated: true,
    source: 'authorizer-claims',
    sub: claims.sub || null,
    email,
    name,
    role: roleFromGroups(groups),
    groups: asArray(groups),
  }
}

function principalFromDevHeaders(event) {
  if (!devAuthEnabled()) return null
  const headers = (event && event.headers) || {}
  const role = headerValue(headers, 'x-univent-role').trim().toLowerCase()
  if (!role) return null
  const email = headerValue(headers, 'x-univent-email').trim().toLowerCase()
  const name = headerValue(headers, 'x-univent-name').trim()
  const sub = headerValue(headers, 'x-univent-sub').trim()
  const resolvedRole = Object.values(ROLES).includes(role) ? role : ROLES.STUDENT
  return {
    authenticated: true,
    source: 'dev-header',
    sub: sub || `dev-${email || 'user'}`,
    email,
    name,
    role: resolvedRole,
    groups: [],
  }
}

function anonymousPrincipal() {
  return {
    authenticated: false,
    source: 'none',
    sub: null,
    email: '',
    name: '',
    role: null,
    groups: [],
  }
}

function resolvePrincipal(event) {
  return principalFromClaims(claimsFromEvent(event)) || principalFromDevHeaders(event) || anonymousPrincipal()
}

function isAdmin(principal) {
  return Boolean(principal && principal.authenticated && principal.role === ROLES.ADMIN)
}

module.exports = {
  ROLES,
  devAuthEnabled,
  resolvePrincipal,
  isAdmin,
}
