import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { getCurrentUser, signIn as mockSignIn, signOut as mockSignOut, signUp as mockSignUp } from '../services/auth.js'

// Thin React wrapper over services/auth.js. Pages use useAuth() so the
// Phase 5 Cognito swap only touches this provider + the auth service.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser())

  const signUp = useCallback(async (input) => {
    const session = await mockSignUp(input)
    setUser(session)
    return session
  }, [])

  const signIn = useCallback(async (input) => {
    const session = await mockSignIn(input)
    setUser(session)
    return session
  }, [])

  const signOut = useCallback(async () => {
    await mockSignOut()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, signUp, signIn, signOut }), [user, signUp, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
