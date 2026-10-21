// Identifier generation for events and registrations.
const crypto = require('node:crypto')

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

module.exports = { makeId }
