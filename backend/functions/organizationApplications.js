const { json, error, requestMethod, parseBody } = require('./lib/http')
const { resolvePrincipal, isAdmin } = require('./lib/principal')
const { getStore } = require('./lib/store')
const { CODES, StoreError } = require('./lib/storeError')
const { validatePublicOrganizationApplicationInput, firstError } = require('./lib/validation')
const cognitoGroups = require('./lib/cognitoGroups')
const cognitoProvisioning = require('./lib/cognitoProvisioning')
const organizationApplicationSecrets = require('./lib/organizationApplicationSecrets')

const STATUS_TRANSITIONS = {
  APPROVED: ['PENDING', 'REJECTED', 'SUSPENDED'],
  REJECTED: ['PENDING', 'APPROVED', 'SUSPENDED'],
  SUSPENDED: ['APPROVED'],
}
const VALID_STATUSES = new Set(['APPROVED', 'REJECTED', 'SUSPENDED'])
const ADMIN_ACTIONS = new Set(['APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE'])

function publicApplication(application, includeUserSub) {
  if (!application) return null
  return {
    applicationId: application.applicationId || application.userSub,
    ...(includeUserSub ? { userSub: application.userSub, cognitoSub: application.cognitoSub || application.userSub } : {}),
    organizationName: application.organizationName,
    officialEmail: application.officialEmail,
    applicantName: application.applicantName || application.representativeName,
    applicantEmail: application.applicantEmail || application.officialEmail,
    department: application.department || '',
    reason: application.reason || '',
    representativeName: application.applicantName || application.representativeName,
    representativeTitle: application.representativeTitle,
    representativePhone: application.representativePhone,
    status: application.status,
    appliedAt: application.appliedAt,
    ...(application.isLegacy ? { isLegacy: true } : {}),
    ...(includeUserSub && application.passwordExpiresAt
      ? {
          canApprove: application.status === 'PENDING_APPROVAL'
            && application.passwordExpiresAt > Math.floor(Date.now() / 1000),
        }
      : {}),
    ...(includeUserSub && application.approvedAt ? { approvedAt: application.approvedAt } : {}),
    ...(includeUserSub && application.approvedBy ? { approvedBy: application.approvedBy } : {}),
    ...(includeUserSub && application.auditLog ? { auditLog: application.auditLog } : {}),
    ...(application.decidedAt ? { decidedAt: application.decidedAt } : {}),
    ...(application.decisionReason ? { decisionReason: application.decisionReason } : {}),
  }
}

function statusError(err) {
  if (!(err instanceof StoreError)) return null
  if (err.code === CODES.ORGANIZATION_APPLICATION_EXISTS) return error(409, err.message)
  if (err.code === CODES.ORGANIZATION_APPLICATION_CONFLICT) return error(409, err.message)
  if (err.code === CODES.ORGANIZATION_ACCOUNT_EXISTS) return error(409, err.message)
  return null
}

async function listOrReadApplication(principal, store) {
  if (isAdmin(principal)) {
    const applications = await store.listOrganizationApplications()
    return json(200, { applications: applications.map((item) => publicApplication(item, true)) })
  }
  if (!principal.sub) return error(403, 'The account has no trusted user identifier.')
  const application = await store.getOrganizationApplication(principal.sub)
  return json(200, { application: publicApplication(application, false) })
}

async function submitApplication(event, store) {
  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)
  const { values, errors } = validatePublicOrganizationApplicationInput(
    parsed.value,
    process.env.ALLOWED_SIGNUP_DOMAIN || 'ves.ac.in',
  )
  if (Object.keys(errors).length > 0) return error(400, firstError(errors))

  let application
  const passwordExpiresAt = Math.floor(Date.now() / 1000) + organizationApplicationSecrets.PASSWORD_TTL_SECONDS
  try {
    application = await store.createPendingOrganizationApplication(values, { passwordExpiresAt })
    await organizationApplicationSecrets.storePassword(
      application.applicationId,
      parsed.value.password,
      passwordExpiresAt,
    )
    return json(201, {
      application: {
        applicationId: application.applicationId,
        status: application.status,
      },
    })
  } catch (err) {
    if (application) {
      try {
        await organizationApplicationSecrets.deletePassword(application.applicationId)
      } catch (cleanupError) {
        console.error('organization password cleanup failed:', cleanupError && cleanupError.name)
      }
      try {
        const deleted = await store.deletePendingOrganizationApplication(application.applicationId)
        if (!deleted) {
          console.error('organization application reservation cleanup was not completed.')
        }
      } catch (cleanupError) {
        console.error('organization application reservation cleanup failed:', cleanupError && cleanupError.name)
      }
    }
    const mapped = statusError(err)
    if (mapped) return mapped
    console.error('organization application submission failed:', err && err.name)
    return error(500, 'Unable to submit the organization application right now.')
  }
}

function actionAudit(action, principal, now, notes = '') {
  return {
    action,
    at: now,
    actorSub: principal.sub,
    ...(notes ? { notes } : {}),
  }
}

function actionFields(action, principal, parsed, current, now) {
  if (!ADMIN_ACTIONS.has(action)) return { error: 'Choose a valid application action.' }
  const allowedFields = {
    APPROVE: new Set(['action']),
    REJECT: new Set(['action', 'reason']),
    SUSPEND: new Set(['action', 'reason']),
    REACTIVATE: new Set(['action']),
  }[action]
  if (Object.keys(parsed.value).some((key) => !allowedFields.has(key))) {
    return { error: 'The request contains unsupported application fields.' }
  }

  if (action === 'REJECT' || action === 'SUSPEND') {
    const reason = String(parsed.value.reason || '').trim()
    if (reason.length > 500 || (action === 'REJECT' && reason.length < 3)) {
      return { error: action === 'REJECT'
        ? 'A rejection reason of at least 3 characters is required.'
        : 'Suspension reason must be at most 500 characters.' }
    }
    return {
      status: action === 'REJECT' ? 'REJECTED' : 'SUSPENDED',
      decisionReason: reason,
      decidedBy: principal.sub,
      decidedAt: now,
      auditEntry: actionAudit(action, principal, now, reason),
    }
  }

  if (action === 'APPROVE') {
    return {
      status: 'APPROVED',
      approvedBy: principal.sub,
      approvedAt: now,
      decisionReason: '',
      decidedBy: principal.sub,
      decidedAt: now,
      auditEntry: actionAudit(action, principal, now),
    }
  }

  return {
    status: 'APPROVED',
    approvedBy: principal.sub,
    approvedAt: now,
    decisionReason: '',
    decidedBy: principal.sub,
    decidedAt: now,
    auditEntry: actionAudit(action, principal, now),
  }
}

async function completeOrganizationApproval(application) {
  if (!application.cognitoSub) {
    return error(502, 'The approved organization account could not be matched to the application.')
  }
  try {
    await cognitoGroups.addOrganizationGroup(application.cognitoSub)
    const enabledSub = await cognitoProvisioning.enableOrganizationAccount(application)
    if (enabledSub !== application.cognitoSub) {
      throw new Error('Cognito returned a different organization account.')
    }
  } catch (err) {
    console.error('organization access grant failed:', err && err.name)
    return error(502, 'Approval is saved; organization access could not be enabled. Retry approval.')
  }

  try {
    await organizationApplicationSecrets.deletePassword(application.applicationId)
  } catch (err) {
    console.error('organization password cleanup failed:', err && err.name)
    return error(502, 'Approval is active; secure password cleanup must be retried.')
  }
  return json(200, { application: publicApplication(application, true) })
}

async function changePublicApplicationStatus(event, principal, store, current) {
  if (!isAdmin(principal)) return error(403, 'Only administrators can decide organization applications.')
  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)
  const action = String(parsed.value.action || '').trim().toUpperCase()
  if (!ADMIN_ACTIONS.has(action)) return error(400, 'Choose a valid application action.')
  if (action === 'APPROVE' && current.status === 'APPROVED') {
    return completeOrganizationApproval(current)
  }
  if (action === 'REACTIVATE' && current.status === 'APPROVED') {
    return completeOrganizationApproval(current)
  }
  if (action === 'REJECT' && current.status === 'REJECTED') {
    try {
      await organizationApplicationSecrets.deletePassword(current.applicationId)
      return json(200, { application: publicApplication(current, true) })
    } catch (err) {
      console.error('organization password cleanup failed:', err && err.name)
      return error(502, 'The application is rejected; secure password cleanup must be retried.')
    }
  }
  const allowedFrom = {
    APPROVE: ['PENDING_APPROVAL'],
    REJECT: ['PENDING_VERIFICATION', 'PENDING_APPROVAL'],
    SUSPEND: ['APPROVED', 'SUSPENDED'],
    REACTIVATE: ['SUSPENDED'],
  }[action]
  if (!allowedFrom.includes(current.status)) {
    return error(409, `Cannot ${action.toLowerCase()} an application from ${current.status}.`)
  }
  const now = new Date().toISOString()
  const updates = actionFields(action, principal, parsed, current, now)
  if (updates.error) return error(400, updates.error)

  if (action === 'APPROVE') {
    let password
    try {
      password = await organizationApplicationSecrets.getPassword(current.applicationId)
    } catch (err) {
      console.error('organization password retrieval failed:', err && err.name)
      return error(502, 'The organization password could not be securely retrieved.')
    }
    if (!password) {
      return error(409, 'The secure password setup expired. Reject this application and ask the organization to reapply.')
    }

    let cognitoSub
    try {
      cognitoSub = await cognitoProvisioning.createOrganizationAccount(current, password)
    } catch (err) {
      const mapped = statusError(err)
      if (mapped) return mapped
      console.error('organization account provisioning failed:', err && err.name)
      return error(502, 'The account could not be provisioned; approval was not completed.')
    }
    updates.cognitoSub = cognitoSub
    let updated
    try {
      updated = await store.updatePublicOrganizationApplication(
        current.applicationId,
        updates,
        allowedFrom,
      )
    } catch (err) {
      try {
        const latest = await store.getPublicOrganizationApplication(current.applicationId)
        if (latest?.status === 'APPROVED' && latest?.cognitoSub === cognitoSub) {
          updated = latest
        } else {
          const mapped = statusError(err)
          if (mapped) return mapped
          console.error('organization approval persistence failed:', err && err.name)
          return error(500, 'The account remains disabled because approval could not be saved.')
        }
      } catch (rollbackError) {
        console.error('organization approval recovery failed:', rollbackError && rollbackError.name)
        return error(500, 'The account remains disabled because approval could not be confirmed.')
      }
    }
    if (!updated) return error(404, 'Organization application not found.')
    return completeOrganizationApproval(updated)
  }

  let updated
  try {
    updated = await store.updatePublicOrganizationApplication(
      current.applicationId,
      updates,
      allowedFrom.filter((status) => status === current.status),
    )
    if (!updated) return error(404, 'Organization application not found.')
  } catch (err) {
    const mapped = statusError(err)
    if (mapped) return mapped
    console.error('organization application decision failed:', err && err.name)
    return error(500, 'Unable to save the organization application decision.')
  }

  if (action === 'REJECT') {
    try {
      await organizationApplicationSecrets.deletePassword(updated.applicationId)
    } catch (err) {
      console.error('organization password cleanup failed:', err && err.name)
      return error(502, 'The application is rejected; secure password cleanup must be retried.')
    }
  }

  if (action === 'SUSPEND') {
    let cleanupFailed = false
    try {
      await cognitoProvisioning.disableOrganizationAccount(updated)
    } catch (err) {
      cleanupFailed = true
      console.error('organization account disable failed:', err && err.name)
    }
    try {
      await cognitoGroups.removeOrganizationGroup(updated.cognitoSub)
    } catch (err) {
      cleanupFailed = true
      console.error('organization group removal failed:', err && err.name)
    }
    if (cleanupFailed) {
      return error(502, 'Suspension is saved and backend access is blocked; retry Cognito cleanup.')
    }
  }

  if (action === 'REACTIVATE') {
    try {
      await cognitoGroups.addOrganizationGroup(updated.cognitoSub)
      await cognitoProvisioning.enableOrganizationAccount(updated)
    } catch (err) {
      console.error('organization access restoration failed:', err && err.name)
      return error(502, 'Reactivation is saved; organization access could not be restored. Retry.')
    }
  }
  return json(200, { application: publicApplication(updated, true) })
}

async function changeLegacyApplicationStatus(event, principal, store) {
  if (!isAdmin(principal)) return error(403, 'Only administrators can decide organization applications.')
  const userSub = String(event.pathParameters?.userSub || event.pathParameters?.applicationId || '').trim()
  if (!userSub || userSub.length > 200) return error(400, 'A valid application userSub is required.')

  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)
  const status = String(parsed.value.status || ({
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    SUSPEND: 'SUSPENDED',
    REACTIVATE: 'APPROVED',
  }[String(parsed.value.action || '').trim().toUpperCase()] || '')).trim().toUpperCase()
  const decisionReason = String(parsed.value.decisionReason || parsed.value.reason || '').trim()
  if (status === 'APPROVED') {
    return error(409, 'Historical applications cannot grant organization access. Submit a new application using the organization email.')
  }
  if (!VALID_STATUSES.has(status)) {
    return error(400, 'Status must be APPROVED, REJECTED, or SUSPENDED.')
  }
  if (status === 'REJECTED' && decisionReason.length < 3) {
    return error(400, 'A rejection reason of at least 3 characters is required.')
  }
  if (decisionReason.length > 500) return error(400, 'Decision reason must be at most 500 characters.')

  try {
    const current = await store.getOrganizationApplication(userSub)
    if (!current) return error(404, 'Organization application not found.')

    const expectedStatuses = STATUS_TRANSITIONS[status]
    if (current.status !== status && !expectedStatuses.includes(current.status)) {
      return error(409, `Cannot change an application from ${current.status} to ${status}.`)
    }

    let updated = current
    if (current.status !== status) {
      try {
        updated = await store.updateOrganizationApplicationStatus(
          userSub,
          { status, decisionReason, decidedBy: principal.sub },
          expectedStatuses,
        )
      } catch (err) {
        const mapped = statusError(err)
        if (mapped) return mapped
        console.error('organization application decision failed:', err && err.message)
        return error(500, 'Unable to save the organization application decision.')
      }
      if (!updated) return error(404, 'Organization application not found.')
    }

    return json(200, { application: publicApplication(updated, true) })
  } catch (err) {
    console.error('organization application decision failed:', err && err.message)
    return error(500, 'Unable to process the organization application right now.')
  }
}

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (!['GET', 'POST', 'PATCH'].includes(method)) {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use GET, POST, or PATCH.`, {
      Allow: 'GET, POST, PATCH',
    })
  }

  const store = getStore()
  if (method === 'POST') return submitApplication(event, store)

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to access organization applications.')

  if (method === 'GET') {
    try {
      return await listOrReadApplication(principal, store)
    } catch (err) {
      console.error('organization application lookup failed:', err && err.message)
      return error(500, 'Unable to load organization applications right now.')
    }
  }
  const applicationId = String(
    event.pathParameters?.applicationId || event.pathParameters?.userSub || '',
  ).trim()
  if (!applicationId) return error(400, 'A valid application identifier is required.')

  try {
    const application = await store.getPublicOrganizationApplication(applicationId)
    if (application) return changePublicApplicationStatus(event, principal, store, application)
    return changeLegacyApplicationStatus(event, principal, store)
  } catch (err) {
    console.error('organization application lookup failed:', err && err.name)
    return error(500, 'Unable to load the organization application right now.')
  }
}
