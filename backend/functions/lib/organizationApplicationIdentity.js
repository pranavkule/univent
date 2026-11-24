const { createHash } = require('node:crypto')

function duplicateKeyForApplication(values) {
  const officialEmail = String(values.officialEmail || values.applicantEmail || '')
    .trim()
    .toLowerCase()
  return createHash('sha256')
    .update(officialEmail)
    .digest('hex')
}

module.exports = { duplicateKeyForApplication }
