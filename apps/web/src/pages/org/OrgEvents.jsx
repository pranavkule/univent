import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../components/AuthProvider.jsx'
import OrgStatusBadge from '../../components/OrgStatusBadge.jsx'
import { ORG_STATUSES, cancelOrgEvent, countRegistrationsByEvent, listOrgEvents, listOrgRegistrations, submitOrgEventForApproval } from '../../services/orgEvents.js'
import { statusLabel } from '../../components/OrgStatusBadge.jsx'
import { API_MODE } from '../../services/api.js'

// My Events: the live API scopes events and registrations to the authenticated organization.
export default function OrgEvents() {
  const { user } = useAuth()
  const orgEmail = user?.email || ''
  const location = useLocation()
  const [events, setEvents] = useState([])
  const [regCountByEvent, setRegCountByEvent] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listOrgEvents(orgEmail), listOrgRegistrations(orgEmail)])
      .then(([evts, regs]) => {
        if (cancelled) return
        setEvents([...evts].sort((a, b) => (a.date < b.date ? -1 : 1)))
        setRegCountByEvent(countRegistrationsByEvent(regs))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load events.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgEmail])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (status !== 'all' && e.status !== status) return false
      if (!q) return true
      return `${e.title} ${e.venue}`.toLowerCase().includes(q)
    })
  }, [events, query, status])

  async function refresh() {
    const [evts, regs] = await Promise.all([listOrgEvents(orgEmail), listOrgRegistrations(orgEmail)])
    setEvents([...evts].sort((a, b) => (a.date < b.date ? -1 : 1)))
    setRegCountByEvent(countRegistrationsByEvent(regs))
  }

  async function handleSubmitForApproval(eventId) {
    setBusy(eventId)
    setNotice('')
    setError('')
    try {
      await submitOrgEventForApproval(orgEmail, eventId)
      await refresh()
      setNotice('Event submitted for admin approval. Demo only — status is stored in this browser, not in AWS.')
    } catch (err) {
      setError(err.message || 'Could not submit the event.')
    } finally {
      setBusy(null)
    }
  }

  async function handleCancel(eventId) {
    if (!window.confirm('Cancel this event? It will no longer accept registrations.')) return
    setBusy(eventId)
    setNotice('')
    setError('')
    try {
      await cancelOrgEvent(orgEmail, eventId)
      await refresh()
      setNotice('Event cancelled. Demo only — status is stored in this browser, not in AWS.')
    } catch (err) {
      setError(err.message || 'Could not cancel the event.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="skeleton">Loading your events…</div>

  return (
    <>
      <p className="muted org-sub">
        {events.length} event{events.length === 1 ? '' : 's'} owned by {user?.name}.{' '}
        {API_MODE === 'live' ? 'Changes are saved to AWS.' : 'Mock data — stored in this browser only.'}
      </p>
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="toolbar" role="search">
        <label className="visually-hidden" htmlFor="org-events-search">Search your events</label>
        <input
          id="org-events-search"
          type="search"
          placeholder="Search by name or venue…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="org-search"
        />
        {API_MODE === 'mock' && (
          <>
            <label className="visually-hidden" htmlFor="org-events-status">Filter by status</label>
            <select id="org-events-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {ORG_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </>
        )}
        <Link className="btn btn-sm" to="/org/events/new">Create Event</Link>
      </div>

      {events.length === 0 ? (
        <div className="alert alert-empty">
          No events yet. Create your first event to get started.
          <div><Link className="btn" to="/org/events/new">Create Event</Link></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="alert alert-empty">No events match your search or filter.</div>
      ) : (
        <div className="org-table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Event</th><th>Date</th><th>Capacity</th><th>Registrations</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.eventId}>
                  <td>{e.title}</td>
                  <td>{e.date}</td>
                  <td>{e.capacity}</td>
                  <td>{regCountByEvent[e.eventId] || 0}</td>
                  <td><OrgStatusBadge status={e.status} /></td>
                  <td className="org-actions">
                    {(API_MODE === 'live' || e.status === 'draft' || e.status === 'rejected' || e.status === 'pending') && (
                      <Link className="btn btn-secondary btn-sm" to={`/org/events/${e.eventId}/edit`}>Edit</Link>
                    )}
                    {API_MODE === 'mock' && e.status === 'published' && (
                      <Link className="btn btn-secondary btn-sm" to={`/org/events/${e.eventId}/edit`}>View</Link>
                    )}
                    {API_MODE === 'mock' && (e.status === 'draft' || e.status === 'rejected') && (
                      <button type="button" className="btn btn-sm" disabled={busy === e.eventId} onClick={() => handleSubmitForApproval(e.eventId)}>
                        {busy === e.eventId ? 'Submitting…' : 'Submit'}
                      </button>
                    )}
                    {API_MODE === 'mock' && (e.status === 'published' || e.status === 'pending') && (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy === e.eventId} onClick={() => handleCancel(e.eventId)}>
                        {busy === e.eventId ? 'Working…' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
