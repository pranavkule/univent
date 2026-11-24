// Organization applications use a public submit route and authenticated read/review routes.
// Static sample organizations used for visuals live in sampleOrganizations.js
// and are never used for authentication, authorization, or writes.
import {
  decideOrganizationApplication,
  getOrganizationApplication,
  listOrganizationApplications,
  submitOrganizationApplication as submitApplicationApi,
} from './api.js'

export const ORG_APPROVAL_STATUSES = [
  'pending_verification',
  'pending_approval',
  'pending',
  'approved',
  'rejected',
  'suspended',
]

function normalizeLiveApplication(application) {
  const status = String(application.status || '').toUpperCase()
  const approvalStatus = status === 'PENDING_VERIFICATION'
    ? 'pending_verification'
    : status === 'PENDING_APPROVAL'
      ? 'pending_approval'
      : status.toLowerCase()
  return {
    id: application.applicationId || application.userSub || application.officialEmail,
    applicationId: application.applicationId || application.userSub || '',
    userSub: application.cognitoSub || application.userSub || '',
    name: application.organizationName,
    description: application.reason || '',
    contactEmail: application.applicantEmail || application.officialEmail || '',
    officialEmail: application.officialEmail || '',
    contactName: application.applicantName || application.representativeName,
    representativeTitle: application.representativeTitle,
    representativePhone: application.representativePhone,
    department: application.department || '',
    reason: application.reason || '',
    verificationNotes: application.verificationNotes || '',
    emailOwnershipVerified: application.emailOwnershipVerified === true,
    approvalStatus,
    appliedAt: application.appliedAt || '',
    decisionReason: application.decisionReason || '',
    canApprove: application.canApprove === true,
    isLegacy: application.isLegacy === true,
  }
}

export async function getOrganizationByEmail(email) {
  const clean = (email || '').trim().toLowerCase()
  const application = await getOrganizationApplication()
  const officialEmail = String(application?.officialEmail || '').toLowerCase()
  return application && officialEmail === clean
    ? normalizeLiveApplication(application)
    : null
}

// Admin workspace: list every organization application.
export async function listOrganizations() {
  const applications = await listOrganizationApplications()
  return applications.map(normalizeLiveApplication)
}

export async function getMyOrganizationApplication() {
  const application = await getOrganizationApplication()
  return application ? normalizeLiveApplication(application) : null
}

export async function submitOrganizationApplication(input) {
  return normalizeLiveApplication(await submitApplicationApi(input))
}

// Admin-only status transition. The backend enforces authorization and persists
// the decision; rejecting requires a reason so the organization knows what to fix.
export async function setOrganizationStatus(organization, action, details = {}) {
  const applicationId = typeof organization === 'string'
    ? organization
    : organization?.applicationId || organization?.id
  if (!applicationId) throw new Error('The application is missing its identifier.')
  return normalizeLiveApplication(
    await decideOrganizationApplication(applicationId, action.toUpperCase(), details),
  )
}
