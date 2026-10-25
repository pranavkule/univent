import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_MODE, createEvent } from '../../services/api.js'
import { cleanEventInput, validateEventInput } from '../../services/eventValidation.js'
import { eventCategories as mockCategories } from '../../services/eventCategories.js'

const EMPTY = {
  title: '',
  description: '',
  category: 'Technical',
  organizer: 'UniVent',
  date: '',
  startTime: '',
  endTime: '',
  venue: '',
  regDeadline: '',
  capacity: 100,
}

export default function AdminEventForm() {
  const navigate = useNavigate()
  const [values, setValues] = useState(EMPTY)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const cleaned = cleanEventInput(values)
    const errors = validateEventInput(cleaned)
    setFieldErrors(errors)
    setServerError('')
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const created = await createEvent(cleaned)
      const persistence = API_MODE === 'mock'
        ? 'created in this browser (demo — not saved to AWS)'
        : 'saved to the backend API'
      navigate('/admin/events', { state: { notice: `"${created.title}" was ${persistence}.` } })
    } catch (err) {
      if (err.fields) setFieldErrors(err.fields)
      setServerError(err.message || 'Could not create the event.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <p className="muted org-sub">
        Create a published event directly on the platform.{' '}
        {API_MODE === 'mock'
          ? 'Mock mode — the event is stored in this browser, not in AWS.'
          : 'Live mode — the event is written through the backend API.'}
      </p>
      {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
      <form className="form org-form" noValidate onSubmit={handleSubmit}>
        <div className="org-form-grid">
          <div className="field org-span-2">
            <label htmlFor="admin-title">Event title</label>
            <input id="admin-title" name="title" type="text" value={values.title} onChange={handleChange} required />
            {fieldErrors.title && <span className="field-error" role="alert">{fieldErrors.title}</span>}
          </div>
          <div className="field org-span-2">
            <label htmlFor="admin-description">Description</label>
            <textarea id="admin-description" name="description" rows="4" value={values.description} onChange={handleChange} />
            {fieldErrors.description && <span className="field-error" role="alert">{fieldErrors.description}</span>}
          </div>
          <div className="field">
            <label htmlFor="admin-category">Category</label>
            <select id="admin-category" name="category" value={values.category} onChange={handleChange}>
              {mockCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            {fieldErrors.category && <span className="field-error" role="alert">{fieldErrors.category}</span>}
          </div>
          <div className="field">
            <label htmlFor="admin-organizer">Organizer</label>
            <input id="admin-organizer" name="organizer" type="text" value={values.organizer} onChange={handleChange} />
            {fieldErrors.organizer && <span className="field-error" role="alert">{fieldErrors.organizer}</span>}
          </div>
          <div className="field">
            <label htmlFor="admin-date">Event date</label>
            <input id="admin-date" name="date" type="date" value={values.date} onChange={handleChange} required />
            {fieldErrors.date && <span className="field-error" role="alert">{fieldErrors.date}</span>}
          </div>
          <div className="field">
            <label htmlFor="admin-deadline">Registration deadline</label>
            <input id="admin-deadline" name="regDeadline" type="date" value={values.regDeadline} onChange={handleChange} />
            {fieldErrors.regDeadline && <span className="field-error" role="alert">{fieldErrors.regDeadline}</span>}
          </div>
          <div className="field">
            <label htmlFor="admin-start">Start time</label>
            <input id="admin-start" name="startTime" type="time" value={values.startTime} onChange={handleChange} />
            {fieldErrors.startTime && <span className="field-error" role="alert">{fieldErrors.startTime}</span>}
          </div>
          <div className="field">
            <label htmlFor="admin-end">End time</label>
            <input id="admin-end" name="endTime" type="time" value={values.endTime} onChange={handleChange} />
            {fieldErrors.endTime && <span className="field-error" role="alert">{fieldErrors.endTime}</span>}
          </div>
          <div className="field">
            <label htmlFor="admin-venue">Venue</label>
            <input id="admin-venue" name="venue" type="text" value={values.venue} onChange={handleChange} required />
            {fieldErrors.venue && <span className="field-error" role="alert">{fieldErrors.venue}</span>}
          </div>
          <div className="field">
            <label htmlFor="admin-capacity">Maximum capacity</label>
            <input id="admin-capacity" name="capacity" type="number" min="1" max="5000" value={values.capacity} onChange={handleChange} required />
            {fieldErrors.capacity && <span className="field-error" role="alert">{fieldErrors.capacity}</span>}
          </div>
        </div>
        <div className="org-form-actions">
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create event'}
          </button>
          <Link className="link-more" to="/admin/events">Cancel</Link>
        </div>
      </form>
    </>
  )
}
