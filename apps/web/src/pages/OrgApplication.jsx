import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrgStatusBadge from '../components/OrgStatusBadge.jsx'
import { useAuth } from '../components/AuthProvider.jsx'
import { API_MODE } from '../services/api.js'
import {
  getMyOrganizationApplication,
  submitOrganizationApplication,
} from '../services/organizations.js'

function validate(values) {
  const errors = {}
  if (values.organizationName.trim().length < 2 || values.organizationName.trim().length > 120) {
    errors.organizationName = 'Organization name must be between 2 and 120 characters.'
  }
  if (values.representativeName.trim().length < 2) {
    errors.representativeName = 'Enter the representative’s full name.'
  }
  if (values.representativeTitle.trim().length < 2) {
    errors.representativeTitle = 'Enter the representative’s role.'
  }
  if (!/^[+()\d .-]{7,32}$/.test(values.representativePhone.trim())) {
    errors.representativePhone = 'Enter a valid phone number.'
  }
  return errors
}

export default function OrgApplication() {
  const { user } = useAuth()
  const [application, setApplication] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState({
    organizationName: '',
    representativeName: user?.name || '',
    representativeTitle: '',
    representativePhone: '',
  })

  useEffect(() => {
    let cancelled = false
    getMyOrganizationApplication(user?.email || '')
      .then((result) => {
        if (!cancelled) setApplication(result)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load your application.')
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const fieldErrors = validate(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    setSaving(true)
    setSubmitError('')
    try {
      const result = await submitOrganizationApplication({
        ...values,
        officialEmail: user.email,
      })
      setApplication(result)
    } catch (err) {
      setSubmitError(err.message || 'Could not submit your application.')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <div className="container"><div className="skeleton">Loading application…</div></div>
  if (loadError) return <div className="container"><div className="alert alert-error" role="alert">{loadError}</div></div>

  if (application) {
    const status = application.approvalStatus || 'pending'
    const approved = status === 'approved'
    return (
      <div className="container container-narrow">
        <h2>Organization application</h2>
        <div className="detail">
          <div className="org-profile-head">
            <h3>{application.name}</h3>
            <OrgStatusBadge status={status} />
          </div>
          <p className="muted">{application.contactEmail}</p>
          <p role="status">
            {status === 'pending' && 'Your application is awaiting Admin review. Organization features are unavailable until approval.'}
            {approved && 'Your application is approved. Sign out and back in if your current session does not yet show the Organization role.'}
            {status === 'rejected' && 'Your application was rejected. Contact the UniVent administrators for next steps.'}
            {status === 'suspended' && 'Organization access is suspended. Contact the UniVent administrators for assistance.'}
          </p>
          {application.decisionReason && <p className="muted">Decision: {application.decisionReason}</p>}
          {approved && <Link className="btn" to="/org">Open organization workspace</Link>}
        </div>
        {API_MODE === 'mock' && <p className="muted">Mock application status is stored in this browser only.</p>}
      </div>
    )
  }

  return (
    <div className="container container-narrow">
      <h2>Apply as an organization</h2>
      <p className="muted">
        Submit organization and representative details for Admin review. The official email is taken from your signed-in account and must be confirmed.
        {API_MODE === 'mock' ? ' This is a local mock workflow.' : ''}
      </p>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="application-org-name">Organization name</label>
          <input id="application-org-name" name="organizationName" required value={values.organizationName} onChange={handleChange} />
          {errors.organizationName && <span className="field-error" role="alert">{errors.organizationName}</span>}
        </div>
        <div className="field">
          <label htmlFor="application-org-email">Verified official college email</label>
          <input id="application-org-email" type="email" value={user?.email || ''} disabled aria-disabled="true" />
        </div>
        <div className="field">
          <label htmlFor="application-rep-name">Representative full name</label>
          <input id="application-rep-name" name="representativeName" required value={values.representativeName} onChange={handleChange} />
          {errors.representativeName && <span className="field-error" role="alert">{errors.representativeName}</span>}
        </div>
        <div className="field">
          <label htmlFor="application-rep-title">Representative role</label>
          <input id="application-rep-title" name="representativeTitle" required value={values.representativeTitle} onChange={handleChange} placeholder="e.g. Club Secretary" />
          {errors.representativeTitle && <span className="field-error" role="alert">{errors.representativeTitle}</span>}
        </div>
        <div className="field">
          <label htmlFor="application-rep-phone">Representative phone</label>
          <input id="application-rep-phone" name="representativePhone" type="tel" required value={values.representativePhone} onChange={handleChange} />
          {errors.representativePhone && <span className="field-error" role="alert">{errors.representativePhone}</span>}
        </div>
        {submitError && <div className="alert alert-error" role="alert">{submitError}</div>}
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </div>
  )
}
