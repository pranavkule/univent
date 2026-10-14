import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import EventList from '../components/EventList.jsx'
import EventSearch from '../components/EventSearch.jsx'
import { useAuth } from '../components/AuthProvider.jsx'
import { listEvents, listRegistrations } from '../services/api.js'
import { filterEvents, sortByDate } from '../services/eventFilter.js'
import { mockCategories } from '../services/mockEvents.js'

function initialCategory(param) {
  return param && mockCategories.includes(param) ? param : 'All'
}

// Explore Events: published events with search, category + availability
// filters, date sorting, and per-event registration status for signed-in
// students. Mock data only — stored in this browser, not in AWS.
export default function Events() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [regCounts, setRegCounts] = useState({})
  const [myEventIds, setMyEventIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(() => initialCategory(searchParams.get('category')))
  const [availability, setAvailability] = useState('All')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    setCategory(initialCategory(searchParams.get('category')))
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    Promise.all([listEvents(), listRegistrations()])
      .then(([evts, regs]) => {
        if (cancelled) return
        setEvents(sortByDate(evts))
        const counts = {}
        for (const r of regs) counts[r.eventId] = (counts[r.eventId] || 0) + 1
        setRegCounts(counts)
        const email = (user?.email || '').toLowerCase()
        setMyEventIds(new Set(
          regs.filter((r) => r.email.toLowerCase() === email).map((r) => r.eventId),
        ))
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
  }, [user])

  const seatsLeft = (e) => (e.capacity || 0) - (regCounts[e.eventId] || 0)

  const filtered = useMemo(() => {
    const base = filterEvents(events, { query, category })
    const withAvailability = base.filter((e) => {
      if (availability === 'Available') return seatsLeft(e) > 0
      if (availability === 'Full') return seatsLeft(e) <= 0
      return true
    })
    const sorted = [...withAvailability].sort((a, b) => (
      sortDir === 'asc'
        ? String(a.date).localeCompare(String(b.date))
        : String(b.date).localeCompare(String(a.date))
    ))
    return sorted
  }, [events, query, category, availability, sortDir, regCounts])

  const hasFilter = query.trim() !== '' || category !== 'All' || availability !== 'All'

  function clearFilters() {
    setQuery('')
    setCategory('All')
    setAvailability('All')
  }

  return (
    <div className="container">
      <h2>Explore events</h2>
      <p className="muted">Workshops, hackathons, cultural events, talks, and competitions — all in one list.</p>

      {!loading && !error && events.length > 0 && (
        <>
          <EventSearch
            query={query}
            category={category}
            onQueryChange={setQuery}
            onCategoryChange={setCategory}
            idPrefix="events-search"
          />
          <div className="toolbar" aria-label="More event filters">
            <label htmlFor="events-availability">Availability</label>
            <select
              id="events-availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option value="All">All events</option>
              <option value="Available">Seats available</option>
              <option value="Full">Full</option>
            </select>
            <label htmlFor="events-sort">Sort by date</label>
            <select
              id="events-sort"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
            >
              <option value="asc">Soonest first</option>
              <option value="desc">Latest first</option>
            </select>
          </div>
        </>
      )}

      {loading && <div className="skeleton">Loading events…</div>}
      {!loading && error && <div className="alert alert-error" role="alert">{error}</div>}
      {!loading && !error && (
        <>
          <p className="muted" aria-live="polite">
            Showing {filtered.length} of {events.length} events.
          </p>
          {filtered.length === 0 && events.length > 0 && (
            <div className="alert alert-empty">
              No events match {hasFilter ? 'your search or filters. Try different keywords, categories, or availability.' : '— check back later.'}
              {hasFilter && (
                <div><button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button></div>
              )}
            </div>
          )}
          <EventList events={filtered} registeredIds={myEventIds} />
        </>
      )}
    </div>
  )
}
