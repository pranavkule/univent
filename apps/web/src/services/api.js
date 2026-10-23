import { API_BASE_URL, API_MODE } from './apiConfig.js'
import { getAuthHeaders } from './auth.js'
import { createLiveApi } from './liveApi.js'
import * as mockApi from './mockApi.js'

export { ApiError } from './apiError.js'
export { API_MODE }

const impl = API_MODE === 'live'
  ? createLiveApi({ baseUrl: API_BASE_URL, getAuthHeaders })
  : mockApi

export const validateRegistrationInput = mockApi.validateRegistrationInput
export const listMockRegistrations = mockApi.listMockRegistrations

export function listEvents(...args) {
  return impl.listEvents(...args)
}

export function getEvent(...args) {
  return impl.getEvent(...args)
}

export function createEvent(...args) {
  return impl.createEvent(...args)
}

export function createRegistration(...args) {
  return impl.createRegistration(...args)
}

export function listRegistrations(...args) {
  return impl.listRegistrations(...args)
}

export function getRegistration(...args) {
  return impl.getRegistration(...args)
}

export function cancelRegistration(...args) {
  return impl.cancelRegistration(...args)
}
