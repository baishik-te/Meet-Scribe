import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireActive?: boolean; // If true, requires user to be ACTIVE and emailVerified
}

/**
 * ProtectedRoute wrapper that enforces authentication and verification status
 * 
 * Features:
 * - Redirects to /login if not authenticated
 * - Redirects to /verify-otp if user is INACTIVE (requires verification)
 * - Redirects to dashboard if user is still loading
 * - Only allows ACTIVE users to proceed if requireActive is true
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireActive = true 
}) => {
  const { user, token, loading, requiresVerification, isActive } = useAuth();
  const location = useLocation();

  // Still loading user data
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is INACTIVE - redirect to OTP verification page
  if (requiresVerification) {
    return <Navigate 
      to={`/verify-otp?email=${encodeURIComponent(user.email)}`} 
      state={{ from: location }} 
      replace 
    />;
  }

  // If route requires active status and user is not active - redirect to OTP
  if (requireActive && !isActive) {
    return <Navigate 
      to={`/verify-otp?email=${encodeURIComponent(user.email)}`} 
      state={{ from: location }} 
      replace 
    />;
  }

  // All checks passed - render the protected component
  return <>{children}</>;
};

/**
 * Alternative: For routes that don't require active status (like profile edit page)
 * but still need authentication
 */
export const AuthenticatedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
