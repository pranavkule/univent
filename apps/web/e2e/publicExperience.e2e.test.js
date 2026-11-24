import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const TEST_ENV = {
  VITE_API_URL: 'https://api.example.test',
  VITE_COGNITO_REGION: 'us-east-1',
  VITE_COGNITO_USER_POOL_ID: 'us-east-1_testpool',
  VITE_COGNITO_CLIENT_ID: 'test-client',
}

const originalEnv = {}
let server
let browser
let baseUrl

before(async () => {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    originalEnv[key] = process.env[key]
    process.env[key] = value
  }
  server = await createServer({ mode: 'test', logLevel: 'error', server: { port: 0, strictPort: false } })
  await server.listen()
  baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '')
  browser = await chromium.launch({ channel: 'msedge', headless: true })
})

after(async () => {
  if (browser) await browser.close()
  if (server) await server.close()
  for (const key of Object.keys(TEST_ENV)) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

describe('public experience', () => {
  it('shows static presentation data and no demo login controls', async () => {
    const page = await browser.newPage()
    await page.route('https://**', (route) => route.abort())
    try {
      await page.goto(`${baseUrl}/`)
      await page.getByRole('heading', { name: /Find your next campus experience/ }).waitFor()
      await page.getByRole('heading', { name: 'Meet the communities behind campus events' }).waitFor()
      await page.getByText('CodeCell', { exact: true }).waitFor()
      await page.getByText('Robotics Club', { exact: true }).waitFor()

      await page.goto(`${baseUrl}/signin`)
      await page.getByRole('heading', { name: 'Student sign in' }).waitFor()
      assert.equal(await page.getByText('Demo Accounts').count(), 0)
      assert.equal(await page.getByRole('button', { name: /Use demo/ }).count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).count(), 1)
    } finally {
      await page.close()
    }
  })

  it('submits separate organization credentials without creating a pending Cognito user', async () => {
    const page = await browser.newPage()
    let submitted
    await page.route('https://api.example.test/organization-applications', async (route) => {
      submitted = route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          application: {
            applicationId: 'application-test-id',
            status: 'PENDING_APPROVAL',
          },
        }),
      })
    })
    try {
      await page.goto(`${baseUrl}/org/signup`)
      await page.getByLabel('Official organization name').fill('Robotics Club')
      await page.getByLabel('Official organization email').fill('codecell@ves.ac.in')
      await page.getByLabel('Organization category or type').fill('Engineering')
      await page.getByLabel('Contact person name').fill('Aarav Mehta')
      await page.getByLabel('Contact person position').fill('Secretary')
      await page.getByLabel('Application details')
        .fill('Manage events and registrations for the club.')
      await page.getByLabel('Password', { exact: true }).fill('StrongPass123')
      await page.getByLabel('Confirm password').fill('StrongPass123')
      await page.getByRole('button', { name: 'Submit application' }).click()

      await page.getByRole('heading', { name: 'Application submitted' }).waitFor()
      await page.getByText(/No Cognito account is created until approval/).waitFor()
      assert.equal(await page.getByLabel('Password', { exact: true }).count(), 0)
      assert.deepEqual(submitted, {
        organizationName: 'Robotics Club',
        applicantName: 'Aarav Mehta',
        officialEmail: 'codecell@ves.ac.in',
        department: 'Engineering',
        representativeTitle: 'Secretary',
        representativePhone: '',
        reason: 'Manage events and registrations for the club.',
        password: 'StrongPass123',
      })
    } finally {
      await page.close()
    }
  })
})
