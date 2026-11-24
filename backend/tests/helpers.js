// Test helpers: build API Gateway (REST API, payload format 1.0) proxy events
// and invoke the handlers with them.
function proxyEvent({
  method = 'GET',
  path = '/events',
  body = null,
  query = null,
  pathParameters = null,
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
    pathParameters,
    stageVariables: null,
    requestContext: { requestId: 'local-test-request', authorizer },
    body: body === null ? null : typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  }
}

// Cognito user pool authorizer claims (REST API shape).
function cognitoAuthorizer({
  sub = 'test-sub',
  email = '',
  name = 'Test User',
  groups = [],
  emailVerified = true,
} = {}) {
  return {
    claims: {
      sub,
      email,
      name,
      email_verified: emailVerified ? 'true' : 'false',
      'cognito:groups': groups,
    },
  }
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

module.exports = { proxyEvent, cognitoAuthorizer, cognitoJwtAuthorizer, invoke }
