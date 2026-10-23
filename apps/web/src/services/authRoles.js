export const ROLES = {
  STUDENT: 'student',
  ORGANIZATION: 'organization',
  ADMIN: 'admin',
}

const ADMIN_GROUP = 'admins'
const ORGANIZATION_GROUP = 'organizations'

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
