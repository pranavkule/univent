import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import EventList from '../components/EventList.jsx'
import EventSearch from '../components/EventSearch.jsx'
import { listEvents } from '../services/api.js'
import { filterEvents, sortByDate } from '../services/eventFilter.js'
import { mockCategories } from '../services/mockEvents.js'

function initialCategory(param) {
  return param && mockCategories.includes(param) ? param : 'All'
}

export default function Events() {
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(() => initialCategory(searchParams.get('category')))

  useEffect(() => {
    setCategory(initialCategory(searchParams.get('category')))
  }, [searchParams])

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

  const filtered = useMemo(
    () => filterEvents(events, { query, category }),
    [events, query, category],
  )
  const hasFilter = query.trim() !== '' || category !== 'All'

  function clearFilters() {
    setQuery('')
    setCategory('All')
  }

  return (
    <div className="container">
      <h2>Explore events</h2>
      <p className="muted">Workshops, hackathons, cultural events, talks, and competitions — all in one list.</p>

      {!loading && !error && events.length > 0 && (
        <EventSearch
          query={query}
          category={category}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
          idPrefix="events-search"
        />
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
              No events match {hasFilter ? 'your search. Try a different keyword or category.' : '— check back later.'}
              {hasFilter && (
                <div><button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button></div>
              )}
            </div>
          )}
          <EventList events={filtered} />
        </>
      )}
    </div>
  )
}
