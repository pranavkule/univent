import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { validateSignUpInput } from '../services/auth.js'

export default function OrgSignUp() {
  const { signUp, authMode } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const fieldErrors = validateSignUpInput(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    setSubmitting(true)
    setServerError('')
    try {
      const result = await signUp(values)
      if (result.user) {
        navigate('/org/apply', { replace: true })
      } else if (result.needsConfirmation) {
        navigate('/confirm-signup', {
          replace: true,
          state: { email: result.email, name: result.name, from: '/org/apply' },
        })
      } else {
        navigate('/signin', {
          replace: true,
          state: { email: result.email, from: '/org/apply' },
        })
      }
    } catch (err) {
      setServerError(err.message || 'Could not create the account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container container-narrow">
      <h2>Organization representative account</h2>
      <p className="muted">
        {authMode === 'cognito'
          ? 'Create an account with your official @ves.ac.in email, confirm it, and sign in to submit an application. Organization features stay locked until Admin approval.'
          : 'Mock account creation is for local UI testing only. Application data stays in this browser.'}
      </p>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="org-signup-name">Representative full name</label>
          <input
            id="org-signup-name" name="name" type="text" autoComplete="name" required
            value={values.name} onChange={handleChange} aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <span className="field-error" role="alert">{errors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-signup-email">Official college email</label>
          <input
            id="org-signup-email" name="email" type="email" autoComplete="email" required
            value={values.email} onChange={handleChange} placeholder="representative@ves.ac.in"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-signup-password">Password</label>
          <input
            id="org-signup-password" name="password" type="password" autoComplete="new-password" required
            value={values.password} onChange={handleChange} aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <span className="field-error" role="alert">{errors.password}</span>}
        </div>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link to="/signin" state={{ from: '/org/apply' }}>Sign in to apply</Link>.
        {' '}<Link to="/signup">Student signup</Link>
      </p>
    </div>
  )
}
