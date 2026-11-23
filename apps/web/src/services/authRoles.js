export const ROLES = {
  STUDENT: 'student',
  ORGANIZATION: 'organization',
  ADMIN: 'admin',
}

export const ACCOUNT_TYPES = {
  STUDENT: 'STUDENT',
  ORGANIZATION_APPLICANT: 'ORGANIZATION_APPLICANT',
}

const ADMIN_GROUP = 'admins'
const ORGANIZATION_GROUP = 'organizations'
const ACCOUNT_TYPE_VALUES = new Set(Object.values(ACCOUNT_TYPES))

function asArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim() !== '') return value.split(/[\s,]+/)
  return []
}

export function roleFromGroups(groups) {
  const list = asArray(groups).map((group) => String(group).toLowerCase())
  if (list.includes(ADMIN_GROUP)) return ROLES.ADMIN
  if (list.includes(ORGANIZATION_GROUP)) return ROLES.ORGANIZATION
  return ROLES.STUDENT
}

export function accountTypeFromClaims(claims) {
  const accountType = claims?.['custom:account_type']
  return ACCOUNT_TYPE_VALUES.has(accountType) ? accountType : null
}

export function getDashboardPathForRole(role) {
  switch ((role || '').toLowerCase()) {
    case ROLES.ORGANIZATION:
      return '/org'
    case ROLES.ADMIN:
      return '/admin'
    case ROLES.STUDENT:
      return '/dashboard'
    default:
      return '/events'
  }
}
