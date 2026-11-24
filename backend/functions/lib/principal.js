// Resolve identity only from API Gateway Cognito authorizer claims.

const ROLES = {
  ADMIN: 'admin',
  ORGANIZATION: 'organization',
  STUDENT: 'student',
}

const ADMIN_GROUP = 'admins'
const ORGANIZATION_GROUP = 'organizations'

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
    emailVerified: claims.email_verified === true || String(claims.email_verified).toLowerCase() === 'true',
    name,
    role: roleFromGroups(groups),
    groups: asArray(groups),
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
  return principalFromClaims(claimsFromEvent(event)) || anonymousPrincipal()
}

function hasRole(principal, ...roles) {
  return Boolean(
    principal && principal.authenticated && roles.includes(principal.role),
  )
}

function isAdmin(principal) {
  return hasRole(principal, ROLES.ADMIN)
}

function isStudent(principal) {
  return hasRole(principal, ROLES.STUDENT)
}

function isOrganization(principal) {
  return hasRole(principal, ROLES.ORGANIZATION)
}

module.exports = {
  ROLES,
  resolvePrincipal,
  hasRole,
  isAdmin,
  isStudent,
  isOrganization,
}
