// Restrained status indicator for org event lifecycle states and
// organization approval states. Flat tints (no gradients), shared across
// the Organization and Admin workspaces.
const LABELS = {
  draft: 'Draft',
  pending: 'Pending Approval',
  published: 'Published',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  approved: 'Approved',
  suspended: 'Suspended',
}

export function statusLabel(status) {
  return LABELS[status] || status
}

export default function OrgStatusBadge({ status }) {
  return (
    <span className={`status status-${status || 'draft'}`}>
      {statusLabel(status)}
    </span>
  )
}
