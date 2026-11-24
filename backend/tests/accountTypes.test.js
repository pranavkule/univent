const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const postConfirmation = require('../functions/postConfirmation')

describe('Cognito post-confirmation behavior', () => {
  it('preserves student confirmation without relying on undeployed custom attributes', async () => {
    const event = {
      triggerSource: 'PostConfirmation_ConfirmSignUp',
      userPoolId: 'pool-id',
      userName: 'student@ves.ac.in',
      request: { userAttributes: { sub: 'student-sub', email: 'student@ves.ac.in' } },
      response: {},
    }

    assert.equal(await postConfirmation.handler(event), event)
  })
})
