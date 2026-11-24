import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../components/AuthProvider.jsx'
import { eventCategories } from '../../services/eventCategories.js'
import { createOrgEvent, getOrgEvent, updateOrgEvent } from '../../services/orgEvents.js'

const EMPTY = {
  title: '',
  description: '',
  category: 'Technical',
  bannerUrl: '',
  date: '',
  startTime: '',
  endTime: '',
  venue: '',
  regDeadline: '',
  capacity: '',
}

// Shared create/edit form. Changes are saved through the authenticated AWS API.
function saveNotice(event) {
  return `"${event.title}" was saved to AWS and is publicly available.`
}

export default function OrgEventForm() {
  const { user } = useAuth()
  const orgEmail = user?.email || ''
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [values, setValues] = useState(EMPTY)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return undefined
    let cancelled = false
    getOrgEvent(orgEmail, id)
      .then((e) => {
        if (cancelled) return
        setValues({
          title: e.title || '',
          description: e.description || '',
          category: e.category || 'Technical',
          bannerUrl: e.bannerUrl || '',
          date: e.date || '',
          startTime: e.startTime || '',
          endTime: e.endTime || '',
          venue: e.venue || '',
          regDeadline: e.regDeadline || '',
          capacity: e.capacity ?? '',
        })
      })
      .catch((err) => {
        if (!cancelled) setServerError(err.message || 'Could not load the event.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, id, orgEmail])

  function handleChange(e) {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setServerError('')
    setFieldErrors({})
    try {
      const saved = isEdit
        ? await updateOrgEvent(orgEmail, id, values)
        : await createOrgEvent(orgEmail, user?.name || '', values)
      navigate('/org/events', {
        state: { notice: saveNotice(saved) },
      })
    } catch (err) {
      if (err.fields) setFieldErrors(err.fields)
      setServerError(err.message || 'Could not save the event.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="skeleton">Loading event…</div>

  return (
    <>
      <p className="muted org-sub">
        {isEdit
          ? 'Update a published event. Changes are saved to AWS immediately.'
          : 'Create a published event. Changes are saved to AWS immediately; this deployment has no approval workflow.'}
      </p>
      {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
      <form
        className="form org-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        <div className="org-form-grid">
          <div className="field org-span-2">
            <label htmlFor="org-title">Event title</label>
            <input id="org-title" name="title" type="text" value={values.title} onChange={handleChange} placeholder="e.g. Hack Night 2.0" required />
            {fieldErrors.title && <span className="field-error" role="alert">{fieldErrors.title}</span>}
          </div>
          <div className="field org-span-2">
            <label htmlFor="org-description">Description</label>
            <textarea id="org-description" name="description" rows="4" value={values.description} onChange={handleChange} placeholder="What is this event about?" required />
            {fieldErrors.description && <span className="field-error" role="alert">{fieldErrors.description}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-category">Category</label>
            <select id="org-category" name="category" value={values.category} onChange={handleChange}>
              {eventCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {fieldErrors.category && <span className="field-error" role="alert">{fieldErrors.category}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-capacity">Maximum capacity</label>
            <input id="org-capacity" name="capacity" type="number" min="1" max="5000" value={values.capacity} onChange={handleChange} placeholder="e.g. 100" required />
            {fieldErrors.capacity && <span className="field-error" role="alert">{fieldErrors.capacity}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-date">Event date</label>
            <input id="org-date" name="date" type="date" value={values.date} onChange={handleChange} required />
            {fieldErrors.date && <span className="field-error" role="alert">{fieldErrors.date}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-deadline">Registration deadline</label>
            <input id="org-deadline" name="regDeadline" type="date" value={values.regDeadline} onChange={handleChange} />
            {fieldErrors.regDeadline && <span className="field-error" role="alert">{fieldErrors.regDeadline}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-start">Start time</label>
            <input id="org-start" name="startTime" type="time" value={values.startTime} onChange={handleChange} />
            {fieldErrors.startTime && <span className="field-error" role="alert">{fieldErrors.startTime}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-end">End time</label>
            <input id="org-end" name="endTime" type="time" value={values.endTime} onChange={handleChange} />
            {fieldErrors.endTime && <span className="field-error" role="alert">{fieldErrors.endTime}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-venue">Venue</label>
            <input id="org-venue" name="venue" type="text" value={values.venue} onChange={handleChange} placeholder="e.g. Seminar Hall A" required />
            {fieldErrors.venue && <span className="field-error" role="alert">{fieldErrors.venue}</span>}
          </div>
          <div className="field">
            <label htmlFor="org-banner">Banner image URL (optional)</label>
            <input id="org-banner" name="bannerUrl" type="url" value={values.bannerUrl} onChange={handleChange} placeholder="https://…" />
            {fieldErrors.bannerUrl && <span className="field-error" role="alert">{fieldErrors.bannerUrl}</span>}
          </div>
        </div>
        <div className="org-form-actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create event')}
          </button>
          <Link className="link-more" to="/org/events">Cancel</Link>
        </div>
      </form>
    </>
  )
}
