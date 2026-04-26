import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import NetworkBanner from './components/NetworkBanner';
import GlobalAlertBanner from './components/GlobalAlertBanner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SOSScreen from './pages/SOSScreen';
import IncidentRoom from './pages/IncidentRoom';
import MapView from './pages/MapView';
import Analytics from './pages/Analytics';
import IncidentsList from './pages/IncidentsList';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import OrganizationSetup from './pages/OrganizationSetup';
import RoleManagement from './pages/RoleManagement';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isAuthReady, isGuestVerified } = useAuth();
  const location = window.location.pathname;

  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-primary transition-colors duration-500">
        <NetworkBanner />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-accent-emergency border-t-transparent rounded-full animate-spin shadow-lg shadow-red-500/20"></div>
            <p className="text-text-secondary font-black uppercase tracking-widest text-[10px] animate-pulse">Initializing TRISHAK...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user && !profile?.uniqueId) {
    return <Navigate to="/login" />;
  }

  // If user is logged in but has no profile, redirect to login to complete onboarding
  if (!profile) {
    return <Navigate to="/login" />;
  }

  // If role is guest, must be verified
  if (profile.role === 'guest' && !isGuestVerified) {
    return <Navigate to="/login" />;
  }

  // If Admin has no organization, redirect to setup (unless already there)
  if (profile.role === 'admin' && !profile.organizationId && location !== '/setup-organization') {
    return <Navigate to="/setup-organization" />;
  }

  // If already has organization, don't allow going back to setup
  if (profile.organizationId && location === '/setup-organization') {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NetworkBanner />
      <GlobalAlertBanner />
      <Layout>{children}</Layout>
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  return <RoleRoute allowedRoles={['admin']}>{children}</RoleRoute>;
}

function RoleRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) {
  const { profile, loading } = useAuth();
  
  if (loading) return null;
  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col">
          <Routes>
            <Route path="/login" element={
              <>
                <NetworkBanner />
                <Login />
              </>
            } />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            {/* ... other routes ... */}

          <Route path="/sos" element={
            <ProtectedRoute>
              <SOSScreen />
            </ProtectedRoute>
          } />

          <Route path="/incidents" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['receptionist', 'staff', 'security', 'admin']}>
                <IncidentsList />
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/incident/:id" element={
            <ProtectedRoute>
              <IncidentRoom />
            </ProtectedRoute>
          } />

          <Route path="/map" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['receptionist', 'staff', 'security', 'admin']}>
                <MapView />
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute>
              <AdminRoute>
                <Analytics />
              </AdminRoute>
            </ProtectedRoute>
          } />

          <Route path="/reception/dashboard" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['receptionist']}>
                <ReceptionistDashboard />
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/security/dashboard" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['security', 'admin']}>
                <Dashboard />
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/staff/dashboard" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['staff', 'admin']}>
                <Dashboard />
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            </ProtectedRoute>
          } />

          <Route path="/setup-organization" element={
            <ProtectedRoute>
              <AdminRoute>
                <OrganizationSetup />
              </AdminRoute>
            </ProtectedRoute>
          } />

          <Route path="/admin/roles" element={
            <ProtectedRoute>
              <AdminRoute>
                <RoleManagement />
              </AdminRoute>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}
