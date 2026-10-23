import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

// Shell for the Admin workspace: sidebar navigation + top bar.
// Reuses the workspace layout classes from styles.css (shared with the
// Organization workspace) so both stay visually consistent in all themes.
function icon(path) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICONS = {
  overview: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  orgs: icon('M3 13.5V5.8L8 2.5l5 3.3v7.7M3 13.5h10M6.5 13.5v-3h3v3'),
  events: icon('M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-7zM2 6.5h12M5.5 2.5v3M10.5 2.5v3'),
  users: icon('M5.5 5.2a2 2 0 1 0 0-.01M2 13.5c.5-2.4 1.9-3.7 3.5-3.7s3 1.3 3.5 3.7M11 4.5a1.8 1.8 0 1 1 0 3.6M11.8 10c1.1.4 1.9 1.4 2.2 2.9'),
  reports: icon('M2.5 13.5h11M4.5 11V7.5M8 11V4.5M11.5 11V6.5'),
  logout: icon('M9.5 3.5H3.5v9h6M6.5 8h7M11 5.5L13.5 8 11 10.5'),
}

const NAV = [
  { to: '/admin', end: true, label: 'Overview', icon: ICONS.overview },
  { to: '/admin/organizations', end: true, label: 'Organizations', icon: ICONS.orgs },
  { to: '/admin/events', end: true, label: 'Events', icon: ICONS.events },
  { to: '/admin/users', end: true, label: 'Users', icon: ICONS.users },
  { to: '/admin/reports', end: true, label: 'Reports & Activity', icon: ICONS.reports },
]

const TITLES = {
  '/admin': 'Overview',
  '/admin/organizations': 'Organizations',
  '/admin/events': 'Events',
  '/admin/events/new': 'Create Event',
  '/admin/users': 'Users',
  '/admin/reports': 'Reports & Activity',
}

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="container org-shell">
      <aside className="org-side" aria-label="Administration">
        <nav aria-label="Administration sections">
          <ul className="org-nav">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'org-nav-link active' : 'org-nav-link')}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="org-nav-link org-logout" onClick={handleLogout}>
          {ICONS.logout}
          <span>Logout</span>
        </button>
      </aside>
      <div className="org-main">
        <div className="org-topbar">
          <h2 className="org-title">{TITLES[location.pathname] || 'Administration'}</h2>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
