import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { listEvents, listRegistrations } from '../services/api.js'

// My Registrations: the signed-in student's own registrations only.
export default function StudentRegistrations() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    let cancelled = false
    Promise.all([listEvents(), listRegistrations()])
      .then(([evts, regs]) => {
        if (!cancelled) {
          setEvents(evts)
          setRegistrations(regs)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your registrations.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const mine = useMemo(() => {
    const email = (user?.email || '').toLowerCase()
    return registrations.filter((r) => r.email.toLowerCase() === email)
  }, [registrations, user])

  const statuses = useMemo(() => {
    const set = new Set(mine.map((r) => r.status || 'Confirmed'))
    return ['All', ...set]
  }, [mine])

  const filtered = useMemo(() => (
    statusFilter === 'All' ? mine : mine.filter((r) => (r.status || 'Confirmed') === statusFilter)
  ), [mine, statusFilter])

  const eventById = (eventId) => events.find((e) => e.eventId === eventId)

  if (loading) {
    return (
      <div className="container">
        <h2>My registrations</h2>
        <div className="skeleton">Loading your registrations…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <h2>My registrations</h2>
        <div className="alert alert-error" role="alert">{error}</div>
      </div>
    )
  }

  return (
    <div className="container">
      <h2>My registrations</h2>
      <p className="muted">
        Signed in as {user?.name} ({user?.email}).
      </p>
      {mine.length === 0 ? (
        <div className="alert alert-empty">
          You have not registered for any event yet.
          <div><Link className="btn" to="/events">Explore events</Link></div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <label htmlFor="regs-status-filter">Filter by status</label>
            <select
              id="regs-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>
              ))}
            </select>
          </div>
          {filtered.length === 0 ? (
            <div className="alert alert-empty">No registrations with this status.</div>
          ) : (
            <div className="org-table-wrap">
              <table className="reg-table">
                <thead>
                  <tr><th>Registration ID</th><th>Event</th><th>Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const evt = eventById(r.eventId)
                    return (
                      <tr key={r.registrationId}>
                        <td>{r.registrationId}</td>
                        <td>{evt ? <Link to={`/events/${evt.eventId}`}>{evt.title}</Link> : r.eventId}</td>
                        <td>{evt?.date || '—'}</td>
                        <td><span className="badge badge-ok">{r.status || 'Confirmed'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
