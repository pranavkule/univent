import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  AUTH_MODE,
  confirmSignUp as authConfirmSignUp,
  resendConfirmationCode as authResendCode,
  restoreSession,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  signUpOrganizationApplicant as authSignUpOrganizationApplicant,
} from '../services/auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [organizationApplicationState, setOrganizationApplicationState] = useState({
    email: '',
    application: null,
    loading: false,
    error: '',
  })

  useEffect(() => {
    let active = true
    restoreSession()
      .then((session) => {
        if (active) {
          setUser(session)
          setOrganizationApplicationState({
            email: session?.email || '',
            application: null,
            loading: Boolean(session && session.role === 'student'),
            error: '',
          })
        }
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

  const signUp = useCallback(async (input) => {
    const result = await authSignUp(input)
    if (result.user) {
      setOrganizationApplicationState({
        email: result.user.email || '',
        application: null,
        loading: result.user.role === 'student',
        error: '',
      })
      setUser(result.user)
    }
    return result
  }, [])

  const signUpOrganizationApplicant = useCallback(async (input) => {
    const result = await authSignUpOrganizationApplicant(input)
    if (result.user) {
      setOrganizationApplicationState({
        email: result.user.email || '',
        application: null,
        loading: result.user.role === 'student',
        error: '',
      })
      setUser(result.user)
    }
    return result
  }, [])

  const signIn = useCallback(async (input) => {
    const session = await authSignIn(input)
    setOrganizationApplicationState({
      email: session.email || '',
      application: null,
      loading: session.role === 'student',
      error: '',
    })
    setUser(session)
    return session
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authSignOut()
    } finally {
      setOrganizationApplicationState({
        email: '',
        application: null,
        loading: false,
        error: '',
      })
      setUser(null)
    }
  }, [])

  const updateOrganizationApplication = useCallback((application) => {
    setOrganizationApplicationState({
      email: user?.email || '',
      application,
      loading: false,
      error: '',
    })
  }, [user])

  const confirmSignUp = useCallback((input) => authConfirmSignUp(input), [])
  const resendConfirmationCode = useCallback((input) => authResendCode(input), [])

  const value = useMemo(
    () => ({
      user,
      authMode: AUTH_MODE,
      loading,
      signUp,
      signUpOrganizationApplicant,
      signIn,
      signOut,
      organizationApplicationState,
      setOrganizationApplicationState,
      updateOrganizationApplication,
      confirmSignUp,
      resendConfirmationCode,
    }),
    [
      user,
      loading,
      signUp,
      signUpOrganizationApplicant,
      signIn,
      signOut,
      organizationApplicationState,
      updateOrganizationApplication,
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
