import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from 'amazon-cognito-identity-js'

import { COGNITO, assertCognitoConfig } from './authConfig.js'
import { accountTypeFromClaims, roleFromGroups } from './authRoles.js'

const pools = new Map()
let passwordChangeUser = null

function getPool(clientId = COGNITO.clientId) {
  assertCognitoConfig()
  if (!clientId) throw new Error('A Cognito app client is required for this authentication action.')
  if (clientId !== COGNITO.clientId) {
    throw new Error('The Cognito app client is not configured for this authentication action.')
  }
  if (!pools.has(clientId)) {
    pools.set(clientId, new CognitoUserPool({
      UserPoolId: COGNITO.userPoolId,
      ClientId: clientId,
    }))
  }
  return pools.get(clientId)
}

function cognitoUser(email, clientId) {
  return new CognitoUser({
    Username: String(email || '').trim().toLowerCase(),
    Pool: getPool(clientId),
  })
}

function publicUserFromClaims(claims) {
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : ''
  const name = String(claims.name || claims.email || '').trim()
  return {
    name,
    email,
    role: roleFromGroups(claims['cognito:groups']),
    accountType: accountTypeFromClaims(claims),
    groups: claims['cognito:groups'] || [],
  }
}

function publicUserFromSession(session) {
  if (!session || typeof session.isValid !== 'function' || !session.isValid()) {
    throw new Error('Your session has expired. Sign in again.')
  }
  return publicUserFromClaims(session.getIdToken().decodePayload())
}

function sessionForUser(user) {
  return new Promise((resolve, reject) => {
    user.getSession((err, session) => {
      if (err) {
        reject(err)
        return
      }
      try {
        resolve({ user, session })
      } catch (sessionErr) {
        reject(sessionErr)
      }
    })
  })
}

function mapError(err, action = 'signin') {
  const name = err && err.name
  if (name === 'NotAuthorizedException') {
    return new Error('Invalid email or password.')
  }
  if (name === 'UserNotFoundException') {
    return new Error(
      action === 'signin'
        ? 'Invalid email or password.'
        : 'No account was found for that email.',
    )
  }
  if (name === 'UserNotConfirmedException') {
    return new Error('Confirm your email address before signing in.')
  }
  if (name === 'UsernameExistsException') {
    return new Error('An account with this email already exists. Try signing in.')
  }
  if (name === 'CodeMismatchException') {
    return new Error('That confirmation code is incorrect.')
  }
  if (name === 'ExpiredCodeException') {
    return new Error('That confirmation code has expired. Request a new one.')
  }
  if (name === 'LimitExceededException' || name === 'TooManyRequestsException') {
    return new Error('Too many attempts. Wait a moment and try again.')
  }
  if (name === 'InvalidPasswordException') {
    return new Error(err.message || 'Choose a stronger password.')
  }
  return new Error((err && err.message) || 'Authentication failed. Try again.')
}

async function signUpWithClient({ name, email, password }, clientId) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const cleanName = String(name || '').trim()
  const attributes = [
    new CognitoUserAttribute({ Name: 'email', Value: cleanEmail }),
    new CognitoUserAttribute({ Name: 'name', Value: cleanName }),
  ]

  return new Promise((resolve, reject) => {
    getPool(clientId).signUp(cleanEmail, password, attributes, null, (err, result) => {
      if (err) {
        reject(mapError(err))
        return
      }
      resolve({
        needsConfirmation: result.userConfirmed === false,
        email: result.user.getUsername(),
        name: cleanName,
        clientId,
      })
    })
  })
}

export function signUp(input) {
  return signUpWithClient(input, COGNITO.clientId)
}

export async function confirmSignUp({ email, code, clientId }) {
  const user = cognitoUser(email, clientId || COGNITO.clientId)
  return new Promise((resolve, reject) => {
    user.confirmRegistration(String(code || '').trim(), true, (err, result) => {
      if (err) {
        reject(mapError(err, 'confirm'))
        return
      }
      resolve({ confirmed: true, result })
    })
  })
}

export async function resendConfirmationCode({ email, clientId }) {
  const user = cognitoUser(email, clientId || COGNITO.clientId)
  return new Promise((resolve, reject) => {
    user.resendConfirmationCode((err, result) => {
      if (err) {
        reject(mapError(err, 'resend'))
        return
      }
      resolve({ sent: true, result })
    })
  })
}

export async function signIn({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const user = cognitoUser(cleanEmail)
  const details = new AuthenticationDetails({
    Username: cleanEmail,
    Password: password,
  })

  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (session) => {
        try {
          resolve(publicUserFromSession(session))
        } catch (err) {
          reject(mapError(err))
        }
      },
      onFailure: (err) => reject(mapError(err)),
      newPasswordRequired: () => {
        passwordChangeUser = user
        resolve({ requiresPasswordChange: true })
      },
    })
  })
}

export async function completeNewPassword(newPassword) {
  const user = passwordChangeUser
  if (!user) throw new Error('No Cognito password-change challenge is active. Sign in again.')
  return new Promise((resolve, reject) => {
    user.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => {
        passwordChangeUser = null
        try {
          resolve(publicUserFromSession(session))
        } catch (err) {
          reject(mapError(err))
        }
      },
      onFailure: (err) => reject(mapError(err)),
    })
  })
}

export async function signOut() {
  passwordChangeUser = null
  const user = getPool().getCurrentUser()
  if (user) user.signOut()
}

export async function restoreSession() {
  const user = getPool().getCurrentUser()
  if (!user) return null
  try {
    const result = await sessionForUser(user)
    return publicUserFromSession(result.session)
  } catch {
    user.signOut()
    return null
  }
}

export async function getIdToken() {
  const user = getPool().getCurrentUser()
  if (!user) return null
  const result = await sessionForUser(user)
  return result.session.getIdToken().getJwtToken()
}

export async function getAuthHeaders() {
  const token = await getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
