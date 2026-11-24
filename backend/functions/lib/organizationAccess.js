const { isOrganization } = require('./principal')

async function isApprovedOrganization(principal, store) {
  if (!isOrganization(principal) || !principal.sub) return false
  const application = await store.getOrganizationApplication(principal.sub)
  return application?.status === 'APPROVED'
    && application.isLegacy !== true
    && application.cognitoSub === principal.sub
}

async function hasOrganizationApplication(principal, store) {
  if (!principal || !principal.sub) return false
  const application = await store.getOrganizationApplication(principal.sub)
  return Boolean(application && application.isLegacy !== true)
}

module.exports = { isApprovedOrganization, hasOrganizationApplication }
