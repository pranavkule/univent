import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { validateSignUpInput } from '../services/auth.js'

export default function SignUp() {
  const { signUp, authMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const explicitFrom = location.state?.from
  const from = explicitFrom || '/events'
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fieldErrors = validateSignUpInput(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    setSubmitting(true)
    setServerError('')
    try {
      const result = await signUp(values)
      if (result.needsConfirmation) {
        navigate('/confirm-signup', {
          replace: true,
          state: { email: result.email, name: result.name, from },
        })
        return
      }
      const target = explicitFrom && explicitFrom.startsWith('/events/') ? explicitFrom : '/events'
      navigate(target, { replace: true })
    } catch (err) {
      setServerError(err.message || 'Sign-up failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container container-narrow">
      <h2>Create your account</h2>
      <p className="muted">
        {authMode === 'mock'
          ? 'Mock sign-up for the prototype — no real account is created.'
          : 'Student accounts use your @ves.ac.in email. We will send a confirmation code.'}
      </p>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="signup-name">Full name</label>
          <input
            id="signup-name" name="name" type="text" autoComplete="name" required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
            value={values.name} onChange={handleChange} placeholder="e.g. Asha Sharma"
          />
          {errors.name && <span className="field-error" id="signup-name-error" role="alert">{errors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email" name="email" type="email" autoComplete="email" required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            value={values.email} onChange={handleChange} placeholder="you@ves.ac.in"
          />
          {errors.email && <span className="field-error" id="signup-email-error" role="alert">{errors.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password" name="password" type="password" autoComplete="new-password" required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'signup-password-error' : undefined}
            value={values.password} onChange={handleChange} placeholder="Min 8, upper/lower/number"
          />
          {errors.password && <span className="field-error" id="signup-password-error" role="alert">{errors.password}</span>}
        </div>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link to="/signin" state={{ from }}>Sign in</Link>
      </p>
      <p className="muted">
        Organization representative? <Link to="/org/signup">Create an account and apply</Link>.
      </p>
    </div>
  )
}
