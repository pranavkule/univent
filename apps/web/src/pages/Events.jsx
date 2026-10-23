import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import EventList from '../components/EventList.jsx'
import EventSearch from '../components/EventSearch.jsx'
import { useAuth } from '../components/AuthProvider.jsx'
import { listEvents, listRegistrations } from '../services/api.js'
import { getRemainingSeats } from '../services/eventAvailability.js'
import { filterEvents, sortByDate } from '../services/eventFilter.js'
import { eventCategories as mockCategories } from '../services/eventCategories.js'
import {
  loadStudentRegistrationStatus,
  registrationStatusView,
} from '../services/registrationStatus.js'

function initialCategory(param) {
  return param && mockCategories.includes(param) ? param : 'All'
}

// Explore events with search, availability filters, date sorting, and
// optional per-event registration status for signed-in students.
export default function Events() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [myEventIds, setMyEventIds] = useState(new Set())
  const [registrationStatus, setRegistrationStatus] = useState('not-applicable')
  const [registrationStatusMessage, setRegistrationStatusMessage] = useState('')
  const [registrationRetry, setRegistrationRetry] = useState(0)
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
    async function load() {
      try {
        const evts = await listEvents()
        if (cancelled) return
        setEvents(sortByDate(evts))
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load events.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (user?.role !== 'student') {
      setMyEventIds(new Set())
      setRegistrationStatus('not-applicable')
      setRegistrationStatusMessage('')
      return () => {
        cancelled = true
      }
    }

    setMyEventIds(new Set())
    setRegistrationStatus('loading')
    setRegistrationStatusMessage('')
    loadStudentRegistrationStatus(listRegistrations, user.email).then((result) => {
      if (cancelled) return
      setMyEventIds(result.registeredEventIds)
      setRegistrationStatus(result.status)
      setRegistrationStatusMessage(result.message)
    })
    return () => {
      cancelled = true
    }
  }, [user, registrationRetry])

  const filtered = useMemo(() => {
    const base = filterEvents(events, { query, category })
    const withAvailability = base.filter((e) => {
      const seatsLeft = getRemainingSeats(e)
      if (availability === 'Available') return seatsLeft !== null && seatsLeft > 0
      if (availability === 'Full') return seatsLeft !== null && seatsLeft <= 0
      return true
    })
    const sorted = [...withAvailability].sort((a, b) => (
      sortDir === 'asc'
        ? String(a.date).localeCompare(String(b.date))
        : String(b.date).localeCompare(String(a.date))
    ))
    return sorted
  }, [events, query, category, availability, sortDir])

  const hasFilter = query.trim() !== '' || category !== 'All' || availability !== 'All'
  const registrationView = registrationStatusView(registrationStatus)

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
          {user?.role === 'student' && registrationView.isUnavailable && (
            <div className="alert alert-empty" role="status">
              {registrationStatusMessage} Your registration status could not be checked; event browsing is still available.
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRegistrationRetry((attempt) => attempt + 1)}
              >
                Retry status check
              </button>
            </div>
          )}
          {user?.role === 'student' && registrationView.isChecking && (
            <p className="muted" role="status">Checking your registration status…</p>
          )}
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
          <EventList
            events={filtered}
            registeredIds={registrationView.isKnown ? myEventIds : undefined}
          />
        </>
      )}
    </div>
  )
}
