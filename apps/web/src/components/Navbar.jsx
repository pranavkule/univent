import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import Logo from './Logo.jsx'

function linkClass({ isActive }) {
  return isActive ? 'nav-link active' : 'nav-link'
}

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    setOpen(false)
    navigate('/')
  }

  function close() {
    setOpen(false)
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand" onClick={close}>
          <Logo />
        </NavLink>
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
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={open ? 'nav-links nav-open' : 'nav-links'}
        >
          <NavLink to="/" end className={linkClass} onClick={close}>
            Home
          </NavLink>
          <NavLink to="/events" className={linkClass} onClick={close}>
            Explore Events
          </NavLink>
          <NavLink to="/dashboard" className={linkClass} onClick={close}>
            My Registrations
          </NavLink>
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
            <>
              <span className="user-chip" title={user.email}>{user.name}</span>
              <button type="button" className="btn btn-secondary btn-nav" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
