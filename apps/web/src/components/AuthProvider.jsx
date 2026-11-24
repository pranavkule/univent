import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  confirmSignUp as authConfirmSignUp,
  completeNewPassword as authCompleteNewPassword,
  resendConfirmationCode as authResendCode,
  restoreSession,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
} from '../services/auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    restoreSession()
      .then((session) => {
        if (active) setUser(session)
      })
      .catch((err) => {
        if (active) setAuthError(err.message || 'Could not restore your session.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const signUp = useCallback((input) => authSignUp(input), [])

  const signIn = useCallback(async (input) => {
    const session = await authSignIn(input)
    if (session?.requiresPasswordChange) return session
    setUser(session)
    return session
  }, [])

  const completeNewPassword = useCallback(async (password) => {
    const session = await authCompleteNewPassword(password)
    setUser(session)
    return session
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authSignOut()
    } finally {
      setUser(null)
    }
  }, [])

  const confirmSignUp = useCallback((input) => authConfirmSignUp(input), [])
  const resendConfirmationCode = useCallback((input) => authResendCode(input), [])

  const value = useMemo(
    () => ({
      user,
      loading,
      signUp,
      signIn,
      completeNewPassword,
      signOut,
      confirmSignUp,
      resendConfirmationCode,
    }),
    [
      user,
      loading,
      signUp,
      signIn,
      completeNewPassword,
      signOut,
      confirmSignUp,
      resendConfirmationCode,
    ],
  )

  if (loading) {
    return <div className="container"><div className="skeleton">Loading…</div></div>
  }

  if (authError) {
    return (
      <div className="container">
        <div className="alert alert-error" role="alert">{authError}</div>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
