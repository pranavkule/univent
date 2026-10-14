import { Link } from 'react-router-dom'

function categoryClass(category) {
  return `event-art event-art-${(category || 'other').toLowerCase().replace(/[^a-z]/g, '')}`
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 14s5-4.6 5-8a5 5 0 1 0-10 0c0 3.4 5 8 5 8z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function SeatsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 13.5c.6-2.6 2.2-4 4-4s3.4 1.4 4 4M11 3.5a2 2 0 1 1 0 4M12 9.7c1.3.4 2.2 1.6 2.6 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function EventCard({ event, registered = false }) {
  return (
    <article className="event-card">
      <div className={categoryClass(event.category)} aria-hidden="true">
        <span className="event-art-letter">{(event.category || 'E').charAt(0)}</span>
        {event.category && <span className="badge badge-on-art">{event.category}</span>}
      </div>
      <div className="event-body">
        <h3>{event.title}</h3>
        {registered && <span className="badge badge-ok">Registered</span>}
        <p className="desc">{event.description}</p>
        <ul className="event-meta">
          <li><CalendarIcon /> {event.date}</li>
          <li><PinIcon /> {event.venue}</li>
          <li><SeatsIcon /> Capacity: {event.capacity} seats</li>
        </ul>
        <Link className="btn event-cta" to={`/events/${event.eventId}`}>
          View Details
        </Link>
      </div>
    </article>
  )
}
