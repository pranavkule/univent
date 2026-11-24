import * as cognitoAuth from './authCognito.js'
import { ALLOWED_EMAIL_DOMAIN } from './authConfig.js'
import {
  getDashboardPathForRole,
  roleFromGroups,
} from './authRoles.js'
import {
  validateConfirmationInput,
  validateNewPasswordInput,
  validateSignInInput,
  validateSignUpInput as validateSignUpWithDomain,
} from './authValidation.js'

export {
  getDashboardPathForRole,
  roleFromGroups,
  validateConfirmationInput,
  validateNewPasswordInput,
  validateSignInInput,
}

export function validateSignUpInput(values) {
  return validateSignUpWithDomain(values, ALLOWED_EMAIL_DOMAIN)
}

export function signUp(input) {
  return cognitoAuth.signUp(input)
}

export function confirmSignUp(input) {
  return cognitoAuth.confirmSignUp(input)
}

export function resendConfirmationCode(input) {
  return cognitoAuth.resendConfirmationCode(input)
}

export function signIn(input) {
  return cognitoAuth.signIn(input)
}

export function completeNewPassword(password) {
  return cognitoAuth.completeNewPassword(password)
}

export function signOut() {
  return cognitoAuth.signOut()
}

export function restoreSession() {
  return cognitoAuth.restoreSession()
}

export function getIdToken() {
  return cognitoAuth.getIdToken()
}

export function getAuthHeaders() {
  return cognitoAuth.getAuthHeaders()
}
