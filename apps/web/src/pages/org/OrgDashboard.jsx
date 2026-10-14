import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../components/AuthProvider.jsx'
import OrgStatusBadge from '../../components/OrgStatusBadge.jsx'
import { countRegistrationsByEvent, listOrgEvents, listOrgRegistrations } from '../../services/orgEvents.js'

// Organization overview: totals, pending work, and the most recent events.
// Mock data only — stored in this browser, not in AWS.
export default function OrgDashboard() {
  const { user } = useAuth()
  const orgEmail = user?.email || ''
  const [events, setEvents] = useState([])
  const [regCountByEvent, setRegCountByEvent] = useState({})
  const [totalRegs, setTotalRegs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listOrgEvents(orgEmail), listOrgRegistrations(orgEmail)])
      .then(([evts, regs]) => {
        if (cancelled) return
        setEvents([...evts].sort((a, b) => (a.date < b.date ? 1 : -1)))
        setRegCountByEvent(countRegistrationsByEvent(regs))
        setTotalRegs(regs.length)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgEmail])

  const stats = useMemo(() => ({
    total: events.length,
    published: events.filter((e) => e.status === 'published').length,
    pending: events.filter((e) => e.status === 'pending').length,
  }), [events])

  if (loading) {
    return (
      <>
        <div className="skeleton">Loading organization dashboard…</div>
      </>
    )
  }

  if (error) {
    return <div className="alert alert-error" role="alert">{error}</div>
  }

  return (
    <>
      <p className="muted org-sub">
        Welcome, {user?.name}. Overview of your events and registrations. Mock data — stored in this browser only.
      </p>
      <div className="org-stats" role="list" aria-label="Organization summary">
        <div className="org-stat" role="listitem">
          <span className="org-stat-value">{stats.total}</span>
          <span className="org-stat-label">Total Events</span>
        </div>
        <div className="org-stat" role="listitem">
          <span className="org-stat-value">{stats.published}</span>
          <span className="org-stat-label">Published Events</span>
        </div>
        <div className="org-stat" role="listitem">
          <span className="org-stat-value">{stats.pending}</span>
          <span className="org-stat-label">Pending Approvals</span>
        </div>
        <div className="org-stat" role="listitem">
          <span className="org-stat-value">{totalRegs}</span>
          <span className="org-stat-label">Total Registrations</span>
        </div>
      </div>

      <section aria-labelledby="org-recent-heading" className="org-section">
        <div className="org-section-head">
          <h3 id="org-recent-heading">Recent events</h3>
          <Link className="link-more" to="/org/events">View all</Link>
        </div>
        {events.length === 0 ? (
          <div className="alert alert-empty">
            No events yet. Create your first event to get started.
            <div><Link className="btn" to="/org/events/new">Create Event</Link></div>
          </div>
        ) : (
          <div className="org-table-wrap">
            <table className="reg-table">
              <colgroup>
                <col />
                <col className="org-col-date" />
                <col className="org-col-regs" />
                <col className="org-col-status" />
                <col className="org-col-action" />
              </colgroup>
              <thead>
                <tr><th>Event</th><th>Date</th><th>Registrations</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {events.slice(0, 5).map((e) => (
                  <tr key={e.eventId}>
                    <td>{e.title}</td>
                    <td>{e.date}</td>
                    <td>{regCountByEvent[e.eventId] || 0} / {e.capacity}</td>
                    <td><OrgStatusBadge status={e.status} /></td>
                    <td className="org-actions">
                      <Link className="btn btn-secondary btn-sm" to={`/org/events/${e.eventId}/edit`}>Manage</Link>
                    </td>
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
