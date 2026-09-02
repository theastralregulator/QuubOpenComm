import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import OpenCommAnimatedLoader from '../common/OpenCommAnimatedLoader';
import { Lock, ArrowRight } from 'lucide-react';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  isAuthLoading: boolean;
  isSavingProfile: boolean;
  isLoggedIn: boolean;
  isEmailVerified: boolean;
  isOnboardingCompleted: boolean;
  currentPath: string;
  requireCompletedProfile?: boolean;
  actionName?: string;
}

export default function ProtectedRoute({
  children,
  isAuthLoading,
  isSavingProfile,
  isLoggedIn,
  isEmailVerified,
  isOnboardingCompleted,
  currentPath,
  requireCompletedProfile = false,
  actionName = 'use this marketplace feature'
}: ProtectedRouteProps) {
  const navigate = useNavigate();

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

  if (requireCompletedProfile && !isOnboardingCompleted) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-left" id="profile-completion-required-card">
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] overflow-hidden shadow-2xl p-6 sm:p-8 space-y-5 relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          <div className="flex items-start space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest font-extrabold text-indigo-600 dark:text-indigo-400 block">Feature Locked</span>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                Complete your profile to continue
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                Complete your profile to {actionName}, including job applications, hiring, and direct messaging.
              </p>
            </div>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate('/profile?complete=1')}
              className="w-full h-11 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
              id="btn-locked-route-complete-profile"
            >
              <span>Complete Profile</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
