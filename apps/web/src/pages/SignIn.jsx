import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { validateNewPasswordInput, validateSignInInput } from '../services/auth.js'

const ROLE_BY_MODE = {
  student: 'student',
  organization: 'organization',
  admin: 'admin',
}

const TITLE_BY_MODE = {
  student: 'Student sign in',
  organization: 'Organization login',
  admin: 'Admin login',
}

export default function SignIn({ mode = 'student' }) {
  const { signIn, signOut, completeNewPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const explicitFrom = location.state?.from
  const notice = location.state?.notice || ''
  const expectedRole = ROLE_BY_MODE[mode] || ROLE_BY_MODE.student
  const [values, setValues] = useState({ email: location.state?.email || '', password: '' })
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  function navigateAfterSignIn(session) {
    const role = (session?.role || '').toLowerCase()
    if (role === 'organization') {
      const target = explicitFrom && explicitFrom.startsWith('/org') ? explicitFrom : '/org'
      navigate(target, { replace: true })
      return
    }
    if (role === 'admin') {
      const target = explicitFrom && explicitFrom.startsWith('/admin') ? explicitFrom : '/admin'
      navigate(target, { replace: true })
      return
    }
    const target = explicitFrom && explicitFrom.startsWith('/events/') ? explicitFrom : '/events'
    navigate(target, { replace: true })
  }

  async function requireExpectedRole(session) {
    if ((session?.role || '').toLowerCase() === expectedRole) return true
    await signOut()
    const expectedLabel = expectedRole === 'organization'
      ? 'organization'
      : expectedRole === 'admin'
        ? 'administrator'
        : 'student'
    setServerError(`This is not a ${expectedLabel} account. Use the matching sign-in page.`)
    return false
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const fieldErrors = validateSignInInput(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    setSubmitting(true)
    setServerError('')
    try {
      const session = await signIn(values)
      if (session?.requiresPasswordChange) {
        setPasswordChangeRequired(true)
        setValues((current) => ({ ...current, password: '' }))
        return
      }
      if (!(await requireExpectedRole(session))) return
      navigateAfterSignIn(session)
    } catch (err) {
      setServerError(err.message || 'Sign-in failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault()
    const validationError = validateNewPasswordInput(newPassword, passwordConfirmation)
    if (validationError) {
      setServerError(validationError)
      return
    }
    setSubmitting(true)
    setServerError('')
    try {
      const session = await completeNewPassword(newPassword)
      if (!(await requireExpectedRole(session))) return
      navigateAfterSignIn(session)
    } catch (err) {
      setServerError(err.message || 'Could not set your new password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container auth-container">
      <h2>{passwordChangeRequired ? 'Set your password' : TITLE_BY_MODE[mode] || TITLE_BY_MODE.student}</h2>
      <p className="muted">
        {passwordChangeRequired
          ? 'Use the temporary password sent to your accessible college email, then choose a password only you know.'
          : mode === 'organization'
            ? 'Approved organizations sign in with their official email and the password chosen in their application.'
            : mode === 'admin'
              ? 'Sign in with the existing administrator account.'
              : 'Sign in with your student account to register for campus events.'}
      </p>
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      <div className="auth-layout">
        <div className="auth-main">
          {passwordChangeRequired ? (
            <form className="form auth-form" onSubmit={handlePasswordChange} noValidate>
              <div className="field">
                <label htmlFor="signin-new-password">New password</label>
                <input
                  id="signin-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="signin-password-confirmation">Confirm new password</label>
                <input
                  id="signin-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                />
              </div>
              {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? 'Updating password…' : 'Set password and sign in'}
              </button>
            </form>
          ) : (
            <>
              <form className="form auth-form" onSubmit={handleSubmit} noValidate>
                <div className="field">
                  <label htmlFor="signin-email">
                    {mode === 'organization' ? 'Official organization email' : 'Email'}
                  </label>
                  <input
                    id="signin-email" name="email" type="email" autoComplete="email" required
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'signin-email-error' : undefined}
                    value={values.email}
                    onChange={handleChange}
                    placeholder={mode === 'organization' ? 'organization@ves.ac.in' : 'you@ves.ac.in'}
                  />
                  {errors.email && <span className="field-error" id="signin-email-error" role="alert">{errors.email}</span>}
                </div>
                <div className="field">
                  <label htmlFor="signin-password">Password</label>
                  <input
                    id="signin-password" name="password" type="password" autoComplete="current-password" required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'signin-password-error' : undefined}
                    value={values.password} onChange={handleChange} placeholder="Your password"
                  />
                  {errors.password && <span className="field-error" id="signin-password-error" role="alert">{errors.password}</span>}
                </div>
                {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
                <button className="btn" type="submit" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              {mode === 'student' && (
                <>
                  <p className="muted">No student account? <Link to="/signup">Sign up</Link></p>
                  <p className="muted">
                    Need to confirm your student email?{' '}
                    <Link to="/confirm-signup" state={{ email: values.email, from: explicitFrom || '/events' }}>
                      Enter your code
                    </Link>
                  </p>
                  <p className="muted">Organization representative? <Link to="/org/signin">Organization login</Link></p>
                </>
              )}
              {mode === 'organization' && (
                <p className="muted">
                  Not approved yet? <Link to="/org/signup">Submit an organization application</Link>.
                </p>
              )}
              {mode === 'admin' && (
                <p className="muted">
                  Student login: <Link to="/signin">Student sign in</Link>. Organization login:{' '}
                  <Link to="/org/signin">Organization sign in</Link>.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
