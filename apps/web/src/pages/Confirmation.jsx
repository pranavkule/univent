import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { API_MODE, getEvent, getRegistration } from '../services/api.js'

export default function Confirmation() {
  const { id } = useParams()
  const location = useLocation()
  const seeded = location.state?.registration || null
  const [registration, setRegistration] = useState(seeded)
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const reg = seeded || await getRegistration(id)
        if (cancelled) return
        setRegistration(reg)
        try {
          const evt = await getEvent(reg.eventId)
          if (!cancelled) setEvent(evt)
        } catch {
          if (!cancelled) setEvent(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the confirmation.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, seeded])

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
      <div className="alert alert-ok" role="status">
        Registration successful!
        {API_MODE === 'mock' && ' Demo only — this confirmation is stored in this browser, not in AWS.'}
      </div>
      <div className="detail">
        <h2>Confirmation</h2>
        <p>Your registration ID (show it at the venue):</p>
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
          <Link className="btn" to="/registrations">My registrations</Link>
        </p>
      </div>
    </div>
  )
}
