import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import Logo from './Logo.jsx'
import ThemeToggle from './ThemeToggle.jsx'

function linkClass({ isActive }) {
  return isActive ? 'nav-link active' : 'nav-link'
}

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)

  async function handleSignOut() {
    await signOut()
    setOpen(false)
    setAccountOpen(false)
    navigate('/')
  }

  function close() {
    setOpen(false)
    setAccountOpen(false)
  }

  // Close the account menu on outside click / Escape.
  useEffect(() => {
    if (!accountOpen) return undefined
    function onPointerDown(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false)
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()
  const profilePath = user?.role === 'organization' ? '/org/profile' : '/profile'

  return (
    <header className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand" onClick={close}>
          <Logo />
        </NavLink>
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={open ? 'nav-links nav-open' : 'nav-links'}
        >
          {!user && (
            <NavLink to="/" end className={linkClass} onClick={close}>
              Home
            </NavLink>
          )}
          {user?.role === 'organization' ? (
            <NavLink to="/org" className={linkClass} onClick={close}>
              Organization
            </NavLink>
          ) : user?.role === 'admin' ? (
            <NavLink to="/admin" className={linkClass} onClick={close}>
              Admin
            </NavLink>
          ) : (
            <>
              {user && (
                <NavLink to="/dashboard" className={linkClass} onClick={close}>
                  Dashboard
                </NavLink>
              )}
              <NavLink to="/events" className={linkClass} onClick={close}>
                Explore Events
              </NavLink>
              {user && (
                <NavLink to="/registrations" className={linkClass} onClick={close}>
                  My Registrations
                </NavLink>
              )}
            </>
          )}
          {!user && (
            <NavLink to="/signin" className={linkClass} onClick={close}>
              Sign in
            </NavLink>
          )}
          {!user && (
            <NavLink to="/signup" className="btn btn-nav" onClick={close}>
              Sign up
            </NavLink>
          )}
          {user && (
            <div className="account-menu" ref={accountRef}>
              <button
                type="button"
                className="user-chip account-btn"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((o) => !o)}
                title={user.email}
              >
                <span className="account-avatar" aria-hidden="true">{initial}</span>
                <span className="account-name">{user.name}</span>
                <span className="account-caret" aria-hidden="true">{accountOpen ? '▴' : '▾'}</span>
              </button>
              {accountOpen && (
                <div className="account-pop" role="menu" aria-label="Account">
                  <p className="account-detail-name">{user.name}</p>
                  <p className="account-detail-email">{user.email}</p>
                  <span className="badge">{user.role || 'student'}</span>
                  {user.role !== 'admin' && (
                    <NavLink to={profilePath} className="btn btn-secondary btn-sm account-signout" role="menuitem" onClick={close}>
                      View profile
                    </NavLink>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm account-signout"
                    role="menuitem"
                    onClick={handleSignOut}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="nav-tools">
          <ThemeToggle />
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="primary-navigation"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
