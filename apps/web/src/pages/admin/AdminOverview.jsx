import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrgStatusBadge from '../../components/OrgStatusBadge.jsx'
import { getPlatformSummary, listRecentActivity } from '../../services/admin.js'
import { listOrganizations } from '../../services/organizations.js'

// Admin overview: platform totals, pending organization approvals, and recent
// activity loaded through the live API.
export default function AdminOverview() {
  const [summary, setSummary] = useState(null)
  const [pendingOrgs, setPendingOrgs] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getPlatformSummary(), listOrganizations(), listRecentActivity()])
      .then(([sum, orgs, feed]) => {
        if (cancelled) return
        setSummary(sum)
        setPendingOrgs(orgs.filter((o) =>
          ['pending', 'pending_verification', 'pending_approval'].includes(o.approvalStatus))
          .sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt))))
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
    { label: 'Total Organizations', value: summary.totalOrganizations },
    { label: 'Approved Organizations', value: summary.approvedOrganizations },
    { label: 'Pending Organization Applications', value: summary.pendingOrgApprovals },
    { label: 'Total Events', value: summary.totalEvents },
    { label: 'Total Registrations', value: summary.totalRegistrations },
  ]

  return (
    <>
      <p className="muted org-sub">
        Platform health at a glance. Organization applications, events, and registrations load through the live API.
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
          <h3 id="admin-pending-orgs">Organization applications awaiting review</h3>
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

      <section aria-labelledby="admin-activity" className="org-section">
        <div className="org-section-head">
          <h3 id="admin-activity">Recent platform activity</h3>
          <Link className="link-more" to="/admin/reports">Reports &amp; activity</Link>
        </div>
        {activity.length === 0 ? (
          <div className="alert alert-empty">No recent activity.</div>
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
