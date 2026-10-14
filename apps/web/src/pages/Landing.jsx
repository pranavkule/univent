import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import EventCard from '../components/EventCard.jsx'
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

function formatLongDate(iso) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.18" />
      <path d="M5.5 8.2l1.8 1.8 3.2-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DashboardPreview({ spotlight, schedule }) {
  if (!spotlight) return null
  const { day, mon } = formatShortDate(spotlight.date)
  const fill = Math.min(92, 38 + ((spotlight.capacity || 60) % 55))
  return (
    <div className="dash" aria-hidden="true">
      <div className="dash-glow" aria-hidden="true" />
      <div className="dash-topbar">
        <span className="dash-dots">
          <i /><i /><i />
        </span>
        <span className="dash-search">
          Search hackathons, workshops…
          <kbd>⌘K</kbd>
        </span>
        <span className="dash-live"><span className="pulse" />Live</span>
      </div>

      <div className="dash-body">
        <div className="dash-pills">
          <span className="dash-pill dash-pill-active">All</span>
          <span className="dash-pill">Technical</span>
          <span className="dash-pill">Cultural</span>
          <span className="dash-pill">Sports</span>
        </div>

        <div className="dash-spot">
          <div className="dash-spot-head">
            <span className="badge badge-grad">{spotlight.category}</span>
            <span className="dash-seats">{spotlight.capacity} seats</span>
          </div>
          <div className="dash-spot-main">
            <div className="dash-date">
              <span className="dash-day">{day}</span>
              <span className="dash-mon">{mon}</span>
            </div>
            <div>
              <p className="dash-spot-title">{spotlight.title}</p>
              <p className="dash-spot-meta">{spotlight.venue} · {formatLongDate(spotlight.date)}</p>
            </div>
          </div>
          <div className="dash-progress" aria-hidden="true"><span style={{ width: `${fill}%` }} /></div>
          <div className="dash-spot-foot">
            <span className="dash-register">Register <ArrowIcon /></span>
            <span className="dash-filling">{fill}% filled</span>
          </div>
        </div>

        <div className="dash-list">
          <p className="dash-list-title">Coming up next</p>
          <ul>
            {schedule.map((e) => {
              const s = formatShortDate(e.date)
              return (
                <li key={e.eventId}>
                  <span className="dash-mini-date">{s.day} <em>{s.mon}</em></span>
                  <span className="dash-mini-main">
                    <strong>{e.title}</strong>
                    <span>{e.venue}</span>
                  </span>
                  <span className="dash-mini-cat">{e.category}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="dash-toast">
        <CheckIcon />
        <span>Registration confirmed · instant ID</span>
      </div>

      <span className="dash-float dash-float-a">{spotlight.category} season</span>
      <span className="dash-float dash-float-b">Zero-fee mock checkout</span>
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

  const featured = useMemo(() => {
    const hacks = events.filter((e) =>
      /hack/i.test(`${e.title} ${e.description}`) || e.category === 'Technical',
    )
    const rest = events.filter((e) => !hacks.includes(e))
    return [...hacks, ...rest].slice(0, 2)
  }, [events])

  const upcoming = useMemo(() => events.slice(0, 3), [events])

  const categoryCounts = useMemo(() => {
    const map = {}
    for (const e of events) map[e.category] = (map[e.category] || 0) + 1
    return mockCategories.map((c) => ({ name: c, count: map[c] || 0 }))
  }, [events])

  return (
    <div className="landing">
      <section className="hero-premium">
        <div className="hero-bg" aria-hidden="true">
          <span className="orb orb-a" />
          <span className="orb orb-b" />
          <span className="grid-overlay" />
        </div>
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow eyebrow-glow">
              <span className="eyebrow-dot" aria-hidden="true" />
              {!loading && !error ? `${events.length} live events · Fall 2026` : 'Your campus, your community'}
            </p>
            <h1>
              Find your next <span className="grad-text">campus experience.</span>
            </h1>
            <p className="hero-sub">
              UniVent brings your college&apos;s workshops, hackathons, cultural
              events, talks, and competitions together in one premium feed —
              discover something worth showing up for and register in under a minute.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary-grad btn-lg" to="/events">
                Explore Events <ArrowIcon />
              </Link>
              {!user && <Link className="btn btn-ghost btn-lg" to="/signup">Create free account</Link>}
              {user && <Link className="btn btn-ghost btn-lg" to="/registrations">My Registrations</Link>}
            </div>
            <dl className="hero-stats" aria-live="polite">
              <div>
                <dt>Upcoming</dt>
                <dd>{loading ? '—' : `${events.length} events`}</dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>{mockCategories.length} tracks</dd>
              </div>
              <div>
                <dt>Checkout</dt>
                <dd>~60 sec + instant ID</dd>
              </div>
            </dl>
          </div>
          <div className="hero-preview">
            {loading && <div className="skeleton skeleton-dash">Loading live preview…</div>}
            {!loading && !error && events.length > 0 && (
              <DashboardPreview spotlight={events[0]} schedule={events.slice(1, 3)} />
            )}
            {!loading && error && <div className="alert alert-error" role="alert">{error}</div>}
          </div>
        </div>
      </section>

      <div className="container landing-sections">
        <section aria-labelledby="featured-heading" className="landing-block">
          <div className="block-head">
            <div>
              <p className="kicker">Featured hackathons</p>
              <h2 id="featured-heading">Build something this month</h2>
              <p className="block-sub">Hand-picked technical events with the highest demand on campus right now.</p>
            </div>
            <Link className="link-more" to="/events?category=Technical">View all technical <ArrowIcon /></Link>
          </div>
          <div className="feat-grid">
            {loading && <div className="skeleton">Loading featured…</div>}
            {!loading && featured.map((e, i) => {
              const s = formatShortDate(e.date)
              return (
                <article className="feat-card" key={e.eventId}>
                  <span className="feat-rank" aria-hidden="true">0{i + 1}</span>
                  <div className="feat-top">
                    <span className="badge badge-grad">{e.category}</span>
                    <span className="feat-date">{s.mon} {s.day} · {e.venue}</span>
                  </div>
                  <h3>{e.title}</h3>
                  <p className="desc">{e.description}</p>
                  <div className="feat-foot">
                    <span className="feat-cap">{e.capacity} seats · {formatLongDate(e.date)}</span>
                    <Link className="btn btn-small-grad" to={`/events/${e.eventId}`}>View details</Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="upcoming-heading" className="landing-block">
          <div className="block-head">
            <div>
              <p className="kicker">Upcoming events</p>
              <h2 id="upcoming-heading">Don&apos;t miss what&apos;s next</h2>
              <p className="block-sub">The nearest dates across every track — powered by live mock data.</p>
            </div>
            <Link className="link-more" to="/events">Browse all events <ArrowIcon /></Link>
          </div>
          {loading && <div className="skeleton">Loading events…</div>}
          {!loading && !error && (
            <div className="grid grid-3">
              {upcoming.map((e) => (
                <EventCard key={e.eventId} event={e} />
              ))}
            </div>
          )}
          {!loading && error && <div className="alert alert-error" role="alert">{error}</div>}
        </section>

        <section aria-labelledby="cats-heading" className="landing-block">
          <div className="block-head">
            <div>
              <p className="kicker">Event categories</p>
              <h2 id="cats-heading">Pick your lane</h2>
              <p className="block-sub">Four tracks, one feed. Jump straight into what you care about.</p>
            </div>
          </div>
          <div className="cat-grid">
            {categoryCounts.map((c) => (
              <Link key={c.name} className={`cat-card cat-${c.name.toLowerCase()}`} to={`/events?category=${encodeURIComponent(c.name)}`}>
                <span className={`tile-dot tile-dot-${c.name.toLowerCase()}`} aria-hidden="true" />
                <span className="cat-name">{c.name}</span>
                <span className="cat-count">{loading ? '…' : `${c.count} event${c.count === 1 ? '' : 's'}`}</span>
                <span className="cat-go">Explore <ArrowIcon /></span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-heading" id="how-it-works" className="landing-block">
          <p className="kicker">How UniVent works</p>
          <h2 id="how-heading">From discovery to venue in three steps</h2>
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

        <section aria-labelledby="why-heading" className="landing-block">
          <p className="kicker">Why UniVent</p>
          <h2 id="why-heading">Built for campus chaos</h2>
          <div className="steps">
            {WHY.map((s) => (
              <div className="card" key={s.title}>
                <h3>{s.title}</h3>
                <p className="desc">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-panel cta-premium" aria-labelledby="cta-heading">
          <div className="cta-glow" aria-hidden="true" />
          <p className="kicker kicker-center">Get started</p>
          <h2 id="cta-heading">Ready to find your event?</h2>
          <p>Browse what&apos;s on this month, or create a free mock account to register in minutes.</p>
          <div className="hero-actions hero-actions-center">
            <Link className="btn btn-primary-grad btn-lg" to="/events">Explore Upcoming Events</Link>
            {!user && <Link className="btn btn-ghost btn-lg" to="/signup">Create Account</Link>}
          </div>
        </section>
      </div>
    </div>
  )
}
