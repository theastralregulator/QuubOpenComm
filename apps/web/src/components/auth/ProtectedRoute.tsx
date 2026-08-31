import React from 'react';
import { Navigate } from 'react-router-dom';
import OpenCommAnimatedLoader from '../common/OpenCommAnimatedLoader';

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
      <OpenCommAnimatedLoader
        fullscreen
        size="lg"
        label="Loading OpenComm"
      />
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
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
}
