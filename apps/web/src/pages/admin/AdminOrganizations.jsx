import { useEffect, useMemo, useState } from 'react'
import OrgStatusBadge, { statusLabel } from '../../components/OrgStatusBadge.jsx'
import { ORG_APPROVAL_STATUSES, listOrganizations, setOrganizationStatus } from '../../services/organizations.js'

// Organization management: review applications, approve/reject (a reason is
// required for rejections), and suspend or reactivate approved entries.
// Sensitive actions always ask for confirmation. Mock data only.
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

  async function refresh() {
    const list = await listOrganizations()
    setOrgs([...list].sort((a, b) => a.name.localeCompare(b.name)))
  }

  useEffect(() => {
    let cancelled = false
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load organizations.')
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
      return `${o.name} ${o.contactEmail} ${o.contactName || ''}`.toLowerCase().includes(q)
    })
  }, [orgs, query, statusFilter])

  async function runAction(email, status, confirmText, reasonValue = '') {
    if (!window.confirm(confirmText)) return
    setBusy(email)
    setNotice('')
    setError('')
    try {
      await setOrganizationStatus(email, status, reasonValue)
      await refresh()
      setNotice(`Organization ${status}.`)
      setRejectTarget(null)
      setReason('')
    } catch (err) {
      setError(err.message || 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  function submitReject(e) {
    e.preventDefault()
    if (reason.trim().length < 3) {
      setReasonError('Give a short reason (min 3 characters) so the organization knows what to fix.')
      return
    }
    setReasonError('')
    runAction(rejectTarget.contactEmail, 'rejected', `Reject the application from "${rejectTarget.name}"?`, reason.trim())
  }

  if (loading) return <div className="skeleton">Loading organizations…</div>

  return (
    <>
      <p className="muted org-sub">
        {orgs.length} organization{orgs.length === 1 ? '' : 's'} on record. Mock data — stored in this browser only.
      </p>
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="toolbar" role="search">
        <label className="visually-hidden" htmlFor="admin-orgs-search">Search organizations</label>
        <input
          id="admin-orgs-search"
          type="search"
          placeholder="Search name, contact, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="org-search"
        />
        <label htmlFor="admin-orgs-status">Status</label>
        <select id="admin-orgs-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {ORG_APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="alert alert-empty">No organizations match your search or filter.</div>
      ) : (
        <div className="org-table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Organization</th><th>Contact</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.name}
                    <br />
                    <span className="muted">{o.description && o.description.length > 90 ? `${o.description.slice(0, 90)}…` : o.description}</span>
                    {o.decisionReason && <br />}
                    {o.decisionReason && <span className="muted">Decision: {o.decisionReason}</span>}
                  </td>
                  <td>
                    {o.contactName || '—'}
                    <br />
                    <span className="muted">{o.contactEmail}</span>
                  </td>
                  <td><OrgStatusBadge status={o.approvalStatus} /></td>
                  <td className="org-actions">
                    {o.approvalStatus === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={busy === o.contactEmail}
                          onClick={() => runAction(o.contactEmail, 'approved', `Approve "${o.name}" as an organization?`)}
                        >
                          {busy === o.contactEmail ? 'Working…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy === o.contactEmail}
                          onClick={() => { setRejectTarget(o); setReason(''); setReasonError(''); setNotice('') }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {o.approvalStatus === 'approved' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy === o.contactEmail}
                        onClick={() => runAction(o.contactEmail, 'suspended', `Suspend "${o.name}"? Its events stay listed but approval is revoked in this mock.`)}
                      >
                        {busy === o.contactEmail ? 'Working…' : 'Suspend'}
                      </button>
                    )}
                    {o.approvalStatus === 'suspended' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy === o.contactEmail}
                        onClick={() => runAction(o.contactEmail, 'approved', `Reactivate "${o.name}"?`)}
                      >
                        {busy === o.contactEmail ? 'Working…' : 'Reactivate'}
                      </button>
                    )}
                    {o.approvalStatus === 'rejected' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy === o.contactEmail}
                        onClick={() => runAction(o.contactEmail, 'approved', `Approve "${o.name}" after all?`)}
                      >
                        {busy === o.contactEmail ? 'Working…' : 'Approve'}
                      </button>
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
          <p className="muted">A reason is required so the organization knows what to fix.</p>
          <div className="field">
            <label htmlFor="admin-reject-reason">Reason for rejection</label>
            <textarea
              id="admin-reject-reason"
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Missing faculty advisor details"
            />
            {reasonError && <span className="field-error" role="alert">{reasonError}</span>}
          </div>
          <div className="org-form-actions">
            <button type="submit" className="btn" disabled={busy === rejectTarget.contactEmail}>
              {busy === rejectTarget.contactEmail ? 'Rejecting…' : 'Confirm rejection'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setRejectTarget(null); setReason('') }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  )
}
