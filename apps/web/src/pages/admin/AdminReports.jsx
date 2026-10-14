import { useEffect, useState } from 'react'
import OrgStatusBadge from '../../components/OrgStatusBadge.jsx'
import { getEventStatusDistribution, getRegistrationsByEvent, listRecentActivity } from '../../services/admin.js'

// Reports & Activity: platform summaries computed from available mock
// records. The mock backend has no audit-log API, so administrative actions
// themselves are not logged — that gap is stated, not fabricated.
export default function AdminReports() {
  const [byEvent, setByEvent] = useState([])
  const [dist, setDist] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getRegistrationsByEvent(), getEventStatusDistribution(), listRecentActivity(20)])
      .then(([rows, distribution, feed]) => {
        if (cancelled) return
        setByEvent(rows)
        setDist(distribution)
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
        Summaries from mock records only — not production analytics.
      </p>

      <section aria-labelledby="reports-by-event" className="org-section">
        <div className="org-section-head">
          <h3 id="reports-by-event">Registrations by event ({totalRegs} total)</h3>
        </div>
        {byEvent.length === 0 ? (
          <div className="alert alert-empty">No registrations in the mock records yet.</div>
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

      <section aria-labelledby="reports-status" className="org-section">
        <div className="org-section-head">
          <h3 id="reports-status">Event status distribution</h3>
        </div>
        {dist.length === 0 ? (
          <div className="alert alert-empty">No events in the mock records yet.</div>
        ) : (
          <div className="org-table-wrap">
            <table className="reg-table">
              <thead>
                <tr><th>Status</th><th>Events</th></tr>
              </thead>
              <tbody>
                {dist.map((d) => (
                  <tr key={d.status}>
                    <td><OrgStatusBadge status={d.status} /></td>
                    <td>{d.count}</td>
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
          Audit logging is not available in the mock backend, so administrative
          actions are not recorded. Below is recent platform activity derived
          from mock registration and event records.
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
