// GET /events - list all events
exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'getEvents not implemented yet' }),
  }
}
