import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { getEvent, listRegistrations } from '../services/api.js'
import { getRemainingSeats } from '../services/eventAvailability.js'
import {
  loadStudentRegistrationStatus,
  registrationStatusView,
} from '../services/registrationStatus.js'

// Event Details: full schedule, organizer, deadline, and seat availability,
// with a Register action that respects full / closed / already-registered
// states. Duplicate registrations are also rejected by the API (409).
export default function EventDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [myRegistration, setMyRegistration] = useState(null)
  const [registrationStatus, setRegistrationStatus] = useState('not-applicable')
  const [registrationStatusMessage, setRegistrationStatusMessage] = useState('')
  const [registrationRetry, setRegistrationRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await getEvent(id)
        if (cancelled) return
        setEvent(data)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the event.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    if (user?.role !== 'student') {
      setMyRegistration(null)
      setRegistrationStatus('not-applicable')
      setRegistrationStatusMessage('')
      return () => {
        cancelled = true
      }
    }

    setMyRegistration(null)
    setRegistrationStatus('loading')
    setRegistrationStatusMessage('')
    loadStudentRegistrationStatus(listRegistrations, user.email, id).then((result) => {
      if (cancelled) return
      setMyRegistration(result.registration)
      setRegistrationStatus(result.status)
      setRegistrationStatusMessage(result.message)
    })
    return () => {
      cancelled = true
    }
  }, [id, user, registrationRetry])

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

  const isStudent = user?.role === 'student'
  const today = new Date().toISOString().slice(0, 10)
  const seatsLeft = getRemainingSeats(event)
  const deadlinePassed = Boolean(event.regDeadline) && event.regDeadline < today
  const eventPassed = Boolean(event.date) && event.date < today
  const closed = deadlinePassed || eventPassed
  const full = seatsLeft !== null && seatsLeft <= 0
  const registrationView = registrationStatusView(registrationStatus, myRegistration)
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
            <dd>
              {seatsLeft === null
                ? 'Availability unavailable'
                : `${seatsLeft} of ${event.capacity} available`}
            </dd>
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
        {user && !isStudent && (
          <div className="alert alert-empty" role="status">Only student accounts can register for events.</div>
        )}
        {isStudent && registrationView.isChecking && (
          <p className="muted" role="status">Checking your registration status…</p>
        )}
        {isStudent && registrationView.isUnavailable && (
          <div className="alert alert-empty" role="status">
            {registrationStatusMessage} Event details remain available, but registration status could not be checked.
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRegistrationRetry((attempt) => attempt + 1)}
            >
              Retry status check
            </button>
          </div>
        )}
        {isStudent && seatsLeft === null && (
          <div className="alert alert-empty" role="status">
            Seat availability could not be confirmed. Registration is temporarily unavailable.
          </div>
        )}
        {isStudent && registrationView.isRegistered && (
          <div className="alert alert-ok" role="status">
            You are registered for this event ({myRegistration.registrationId}).
            <div><Link className="btn btn-secondary" to="/registrations">View my registrations</Link></div>
          </div>
        )}
        {isStudent && registrationView.canOfferRegistration && seatsLeft !== null && full && (
          <div className="alert alert-empty" role="status">This event is full. Registration is closed.</div>
        )}
        {isStudent && registrationView.canOfferRegistration && seatsLeft !== null && !full && closed && (
          <div className="alert alert-empty" role="status">Registration for this event has closed.</div>
        )}
        {isStudent && registrationView.canOfferRegistration && seatsLeft !== null && !full && !closed && (
          <Link className="btn" to={`/events/${event.eventId}/register`}>Register now</Link>
        )}
      </div>
    </div>
  )
}
