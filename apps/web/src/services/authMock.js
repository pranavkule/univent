import { ALLOWED_EMAIL_DOMAIN, DEV_AUTH } from './authConfig.js'
import {
  validateSignInInput as validateMockSignInInput,
  validateSignUpInput as validateMockSignUpInput,
} from './authValidation.js'

const USERS_KEY = 'univent.mock-users.v1'
const SESSION_KEY = 'univent.mock-session.v1'
const LATENCY_MS = 200

export const DEMO_PASSWORD = 'Demo@123'

export const DEMO_ACCOUNTS = [
  {
    role: 'student',
    name: 'Demo Student',
    email: 'student@ves.ac.in',
    password: DEMO_PASSWORD,
    dashboard: '/dashboard',
    blurb: 'Browse events & manage own registrations',
  },
  {
    role: 'organization',
    name: 'CodeCell (Org)',
    email: 'codecell@ves.ac.in',
    password: DEMO_PASSWORD,
    dashboard: '/org',
    blurb: 'Manage org events, registrations & profile',
  },
  {
    role: 'admin',
    name: 'Demo Admin',
    email: 'admin@univent.demo',
    password: DEMO_PASSWORD,
    dashboard: '/admin',
    blurb: 'Platform overview, approvals & reports',
  },
]

const delay = (ms = LATENCY_MS) => new Promise((res) => setTimeout(res, ms))

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch {
    // private mode / quota — mock keeps working in memory for this load
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return { role: 'student', ...parsed }
  } catch {
    return null
  }
}

export function listMockUsers() {
  return readUsers().map((u) => ({
    name: u.name,
    email: u.email,
    role: u.role || 'student',
    status: 'Active',
  }))
}

function ensureDemoAccounts(users) {
  const byEmail = new Map(users.map((u) => [u.email, u]))
  let changed = false
  for (const d of DEMO_ACCOUNTS) {
    const existing = byEmail.get(d.email)
    if (!existing) {
      users.push({ name: d.name, email: d.email, password: d.password, role: d.role })
      changed = true
    } else if (!existing.role) {
      existing.role = d.role
      changed = true
    }
  }
  return changed
}

export function validateSignUpInput(values) {
  return validateMockSignUpInput(values, ALLOWED_EMAIL_DOMAIN)
}

export function validateSignInInput(values) {
  return validateMockSignInInput(values)
}

export async function signUp({ name, email, password }) {
  await delay()
  const clean = {
    name: (name || '').trim(),
    email: (email || '').trim().toLowerCase(),
    password: password || '',
  }
  const errors = validateSignUpInput(clean)
  if (Object.keys(errors).length > 0) throw new Error(Object.values(errors)[0])

  const users = readUsers()
  if (users.some((u) => u.email === clean.email)) {
    throw new Error('An account with this email already exists. Try signing in.')
  }
  const user = { name: clean.name, email: clean.email, password: clean.password, role: 'student' }
  writeUsers([...users, user])
  const session = { name: user.name, email: user.email, role: user.role }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // session just won't survive reload
  }
  return { needsConfirmation: false, user: session }
}

export async function confirmSignUp() {
  return { confirmed: true }
}

export async function resendConfirmationCode() {
  return { sent: true }
}

export async function signIn({ email, password }) {
  await delay()
  const cleanEmail = (email || '').trim().toLowerCase()
  const errors = validateSignInInput({ email: cleanEmail, password })
  if (Object.keys(errors).length > 0) throw new Error(Object.values(errors)[0])

  const users = readUsers()
  if (ensureDemoAccounts(users)) writeUsers(users)
  const match = users.find((u) => u.email === cleanEmail && u.password === password)
  if (!match) throw new Error('Invalid email or password.')
  const session = { name: match.name, email: match.email, role: match.role || 'student' }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
  }
  return session
}

export async function signOut() {
  await delay(100)
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
  }
}

export async function restoreSession() {
  return getCurrentUser()
}

export async function getIdToken() {
  return null
}

export async function getAuthHeaders() {
  if (!DEV_AUTH) return {}
  const user = getCurrentUser()
  if (!user) return {}
  return {
    'X-Univent-Role': user.role || 'student',
    'X-Univent-Email': user.email || '',
    'X-Univent-Name': user.name || '',
    'X-Univent-Sub': `mock-${user.email || 'user'}`,
  }
}
