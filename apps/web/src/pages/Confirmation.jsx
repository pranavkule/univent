import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEvent, getRegistration } from '../services/api.js'

export default function Confirmation() {
  const { id } = useParams()
  const [registration, setRegistration] = useState(null)
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getRegistration(id)
      .then(async (reg) => {
        if (cancelled) return
        setRegistration(reg)
        try {
          const evt = await getEvent(reg.eventId)
          if (!cancelled) setEvent(evt)
        } catch {
          if (!cancelled) setEvent(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the confirmation.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="container">
        <div className="skeleton">Loading confirmation…</div>
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

  return (
    <div className="container">
      <div className="alert alert-ok">Registration successful! (Mock confirmation — nothing was sent anywhere.)</div>
      <div className="detail">
        <h2>Confirmation</h2>
        <p>Your mock registration ID (show it at the venue):</p>
        <span className="reg-id">{registration.registrationId}</span>
        <div className="meta">
          <span>Name: {registration.name}</span>
          <span>Email: {registration.email}</span>
          <span>Event: {event ? event.title : registration.eventId}</span>
          {event && <span>{event.date} · {event.venue}</span>}
          <span>Status: {registration.status || 'Confirmed'}</span>
        </div>
        <p>
          <Link className="btn btn-secondary" to="/events">Browse more events</Link>{' '}
          <Link className="btn" to="/dashboard">My registrations</Link>
        </p>
      </div>
    </div>
  )
}
