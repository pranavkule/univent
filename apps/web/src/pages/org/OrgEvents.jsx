import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../components/AuthProvider.jsx'
import OrgStatusBadge from '../../components/OrgStatusBadge.jsx'
import { countRegistrationsByEvent, listOrgEvents, listOrgRegistrations } from '../../services/orgEvents.js'

// My Events: the live API scopes events and registrations to the authenticated organization.
export default function OrgEvents() {
  const { user } = useAuth()
  const orgEmail = user?.email || ''
  const location = useLocation()
  const [events, setEvents] = useState([])
  const [regCountByEvent, setRegCountByEvent] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice] = useState(location.state?.notice || '')
  const [query, setQuery] = useState('')

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
      if (!q) return true
      return `${e.title} ${e.venue}`.toLowerCase().includes(q)
    })
  }, [events, query])

  if (loading) return <div className="skeleton">Loading your events…</div>

  return (
    <>
      <p className="muted org-sub">
        {events.length} event{events.length === 1 ? '' : 's'} owned by {user?.name}. Changes are saved to AWS.
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
        <Link className="btn btn-sm" to="/org/events/new">Create Event</Link>
      </div>

      {events.length === 0 ? (
        <div className="alert alert-empty">
          No events yet. Create your first event to get started.
          <div><Link className="btn" to="/org/events/new">Create Event</Link></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="alert alert-empty">No events match your search.</div>
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
                    <Link className="btn btn-secondary btn-sm" to={`/org/events/${e.eventId}/edit`}>Edit</Link>
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
