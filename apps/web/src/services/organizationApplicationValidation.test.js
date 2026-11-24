import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateOrganizationApplicationInput } from './organizationApplicationValidation.js'

const validApplication = {
  organizationName: 'Robotics Club',
  applicantName: 'Aarav Mehta',
  officialEmail: 'CODECELL@VES.AC.IN',
  department: 'Engineering',
  representativeTitle: 'Secretary',
  representativePhone: '+1 555 010 1234',
  reason: 'Manage events and registrations for the club.',
  password: 'StrongPass123',
  confirmPassword: 'StrongPass123',
}

describe('organization application validation', () => {
  it('accepts a college organization email and a strong matching password', () => {
    assert.deepEqual(validateOrganizationApplicationInput(validApplication), {})
  })

  it('rejects invalid official email domains, weak passwords, and mismatched confirmation', () => {
    const errors = validateOrganizationApplicationInput({
      ...validApplication,
      officialEmail: 'student@gmail.com',
      password: 'weak',
      confirmPassword: 'different',
      reason: '',
    })
    assert.match(errors.officialEmail, /ves\.ac\.in/)
    assert.match(errors.password, /at least|between|uppercase/i)
    assert.match(errors.confirmPassword, /do not match/i)
    assert.ok(errors.reason)
  })

  it('requires an official email and contact information', () => {
    const errors = validateOrganizationApplicationInput({
      ...validApplication,
      officialEmail: '',
      applicantName: '',
      department: '',
    })
    assert.ok(errors.officialEmail)
    assert.ok(errors.applicantName)
    assert.ok(errors.department)
  })
})
