import React from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  isAuthLoading: boolean;
  isSavingProfile: boolean;
  isLoggedIn: boolean;
  isEmailVerified: boolean;
  isOnboardingCompleted: boolean;
  currentPath: string;
}

export default function ProtectedRoute({
  children,
  isAuthLoading,
  isSavingProfile,
  isLoggedIn,
  isEmailVerified,
  isOnboardingCompleted,
  currentPath
}: ProtectedRouteProps) {
  if (isAuthLoading || isSavingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(currentPath)}`}
        replace
      />
    );
  }

  if (!isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!isOnboardingCompleted) {
    return <Navigate to="/signup" replace />;
  }

  return <>{children}</>;
}
