// Test helpers: build API Gateway (REST API, payload format 1.0) proxy events
// and invoke the handlers with them.
function proxyEvent({
  method = 'GET',
  path = '/events',
  body = null,
  query = null,
  headers = {},
  authorizer = null,
} = {}) {
  return {
    resource: path,
    path,
    httpMethod: method,
    headers: { 'Content-Type': 'application/json', ...headers },
    multiValueHeaders: {},
    queryStringParameters: query,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: { requestId: 'local-test-request', authorizer },
    body: body === null ? null : typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  }
}

// Local development identity headers (only honoured when UNIVENT_DEV_AUTH
// is enabled and the code is not running inside AWS Lambda).
function devHeaders(role, email, name = 'Test User') {
  return {
    'x-univent-role': role,
    'x-univent-email': email,
    'x-univent-name': name,
  }
}

// Cognito user pool authorizer claims (REST API shape).
function cognitoAuthorizer({ sub = 'test-sub', email = '', name = 'Test User', groups = [] } = {}) {
  return { claims: { sub, email, name, 'cognito:groups': groups } }
}

// Cognito authorizer claims (HTTP API JWT shape).
function cognitoJwtAuthorizer({ sub = 'test-sub', email = '', name = 'Test User', groups = [] } = {}) {
  return { jwt: { claims: { sub, email, name, 'cognito:groups': groups } } }
}

async function invoke(handler, options = {}) {
  const result = await handler(proxyEvent(options))
  let parsed = null
  try {
    parsed = JSON.parse(result.body)
  } catch {
    parsed = null
  }
  return { statusCode: result.statusCode, headers: result.headers, body: result.body, json: parsed }
}

module.exports = { proxyEvent, devHeaders, cognitoAuthorizer, cognitoJwtAuthorizer, invoke }
