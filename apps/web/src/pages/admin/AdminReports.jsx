import { useEffect, useState } from 'react'
import { getRegistrationsByEvent, listRecentActivity } from '../../services/admin.js'

// Reports & Activity are derived from API records. The API has no audit-log
// endpoint, so administrative actions themselves are not recorded.
export default function AdminReports() {
  const [byEvent, setByEvent] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getRegistrationsByEvent(), listRecentActivity(20)])
      .then(([rows, feed]) => {
        if (cancelled) return
        setByEvent(rows)
        setActivity(feed)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load reports.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="skeleton">Loading reports…</div>
  if (error) return <div className="alert alert-error" role="alert">{error}</div>

  const totalRegs = byEvent.reduce((sum, r) => sum + r.count, 0)

  return (
    <>
      <p className="muted org-sub">
        Summaries derived from events and registrations available through the API.
      </p>

      <section aria-labelledby="reports-by-event" className="org-section">
        <div className="org-section-head">
          <h3 id="reports-by-event">Registrations by event ({totalRegs} total)</h3>
        </div>
        {byEvent.length === 0 ? (
          <div className="alert alert-empty">No registrations are available from the API.</div>
        ) : (
          <div className="org-table-wrap">
            <table className="reg-table">
              <thead>
                <tr><th>Event</th><th>Registrations</th></tr>
              </thead>
              <tbody>
                {byEvent.map((r) => (
                  <tr key={r.eventId}>
                    <td>{r.title}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="reports-activity" className="org-section">
        <div className="org-section-head">
          <h3 id="reports-activity">Activity log</h3>
        </div>
        <div className="alert alert-empty">
          The API does not provide an audit log, so administrative actions are
          not recorded. The activity below is derived from registration and
          event records.
        </div>
        {activity.length > 0 && (
          <div className="org-table-wrap">
            <table className="reg-table">
              <thead>
                <tr><th>Activity</th><th>Date</th></tr>
              </thead>
              <tbody>
                {activity.map((a, i) => (
                  <tr key={`${a.kind}-${i}`}>
                    <td>{a.text}</td>
                    <td>{a.at ? String(a.at).slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
