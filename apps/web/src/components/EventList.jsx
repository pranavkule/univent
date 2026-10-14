import EventCard from './EventCard.jsx'

// `registeredIds` is an optional Set of eventIds the signed-in student has
// already registered for. Callers that omit it get plain cards (unchanged).
export default function EventList({ events, registeredIds }) {
  if (!events || events.length === 0) {
    return <div className="alert alert-empty">No events found. Check back later.</div>
  }
  return (
    <div className="grid">
      {events.map((event) => (
        <EventCard
          key={event.eventId}
          event={event}
          registered={Boolean(registeredIds && registeredIds.has(event.eventId))}
        />
      ))}
    </div>
  )
}
