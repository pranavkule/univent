import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../components/AuthProvider.jsx'
import OrgStatusBadge from '../../components/OrgStatusBadge.jsx'
import { mockCategories } from '../../services/mockEvents.js'
import { createOrgEvent, getOrgEvent, isEditableStatus, updateOrgEvent } from '../../services/orgEvents.js'

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

// Shared create/edit form. New events are saved as drafts or submitted for
// admin approval; edits preserve status unless resubmitted. Mock only.
export default function OrgEventForm() {
  const { user } = useAuth()
  const orgEmail = user?.email || ''
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [values, setValues] = useState(EMPTY)
  const [status, setStatus] = useState('draft')
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(null)

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
        setStatus(e.status)
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

  async function handleSave(submit) {
    setSaving(submit ? 'submit' : 'draft')
    setServerError('')
    setFieldErrors({})
    try {
      if (isEdit) {
        await updateOrgEvent(orgEmail, id, values, { submit })
      } else {
        await createOrgEvent(orgEmail, user?.name || '', values, { submit })
      }
      navigate('/org/events', {
        state: { notice: submit ? 'Event submitted for admin approval.' : 'Draft saved.' },
      })
    } catch (err) {
      if (err.fields) setFieldErrors(err.fields)
      setServerError(err.message || 'Could not save the event.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="skeleton">Loading event…</div>

  // Published / cancelled events are read-only in this mock: approval and
  // closure are controlled by the Admin side of the flow.
  if (isEdit && !isEditableStatus(status) && !serverError) {
    const v = values
    return (
      <>
        <p className="muted org-sub">
          This event is <OrgStatusBadge status={status} /> and can no longer be edited here.
        </p>
        <div className="detail">
          <h3>{v.title}</h3>
          <dl className="facts">
            <div><dt>Date</dt><dd>{v.date}{v.startTime ? ` · ${v.startTime}${v.endTime ? `–${v.endTime}` : ''}` : ''}</dd></div>
            <div><dt>Venue</dt><dd>{v.venue}</dd></div>
            <div><dt>Category</dt><dd>{v.category}</dd></div>
            <div><dt>Deadline</dt><dd>{v.regDeadline || '—'}</dd></div>
            <div><dt>Capacity</dt><dd>{v.capacity}</dd></div>
          </dl>
          <p className="muted">{v.description}</p>
          <Link className="btn btn-secondary" to="/org/events">Back to My Events</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="muted org-sub">
        {isEdit ? 'Update the draft, then save or resubmit for approval.' : 'Save as a draft now, submit for admin approval when ready.'}
        {' '}Mock only — nothing is sent to AWS.
      </p>
      {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
      <form
        className="form org-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          handleSave(false)
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
              {mockCategories.map((c) => (
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
          <button type="button" className="btn btn-secondary" disabled={saving !== null} onClick={() => handleSave(false)}>
            {saving === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
          <button type="submit" className="btn" disabled={saving !== null}>
            {saving === 'submit' ? 'Submitting…' : 'Submit for approval'}
          </button>
          <Link className="link-more" to="/org/events">Cancel</Link>
        </div>
      </form>
    </>
  )
}
