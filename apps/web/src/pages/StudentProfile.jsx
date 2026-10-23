import { useAuth } from '../components/AuthProvider.jsx'

// Student profile: read-only account information. The mock backend stores
// only name/email/role, so there is nothing editable here yet — profile
// editing will arrive with the real backend (Cognito/DynamoDB).
export default function StudentProfile() {
  const { user, signOut, authMode } = useAuth()

  async function handleSignOut() {
    await signOut()
  }

  return (
    <div className="container container-narrow">
      <h2>Profile</h2>
      <p className="muted">
        {authMode === 'mock'
          ? 'Your account details. Mock data — stored in this browser only.'
          : 'Your account details, provided by Cognito.'}
      </p>
      <div className="detail">
        <dl className="facts">
          <div><dt>Name</dt><dd>{user?.name || '—'}</dd></div>
          <div><dt>Email</dt><dd>{user?.email || '—'}</dd></div>
          <div><dt>Role</dt><dd><span className="badge">{user?.role || 'student'}</span></dd></div>
          <div>
            <dt>Student ID</dt>
            <dd><span className="muted">Not provided in this prototype</span></dd>
          </div>
        </dl>
        <p className="muted">Profile editing is not supported yet.</p>
        <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
