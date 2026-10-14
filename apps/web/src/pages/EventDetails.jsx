import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { getEvent, listRegistrations } from '../services/api.js'

// Event Details: full schedule, organizer, deadline, and seat availability,
// with a Register action that respects full / closed / already-registered
// states. Duplicate registrations are also rejected by the mock API (409).
export default function EventDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [regCount, setRegCount] = useState(0)
  const [myRegistration, setMyRegistration] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getEvent(id), listRegistrations(id)])
      .then(([data, regs]) => {
        if (cancelled) return
        setEvent(data)
        setRegCount(regs.length)
        const email = (user?.email || '').toLowerCase()
        setMyRegistration(regs.find((r) => r.email.toLowerCase() === email) || null)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the event.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, user])

  if (loading) {
    return (
      <div className="container">
        <div className="skeleton">Loading event…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error" role="alert">{error}</div>
        <p><Link to="/events">← Back to events</Link></p>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const seatsLeft = Math.max(0, (event.capacity || 0) - regCount)
  const deadlinePassed = Boolean(event.regDeadline) && event.regDeadline < today
  const eventPassed = Boolean(event.date) && event.date < today
  const closed = deadlinePassed || eventPassed
  const full = seatsLeft <= 0
  const schedule = event.startTime
    ? `${event.date} · ${event.startTime}${event.endTime ? `–${event.endTime}` : ''}`
    : event.date

  return (
    <div className="container">
      <p><Link to="/events">← Back to events</Link></p>
      <div className="detail">
        {event.category && <span className="badge">{event.category}</span>}
        <h2>{event.title}</h2>
        <dl className="facts">
          <div><dt>Organizer</dt><dd>{event.organizer || '—'}</dd></div>
          <div><dt>Schedule</dt><dd>{schedule}</dd></div>
          <div><dt>Venue</dt><dd>{event.venue}</dd></div>
          <div><dt>Deadline</dt><dd>{event.regDeadline || '—'}</dd></div>
          <div>
            <dt>Seats</dt>
            <dd>{seatsLeft} of {event.capacity} available</dd>
          </div>
        </dl>
        <h3>About this event</h3>
        <p>{event.description}</p>
        {!user && (
          <div>
            <p className="muted">Sign in to register for this event.</p>
            <Link
              className="btn"
              to="/signin"
              state={{ from: `/events/${event.eventId}/register` }}
            >
              Sign in to register
            </Link>
          </div>
        )}
        {user && myRegistration && (
          <div className="alert alert-ok" role="status">
            You are registered for this event ({myRegistration.registrationId}).
            <div><Link className="btn btn-secondary" to="/registrations">View my registrations</Link></div>
          </div>
        )}
        {user && !myRegistration && full && (
          <div className="alert alert-empty" role="status">This event is full. Registration is closed.</div>
        )}
        {user && !myRegistration && !full && closed && (
          <div className="alert alert-empty" role="status">Registration for this event has closed.</div>
        )}
        {user && !myRegistration && !full && !closed && (
          <Link className="btn" to={`/events/${event.eventId}/register`}>Register now</Link>
        )}
      </div>
    </div>
  )
}
