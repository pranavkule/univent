import { useEffect, useMemo, useState } from 'react'
import OrgStatusBadge, { statusLabel } from '../../components/OrgStatusBadge.jsx'
import { ORG_APPROVAL_STATUSES, listOrganizations, setOrganizationStatus } from '../../services/organizations.js'

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busy, setBusy] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const decisionInProgress = busy !== null

  async function refresh() {
    const list = await listOrganizations()
    setOrgs([...list].sort((a, b) => a.name.localeCompare(b.name)))
  }

  useEffect(() => {
    let cancelled = false
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load organization applications.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orgs.filter((o) => {
      if (statusFilter !== 'all' && o.approvalStatus !== statusFilter) return false
      if (!q) return true
      return [
        o.name,
        o.contactEmail,
        o.officialEmail,
        o.contactName,
        o.department,
        o.representativeTitle,
      ].join(' ').toLowerCase().includes(q)
    })
  }, [orgs, query, statusFilter])

  async function runAction(application, action, confirmText, details = {}) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(application.id)
    setNotice('')
    setError('')
    try {
      await setOrganizationStatus(application, action, details)
      await refresh()
      setNotice(`Application ${action.toLowerCase()} action completed.`)
      setRejectTarget(null)
      setReason('')
    } catch (err) {
      setError(err.message || 'The application action failed.')
    } finally {
      setBusy(null)
    }
  }

  function submitReject(event) {
    event.preventDefault()
    if (reason.trim().length < 3 || reason.trim().length > 500) {
      setReasonError('Enter a reason between 3 and 500 characters.')
      return
    }
    setReasonError('')
    runAction(
      rejectTarget,
      'REJECT',
      `Reject the application from "${rejectTarget.name}"?`,
      { reason: reason.trim() },
    )
  }

  if (loading) return <div className="skeleton">Loading organization applications…</div>

  return (
    <>
      <p className="muted org-sub">
        {orgs.length} organization application{orgs.length === 1 ? '' : 's'} on record.
        Accounts are created only after administrator approval; organization email OTP is not required.
      </p>
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="toolbar" role="search">
        <label className="visually-hidden" htmlFor="admin-orgs-search">Search applications</label>
        <input
          id="admin-orgs-search"
          type="search"
          placeholder="Search organization, applicant, or email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="org-search"
        />
        <label htmlFor="admin-orgs-status">Status</label>
        <select id="admin-orgs-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          {ORG_APPROVAL_STATUSES.map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="alert alert-empty">No organization applications match your search or filter.</div>
      ) : (
        <div className="org-table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Organization and request</th><th>Applicant</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {filtered.map((application) => (
                <tr key={application.id}>
                  <td>
                    <strong>{application.name}</strong>
                    <br />
                    <span className="muted">{application.department || 'Department/category not supplied'}</span>
                    {application.officialEmail && (
                      <><br /><span className="muted">Official email: {application.officialEmail}</span></>
                    )}
                    {application.reason && (
                      <><br /><span className="muted">Request: {application.reason}</span></>
                    )}
                    {application.verificationNotes && (
                      <><br /><span className="muted">Verification notes: {application.verificationNotes}</span></>
                    )}
                    {application.decisionReason && (
                      <><br /><span className="muted">Decision: {application.decisionReason}</span></>
                    )}
                    {application.appliedAt && (
                      <><br /><span className="muted">Applied: {application.appliedAt.slice(0, 10)}</span></>
                    )}
                  </td>
                  <td>
                    {application.contactName || '—'}
                    {application.representativeTitle && (
                      <><br /><span className="muted">{application.representativeTitle}</span></>
                    )}
                    <br /><span className="muted">{application.contactEmail || '—'}</span>
                  </td>
                  <td><OrgStatusBadge status={application.approvalStatus} /></td>
                  <td className="org-actions">
                    {application.approvalStatus === 'pending_verification' && (
                      <>
                        <span className="muted">Historical application; request a new application to provision a separate account.</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={decisionInProgress}
                          onClick={() => { setRejectTarget(application); setReason(''); setReasonError(''); setNotice('') }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {application.approvalStatus === 'pending_approval' && application.canApprove && !application.isLegacy && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={decisionInProgress}
                          onClick={() => runAction(
                            application,
                            'APPROVE',
                            `Create and enable a separate Cognito account for "${application.officialEmail}"?`,
                          )}
                        >
                          {busy === application.id ? 'Working…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={decisionInProgress}
                          onClick={() => { setRejectTarget(application); setReason(''); setReasonError(''); setNotice('') }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {['pending', 'pending_approval'].includes(application.approvalStatus)
                      && (!application.canApprove || application.isLegacy) && (
                      <>
                        <span className="muted">Secure password setup is unavailable or expired; request a new application.</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={decisionInProgress}
                          onClick={() => { setRejectTarget(application); setReason(''); setReasonError(''); setNotice('') }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {application.approvalStatus === 'approved' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={decisionInProgress}
                        onClick={() => runAction(
                          application,
                          'SUSPEND',
                          `Suspend access for "${application.name}"?`,
                          { reason: 'Suspended by administrator.' },
                        )}
                      >
                        Suspend
                      </button>
                    )}
                    {application.approvalStatus === 'suspended' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={decisionInProgress}
                          onClick={() => runAction(application, 'SUSPEND', 'Retry removal of organization access?')}
                        >
                          Retry revocation
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={decisionInProgress}
                          onClick={() => runAction(application, 'REACTIVATE', `Reactivate "${application.name}"?`)}
                        >
                          Reactivate
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectTarget && (
        <form className="detail" onSubmit={submitReject} aria-label={`Reject ${rejectTarget.name}`}>
          <h3>Reject “{rejectTarget.name}”</h3>
          <p className="muted">A reason is required and will be included in the application record.</p>
          <div className="field">
            <label htmlFor="admin-reject-reason">Reason for rejection</label>
            <textarea
              id="admin-reject-reason"
              rows="3"
              maxLength="500"
              value={reason}
              disabled={decisionInProgress}
              onChange={(event) => setReason(event.target.value)}
            />
            {reasonError && <span className="field-error" role="alert">{reasonError}</span>}
          </div>
          <div className="org-form-actions">
            <button type="submit" className="btn" disabled={decisionInProgress}>
              {busy === rejectTarget.id ? 'Rejecting…' : 'Confirm rejection'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={decisionInProgress} onClick={() => { setRejectTarget(null); setReason('') }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  )
}
