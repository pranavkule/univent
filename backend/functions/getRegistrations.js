// GET /registrations - list registrations
exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'getRegistrations not implemented yet' }),
  }
}
