import { useEffect, useMemo, useState } from 'react'
import { listAdminUsers } from '../../services/admin.js'

// User management: directory of mock accounts with safe profile fields.
// Passwords, tokens, and credentials are never loaded or displayed.
// The mock backend has no account-status field, so suspend/reactivate is
// intentionally unavailable here (needs Cognito/backend support).
export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => listAdminUsers())
      .then((list) => {
        if (!cancelled) setUsers([...list].sort((a, b) => a.email.localeCompare(b.email)))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load users.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const roles = useMemo(() => {
    const set = new Set(users.map((u) => u.role || 'student'))
    return ['all', ...set]
  }, [users])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && (u.role || 'student') !== roleFilter) return false
      if (!q) return true
      return `${u.name} ${u.email}`.toLowerCase().includes(q)
    })
  }, [users, query, roleFilter])

  if (loading) return <div className="skeleton">Loading users…</div>
  if (error) return <div className="alert alert-error" role="alert">{error}</div>

  return (
    <>
      <p className="muted org-sub">
        {users.length} mock account{users.length === 1 ? '' : 's'}. Safe fields only — no passwords or tokens are stored here or displayed.
      </p>

      <div className="toolbar" role="search">
        <label className="visually-hidden" htmlFor="admin-users-search">Search users</label>
        <input
          id="admin-users-search"
          type="search"
          placeholder="Search name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="org-search"
        />
        <label htmlFor="admin-users-role">Role</label>
        <select id="admin-users-role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          {roles.map((r) => (
            <option key={r} value={r}>{r === 'all' ? 'All roles' : r}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="alert alert-empty">No users match your search or filter.</div>
      ) : (
        <div className="org-table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.email}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="badge">{u.role || 'student'}</span></td>
                  <td><span className="badge badge-ok">{u.status || 'Active'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">Suspending or reactivating accounts is not supported by the mock backend. It requires Cognito and a real user store.</p>
    </>
  )
}
