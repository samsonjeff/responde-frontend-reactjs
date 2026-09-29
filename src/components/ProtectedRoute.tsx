import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../services/authService';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  /**
   * If provided, only users whose role is in this array can access the route.
   * Everyone else is redirected to /dashboard.
   * If omitted, any authenticated user can access the route.
   */
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();

  // While the session check is in flight, show a centered spinner instead
  // of immediately redirecting (which would log out users with valid cookies).
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#0B0F17]">
        <Loader2 className="w-8 h-8 text-[#0071E3] animate-spin" />
      </div>
    );
  }

  // Not logged in → go to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role → bounce to dashboard
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // All good — render the nested routes
  return <Outlet />;
}
