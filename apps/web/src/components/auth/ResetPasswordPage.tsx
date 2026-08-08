import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ResetPasswordPageProps {
  onSuccessRedirect?: () => void;
  onNavigateLogin?: () => void;
  triggerToast?: (msg: string) => void;
}

export default function ResetPasswordPage({
  onSuccessRedirect,
  onNavigateLogin,
  triggerToast,
}: ResetPasswordPageProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isInvalidSession, setIsInvalidSession] = useState(false);

  const validatePassword = (pass: string): string | null => {
    if (!pass || pass.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(pass)) {
      return 'Password must contain at least 1 uppercase letter.';
    }
    if (!/[a-z]/.test(pass)) {
      return 'Password must contain at least 1 lowercase letter.';
    }
    if (!/[0-9]/.test(pass)) {
      return 'Password must contain at least 1 number.';
    }
    return null;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const valError = validatePassword(newPassword);
    if (valError) {
      setErrorMessage(valError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!supabase) {
        throw new Error('Supabase client unavailable.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsInvalidSession(true);
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('Password reset error:', error.message);
        if (error.message?.toLowerCase().includes('same') || error.message?.toLowerCase().includes('previous')) {
          setErrorMessage('New password cannot be the same as your previous password.');
        } else if (error.message?.toLowerCase().includes('expired') || error.message?.toLowerCase().includes('jwt')) {
          setIsInvalidSession(true);
        } else {
          setErrorMessage(error.message);
        }
        setIsSubmitting(false);
        return;
      }

      // Success flow
      setIsSuccess(true);
      if (triggerToast) triggerToast('Password updated successfully.');

      // Clear recovery session storage marker
      sessionStorage.removeItem('opencomm_is_recovery');

      // Sign out the recovery session
      await supabase.auth.signOut();

      setIsSubmitting(false);
    } catch (err: any) {
      console.error('Password reset exception:', err);
      setErrorMessage(err.message || 'Failed to update password. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleGoToLogin = () => {
    sessionStorage.removeItem('opencomm_is_recovery');
    if (onNavigateLogin) {
      onNavigateLogin();
    } else if (onSuccessRedirect) {
      onSuccessRedirect();
    } else {
      window.location.href = '/login';
    }
  };

  if (isInvalidSession) {
    return (
      <div className="min-h-screen w-full bg-[#0B0F17] flex items-center justify-center p-4 sm:p-6 text-left">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#111827] border border-[#273449] rounded-2xl p-6 sm:p-8 shadow-2xl"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-white text-center">
            Link Expired or Invalid
          </h2>
          <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed">
            Your password reset link is invalid or has expired. Please request a new link to recover your account.
          </p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoToLogin}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Request New Reset Link</span>
            </button>

            <button
              type="button"
              onClick={handleGoToLogin}
              className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full bg-[#0B0F17] flex items-center justify-center p-4 sm:p-6 text-left">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#111827] border border-[#273449] rounded-2xl p-6 sm:p-8 shadow-2xl text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white">
            Password Updated
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Your password has been changed successfully. You can now sign in using your new credentials.
          </p>

          <button
            type="button"
            onClick={handleGoToLogin}
            className="mt-6 w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>Proceed to Sign In</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0B0F17] flex items-center justify-center p-4 sm:p-6 text-left">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#111827] border border-[#273449] rounded-2xl p-6 sm:p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Set New Password</h1>
            <p className="text-xs text-slate-400">Create a secure new password for your account</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {/* New Password */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 chars (1 upper, 1 lower, 1 number)"
                className="w-full h-11 px-3.5 pr-10 rounded-xl border border-[#273449] bg-[#0B0F17] text-white text-xs focus:outline-none focus:border-blue-500 placeholder-slate-500 font-semibold"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full h-11 px-3.5 pr-10 rounded-xl border border-[#273449] bg-[#0B0F17] text-white text-xs focus:outline-none focus:border-blue-500 placeholder-slate-500 font-semibold"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Guidelines */}
          <div className="p-3 bg-[#0B0F17] rounded-xl border border-[#273449] text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-slate-300 text-[10px] uppercase font-mono">Password Requirements:</p>
            <ul className="list-disc list-inside space-y-0.5 text-[10px]">
              <li className={newPassword.length >= 8 ? 'text-emerald-400' : ''}>Minimum 8 characters</li>
              <li className={/[A-Z]/.test(newPassword) ? 'text-emerald-400' : ''}>At least 1 uppercase letter</li>
              <li className={/[a-z]/.test(newPassword) ? 'text-emerald-400' : ''}>At least 1 lowercase letter</li>
              <li className={/[0-9]/.test(newPassword) ? 'text-emerald-400' : ''}>At least 1 number</li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Update Password</span>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleGoToLogin}
            className="text-xs text-slate-400 hover:text-white font-medium inline-flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
