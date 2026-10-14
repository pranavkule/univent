import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../components/AuthProvider.jsx'
import { listOrgEvents, listOrgRegistrations } from '../../services/orgEvents.js'

// Registrations for this organization's events only. Rows from other
// organizations' events are never loaded here. Mock data only.
export default function OrgRegistrations() {
  const { user } = useAuth()
  const orgEmail = user?.email || ''
  const [events, setEvents] = useState([])
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eventFilter, setEventFilter] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listOrgEvents(orgEmail), listOrgRegistrations(orgEmail)])
      .then(([evts, rows]) => {
        if (cancelled) return
        setEvents([...evts].sort((a, b) => (a.title < b.title ? -1 : 1)))
        setRegs([...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load registrations.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgEmail])

  const eventById = useMemo(() => {
    const map = {}
    for (const e of events) map[e.eventId] = e
    return map
  }, [events])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return regs.filter((r) => {
      if (eventFilter !== 'all' && r.eventId !== eventFilter) return false
      if (!q) return true
      return `${r.name} ${r.email} ${r.registrationId}`.toLowerCase().includes(q)
    })
  }, [regs, eventFilter, query])

  if (loading) return <div className="skeleton">Loading registrations…</div>
  if (error) return <div className="alert alert-error" role="alert">{error}</div>

  return (
    <>
      <p className="muted org-sub">
        {regs.length} registration{regs.length === 1 ? '' : 's'} across your events. Mock data — stored in this browser only.
      </p>

      <div className="toolbar" role="search">
        <label className="visually-hidden" htmlFor="org-regs-event">Filter by event</label>
        <select id="org-regs-event" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="all">All my events</option>
          {events.map((e) => (
            <option key={e.eventId} value={e.eventId}>{e.title}</option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="org-regs-search">Search participants</label>
        <input
          id="org-regs-search"
          type="search"
          placeholder="Search name, email, or registration ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="org-search"
        />
      </div>

      {events.length === 0 ? (
        <div className="alert alert-empty">No events yet, so there are no registrations to show.</div>
      ) : filtered.length === 0 ? (
        <div className="alert alert-empty">No registrations match your event selection or search.</div>
      ) : (
        <div className="org-table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Participant</th><th>Registration ID</th><th>Event</th><th>Registered on</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.registrationId}>
                  <td>{r.name}<br /><span className="muted">{r.email}</span></td>
                  <td>{r.registrationId}</td>
                  <td>{eventById[r.eventId]?.title || r.eventId}</td>
                  <td>{new Date(r.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td><span className="badge badge-ok">{r.status || 'Confirmed'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
