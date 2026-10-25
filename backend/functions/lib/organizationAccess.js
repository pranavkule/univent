const { isOrganization } = require('./principal')

async function isApprovedOrganization(principal, store) {
  if (!isOrganization(principal) || !principal.sub) return false
  const application = await store.getOrganizationApplication(principal.sub)
  return application?.status === 'APPROVED'
}

async function hasOrganizationApplication(principal, store) {
  if (!principal || !principal.sub) return false
  return Boolean(await store.getOrganizationApplication(principal.sub))
}

module.exports = { isApprovedOrganization, hasOrganizationApplication }
