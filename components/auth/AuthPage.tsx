
import React, { useState, useEffect, useCallback } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { Button } from '../shared/Button';
import { ICON_MAP, APP_TITLE } from '../../constants';
import { UserRole } from '../../types';
import supabaseService from '../../services/supabaseService';

// Debounce helper
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const newFunc = (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        const result = func(...args);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(err => {
            console.warn("Debounced function promise rejected:", err);
            resolve(undefined as any);
          });
        } else {
          resolve(result);
        }
      }, waitFor);
    });
  return newFunc;
};


export const AuthPage: React.FC = () => {
  const {
    signUp,
    signIn,
    authLoading,
    authError: globalAuthError,
    darkMode,
    setAuthError,
    addToast
  } = useAppStore();

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot_password' | 'reset_password'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Check URL hash for password recovery token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('type=recovery') || hash.includes('reset-password')) {
        setAuthMode('reset_password');
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAuthError(null);
    setResetSuccessMessage(null);

    try {
      if (authMode === 'login') {
        await signIn(email, password);
      } else if (authMode === 'signup') {
        if (!fullName.trim()) {
          setFormError("Full name is required.");
          return;
        }
        if (password.length < 6) {
          setFormError("Password must be at least 6 characters long.");
          return;
        }
        await signUp(email, password, fullName);
      } else if (authMode === 'forgot_password') {
        if (!email.trim()) {
          setFormError("Please enter your registered email address.");
          return;
        }
        setIsResetting(true);
        try {
          await supabaseService.sendPasswordResetEmail(email);
          setResetSuccessMessage(`Password reset link sent to ${email}! Check your inbox to set a new password.`);
          addToast('Reset Link Dispatched', `Password recovery link sent to ${email}`, 'success');
        } catch (err: any) {
          setFormError(err.message || "Failed to send reset link. Please check your email.");
        } finally {
          setIsResetting(false);
        }
      } else if (authMode === 'reset_password') {
        if (password.length < 6) {
          setFormError("New password must be at least 6 characters long.");
          return;
        }
        if (password !== confirmPassword) {
          setFormError("Passwords do not match. Please re-enter.");
          return;
        }
        setIsResetting(true);
        try {
          await supabaseService.updateUserPassword(password);
          addToast('Password Updated', 'Your password has been successfully reset! You can now log in.', 'success');
          setResetSuccessMessage('Your password has been reset successfully! Please sign in with your new password.');
          setAuthMode('login');
          setPassword('');
          setConfirmPassword('');
        } catch (err: any) {
          setFormError(err.message || "Failed to update password. Recovery link may have expired.");
        } finally {
          setIsResetting(false);
        }
      }
    } catch (error: any) {
      console.error(`[AuthPage] Error during handleSubmit:`, error.message || error);
    }
  };
  
  const labelClass = `block text-sm font-medium mb-1.5`;

  return (
    <div className="min-h-screen flex w-full animate-fadeIn">
      {/* Left Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-24 relative z-10">
        <div className={`w-full max-w-md auth-panel p-8 md:p-10 space-y-6 rounded-squircle-lg`}>
          <div className="text-center">
              <ICON_MAP.SparklesIcon className="w-12 h-12 text-accent mx-auto mb-3" />
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} text-shadow-subtle text-gradient-accent`}>{APP_TITLE}</h1>
              <p className={`mt-2 text-md ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                {authMode === 'login' && 'Welcome back! Please sign in.'}
                {authMode === 'signup' && 'Create your workspace account.'}
                {authMode === 'forgot_password' && 'Reset your account password.'}
                {authMode === 'reset_password' && 'Set a new password for your account.'}
              </p>
          </div>

          {resetSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs text-center font-medium leading-relaxed">
              ✨ {resetSuccessMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label htmlFor="full-name" className={labelClass}>Full Name</label>
                <input type="text" id="full-name" className="w-full font-medium" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Your Name" disabled={authLoading || isResetting}/>
              </div>
            )}

            {authMode !== 'reset_password' && (
              <div>
                <label htmlFor="email" className={labelClass}>Email Address</label>
                <input type="email" id="email" className="w-full font-medium" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" disabled={authLoading || isResetting}/>
              </div>
            )}

            {authMode !== 'forgot_password' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="text-sm font-medium">
                    {authMode === 'reset_password' ? 'New Password' : 'Password'}
                  </label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot_password');
                        setFormError(null);
                        setResetSuccessMessage(null);
                      }}
                      className="text-xs text-accent hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input type="password" id="password" className="w-full font-medium" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" disabled={authLoading || isResetting}/>
              </div>
            )}

            {authMode === 'reset_password' && (
              <div>
                <label htmlFor="confirm-password" className={labelClass}>Confirm New Password</label>
                <input type="password" id="confirm-password" className="w-full font-medium" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" disabled={authLoading || isResetting}/>
              </div>
            )}

            {(formError || globalAuthError) && (
              <p className={`text-xs text-status-error text-center py-2.5 px-3.5 rounded-squircle-sm border border-status-error/30 bg-status-error/10`}>
                  {formError || globalAuthError}
              </p>
            )}

            <Button type="submit" variant="primary" className="w-full text-base py-3" disabled={authLoading || isResetting}>
              {authLoading || isResetting ? (
                <div className="flex items-center justify-center gap-2">
                  <ICON_MAP.SpinnerIcon className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <>
                  {authMode === 'login' && 'Sign In'}
                  {authMode === 'signup' && 'Create Account'}
                  {authMode === 'forgot_password' && 'Send Password Reset Link'}
                  {authMode === 'reset_password' && 'Set New Password'}
                </>
              )}
            </Button>
          </form>

          {/* Navigation Links between modes */}
          <div className="space-y-2 text-center text-sm">
            {authMode === 'forgot_password' ? (
              <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                Remembered your password?{' '}
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setFormError(null);
                    setResetSuccessMessage(null);
                  }}
                  className="font-semibold text-accent hover:underline cursor-pointer"
                  type="button"
                >
                  Back to Sign In
                </button>
              </p>
            ) : (
              <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setFormError(null);
                    setResetSuccessMessage(null);
                  }}
                  className="font-semibold text-accent hover:underline cursor-pointer"
                  disabled={authLoading}
                  type="button"
                >
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - 3D Animation */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-slate-900/90 z-0"></div>
        
        {/* 3D Globe Animation */}
        <div className="relative z-10 scale-125">
          <div className="tech-globe-container">
            <div className="globe-shadow"></div>
            <div className="globe-core-wrapper">
              <div className="globe-core">
                <div className="grid-line"></div>
                <div className="grid-line"></div>
                <div className="grid-line"></div>
                <div className="grid-line"></div>
                <div className="grid-line"></div>
                <div className="grid-line"></div>
                <div className="grid-line-horizontal"></div>
                <div className="grid-line-horizontal"></div>
                <div className="grid-line-horizontal"></div>
                <div className="grid-line-horizontal"></div>
              </div>
            </div>
            
            <div className="orbit-path orbit-path-1">
              <div className="orbit-satellite"></div>
            </div>
            <div className="orbit-path orbit-path-2" style={{ width: '120%', height: '120%', left: '-10%', top: '-10%' }}>
              <div className="orbit-satellite" style={{ animationDelay: '-5s' }}></div>
            </div>
            <div className="orbit-path orbit-path-3" style={{ width: '140%', height: '140%', left: '-20%', top: '-20%' }}>
              <div className="orbit-satellite" style={{ animationDelay: '-10s' }}></div>
            </div>
          </div>
        </div>

        {/* Decorative text/elements */}
        <div className="absolute bottom-12 left-12 right-12 z-20 text-center">
          <h2 className="text-3xl font-bold text-white mb-4 text-gradient-neon">
            Orchestrate Your Workflow
          </h2>
          <p className="text-slate-300 text-lg max-w-md mx-auto">
            Connect teams, manage projects, and deliver results faster with our intelligent platform.
          </p>
        </div>
      </div>
    </div>
  );
};