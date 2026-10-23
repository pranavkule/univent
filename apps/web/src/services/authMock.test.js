import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

class MemoryStorage {
  constructor() {
    this.data = new Map()
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null
  }

  setItem(key, value) {
    this.data.set(key, String(value))
  }

  removeItem(key) {
    this.data.delete(key)
  }
}

let auth

before(async () => {
  globalThis.localStorage = new MemoryStorage()
  auth = await import('./authMock.js')
})

describe('mock auth flow', () => {
  it('signs in a seeded demo student', async () => {
    const user = await auth.signIn({ email: 'student@ves.ac.in', password: auth.DEMO_PASSWORD })
    assert.equal(user.role, 'student')
    assert.equal(auth.getCurrentUser().email, 'student@ves.ac.in')
    await auth.signOut()
    assert.equal(auth.getCurrentUser(), null)
  })

  it('rejects non-college sign-up and persists a valid one', async () => {
    await assert.rejects(
      auth.signUp({ name: 'Asha Sharma', email: 'asha@gmail.com', password: 'Demo@123' }),
      /ves\.ac\.in/,
    )

    const result = await auth.signUp({
      name: 'Asha Sharma',
      email: 'ASHA@ves.ac.in',
      password: 'Demo@123',
    })
    assert.equal(result.needsConfirmation, false)
    assert.equal(result.user.email, 'asha@ves.ac.in')

    await auth.signOut()
    const signedIn = await auth.signIn({ email: 'asha@ves.ac.in', password: 'Demo@123' })
    assert.equal(signedIn.name, 'Asha Sharma')
  })

  it('does not emit dev identity headers unless explicitly enabled', async () => {
    assert.deepEqual(await auth.getAuthHeaders(), {})
  })
})
