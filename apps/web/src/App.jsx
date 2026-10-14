import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './components/AuthProvider.jsx'
import { ThemeProvider } from './components/ThemeProvider.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import Footer from './components/Footer.jsx'
import Navbar from './components/Navbar.jsx'
import OrgLayout from './components/OrgLayout.jsx'
import OrgRoute from './components/OrgRoute.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Confirmation from './pages/Confirmation.jsx'
import Dashboard from './pages/Dashboard.jsx'
import EventDetails from './pages/EventDetails.jsx'
import Events from './pages/Events.jsx'
import Landing from './pages/Landing.jsx'
import Register from './pages/Register.jsx'
import SignIn from './pages/SignIn.jsx'
import SignUp from './pages/SignUp.jsx'
import StudentProfile from './pages/StudentProfile.jsx'
import StudentRegistrations from './pages/StudentRegistrations.jsx'
import AdminEvents from './pages/admin/AdminEvents.jsx'
import AdminOrganizations from './pages/admin/AdminOrganizations.jsx'
import AdminOverview from './pages/admin/AdminOverview.jsx'
import AdminReports from './pages/admin/AdminReports.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import OrgDashboard from './pages/org/OrgDashboard.jsx'
import OrgEventForm from './pages/org/OrgEventForm.jsx'
import OrgEvents from './pages/org/OrgEvents.jsx'
import OrgProfile from './pages/org/OrgProfile.jsx'
import OrgRegistrations from './pages/org/OrgRegistrations.jsx'

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Navbar />
        <main id="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route
              path="/events/:id/register"
              element={<ProtectedRoute><Register /></ProtectedRoute>}
            />
            <Route path="/confirmation/:id" element={<Confirmation />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            <Route
              path="/dashboard"
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
            />
            <Route
              path="/registrations"
              element={<ProtectedRoute><StudentRegistrations /></ProtectedRoute>}
            />
            <Route
              path="/profile"
              element={<ProtectedRoute><StudentProfile /></ProtectedRoute>}
            />
            <Route
              path="/admin"
              element={<AdminRoute><AdminLayout /></AdminRoute>}
            >
              <Route index element={<AdminOverview />} />
              <Route path="organizations" element={<AdminOrganizations />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>
            <Route
              path="/org"
              element={<OrgRoute><OrgLayout /></OrgRoute>}
            >
              <Route index element={<OrgDashboard />} />
              <Route path="events" element={<OrgEvents />} />
              <Route path="events/new" element={<OrgEventForm />} />
              <Route path="events/:id/edit" element={<OrgEventForm />} />
              <Route path="registrations" element={<OrgRegistrations />} />
              <Route path="profile" element={<OrgProfile />} />
            </Route>
            <Route path="*" element={<Landing />} />
          </Routes>
        </main>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  )
}
