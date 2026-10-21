#!/usr/bin/env node
// Local development API server (not a deployment artifact).
//
// `sam local start-api` needs the SAM CLI and a running Docker daemon. This
// script mounts the same four routes on a plain Node HTTP server so the
// endpoints can be exercised with curl during development and demos.
//
//   node scripts/dev-api.js            # http://localhost:3000
//   PORT=4000 node scripts/dev-api.js
//
// The identity headers below are the local development ones; they only work
// when UNIVENT_DEV_AUTH=true and never inside AWS Lambda.
const http = require('node:http')
const { URL } = require('node:url')

const getEvents = require('../backend/functions/getEvents')
const createEvent = require('../backend/functions/createEvent')
const register = require('../backend/functions/register')
const getRegistrations = require('../backend/functions/getRegistrations')

const ROUTES = {
  'GET /events': getEvents.handler,
  'POST /events': createEvent.handler,
  'POST /register': register.handler,
  'GET /registrations': getRegistrations.handler,
}

const PORT = Number(process.env.PORT || 3000)
const MAX_BODY_LENGTH = 100000

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Univent-Role,X-Univent-Email,X-Univent-Name,X-Univent-Sub',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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
  console.log('Routes: GET /events | POST /events | POST /register | GET /registrations')
  console.log(`Development identity headers: ${process.env.UNIVENT_DEV_AUTH === 'true' ? 'ENABLED' : 'disabled'}`)
  console.log('Try: curl -H "x-univent-role: admin" -H "x-univent-email: admin@univent.demo" \\')
  console.log('       -H "Content-Type: application/json" \\')
  console.log('       -d \'{"title":"Hack Night","date":"2026-11-02","venue":"Seminar Hall A"}\' \\')
  console.log(`       http://localhost:${PORT}/events`)
})
