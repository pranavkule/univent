import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

// Gates a route behind mock sign-in. Signed-out users go to /signin and
// are sent back afterwards (via location.state.from).
export default function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  return children
}
