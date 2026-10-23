import * as cognitoAuth from './authCognito.js'
import * as mockAuth from './authMock.js'
import { ALLOWED_EMAIL_DOMAIN, AUTH_MODE } from './authConfig.js'
import {
  getDashboardPathForRole,
  roleFromGroups,
} from './authRoles.js'
import {
  validateConfirmationInput,
  validateSignInInput,
  validateSignUpInput as validateSignUpWithDomain,
} from './authValidation.js'

const auth = AUTH_MODE === 'cognito' ? cognitoAuth : mockAuth

export { AUTH_MODE, getDashboardPathForRole, roleFromGroups, validateConfirmationInput, validateSignInInput }
export { DEMO_ACCOUNTS, DEMO_PASSWORD, listMockUsers } from './authMock.js'

export function validateSignUpInput(values) {
  return validateSignUpWithDomain(values, ALLOWED_EMAIL_DOMAIN)
}

export function getCurrentUser() {
  return typeof auth.getCurrentUser === 'function' ? auth.getCurrentUser() : null
}

export function signUp(input) {
  return auth.signUp(input)
}

export function confirmSignUp(input) {
  return auth.confirmSignUp(input)
}

export function resendConfirmationCode(input) {
  return auth.resendConfirmationCode(input)
}

export function signIn(input) {
  return auth.signIn(input)
}

export function signOut() {
  return auth.signOut()
}

export function restoreSession() {
  return auth.restoreSession()
}

export function getIdToken() {
  return auth.getIdToken()
}

export function getAuthHeaders() {
  return auth.getAuthHeaders()
}
