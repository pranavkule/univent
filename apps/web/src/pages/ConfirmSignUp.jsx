import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider.jsx'
import { validateConfirmationInput } from '../services/auth.js'

export default function ConfirmSignUp() {
  const { confirmSignUp, resendConfirmationCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const from = location.state?.from || '/events'
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const fieldErrors = validateConfirmationInput({ code })
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    setSubmitting(true)
    setServerError('')
    setNotice('')
    try {
      await confirmSignUp({ email, code })
      navigate('/signin', {
        replace: true,
        state: {
          email,
          from,
          notice: 'Email confirmed. Sign in with your password.',
        },
      })
    } catch (err) {
      setServerError(err.message || 'Could not confirm your email.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setServerError('')
    setNotice('')
    try {
      await resendConfirmationCode({ email })
      setNotice('A new confirmation code was sent to your email.')
    } catch (err) {
      setServerError(err.message || 'Could not resend the code.')
    } finally {
      setResending(false)
    }
  }

  if (!email) {
    return (
      <div className="container container-narrow">
        <h2>Confirm your email</h2>
        <div className="alert alert-error" role="alert">
          No pending sign-up was found. Start again from the sign-up page.
        </div>
        <p><Link to="/signup">Go to sign up</Link></p>
      </div>
    )
  }

  return (
    <div className="container container-narrow">
      <h2>Confirm your email</h2>
      <p className="muted">
        Enter the 6-digit code sent to <strong>{email}</strong>.
      </p>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="confirm-code">Confirmation code</label>
          <input
            id="confirm-code" name="code" type="text" inputMode="numeric"
            autoComplete="one-time-code" maxLength={6} required
            aria-invalid={Boolean(errors.code)}
            aria-describedby={errors.code ? 'confirm-code-error' : undefined}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
          />
          {errors.code && <span className="field-error" id="confirm-code-error" role="alert">{errors.code}</span>}
        </div>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        {notice && <div className="alert alert-ok" role="status">{notice}</div>}
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Confirming…' : 'Confirm email'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? 'Sending…' : 'Resend code'}
        </button>
      </form>
      <p className="muted">
        Wrong email? <Link to="/signup" state={{ from }}>Start over</Link>
      </p>
    </div>
  )
}
