import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import RegistrationForm from '../components/RegistrationForm.jsx'
import { createRegistration, getEvent } from '../services/api.js'

export default function Register() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    let cancelled = false
    getEvent(id)
      .then((data) => {
        if (!cancelled) setEvent(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load the event.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSubmit(values) {
    setSubmitting(true)
    setServerError('')
    try {
      const registration = await createRegistration(values)
      navigate(`/confirmation/${registration.registrationId}`)
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

  return (
    <div className="container">
      <p><Link to={`/events/${event.eventId}`}>← Back to {event.title}</Link></p>
      <h2>Register for {event.title}</h2>
      <div className="meta">
        <span>{event.date} · {event.venue}</span>
      </div>
      <p className="muted">Registering as {user?.name} ({user?.email}). Details are pre-filled but editable.</p>
      <RegistrationForm
        eventId={event.eventId}
        onSubmit={handleSubmit}
        submitting={submitting}
        serverError={serverError}
        initialValues={{ name: user?.name || '', email: user?.email || '' }}
      />
    </div>
  )
}
