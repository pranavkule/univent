import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { getEvent } from '../services/api.js'

export default function EventDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getEvent(id)
      .then((data) => {
        if (!cancelled) setEvent(data)
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
  }, [id])

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

  return (
    <div className="container">
      <p><Link to="/events">← Back to events</Link></p>
      <div className="detail">
        {event.category && <span className="badge">{event.category}</span>}
        <h2>{event.title}</h2>
        <dl className="facts">
          <div><dt>Date</dt><dd>{event.date}</dd></div>
          <div><dt>Venue</dt><dd>{event.venue}</dd></div>
          <div><dt>Seats</dt><dd>{event.capacity}</dd></div>
        </dl>
        <h3>About this event</h3>
        <p>{event.description}</p>
        {user ? (
          <Link className="btn" to={`/events/${event.eventId}/register`}>Register now</Link>
        ) : (
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
      </div>
    </div>
  )
}
