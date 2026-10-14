// MOCK AUTHENTICATION — Phase 2 prototype only.
// ---------------------------------------------------------------
// Limitations (will be replaced by Amazon Cognito in Phase 5):
// - Users live ONLY in this browser's localStorage; nothing is sent
//   anywhere and nothing is persisted on a server.
// - Passwords are stored as plain text in localStorage. Demo-only —
//   never do this in production. Demo credentials below are fake
//   development logins (Demo@123), NOT real passwords or AWS credentials.
// - This mock is NOT secure production authentication. Do not use it
//   for real accounts.
// - No email verification, no password reset, no sessions across devices.
// - Clearing browser storage wipes all mock accounts and sign-in state.
// Seam: pages/components use only the exported functions below, so Phase 5
// can swap the internals for Cognito without rewriting the UI.
// To remove the dev demo panel: delete components/DemoAccounts.jsx and its
// import in pages/SignIn.jsx — the sign-up/sign-in flow below is unchanged.

const USERS_KEY = 'univent.mock-users.v1'
const SESSION_KEY = 'univent.mock-session.v1'
const LATENCY_MS = 200

// --- Development-only demo accounts (frontend testing only) ---
// Mock password is intentionally the same public value for all three.
// NEVER put real passwords or AWS credentials here.
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

// Role → dashboard mapping. Students keep the participant dashboard;
// organizations land in the Organization workspace (/org);
// admins land in the Admin workspace (/admin).
export function getDashboardPathForRole(role) {
  switch ((role || '').toLowerCase()) {
    case 'organization':
      return '/org'
    case 'admin':
      return '/admin'
    case 'student':
    default:
      return '/dashboard'
  }
}

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
    // Normalize sessions created before roles existed.
    return { role: 'student', ...parsed }
  } catch {
    return null
  }
}

// Mock user directory for the Admin workspace. Returns SAFE fields only —
// name, email, role. Passwords and session tokens are NEVER exposed here.
// (No Cognito yet; this reads the same browser-local mock users.)
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
  const user = { name: clean.name, email: clean.email, password: clean.password, role: 'student' }
  writeUsers([...users, user])
  const session = { name: user.name, email: user.email, role: user.role }
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
  // Seed dev demo accounts so "Use Demo Account" works on a fresh browser
  // without a prior sign-up. Existing logins are never overwritten.
  if (ensureDemoAccounts(users)) writeUsers(users)
  const match = users.find((u) => u.email === cleanEmail && u.password === password)
  if (!match) throw new Error('Invalid email or password.')
  const session = { name: match.name, email: match.email, role: match.role || 'student' }
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
