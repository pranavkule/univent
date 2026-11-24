import { useEffect, useState } from 'react'
import { useAuth } from '../../components/AuthProvider.jsx'
import { getOrganizationByEmail } from '../../services/organizations.js'

// Organization profile. Shows the approved application details stored by the
// organization application API; profile editing is not supported by that API.
export default function OrgProfile() {
  const { user } = useAuth()
  const [org, setOrg] = useState(null)
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getOrganizationByEmail(user?.email || '')
      .then((o) => {
        if (!cancelled) setOrg(o)
      })
      .catch((err) => {
        if (!cancelled) setServerError(err.message || 'Could not load the profile.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) return <div className="skeleton">Loading organization profile…</div>

  if (serverError) return <div className="alert alert-error" role="alert">{serverError}</div>

  if (!org) {
    return (
      <div className="alert alert-empty">
        No organization profile is linked to {user?.email}. Organization accounts are created by the Admin team.
      </div>
    )
  }

  return (
    <>
      <p className="muted org-sub">
        Verified application details stored by the organization application API.
      </p>

      <div className="detail org-profile-card">
        <div className="org-profile-head">
          <h3>{org.name}</h3>
          <span className={`status status-${org.approvalStatus === 'approved' ? 'published' : 'pending'}`}>
            {org.approvalStatus === 'approved' ? 'Approved' : org.approvalStatus}
          </span>
        </div>
        <p className="muted">{org.description}</p>
        <dl className="facts">
          <div><dt>Contact</dt><dd>{org.contactEmail}</dd></div>
          {org.contactName && <div><dt>Representative</dt><dd>{org.contactName}</dd></div>}
          {org.representativeTitle && <div><dt>Role</dt><dd>{org.representativeTitle}</dd></div>}
          {org.representativePhone && <div><dt>Phone</dt><dd>{org.representativePhone}</dd></div>}
          <div><dt>Approval</dt><dd>Controlled by Admin (read-only here)</dd></div>
        </dl>
      </div>
    </>
  )
}
