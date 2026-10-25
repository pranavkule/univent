import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrgStatusBadge from '../../components/OrgStatusBadge.jsx'
import { API_MODE } from '../../services/api.js'
import { getPlatformSummary, listRecentActivity } from '../../services/admin.js'
import { listAllOrgEvents } from '../../services/orgEvents.js'
import { listOrganizations } from '../../services/organizations.js'

// Admin overview: platform totals, pending approval queues, and recent
// activity derived from available mock records. Mock data only.
export default function AdminOverview() {
  const [summary, setSummary] = useState(null)
  const [pendingOrgs, setPendingOrgs] = useState([])
  const [pendingEvents, setPendingEvents] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getPlatformSummary(), listOrganizations(), listAllOrgEvents(), listRecentActivity()])
      .then(([sum, orgs, events, feed]) => {
        if (cancelled) return
        setSummary(sum)
        setPendingOrgs(orgs.filter((o) => o.approvalStatus === 'pending')
          .sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt))))
        setPendingEvents(events.filter((e) => e.status === 'pending')
          .sort((a, b) => String(a.date).localeCompare(String(b.date))))
        setActivity(feed)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the overview.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="skeleton">Loading platform overview…</div>
  if (error) return <div className="alert alert-error" role="alert">{error}</div>

  const cards = [
    { label: 'Total Users', value: summary.totalUsers },
    { label: 'Total Organizations', value: summary.totalOrganizations },
    { label: 'Pending Organization Approvals', value: summary.pendingOrgApprovals },
    { label: 'Pending Event Approvals', value: summary.pendingEventApprovals },
    { label: 'Total Events', value: summary.totalEvents },
    { label: 'Total Registrations', value: summary.totalRegistrations },
  ]

  return (
    <>
      <p className="muted org-sub">
        Platform health at a glance.{' '}
        {API_MODE === 'mock'
          ? 'Mock data — stored in this browser only.'
          : 'Organization applications, system events, and registrations load through the live API; some reports and the user directory remain demo data.'}
      </p>
      <div className="org-stats" role="list" aria-label="Platform summary">
        {cards.map((c) => (
          <div className="org-stat" role="listitem" key={c.label}>
            <span className="org-stat-value">{c.value}</span>
            <span className="org-stat-label">{c.label}</span>
          </div>
        ))}
      </div>

      <section aria-labelledby="admin-pending-orgs" className="org-section">
        <div className="org-section-head">
          <h3 id="admin-pending-orgs">Pending organization approvals</h3>
          <Link className="link-more" to="/admin/organizations">Manage organizations</Link>
        </div>
        {pendingOrgs.length === 0 ? (
          <div className="alert alert-empty">No organization applications awaiting review.</div>
        ) : (
          <div className="org-table-wrap">
            <table className="reg-table">
              <thead>
                <tr><th>Organization</th><th>Contact</th><th>Applied</th><th>Status</th></tr>
              </thead>
              <tbody>
                {pendingOrgs.slice(0, 5).map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{o.contactEmail}</td>
                    <td>{o.appliedAt ? o.appliedAt.slice(0, 10) : '—'}</td>
                    <td><OrgStatusBadge status={o.approvalStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="admin-pending-events" className="org-section">
        <div className="org-section-head">
          <h3 id="admin-pending-events">Pending event approvals</h3>
          <Link className="link-more" to="/admin/events">Manage events</Link>
        </div>
        {pendingEvents.length === 0 ? (
          <div className="alert alert-empty">No events awaiting approval.</div>
        ) : (
          <div className="org-table-wrap">
            <table className="reg-table">
              <thead>
                <tr><th>Event</th><th>Organization</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {pendingEvents.slice(0, 5).map((e) => (
                  <tr key={e.eventId}>
                    <td>{e.title}</td>
                    <td>{e.orgName || e.orgEmail}</td>
                    <td>{e.date}</td>
                    <td><OrgStatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="admin-activity" className="org-section">
        <div className="org-section-head">
          <h3 id="admin-activity">Recent platform activity</h3>
          <Link className="link-more" to="/admin/reports">Reports &amp; activity</Link>
        </div>
        {activity.length === 0 ? (
          <div className="alert alert-empty">No recent activity in the mock records.</div>
        ) : (
          <div className="org-table-wrap">
            <table className="reg-table">
              <thead>
                <tr><th>Activity</th><th>Date</th></tr>
              </thead>
              <tbody>
                {activity.slice(0, 5).map((a, i) => (
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
