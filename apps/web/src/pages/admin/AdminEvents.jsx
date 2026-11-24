import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPlatformEvents } from '../../services/admin.js'
import { eventCategories } from '../../services/eventCategories.js'

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [orgFilter, setOrgFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    listPlatformEvents()
      .then((list) => {
        if (!cancelled) setEvents(list)
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

  const orgOptions = useMemo(
    () => [...new Set(events.map((event) => event.organizer || 'UniVent'))].sort(),
    [events],
  )

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    return events.filter((event) => {
      if (categoryFilter !== 'All' && event.category !== categoryFilter) return false
      if (orgFilter !== 'all' && (event.organizer || 'UniVent') !== orgFilter) return false
      return !text || `${event.title} ${event.venue || ''}`.toLowerCase().includes(text)
    })
  }, [events, query, categoryFilter, orgFilter])

  if (loading) return <div className="skeleton">Loading events…</div>

  return (
    <>
      <p className="muted org-sub">
        Events shown here are loaded from the API. Event moderation is not
        available in the backend.
        {' '}<Link className="link-more" to="/admin/events/new">Create event</Link>
      </p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="toolbar" role="search">
        <label className="visually-hidden" htmlFor="admin-events-search">Search events</label>
        <input
          id="admin-events-search"
          type="search"
          placeholder="Search title or venue…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="org-search"
        />
        <label htmlFor="admin-events-category">Category</label>
        <select id="admin-events-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="All">All categories</option>
          {eventCategories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <label htmlFor="admin-events-org">Organizer</label>
        <select id="admin-events-org" value={orgFilter} onChange={(event) => setOrgFilter(event.target.value)}>
          <option value="all">All organizers</option>
          {orgOptions.map((organizer) => (
            <option key={organizer} value={organizer}>{organizer}</option>
          ))}
        </select>
      </div>

      {!error && filtered.length === 0 ? (
        <div className="alert alert-empty">No events match your search or filters.</div>
      ) : !error && (
        <div className="org-table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Event</th><th>Organizer</th><th>Date</th><th>Category</th></tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr key={event.eventId}>
                  <td>
                    {event.title}
                    <br />
                    <span className="muted">{event.venue || '—'}</span>
                  </td>
                  <td>{event.organizer || 'UniVent'}</td>
                  <td>{event.date}</td>
                  <td>{event.category || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
