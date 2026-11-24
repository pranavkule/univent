import { useState } from 'react'
import { Link } from 'react-router-dom'
import OrgStatusBadge from '../components/OrgStatusBadge.jsx'
import { ALLOWED_EMAIL_DOMAIN } from '../services/authConfig.js'
import { submitOrganizationApplication } from '../services/organizations.js'
import { validateOrganizationApplicationInput } from '../services/organizationApplicationValidation.js'

const EMPTY_VALUES = {
  organizationName: '',
  officialEmail: '',
  department: '',
  applicantName: '',
  representativeTitle: '',
  representativePhone: '',
  reason: '',
  password: '',
  confirmPassword: '',
}

export default function OrgSignUp() {
  const [values, setValues] = useState({ ...EMPTY_VALUES })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null)

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const fieldErrors = validateOrganizationApplicationInput(values, ALLOWED_EMAIL_DOMAIN)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setSubmitting(true)
    setServerError('')
    try {
      const application = { ...values }
      delete application.confirmPassword
      const result = await submitOrganizationApplication(application)
      setReceipt(result)
      setValues({ ...EMPTY_VALUES })
    } catch (err) {
      setServerError(err.message || 'Could not submit the organization application.')
    } finally {
      setSubmitting(false)
    }
  }

  if (receipt) {
    return (
      <div className="container container-narrow">
        <h2>Application submitted</h2>
        <div className="detail">
          <div className="org-profile-head">
            <h3>Status</h3>
            <OrgStatusBadge status="pending_approval" />
          </div>
          <p>
            An administrator will review your application. No Cognito account is created until approval,
            and no email verification code is required. After approval, sign in with the organization
            email and password you selected.
          </p>
          <p className="muted">Application reference: {receipt.applicationId}</p>
          <Link className="btn btn-secondary" to="/org/signin">Organization login</Link>
        </div>
        <p className="muted"><Link to="/events">Return to events</Link></p>
      </div>
    )
  }

  return (
    <div className="container container-narrow">
      <h2>Organization application</h2>
      <p className="muted">
        Apply with the organization’s official @
        {ALLOWED_EMAIL_DOMAIN} address. You do not need access to its inbox.
        This application is separate from student accounts.
      </p>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="org-application-name">Official organization name</label>
          <input
            id="org-application-name"
            name="organizationName"
            type="text"
            required
            maxLength="120"
            value={values.organizationName}
            onChange={handleChange}
            aria-invalid={Boolean(errors.organizationName)}
          />
          {errors.organizationName && <span className="field-error" role="alert">{errors.organizationName}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-official-email">Official organization email</label>
          <input
            id="org-official-email"
            name="officialEmail"
            type="email"
            autoComplete="username"
            placeholder={`organization@${ALLOWED_EMAIL_DOMAIN}`}
            required
            maxLength="254"
            value={values.officialEmail}
            onChange={handleChange}
            aria-invalid={Boolean(errors.officialEmail)}
          />
          {errors.officialEmail && <span className="field-error" role="alert">{errors.officialEmail}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-department">Organization category or type</label>
          <input
            id="org-department"
            name="department"
            type="text"
            required
            maxLength="100"
            value={values.department}
            onChange={handleChange}
            aria-invalid={Boolean(errors.department)}
          />
          {errors.department && <span className="field-error" role="alert">{errors.department}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-contact-name">Contact person name</label>
          <input
            id="org-contact-name"
            name="applicantName"
            type="text"
            autoComplete="name"
            required
            maxLength="100"
            value={values.applicantName}
            onChange={handleChange}
            aria-invalid={Boolean(errors.applicantName)}
          />
          {errors.applicantName && <span className="field-error" role="alert">{errors.applicantName}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-representative-title">Contact person position</label>
          <input
            id="org-representative-title"
            name="representativeTitle"
            type="text"
            required
            maxLength="100"
            value={values.representativeTitle}
            onChange={handleChange}
            aria-invalid={Boolean(errors.representativeTitle)}
          />
          {errors.representativeTitle && <span className="field-error" role="alert">{errors.representativeTitle}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-contact-phone">Contact phone (optional)</label>
          <input
            id="org-contact-phone"
            name="representativePhone"
            type="tel"
            autoComplete="tel"
            maxLength="32"
            value={values.representativePhone}
            onChange={handleChange}
            aria-invalid={Boolean(errors.representativePhone)}
          />
          {errors.representativePhone && <span className="field-error" role="alert">{errors.representativePhone}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-application-reason">Application details</label>
          <textarea
            id="org-application-reason"
            name="reason"
            rows="4"
            maxLength="1000"
            required
            value={values.reason}
            onChange={handleChange}
            aria-invalid={Boolean(errors.reason)}
          />
          {errors.reason && <span className="field-error" role="alert">{errors.reason}</span>}
        </div>
        <div className="field">
          <label htmlFor="org-password">Password</label>
          <input
            id="org-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            maxLength="256"
            value={values.password}
            onChange={handleChange}
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <span className="field-error" role="alert">{errors.password}</span>}
          <span className="muted">Use at least 8 characters with uppercase, lowercase, and a number.</span>
        </div>
        <div className="field">
          <label htmlFor="org-password-confirm">Confirm password</label>
          <input
            id="org-password-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            maxLength="256"
            value={values.confirmPassword}
            onChange={handleChange}
            aria-invalid={Boolean(errors.confirmPassword)}
          />
          {errors.confirmPassword && <span className="field-error" role="alert">{errors.confirmPassword}</span>}
        </div>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Submitting application…' : 'Submit application'}
        </button>
      </form>
      <p className="muted">
        Student account signup is separate. <Link to="/signup">Create a student account</Link>.
      </p>
      <p className="muted">
        Already approved? <Link to="/org/signin">Organization login</Link>.
      </p>
    </div>
  )
}
