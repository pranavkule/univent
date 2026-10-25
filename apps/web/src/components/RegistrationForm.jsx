import { useState } from 'react'
import { validateRegistrationInput } from '../services/api.js'

export default function RegistrationForm({ eventId, onSubmit, submitting, serverError, initialValues }) {
  const [values, setValues] = useState({
    name: initialValues?.name || '',
    email: initialValues?.email || '',
  })
  const [errors, setErrors] = useState({})

  function handleChange(e) {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fieldErrors = validateRegistrationInput({ eventId, ...values })
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    await onSubmit({ eventId, ...values })
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="reg-name">Full name</label>
        <input
          id="reg-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'reg-name-error' : undefined}
          value={values.name}
          onChange={handleChange}
          placeholder="e.g. Asha Sharma"
        />
        {errors.name && <span className="field-error" id="reg-name-error" role="alert">{errors.name}</span>}
      </div>

      <div className="field">
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'reg-email-error' : undefined}
          value={values.email}
          title="Email is tied to your signed-in account"
          placeholder="you@college.edu"
        />
        {errors.email && <span className="field-error" id="reg-email-error" role="alert">{errors.email}</span>}
      </div>

      {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}

      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? 'Registering…' : 'Register'}
      </button>
    </form>
  )
}
