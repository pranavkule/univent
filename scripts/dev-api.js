#!/usr/bin/env node
// Local public events endpoint for development (not a deployment artifact).
// Protected routes require API Gateway's Cognito authorizer.
const http = require('node:http')
const { URL } = require('node:url')

const getEvents = require('../backend/functions/getEvents')

const ROUTES = {
  'GET /events': getEvents.handler,
}

const PORT = Number(process.env.PORT || 3000)
const MAX_BODY_LENGTH = 100000

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  }
}

function toProxyEvent(req, url, bodyText) {
  const query = {}
  for (const [key, value] of url.searchParams.entries()) query[key] = value
  return {
    resource: url.pathname,
    path: url.pathname,
    httpMethod: req.method,
    headers: req.headers,
    multiValueHeaders: {},
    queryStringParameters: Object.keys(query).length > 0 ? query : null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: { requestId: `local-${Date.now()}`, authorizer: null },
    body: bodyText === '' ? null : bodyText,
    isBase64Encoded: false,
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > MAX_BODY_LENGTH) {
        reject(new Error('Request body is too large.'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  const handler = ROUTES[`${req.method} ${url.pathname}`]
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json', ...corsHeaders() })
    res.end(JSON.stringify({ message: `Route ${req.method} ${url.pathname} not found.` }))
    console.log(`${req.method} ${url.pathname} -> 404`)
    return
  }

  let bodyText = ''
  try {
    bodyText = await readBody(req)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders() })
    res.end(JSON.stringify({ message: 'Request body is too large.' }))
    return
  }

  try {
    const result = await handler(toProxyEvent(req, url, bodyText))
    res.writeHead(result.statusCode, result.headers)
    res.end(result.body)
    console.log(`${req.method} ${url.pathname} -> ${result.statusCode}`)
  } catch (err) {
    console.error('Unhandled error:', err && err.message)
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders() })
    res.end(JSON.stringify({ message: 'Internal server error.' }))
  }
})

server.listen(PORT, () => {
  console.log(`UniVent local API listening on http://localhost:${PORT}`)
  console.log('Public route: GET /events')
  console.log('Protected routes require API Gateway with a Cognito authorizer.')
})
