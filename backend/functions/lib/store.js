// Storage seam.
//
// The handlers only ever talk to the interface returned by getStore(), never
// to a concrete database. Phase 3 ships the temporary in-memory store;
// Phase 4 adds the DynamoDB-backed store behind the same interface.
//
// UNIVENT_STORE selects the implementation: "memory" (default) or
// "dynamodb". An unknown value fails loudly instead of silently falling back.
const { createMemoryStore } = require('./memoryStore')

let instance = null

function createStore() {
  const mode = (process.env.UNIVENT_STORE || 'memory').toLowerCase()
  if (mode === 'memory') return createMemoryStore()
  if (mode === 'dynamodb') {
    const { createDynamoStore } = require('./dynamoStore')
    return createDynamoStore()
  }
  throw new Error(`Unsupported UNIVENT_STORE mode: ${mode}`)
}

function getStore() {
  if (!instance) instance = createStore()
  return instance
}

// Test support: drop the current store so the next request starts from the
// seeded sample data again.
function resetStore() {
  instance = null
}

module.exports = { createStore, getStore, resetStore }
