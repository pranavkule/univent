// DEV-ONLY demo panel — frontend mock testing, NOT production auth.
// SignIn renders this only when VITE_AUTH_MODE=mock, so it is never shown in
// a Cognito/production build.
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../services/auth.js'

export default function DemoAccounts({ onUse }) {
  return (
    <aside className="demo-panel" aria-labelledby="demo-accounts-heading">
      <p className="demo-eyebrow">Frontend testing only</p>
      <h3 id="demo-accounts-heading">Demo Accounts</h3>
      <p className="demo-note">
        Mock logins only — password <code>{DEMO_PASSWORD}</code> for all three.
        Insecure by design; never real credentials.
      </p>
      <ul className="demo-list">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email} className="demo-item">
            <span className={`demo-role demo-role-${a.role}`}>{a.role}</span>
            <code className="demo-email" title={a.name}>{a.email}</code>
            <button
              type="button"
              className="btn btn-secondary btn-sm demo-use"
              onClick={() => onUse(a.email, a.password)}
              aria-label={`Use demo ${a.role} account ${a.email}`}
            >
              Use
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
