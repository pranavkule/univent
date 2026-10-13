// POST /register - register for an event
exports.handler = async (event) => {
  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'register not implemented yet' }),
  }
}
