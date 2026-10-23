#!/usr/bin/env node
// Idempotent manual seeding for the sample events. This is never invoked by a
// Lambda handler. Existing events are never overwritten and counters are never
// reset.
const { configFromArgs, seedSampleEvents } = require('./lib/dynamoAdmin')

async function main() {
  try {
    const config = configFromArgs(process.argv.slice(2))
    const summary = await seedSampleEvents(config)
    console.log(JSON.stringify(summary))
    if (summary.failed > 0) process.exitCode = 1
  } catch (err) {
    console.error(err && err.message ? err.message : err)
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = { main }
