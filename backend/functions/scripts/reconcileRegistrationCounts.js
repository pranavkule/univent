#!/usr/bin/env node
// One-time reconciliation for existing Events items.
//
// Initializes missing/unready registration counters from confirmed
// registrations. Existing initialized counters are never overwritten unless
// --force is supplied. Writes must be paused before a forced repair.
const { configFromArgs, reconcileCounts } = require('./lib/dynamoAdmin')

async function main() {
  try {
    const config = configFromArgs(process.argv.slice(2))
    if (config.force) {
      console.warn('WARNING: --force repairs drift. Pause all registration writes first.')
    }
    const summary = await reconcileCounts(config)
    console.log(JSON.stringify(summary))
    if (summary.failed > 0 || summary.remainingProblems.length > 0) {
      process.exitCode = 1
    }
  } catch (err) {
    console.error(err && err.message ? err.message : err)
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = { main }
