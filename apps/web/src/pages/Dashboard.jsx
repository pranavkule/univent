import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import EventCard from '../components/EventCard.jsx'
import { listEvents, listRegistrations } from '../services/api.js'
import { sortByDate } from '../services/eventFilter.js'

// Student Dashboard: welcome, summary cards, upcoming events, quick links.
// Registrations live under My Registrations (/registrations).
// Mock data only — stored in this browser, not in AWS.
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Dashboard() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listEvents(), listRegistrations()])
      .then(([evts, regs]) => {
        if (!cancelled) {
          setEvents(sortByDate(evts))
          setRegistrations(regs)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your dashboard.')
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

  const upcoming = useMemo(() => {
    const today = todayStr()
    return events.filter((e) => (e.date || '') >= today)
  }, [events])

  const attended = useMemo(() => {
    const today = todayStr()
    const pastIds = new Set(events.filter((e) => (e.date || '') < today).map((e) => e.eventId))
    return mine.filter((r) => pastIds.has(r.eventId))
  }, [mine, events])

  if (loading) {
    return (
      <div className="container">
        <h2>Student dashboard</h2>
        <div className="skeleton">Loading your dashboard…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <h2>Student dashboard</h2>
        <div className="alert alert-error" role="alert">{error}</div>
      </div>
    )
  }

  return (
    <div className="container">
      <h2>Welcome back, {user?.name || 'student'}.</h2>
      <p className="muted">Here is what is happening on campus. Mock data — stored in this browser only.</p>

      <div className="org-stats" role="list" aria-label="Student summary">
        <div className="org-stat" role="listitem">
          <span className="org-stat-value">{upcoming.length}</span>
          <span className="org-stat-label">Upcoming Events</span>
        </div>
        <div className="org-stat" role="listitem">
          <span className="org-stat-value">{mine.length}</span>
          <span className="org-stat-label">My Registrations</span>
        </div>
        <div className="org-stat" role="listitem">
          <span className="org-stat-value">{attended.length}</span>
          <span className="org-stat-label">Attended Events</span>
        </div>
      </div>

      <section aria-labelledby="upcoming-heading" className="org-section">
        <div className="org-section-head">
          <h3 id="upcoming-heading">Upcoming events</h3>
          <Link className="link-more" to="/events">View all events</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="alert alert-empty">No upcoming events right now. Check back later.</div>
        ) : (
          <div className="grid grid-3">
            {upcoming.slice(0, 3).map((e) => (
              <EventCard key={e.eventId} event={e} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="quick-links-heading" className="org-section">
        <div className="org-section-head">
          <h3 id="quick-links-heading">Quick links</h3>
        </div>
        <div className="hero-actions">
          <Link className="btn" to="/events">Explore Events</Link>
          <Link className="btn btn-secondary" to="/registrations">My Registrations</Link>
        </div>
      </section>
    </div>
  )
}
