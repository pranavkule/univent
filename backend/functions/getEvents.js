// GET /events - list all events (public route).
const { json, error, requestMethod } = require('./lib/http')
const { getStore } = require('./lib/store')
const { publicEvent } = require('./lib/serializers')

exports.handler = async (event) => {
  const method = requestMethod(event)
  if (method !== 'GET') {
    return error(405, `Method ${method || 'unknown'} is not allowed. Use GET.`, { Allow: 'GET' })
  }

  try {
    const events = getStore().listEvents().map(publicEvent)
    return json(200, { events })
  } catch (err) {
    console.error('getEvents failed:', err && err.message)
    return error(500, 'Unable to list events right now.')
  }
}
