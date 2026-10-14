import { useEffect, useState } from 'react'
import { useAuth } from '../../components/AuthProvider.jsx'
import { ORG_EDITABLE_FIELDS, getOrganizationByEmail, updateOrganization, validateOrganizationInput } from '../../services/organizations.js'

// Organization profile. Only name and description are editable here;
// contact email and approval status are read-only (Admin-controlled).
// Mock data only — stored in this browser, not in AWS.
export default function OrgProfile() {
  const { user } = useAuth()
  const [org, setOrg] = useState(null)
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({ name: '', description: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getOrganizationByEmail(user?.email || '')
      .then((o) => {
        if (cancelled) return
        setOrg(o)
        if (o) setValues({ name: o.name, description: o.description })
      })
      .catch((err) => {
        if (!cancelled) setServerError(err.message || 'Could not load the profile.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  function handleChange(e) {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    const errors = validateOrganizationInput(values)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    setServerError('')
    setNotice('')
    try {
      const updated = await updateOrganization(user.email, values)
      setOrg(updated)
      setEditing(false)
      setNotice('Profile updated.')
    } catch (err) {
      if (err.fields) setFieldErrors(err.fields)
      setServerError(err.message || 'Could not save the profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="skeleton">Loading organization profile…</div>

  if (!org) {
    return (
      <div className="alert alert-empty">
        No organization profile is linked to {user?.email}. Organization accounts are created by the Admin team.
      </div>
    )
  }

  return (
    <>
      <p className="muted org-sub">How your organization appears to students and admins. Mock data — stored in this browser only.</p>
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}

      {!editing ? (
        <div className="detail org-profile-card">
          <div className="org-profile-head">
            <h3>{org.name}</h3>
            <span className={`status status-${org.approvalStatus === 'approved' ? 'published' : 'pending'}`}>
              {org.approvalStatus === 'approved' ? 'Approved' : org.approvalStatus}
            </span>
          </div>
          <p className="muted">{org.description}</p>
          <dl className="facts">
            <div><dt>Contact</dt><dd>{org.contactEmail}</dd></div>
            <div><dt>Approval</dt><dd>Controlled by Admin (read-only here)</dd></div>
          </dl>
          <p className="muted org-hint">Editable fields in this app: {ORG_EDITABLE_FIELDS.join(', ')}.</p>
          <button type="button" className="btn btn-secondary" onClick={() => { setEditing(true); setNotice('') }}>
            Edit Profile
          </button>
        </div>
      ) : (
        <form className="form org-form" onSubmit={handleSave} noValidate>
          <div className="field">
            <label htmlFor="org-profile-name">Organization name</label>
            <input id="org-profile-name" name="name" type="text" value={values.name} onChange={handleChange} required />
            {fieldErrors.name && <span className="field-error" role="alert">{fieldErrors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-profile-desc">Description</label>
            <textarea id="org-profile-desc" name="description" rows="4" value={values.description} onChange={handleChange} required />
            {fieldErrors.description && <span className="field-error" role="alert">{fieldErrors.description}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-profile-email">Contact email (read-only)</label>
            <input id="org-profile-email" type="email" value={org.contactEmail} disabled aria-disabled="true" />
          </div>
          <div className="org-form-actions">
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => { setEditing(false); setValues({ name: org.name, description: org.description }); setFieldErrors({}) }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  )
}
