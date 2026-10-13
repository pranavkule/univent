// POST /events - create a new event
exports.handler = async (event) => {
  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'createEvent not implemented yet' }),
  }
}
