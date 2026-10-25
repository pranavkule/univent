import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import DemoAccounts from '../components/DemoAccounts.jsx'
import { validateSignInInput } from '../services/auth.js'

export default function SignIn() {
  const { signIn, authMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const explicitFrom = location.state?.from
  const from = explicitFrom || '/events'
  const notice = location.state?.notice || ''
  const [values, setValues] = useState({ email: location.state?.email || '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
  }

  function handleUseDemo(email, password) {
    setValues({ email, password })
    setErrors({})
    setServerError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fieldErrors = validateSignInInput(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    setSubmitting(true)
    setServerError('')
    try {
      const session = await signIn(values)
      const role = (session?.role || '').toLowerCase()
      if (explicitFrom === '/org/apply') {
        navigate('/org/apply', { replace: true })
        return
      }
      if (role === 'organization') {
        // Organization accounts open their workspace directly. Only a deep
        // link into the workspace itself is honored instead.
        const target = explicitFrom && explicitFrom.startsWith('/org') ? explicitFrom : '/org'
        navigate(target, { replace: true })
        return
      }
      if (role === 'admin') {
        // Admin accounts open the admin workspace directly. Only a deep
        // link into it is honored instead.
        const target = explicitFrom && explicitFrom.startsWith('/admin') ? explicitFrom : '/admin'
        navigate(target, { replace: true })
        return
      }
      // All events visible first after every other login. Only a deep link
      // into an event flow (detail / register / confirmation) is honored so
      // an in-progress registration is not lost.
      const target = explicitFrom && explicitFrom.startsWith('/events/') ? explicitFrom : '/events'
      navigate(target, { replace: true })
    } catch (err) {
      setServerError(err.message || 'Sign-in failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container auth-container">
      <h2>Sign in</h2>
      <p className="muted">
        {authMode === 'mock'
          ? 'Mock sign-in for the prototype — use an account you created via Sign up, or a dev demo account.'
          : 'Sign in to register for events and manage your account.'}
      </p>
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      <div className="auth-layout">
        <div className="auth-main">
          <form className="form auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="signin-email">Email</label>
          <input
            id="signin-email" name="email" type="email" autoComplete="email" required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signin-email-error' : undefined}
            value={values.email} onChange={handleChange} placeholder="you@ves.ac.in"
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
          <p className="muted">No account yet? <Link to="/signup" state={{ from }}>Sign up</Link></p>
          {authMode === 'cognito' && (
            <p className="muted">
              Need to confirm your email?{' '}
              <Link to="/confirm-signup" state={{ email: values.email, from }}>
                Enter your code
              </Link>
            </p>
          )}
        </div>
        {authMode === 'mock' && <DemoAccounts onUse={handleUseDemo} />}
      </div>
    </div>
  )
}
