import EventCard from './EventCard.jsx'

export default function EventList({ events }) {
  if (!events || events.length === 0) {
    return <div className="alert alert-empty">No events found. Check back later.</div>
  }
  return (
    <div className="grid">
      {events.map((event) => (
        <EventCard key={event.eventId} event={event} />
      ))}
    </div>
  )
}
