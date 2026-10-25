const { json, error, requestMethod, parseBody } = require('./lib/http')
const { resolvePrincipal, isAdmin } = require('./lib/principal')
const { getStore } = require('./lib/store')
const { CODES, StoreError } = require('./lib/storeError')
const { validateOrganizationApplicationInput, firstError } = require('./lib/validation')
const cognitoGroups = require('./lib/cognitoGroups')

const STATUS_TRANSITIONS = {
  APPROVED: ['PENDING', 'REJECTED', 'SUSPENDED'],
  REJECTED: ['PENDING', 'APPROVED', 'SUSPENDED'],
  SUSPENDED: ['APPROVED'],
}
const VALID_STATUSES = new Set(['APPROVED', 'REJECTED', 'SUSPENDED'])

function publicApplication(application, includeUserSub) {
  if (!application) return null
  return {
    ...(includeUserSub ? { userSub: application.userSub } : {}),
    organizationName: application.organizationName,
    officialEmail: application.officialEmail,
    representativeName: application.representativeName,
    representativeTitle: application.representativeTitle,
    representativePhone: application.representativePhone,
    status: application.status,
    appliedAt: application.appliedAt,
    ...(application.decidedAt ? { decidedAt: application.decidedAt } : {}),
    ...(application.decisionReason ? { decisionReason: application.decisionReason } : {}),
  }
}

function statusError(err) {
  if (!(err instanceof StoreError)) return null
  if (err.code === CODES.ORGANIZATION_APPLICATION_EXISTS) return error(409, err.message)
  if (err.code === CODES.ORGANIZATION_APPLICATION_CONFLICT) return error(409, err.message)
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

async function submitApplication(event, principal, store) {
  if (isAdmin(principal)) return error(403, 'Administrators cannot submit organization applications.')
  if (!principal.sub || principal.source !== 'authorizer-claims') {
    return error(403, 'Submit an application using a signed-in Cognito account.')
  }
  if (!principal.emailVerified) {
    return error(403, 'Confirm the account email before applying.')
  }

  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)
  const { values, errors } = validateOrganizationApplicationInput(
    parsed.value,
    principal,
    process.env.ALLOWED_SIGNUP_DOMAIN || 'ves.ac.in',
  )
  if (Object.keys(errors).length > 0) return error(400, firstError(errors))

  try {
    const application = await store.createOrganizationApplication({
      userSub: principal.sub,
      ...values,
    })
    return json(201, { application: publicApplication(application, false) })
  } catch (err) {
    const mapped = statusError(err)
    if (mapped) return mapped
    console.error('organization application submission failed:', err && err.message)
    return error(500, 'Unable to submit the organization application right now.')
  }
}

async function changeApplicationStatus(event, principal, store) {
  if (!isAdmin(principal)) return error(403, 'Only administrators can decide organization applications.')
  const userSub = String(event.pathParameters?.userSub || '').trim()
  if (!userSub || userSub.length > 200) return error(400, 'A valid application userSub is required.')

  const parsed = parseBody(event)
  if (!parsed.ok) return error(400, parsed.message)
  const status = String(parsed.value.status || '').trim().toUpperCase()
  const decisionReason = String(parsed.value.decisionReason || '').trim()
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

    if (status === 'APPROVED') {
      try {
        await cognitoGroups.addOrganizationGroup(userSub)
      } catch (err) {
        console.error('organization group grant failed:', err && err.message)
        return error(502, 'Approval was not completed because Cognito access could not be granted.')
      }
      if (current.status === status) {
        return json(200, { application: publicApplication(current, true) })
      }
      try {
        const updated = await store.updateOrganizationApplicationStatus(
          userSub,
          { status, decidedBy: principal.sub },
          expectedStatuses,
        )
        if (!updated) {
          await cognitoGroups.removeOrganizationGroup(userSub)
          return error(404, 'Organization application not found.')
        }
        return json(200, { application: publicApplication(updated, true) })
      } catch (err) {
        try {
          const latest = await store.getOrganizationApplication(userSub)
          if (latest?.status !== 'APPROVED') {
            await cognitoGroups.removeOrganizationGroup(userSub)
          }
        } catch (rollbackError) {
          console.error('organization group rollback failed:', rollbackError && rollbackError.message)
        }
        const mapped = statusError(err)
        if (mapped) return mapped
        console.error('organization approval persistence failed:', err && err.message)
        return error(500, 'Cognito access was not retained because approval could not be saved.')
      }
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

    try {
      await cognitoGroups.removeOrganizationGroup(userSub)
    } catch (err) {
      console.error('organization group removal failed:', err && err.message)
      return error(502, 'The decision is saved and access is blocked; Cognito group cleanup must be retried.')
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

  const principal = resolvePrincipal(event)
  if (!principal.authenticated) return error(401, 'Sign in to access organization applications.')

  const store = getStore()
  if (method === 'GET') {
    try {
      return await listOrReadApplication(principal, store)
    } catch (err) {
      console.error('organization application lookup failed:', err && err.message)
      return error(500, 'Unable to load organization applications right now.')
    }
  }
  if (method === 'POST') return submitApplication(event, principal, store)
  return changeApplicationStatus(event, principal, store)
}
