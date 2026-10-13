import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { cancelRegistration, listEvents, listRegistrations } from '../services/api.js'

// Participant dashboard: only the signed-in user's own mock registrations.
// (Replaces the earlier organizer-wide prototype view; organizer tooling is
// out of Phase 2 scope — see phases.md.)
export default function Dashboard() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
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

  const eventById = (eventId) => events.find((e) => e.eventId === eventId)

  async function handleCancel(registrationId) {
    setCancelling(registrationId)
    setNotice('')
    try {
      await cancelRegistration(registrationId)
      setRegistrations((regs) => regs.filter((r) => r.registrationId !== registrationId))
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
      <p className="muted">Signed in as {user?.name} ({user?.email}). Mock data — stored in this browser only.</p>
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {mine.length === 0 ? (
        <div className="alert alert-empty">
          You have not registered for any event yet.
          <div><Link className="btn" to="/events">Explore events</Link></div>
        </div>
      ) : (
        <table className="reg-table">
          <thead>
            <tr><th>Registration ID</th><th>Event</th><th>Date</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {mine.map((r) => {
              const evt = eventById(r.eventId)
              return (
                <tr key={r.registrationId}>
                  <td>{r.registrationId}</td>
                  <td>{evt ? <Link to={`/events/${evt.eventId}`}>{evt.title}</Link> : r.eventId}</td>
                  <td>{evt?.date || '—'}</td>
                  <td><span className="badge badge-ok">{r.status || 'Confirmed'}</span></td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={cancelling === r.registrationId}
                      onClick={() => handleCancel(r.registrationId)}
                    >
                      {cancelling === r.registrationId ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
