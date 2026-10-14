import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

// Organization-only gate. Signed-out users go to /signin; signed-in users
// with any other role fall back to the events list. Frontend routing is a
// UX convenience only — real authorization must be enforced by the backend
// (API Gateway/Lambda) once it exists.
export default function OrgRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  if ((user.role || '').toLowerCase() !== 'organization') {
    return <Navigate to="/events" replace />
  }
  return children
}
