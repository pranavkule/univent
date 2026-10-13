import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { listEvents } from '../services/api.js'
import { sortByDate } from '../services/eventFilter.js'
import { mockCategories } from '../services/mockEvents.js'

const STEPS = [
  { title: 'Discover an event', text: 'Browse workshops, hackathons, cultural events, talks, and competitions happening on campus.' },
  { title: 'Register online', text: 'Sign in, pick an event, and register in under a minute with an instant confirmation.' },
  { title: 'Track your registration', text: 'Find your mock registration ID anytime under My Registrations and show it at the venue.' },
]

const WHY = [
  { title: 'One place for everything', text: 'No more chasing notice boards or scattered group messages — upcoming campus events live in a single list.' },
  { title: 'Registration in minutes', text: 'A short form, instant confirmation, and a registration ID you can pull up whenever you need it.' },
  { title: 'Organized event info', text: 'Every event shows its date, venue, category, and capacity up front, so you know what to expect.' },
]

function formatShortDate(iso) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return { day: '–', mon: '' }
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: d.toLocaleString('en', { month: 'short' }),
  }
}

function HeroVisual({ spotlight, schedule }) {
  if (!spotlight) return null
  const { day, mon } = formatShortDate(spotlight.date)
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-card">
        <div className="hero-card-date">
          <span className="hero-card-day">{day}</span>
          <span className="hero-card-mon">{mon}</span>
        </div>
        <div>
          <span className="badge">{spotlight.category}</span>
          <p className="hero-card-title">{spotlight.title}</p>
          <p className="hero-card-venue">{spotlight.venue} · Capacity {spotlight.capacity}</p>
        </div>
      </div>
      <div className="hero-chip hero-chip-a">{spotlight.category}</div>
      <div className="hero-chip hero-chip-b">Instant confirmation</div>
      <div className="hero-schedule">
        <p className="hero-schedule-title">Coming up</p>
        <ul>
          {schedule.map((e) => (
            <li key={e.eventId}>
              <span>{e.title}</span>
              <span className="muted">{e.date}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listEvents()
      .then((data) => {
        if (!cancelled) setEvents(sortByDate(data))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load events.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Your campus, your community</p>
            <h1>Find Your Next Campus Experience.</h1>
            <p className="hero-sub">
              UniVent brings your college&apos;s workshops, hackathons, cultural
              events, talks, and competitions together in one place — so you can
              discover something worth showing up for and register online.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-lg" to="/events">Explore Events</Link>
              {!user && <Link className="btn btn-secondary btn-lg" to="/signup">Sign Up</Link>}
              {user && <Link className="btn btn-secondary btn-lg" to="/dashboard">My Registrations</Link>}
            </div>
            <p className="hero-note" aria-live="polite">
              {!loading && !error && `${events.length} upcoming events · ${mockCategories.length} categories`}
            </p>
          </div>
          <div>
            {loading && <div className="skeleton">Loading preview…</div>}
            {!loading && !error && <HeroVisual spotlight={events[0]} schedule={events.slice(1, 4)} />}
            {!loading && error && <div className="alert alert-error" role="alert">{error}</div>}
          </div>
        </div>
      </section>

      <div className="container">
        <section aria-labelledby="how-heading" id="how-it-works">
          <h2 id="how-heading">How UniVent works</h2>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="card step-card" key={s.title}>
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p className="desc">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="why-heading">
          <h2 id="why-heading">Why UniVent</h2>
          <div className="steps">
            {WHY.map((s) => (
              <div className="card" key={s.title}>
                <h3>{s.title}</h3>
                <p className="desc">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-panel" aria-labelledby="cta-heading">
          <h2 id="cta-heading">Ready to find your event?</h2>
          <p>Browse what&apos;s on this month, or create a free mock account to register in minutes.</p>
          <div className="hero-actions">
            <Link className="btn btn-lg" to="/events">Explore Upcoming Events</Link>
            {!user && <Link className="btn btn-secondary btn-lg" to="/signup">Create Account</Link>}
          </div>
        </section>
      </div>
    </div>
  )
}
