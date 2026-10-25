import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import RegistrationForm from '../components/RegistrationForm.jsx'
import { createRegistration, getEvent, listRegistrations } from '../services/api.js'
import { getRemainingSeats } from '../services/eventAvailability.js'

// Registration form with pre-submit guards: full events, closed
// registration windows, and already-registered students see a message
// instead of the form. Duplicates are also rejected by the mock API (409).
export default function Register() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getEvent(id)
        if (cancelled) return
        setEvent(data)
        const regs = await listRegistrations(id)
        if (cancelled) return
        const email = (user?.email || '').toLowerCase()
        setExisting(regs.find((r) => r.email.toLowerCase() === email) || null)
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not load the event.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, user])

  async function handleSubmit(values) {
    setSubmitting(true)
    setServerError('')
    try {
      const registration = await createRegistration(values)
      navigate(`/confirmation/${registration.registrationId}`, { state: { registration } })
    } catch (err) {
      setServerError(err.message || 'Registration failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="skeleton">Loading…</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="container">
        <div className="alert alert-error" role="alert">{loadError}</div>
        <p><Link to="/events">← Back to events</Link></p>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const seatsLeft = getRemainingSeats(event)
  const closed = (event.regDeadline && event.regDeadline < today) || (event.date && event.date < today)

  return (
    <div className="container">
      <p><Link to={`/events/${event.eventId}`}>← Back to {event.title}</Link></p>
      <h2>Register for {event.title}</h2>
      <div className="meta">
        <span>{event.date} · {event.venue}</span>
      </div>
      {existing && (
        <div className="alert alert-ok" role="status">
          You are already registered for this event ({existing.registrationId}).
          <div><Link className="btn btn-secondary" to="/registrations">View my registrations</Link></div>
        </div>
      )}
      {!existing && seatsLeft === null && (
        <div className="alert alert-empty" role="status">
          Seat availability could not be confirmed. Registration is temporarily unavailable.
        </div>
      )}
      {!existing && seatsLeft !== null && seatsLeft <= 0 && (
        <div className="alert alert-empty" role="status">This event is full. Registration is closed.</div>
      )}
      {!existing && seatsLeft !== null && seatsLeft > 0 && closed && (
        <div className="alert alert-empty" role="status">Registration for this event has closed.</div>
      )}
      {!existing && seatsLeft !== null && seatsLeft > 0 && !closed && (
        <>
          <p className="muted">Registering as {user?.name} ({user?.email}). Your name is editable; the email is tied to your signed-in account.</p>
          <RegistrationForm
            eventId={event.eventId}
            onSubmit={handleSubmit}
            submitting={submitting}
            serverError={serverError}
            initialValues={{ name: user?.name || '', email: user?.email || '' }}
          />
        </>
      )}
    </div>
  )
}
