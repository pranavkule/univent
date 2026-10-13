// Shared mock-data filtering used by both the Events page and the
// landing-page discovery section, so both views always agree.
export function filterEvents(events, { query = '', category = 'All' } = {}) {
  const q = query.trim().toLowerCase()
  return (events || []).filter((e) => {
    const matchesCategory = category === 'All' || e.category === category
    const matchesQuery =
      !q ||
      e.title.toLowerCase().includes(q) ||
      (e.venue || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    return matchesCategory && matchesQuery
  })
}

export function sortByDate(events) {
  return [...(events || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}
