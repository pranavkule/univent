import { API_BASE_URL } from './apiConfig.js'
import { getAuthHeaders } from './auth.js'
import { createLiveApi } from './liveApi.js'

export { ApiError } from './apiError.js'

const impl = createLiveApi({ baseUrl: API_BASE_URL, getAuthHeaders })

export const listEvents = impl.listEvents
export const getEvent = impl.getEvent
export const createEvent = impl.createEvent
export const listOrganizationEvents = impl.listOrganizationEvents
export const updateEvent = impl.updateEvent
export const getOrganizationApplication = impl.getOrganizationApplication
export const submitOrganizationApplication = impl.submitOrganizationApplication
export const listOrganizationApplications = impl.listOrganizationApplications
export const decideOrganizationApplication = impl.decideOrganizationApplication
export const createRegistration = impl.createRegistration
export const listRegistrations = impl.listRegistrations
export const getRegistration = impl.getRegistration
export const cancelRegistration = impl.cancelRegistration
