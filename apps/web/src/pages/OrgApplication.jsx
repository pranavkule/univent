import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrgStatusBadge from '../components/OrgStatusBadge.jsx'
import { useAuth } from '../components/AuthProvider.jsx'
import { getMyOrganizationApplication } from '../services/organizations.js'

function statusMessage(status) {
  if (status === 'pending_verification') {
    return 'This is a historical application. Submit a new organization application using the official organization email.'
  }
  if (status === 'pending_approval' || status === 'pending') {
    return 'The application is awaiting administrator approval. Student accounts are not involved.'
  }
  if (status === 'approved') {
    return 'This organization account is approved. Continue using the official organization email and its own password.'
  }
  if (status === 'rejected') return 'The application was rejected. See the administrator’s reason below.'
  if (status === 'suspended') return 'Organization access is suspended. Contact a UniVent administrator for assistance.'
  return 'The current application status is shown below.'
}

export default function OrgApplication() {
  const { user } = useAuth()
  const [application, setApplication] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getMyOrganizationApplication()
      .then((result) => {
        if (active) {
          setApplication(result)
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load your application.')
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  if (!loaded) return <div className="container"><div className="skeleton">Loading application…</div></div>
  if (error) return <div className="container"><div className="alert alert-error" role="alert">{error}</div></div>
  if (!application) {
    return (
      <div className="container container-narrow">
        <h2>Organization application</h2>
        <p className="muted">No organization application is associated with {user?.email || 'this account'}.</p>
        <Link className="btn" to="/org/signup">Submit an application</Link>
      </div>
    )
  }

  const status = application.approvalStatus
  return (
    <div className="container container-narrow">
      <h2>Organization application</h2>
      <div className="detail">
        <div className="org-profile-head">
          <h3>{application.name}</h3>
          <OrgStatusBadge status={status} />
        </div>
        <p className="muted">Applicant: {application.contactEmail}</p>
        <p role="status">{statusMessage(status)}</p>
        {application.decisionReason && <p className="muted">Administrator decision: {application.decisionReason}</p>}
        {status === 'approved' && <Link className="btn" to="/org">Open organization workspace</Link>}
      </div>
    </div>
  )
}
