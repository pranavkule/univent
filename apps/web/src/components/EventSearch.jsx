import { mockCategories } from '../services/mockEvents.js'

// Reusable search + category filter. Controlled by the parent page so the
// landing discovery section and the Events page share one implementation.
export default function EventSearch({
  query,
  category,
  onQueryChange,
  onCategoryChange,
  idPrefix = 'event-search',
}) {
  const searchId = `${idPrefix}-input`
  return (
    <div className="filters">
      <div className="search-wrap">
        <label htmlFor={searchId} className="visually-hidden">Search events</label>
        <input
          id={searchId}
          type="search"
          placeholder="Search by title, venue, or keyword…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <div className="chips" role="group" aria-label="Filter by category">
        {['All', ...mockCategories].map((c) => (
          <button
            key={c}
            type="button"
            className={category === c ? 'chip chip-active' : 'chip'}
            aria-pressed={category === c}
            onClick={() => onCategoryChange(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}
