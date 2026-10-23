import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { API_MODE, cancelRegistration, listEvents, listRegistrations } from '../services/api.js'

// My Registrations: the signed-in student's own registrations only.
// Cancellation is allowed for upcoming events and always asks first.
// Mock data only — stored in this browser, not in AWS.
function isUpcoming(date) {
  if (!date) return true
  return date >= new Date().toISOString().slice(0, 10)
}

export default function StudentRegistrations() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [cancelling, setCancelling] = useState(null)

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

  async function handleCancel(registration) {
    const evt = eventById(registration.eventId)
    const label = evt ? `"${evt.title}"` : registration.registrationId
    if (!window.confirm(`Cancel your registration for ${label}? This cannot be undone.`)) return
    setCancelling(registration.registrationId)
    setNotice('')
    try {
      await cancelRegistration(registration.registrationId)
      setRegistrations((regs) => regs.filter((r) => r.registrationId !== registration.registrationId))
      setNotice('Registration cancelled.')
    } catch (err) {
      setNotice(err.message || 'Could not cancel the registration.')
    } finally {
      setCancelling(null)
    }
  }

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
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
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
                  <tr><th>Registration ID</th><th>Event</th><th>Date</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const evt = eventById(r.eventId)
                    const allowed = isUpcoming(evt?.date)
                    return (
                      <tr key={r.registrationId}>
                        <td>{r.registrationId}</td>
                        <td>{evt ? <Link to={`/events/${evt.eventId}`}>{evt.title}</Link> : r.eventId}</td>
                        <td>{evt?.date || '—'}</td>
                        <td><span className="badge badge-ok">{r.status || 'Confirmed'}</span></td>
                        <td className="org-actions">
                          {API_MODE !== 'mock' ? (
                            <span className="muted">Not available</span>
                          ) : allowed ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={cancelling === r.registrationId}
                              onClick={() => handleCancel(r)}
                            >
                              {cancelling === r.registrationId ? 'Cancelling…' : 'Cancel'}
                            </button>
                          ) : (
                            <span className="muted">Completed</span>
                          )}
                        </td>
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
