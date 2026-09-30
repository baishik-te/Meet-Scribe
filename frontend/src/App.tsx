import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute, AuthenticatedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { VerifyOtp } from './pages/VerifyOtp';
import { ForgotPassword } from './pages/ForgotPassword';
import { UserDashboard } from './pages/UserDashboard';
import { Connections } from './pages/Connections';
import { Meetings } from './pages/Meetings';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { CallRoom } from './pages/CallRoom';
import { Library } from './pages/Library';
import { MeetScribeAI } from './pages/MeetScribeAI';
import { IncomingCallListener } from './components/IncomingCallListener';

// Admin Sub-Pages & Layout
import { AdminLayout } from './components/AdminLayout';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminPlans } from './pages/admin/AdminPlans';
import { AdminLedger } from './pages/admin/AdminLedger';
import { AdminCalls } from './pages/admin/AdminCalls';

import './styles/theme.css';

//  RoleProtectedRoute - Protects routes by role (ADMIN/USER)
 
const RoleProtectedRoute: React.FC<{ children: React.ReactNode; role: 'ADMIN' | 'USER' }> = ({ 
  children, 
  role 
}) => {
  const { user } = useAuth();
  if (user && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  return <ProtectedRoute requireActive={true}>{children}</ProtectedRoute>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <NotificationProvider>
            <IncomingCallListener />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Standard User Protected Routes - requires ACTIVE status */}
              <Route path="/dashboard" element={<ProtectedRoute requireActive={true}><UserDashboard /></ProtectedRoute>} />
              <Route path="/meetings" element={<ProtectedRoute requireActive={true}><Meetings /></ProtectedRoute>} />
              <Route path="/connections" element={<ProtectedRoute requireActive={true}><Connections /></ProtectedRoute>} />
              <Route path="/messages" element={<Navigate to="/connections" replace />} />
              <Route path="/connect" element={<Navigate to="/connections" replace />} />
              <Route path="/profile" element={<ProtectedRoute requireActive={true}><Profile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requireActive={true}><Settings /></ProtectedRoute>} />
              <Route path="/library" element={<ProtectedRoute requireActive={true}><Library /></ProtectedRoute>} />
              <Route path="/meetscribe" element={<ProtectedRoute requireActive={true}><MeetScribeAI /></ProtectedRoute>} />
              <Route path="/call/room" element={<ProtectedRoute requireActive={true}><CallRoom /></ProtectedRoute>} />

              {/* Admin Nested Protected Routes */}
              <Route
                path="/admin"
                element={
                  <RoleProtectedRoute role="ADMIN">
                    <AdminLayout />
                  </RoleProtectedRoute>
                }
              >
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="plans" element={<AdminPlans />} />
                <Route path="tokens" element={<AdminLedger />} />
                <Route path="calls" element={<AdminCalls />} />
              </Route>

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </NotificationProvider>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;