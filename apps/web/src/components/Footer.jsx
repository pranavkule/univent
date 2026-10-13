import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="brand" aria-label="UniVent home">
            <Logo className="logo-footer" />
          </Link>
          <p className="muted">
            A cloud computing mini-project for college event discovery and
            registration — React frontend, planned serverless AWS backend.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="footer-title">Explore</p>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/events">Explore Events</Link></li>
            <li><Link to="/dashboard">My Registrations</Link></li>
          </ul>
        </nav>
        <nav aria-label="Footer account">
          <p className="footer-title">Account</p>
          <ul>
            <li><Link to="/signin">Sign in</Link></li>
            <li><Link to="/signup">Sign up</Link></li>
          </ul>
        </nav>
      </div>
      <div className="container">
        <p className="mock-note">Phase 2 prototype — mock data and mock sign-in in this browser only. No backend, no real accounts.</p>
      </div>
    </footer>
  )
}
