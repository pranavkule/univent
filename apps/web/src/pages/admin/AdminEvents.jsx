import { useEffect, useMemo, useState } from 'react'
import OrgStatusBadge, { statusLabel } from '../../components/OrgStatusBadge.jsx'
import { listPlatformEvents } from '../../services/admin.js'
import { mockCategories } from '../../services/mockEvents.js'
import { ORG_STATUSES, moderateOrgEvent } from '../../services/orgEvents.js'

// Event management across the platform: public system events (read-only
// mock rows) plus every organization's events with approve / reject /
// cancel moderation. Approval is required before org events go live —
// nothing becomes public from this screen in the mock. Mock data only.
const MODERATABLE = new Set(['pending', 'published'])

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [orgFilter, setOrgFilter] = useState('all')
  const [busy, setBusy] = useState(null)
  const [moderateTarget, setModerateTarget] = useState(null)
  const [moderateAction, setModerateAction] = useState('reject')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  async function refresh() {
    const list = await listPlatformEvents()
    setEvents(list)
  }

  useEffect(() => {
    let cancelled = false
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load events.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const orgOptions = useMemo(() => {
    const set = new Set(events.filter((e) => e.source === 'organization').map((e) => e.orgName || e.orgEmail))
    return [...set].sort()
  }, [events])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (categoryFilter !== 'All' && e.category !== categoryFilter) return false
      if (orgFilter !== 'all' && (e.orgName || e.orgEmail) !== orgFilter) return false
      if (!q) return true
      return `${e.title} ${e.venue || ''}`.toLowerCase().includes(q)
    })
  }, [events, query, statusFilter, categoryFilter, orgFilter])

  async function handleApprove(e) {
    if (!window.confirm(`Approve "${e.title}" for publication?`)) return
    setBusy(e.eventId)
    setNotice('')
    setError('')
    try {
      await moderateOrgEvent(e.eventId, 'approve')
      await refresh()
      setNotice(`"${e.title}" is now published.`)
    } catch (err) {
      setError(err.message || 'Approval failed.')
    } finally {
      setBusy(null)
    }
  }

  function openModerate(e, action) {
    setModerateTarget(e)
    setModerateAction(action)
    setReason('')
    setReasonError('')
    setNotice('')
  }

  function submitModerate(ev) {
    ev.preventDefault()
    if (reason.trim().length < 3) {
      setReasonError('Give a short reason (min 3 characters); it is shown to the organization.')
      return
    }
    setReasonError('')
    const target = moderateTarget
    const action = moderateAction
    const label = action === 'reject' ? 'Reject' : 'Cancel'
    if (!window.confirm(`${label} "${target.title}"?`)) return
    setBusy(target.eventId)
    setNotice('')
    setError('')
    moderateOrgEvent(target.eventId, action, reason.trim())
      .then(() => refresh())
      .then(() => {
        setNotice(`"${target.title}" ${action === 'reject' ? 'rejected' : 'cancelled'}.`)
        setModerateTarget(null)
        setReason('')
      })
      .catch((err) => setError(err.message || 'Action failed.'))
      .finally(() => setBusy(null))
  }

  if (loading) return <div className="skeleton">Loading events…</div>

  return (
    <>
      <p className="muted org-sub">
        {events.length} events across the platform. Mock data — stored in this browser only.
      </p>
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="toolbar" role="search">
        <label className="visually-hidden" htmlFor="admin-events-search">Search events</label>
        <input
          id="admin-events-search"
          type="search"
          placeholder="Search title or venue…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="org-search"
        />
        <label htmlFor="admin-events-status">Status</label>
        <select id="admin-events-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {ORG_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
        <label htmlFor="admin-events-category">Category</label>
        <select id="admin-events-category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="All">All categories</option>
          {mockCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label htmlFor="admin-events-org">Organization</label>
        <select id="admin-events-org" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
          <option value="all">All organizers</option>
          <option value="UniVent">UniVent (system)</option>
          {orgOptions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="alert alert-empty">No events match your search or filters.</div>
      ) : (
        <div className="org-table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Event</th><th>Organizer</th><th>Date</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={`${e.source}-${e.eventId}`}>
                  <td>
                    {e.title}
                    <br />
                    <span className="muted">{e.category || '—'} · {e.venue || '—'}</span>
                    {e.moderationNote && <br />}
                    {e.moderationNote && <span className="muted">Note: {e.moderationNote}</span>}
                  </td>
                  <td>{e.source === 'system' ? 'UniVent (system)' : (e.orgName || e.orgEmail)}</td>
                  <td>{e.date}</td>
                  <td><OrgStatusBadge status={e.status} /></td>
                  <td className="org-actions">
                    {e.source === 'system' ? (
                      <span className="muted">System row</span>
                    ) : (
                      <>
                        {e.status === 'pending' && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy === e.eventId}
                            onClick={() => handleApprove(e)}
                          >
                            {busy === e.eventId ? 'Working…' : 'Approve'}
                          </button>
                        )}
                        {MODERATABLE.has(e.status) && (
                          <>
                            {e.status === 'pending' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={busy === e.eventId}
                                onClick={() => openModerate(e, 'reject')}
                              >
                                Reject
                              </button>
                            )}
                            {e.status === 'published' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={busy === e.eventId}
                                onClick={() => openModerate(e, 'cancel')}
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                        {!MODERATABLE.has(e.status) && (
                          <span className="muted">Closed</span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {moderateTarget && (
        <form
          className="detail"
          onSubmit={submitModerate}
          aria-label={`${moderateAction === 'reject' ? 'Reject' : 'Cancel'} ${moderateTarget.title}`}
        >
          <h3>{moderateAction === 'reject' ? 'Reject' : 'Cancel'} “{moderateTarget.title}”</h3>
          <p className="muted">A reason is required; it is shown to the organization as a moderation note.</p>
          <div className="field">
            <label htmlFor="admin-moderate-reason">Reason</label>
            <textarea
              id="admin-moderate-reason"
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Venue booking could not be verified"
            />
            {reasonError && <span className="field-error" role="alert">{reasonError}</span>}
          </div>
          <div className="org-form-actions">
            <button type="submit" className="btn" disabled={busy === moderateTarget.eventId}>
              {busy === moderateTarget.eventId ? 'Working…' : `Confirm ${moderateAction === 'reject' ? 'rejection' : 'cancellation'}`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setModerateTarget(null); setReason('') }}>
              Back
            </button>
          </div>
        </form>
      )}
    </>
  )
}
