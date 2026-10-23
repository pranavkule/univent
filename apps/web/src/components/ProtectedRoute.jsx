import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import { getDashboardPathForRole } from '../services/authRoles.js'

export default function ProtectedRoute({ children, roles = null }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }

  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />
  }

  return children
}
