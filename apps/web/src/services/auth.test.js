import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  isAllowedStudentEmail,
  validateConfirmationInput,
  validateSignInInput,
  validateSignUpInput,
} from './authValidation.js'
import { getDashboardPathForRole, roleFromGroups } from './authRoles.js'

describe('student auth validation', () => {
  it('accepts ves.ac.in student addresses', () => {
    assert.equal(isAllowedStudentEmail('asha@ves.ac.in'), true)
    assert.equal(isAllowedStudentEmail('ASHA@VES.AC.IN'), true)
  })

  it('rejects non-college, lookalike, and subdomain addresses', () => {
    assert.equal(isAllowedStudentEmail('asha@gmail.com'), false)
    assert.equal(isAllowedStudentEmail('asha@ves.ac.in.evil.com'), false)
    assert.equal(isAllowedStudentEmail('asha@sub.ves.ac.in'), false)
    assert.equal(isAllowedStudentEmail('asha'), false)
  })

  it('validates full name, college email, and password policy', () => {
    const valid = validateSignUpInput({
      name: 'Asha Sharma',
      email: 'asha@ves.ac.in',
      password: 'Demo@123',
    })
    assert.deepEqual(valid, {})

    const invalid = validateSignUpInput({
      name: 'A',
      email: 'asha@gmail.com',
      password: 'short',
    })
    assert.ok(invalid.name)
    assert.match(invalid.email, /ves\.ac\.in/)
    assert.ok(invalid.password)
  })

  it('requires uppercase, lowercase, and a number in passwords', () => {
    const errors = validateSignUpInput({
      name: 'Asha Sharma',
      email: 'asha@ves.ac.in',
      password: 'alllowercase1',
    })
    assert.match(errors.password, /uppercase/i)
  })

  it('validates sign-in email and password presence', () => {
    assert.deepEqual(validateSignInInput({ email: 'admin@univent.demo', password: 'x' }), {})
    assert.ok(validateSignInInput({ email: 'bad', password: '' }).email)
    assert.ok(validateSignInInput({ email: 'admin@univent.demo', password: '' }).password)
  })

  it('validates a six-digit confirmation code', () => {
    assert.deepEqual(validateConfirmationInput({ code: '123456' }), {})
    assert.ok(validateConfirmationInput({ code: '123' }).code)
    assert.ok(validateConfirmationInput({ code: 'abcdef' }).code)
  })
})

describe('Cognito role mapping', () => {
  it('maps admin and organization groups with admin precedence', () => {
    assert.equal(roleFromGroups(['admins']), 'admin')
    assert.equal(roleFromGroups('organizations'), 'organization')
    assert.equal(roleFromGroups(['organizations', 'admins']), 'admin')
    assert.equal(roleFromGroups([]), 'student')
  })

  it('maps roles to their workspaces', () => {
    assert.equal(getDashboardPathForRole('student'), '/dashboard')
    assert.equal(getDashboardPathForRole('organization'), '/org')
    assert.equal(getDashboardPathForRole('admin'), '/admin')
  })

  it('sends unknown roles to the public events list instead of looping', () => {
    assert.equal(getDashboardPathForRole('unknown'), '/events')
    assert.equal(getDashboardPathForRole(undefined), '/events')
  })
})
