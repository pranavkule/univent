import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

// Shell for the Organization workspace: sidebar navigation + top bar.
// Styling lives in the "Organization workspace" section of styles.css and
// reuses the project theme vars, so light/dark modes work without extras.
function icon(path) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICONS = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  events: icon('M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-7zM2 6.5h12M5.5 2.5v3M10.5 2.5v3'),
  create: icon('M8 3v10M3 8h10'),
  regs: icon('M5.5 5.2a2 2 0 1 0 0-.01M2 13.5c.5-2.4 1.9-3.7 3.5-3.7s3 1.3 3.5 3.7M11 4.5a1.8 1.8 0 1 1 0 3.6M11.8 10c1.1.4 1.9 1.4 2.2 2.9'),
  org: icon('M3 13.5V5.8L8 2.5l5 3.3v7.7M3 13.5h10M6.5 13.5v-3h3v3'),
  logout: icon('M9.5 3.5H3.5v9h6M6.5 8h7M11 5.5L13.5 8 11 10.5'),
}

const NAV = [
  { to: '/org', end: true, label: 'Dashboard', icon: ICONS.dashboard },
  { to: '/org/events', end: true, label: 'My Events', icon: ICONS.events },
  { to: '/org/events/new', label: 'Create Event', icon: ICONS.create },
  { to: '/org/registrations', label: 'Registrations', icon: ICONS.regs },
  { to: '/org/profile', label: 'Organization Profile', icon: ICONS.org },
]

const TITLES = {
  '/org': 'Dashboard',
  '/org/events': 'My Events',
  '/org/events/new': 'Create Event',
  '/org/registrations': 'Registrations',
  '/org/profile': 'Organization Profile',
}

function titleFor(pathname) {
  if (TITLES[pathname]) return TITLES[pathname]
  if (/^\/org\/events\/.+\/edit$/.test(pathname)) return 'Edit Event'
  if (/^\/org\/events\/.+$/.test(pathname)) return 'Event Details'
  return 'Organization'
}

export default function OrgLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="container org-shell">
      <aside className="org-side" aria-label="Organization">
        <nav aria-label="Organization sections">
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
          <h2 className="org-title">{titleFor(location.pathname)}</h2>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
