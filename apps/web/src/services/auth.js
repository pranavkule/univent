// MOCK AUTHENTICATION — Phase 2 prototype only.
// ---------------------------------------------------------------
// Limitations (will be replaced by Amazon Cognito in Phase 5):
// - Users live ONLY in this browser's localStorage; nothing is sent
//   anywhere and nothing is persisted on a server.
// - Passwords are stored as plain text in localStorage. Demo-only —
//   never do this in production.
// - No email verification, no password reset, no sessions across devices.
// - Clearing browser storage wipes all mock accounts and sign-in state.
// Seam: pages/components use only the exported functions below, so Phase 5
// can swap the internals for Cognito without rewriting the UI.

const USERS_KEY = 'univent.mock-users.v1'
const SESSION_KEY = 'univent.mock-session.v1'
const LATENCY_MS = 200

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
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function validateSignUpInput({ name, email, password }) {
  const errors = {}
  if (!name || name.trim().length < 2) errors.name = 'Enter your full name (min 2 characters).'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (!password || password.length < 6) errors.password = 'Password needs at least 6 characters.'
  return errors
}

export function validateSignInInput({ email, password }) {
  const errors = {}
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (!password) errors.password = 'Enter your password.'
  return errors
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
  const user = { name: clean.name, email: clean.email, password: clean.password }
  writeUsers([...users, user])
  const session = { name: user.name, email: user.email }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore — session just won't survive reload
  }
  return session
}

export async function signIn({ email, password }) {
  await delay()
  const cleanEmail = (email || '').trim().toLowerCase()
  const errors = validateSignInInput({ email: cleanEmail, password })
  if (Object.keys(errors).length > 0) throw new Error(Object.values(errors)[0])

  const users = readUsers()
  const match = users.find((u) => u.email === cleanEmail && u.password === password)
  if (!match) throw new Error('Invalid email or password.')
  const session = { name: match.name, email: match.email }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
  return session
}

export async function signOut() {
  await delay(100)
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
