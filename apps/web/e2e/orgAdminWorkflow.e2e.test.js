import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const ACCOUNTS = {
  organization: 'codecell@ves.ac.in',
  admin: 'admin@univent.demo',
}

let server
let browser
let baseUrl

const EVENT_INPUT = {
  description: 'End-to-end demo event for the organization and admin approval workflow.',
  category: 'Technical',
  date: '2099-12-15',
  startTime: '10:00',
  endTime: '12:00',
  regDeadline: '2099-12-14',
  venue: 'Seminar Hall E2E',
  capacity: '50',
}

before(async () => {
  server = await createServer({ logLevel: 'error', server: { port: 0, strictPort: false } })
  await server.listen()
  baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '')
  browser = await chromium.launch({ channel: 'msedge', headless: true })
})

after(async () => {
  if (browser) await browser.close()
  if (server) await server.close()
})

async function openFreshPage() {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(`${baseUrl}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  return { context, page }
}

async function signIn(page, role) {
  await page.goto(`${baseUrl}/signin`)
  await page.getByRole('button', {
    name: `Use demo ${role} account ${ACCOUNTS[role]}`,
  }).click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => url.pathname === (role === 'admin' ? '/admin' : '/org'))
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Logout' }).click()
  await page.waitForURL((url) => url.pathname === '/')
}

async function fillEventForm(page, title) {
  await page.getByLabel('Event title').fill(title)
  await page.getByLabel('Description').fill(EVENT_INPUT.description)
  await page.getByLabel('Category').selectOption(EVENT_INPUT.category)
  await page.getByLabel('Maximum capacity').fill(EVENT_INPUT.capacity)
  await page.getByLabel('Event date').fill(EVENT_INPUT.date)
  await page.getByLabel('Registration deadline').fill(EVENT_INPUT.regDeadline)
  await page.getByLabel('Start time').fill(EVENT_INPUT.startTime)
  await page.getByLabel('End time').fill(EVENT_INPUT.endTime)
  await page.getByLabel('Venue').fill(EVENT_INPUT.venue)
}

function eventRow(page, title) {
  return page.locator('tbody tr').filter({ hasText: title })
}

describe('organization to admin demo workflow (browser E2E)', () => {
  it('keeps a draft out of pending, then submits, approves, and shows published to the org', async () => {
    const { context, page } = await openFreshPage()
    const title = `E2E Approval ${Date.now()}`
    try {
      await signIn(page, 'organization')
      await page.goto(`${baseUrl}/org/events/new`)
      await fillEventForm(page, title)
      await page.getByRole('button', { name: 'Save draft' }).click()
      await page.waitForURL((url) => url.pathname === '/org/events')
      await page.getByText(/Draft saved/).waitFor()
      await eventRow(page, title).getByText('Draft', { exact: true }).waitFor()
      await signOut(page)

      await signIn(page, 'admin')
      const pendingSection = page.locator('section[aria-labelledby="admin-pending-events"]')
      await pendingSection.waitFor()
      assert.equal(await pendingSection.getByText(title).count(), 0)
      await signOut(page)

      await signIn(page, 'organization')
      await page.goto(`${baseUrl}/org/events`)
      await eventRow(page, title).getByRole('button', { name: 'Submit', exact: true }).click()
      await page.getByText(/Event submitted for admin approval/).waitFor()
      await eventRow(page, title).getByText('Pending Approval', { exact: true }).waitFor()
      await signOut(page)

      await signIn(page, 'admin')
      await pendingSection.getByText(title).waitFor()
      await page.goto(`${baseUrl}/admin/events`)
      const adminRow = eventRow(page, title)
      await adminRow.getByRole('button', { name: 'Approve', exact: true }).click()
      await page.getByText(/Demo approval recorded/).waitFor()
      await adminRow.getByText('Published', { exact: true }).waitFor()
      await signOut(page)

      await signIn(page, 'organization')
      await page.goto(`${baseUrl}/org/events`)
      await eventRow(page, title).getByText('Published', { exact: true }).waitFor()
    } finally {
      await context.close()
    }
  })

  it('submits from the form and shows the admin rejection back on the organization event', async () => {
    const { context, page } = await openFreshPage()
    const title = `E2E Rejection ${Date.now()}`
    try {
      await signIn(page, 'organization')
      await page.goto(`${baseUrl}/org/events/new`)
      await fillEventForm(page, title)
      await page.getByRole('button', { name: 'Submit for approval' }).click()
      await page.waitForURL((url) => url.pathname === '/org/events')
      await page.getByText(/Event submitted for admin approval/).waitFor()
      await eventRow(page, title).getByText('Pending Approval', { exact: true }).waitFor()
      await signOut(page)

      await signIn(page, 'admin')
      await page.locator('section[aria-labelledby="admin-pending-events"]').getByText(title).waitFor()
      await page.goto(`${baseUrl}/admin/events`)
      await eventRow(page, title).getByRole('button', { name: 'Reject', exact: true }).click()
      await page.getByLabel('Reason').fill('Venue booking could not be verified.')
      await page.getByRole('button', { name: 'Confirm rejection' }).click()
      await page.getByText(/Demo rejection recorded/).waitFor()
      await eventRow(page, title).getByText('Rejected', { exact: true }).waitFor()
      await signOut(page)

      await signIn(page, 'organization')
      await page.goto(`${baseUrl}/org/events`)
      await eventRow(page, title).getByText('Rejected', { exact: true }).waitFor()
    } finally {
      await context.close()
    }
  })
})
