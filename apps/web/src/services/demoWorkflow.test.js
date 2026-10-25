import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  createOrgEvent,
  listAllOrgEvents,
  listOrgEvents,
  moderateOrgEvent,
  submitOrgEventForApproval,
  updateOrgEvent,
} from './orgEvents.js'
import { getPlatformSummary, listPlatformEvents } from './admin.js'

const ORG_EMAIL = 'codecell@ves.ac.in'
const ORG_NAME = 'CodeCell'

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

  clear() {
    this.data.clear()
  }
}

const storage = new MemoryStorage()

const INPUT = {
  title: 'Demo Workflow Event',
  description: 'A demo event used to verify the organization and admin approval flow.',
  category: 'Technical',
  bannerUrl: '',
  date: '2026-12-10',
  startTime: '10:00',
  endTime: '12:00',
  venue: 'Seminar Hall C',
  regDeadline: '2026-12-09',
  capacity: 50,
}

before(() => {
  globalThis.localStorage = storage
})

beforeEach(() => {
  storage.clear()
})

async function platformRow(eventId) {
  const events = await listPlatformEvents()
  return events.find((e) => e.eventId === eventId)
}

async function orgRow(eventId) {
  const events = await listOrgEvents(ORG_EMAIL)
  return events.find((e) => e.eventId === eventId)
}

describe('organization and admin demo workflow', () => {
  it('keeps a saved draft out of the pending queue until it is submitted', async () => {
    const draft = await createOrgEvent(ORG_EMAIL, ORG_NAME, INPUT)

    assert.equal(draft.status, 'draft')
    assert.equal((await platformRow(draft.eventId)).status, 'draft')

    const submitted = await submitOrgEventForApproval(ORG_EMAIL, draft.eventId)

    assert.equal(submitted.status, 'pending')
    const adminRow = await platformRow(draft.eventId)
    assert.equal(adminRow.status, 'pending')
    assert.equal(adminRow.source, 'organization')
  })

  it('submits a new event directly into the admin pending queue', async () => {
    const submitted = await createOrgEvent(ORG_EMAIL, ORG_NAME, INPUT, { submit: true })

    assert.equal(submitted.status, 'pending')
    assert.equal((await platformRow(submitted.eventId)).status, 'pending')

    const summary = await getPlatformSummary()
    const pending = (await listAllOrgEvents()).filter((e) => e.status === 'pending')
    assert.ok(pending.some((e) => e.eventId === submitted.eventId))
    assert.ok(summary.pendingEventApprovals >= 1)
  })

  it('shows the organization that its event was approved', async () => {
    const submitted = await createOrgEvent(ORG_EMAIL, ORG_NAME, INPUT, { submit: true })

    const approved = await moderateOrgEvent(submitted.eventId, 'approve')

    assert.equal(approved.status, 'published')
    assert.equal((await orgRow(submitted.eventId)).status, 'published')
    assert.equal((await platformRow(submitted.eventId)).status, 'published')
  })

  it('shows the organization the rejection reason entered by the admin', async () => {
    const submitted = await createOrgEvent(ORG_EMAIL, ORG_NAME, INPUT, { submit: true })
    const reason = 'Venue booking could not be verified.'

    const rejected = await moderateOrgEvent(submitted.eventId, 'reject', reason)

    assert.equal(rejected.status, 'rejected')
    const row = await orgRow(submitted.eventId)
    assert.equal(row.status, 'rejected')
    assert.equal(row.moderationNote, reason)
    assert.equal((await platformRow(submitted.eventId)).status, 'rejected')
  })

  it('saves edits as a draft, then resubmits them only on the submit action', async () => {
    const draft = await createOrgEvent(ORG_EMAIL, ORG_NAME, INPUT)

    const saved = await updateOrgEvent(
      ORG_EMAIL,
      draft.eventId,
      { ...INPUT, title: 'Updated Draft Event' },
      { submit: false },
    )
    assert.equal(saved.status, 'draft')
    assert.equal(saved.title, 'Updated Draft Event')

    const submitted = await updateOrgEvent(
      ORG_EMAIL,
      draft.eventId,
      { ...INPUT, title: 'Resubmitted Event' },
      { submit: true },
    )
    assert.equal(submitted.status, 'pending')
    assert.equal(submitted.title, 'Resubmitted Event')
    assert.equal((await platformRow(draft.eventId)).status, 'pending')
  })
})
