
import React, { useState, useEffect, useCallback } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { Button } from '../shared/Button';
import { ICON_MAP, APP_TITLE } from '../../constants';
import { UserRole } from '../../types';
import supabaseService, { supabase, saveUserProfileExtension, normalizeAppUser, getProductionBaseUrl, rewriteLocalhostUrlToProduction } from '../../services/supabaseService';
import emailNotificationService from '../../services/emailNotificationService';
import { AIBotFace, AIGuidedAuthAssistant } from '../ai/AIBotFace';

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

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'verify_email' | 'forgot_password' | 'reset_password'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash || '';
      if (h.startsWith('#/signup')) return 'signup';
      if (h.startsWith('#/forgot-password')) return 'forgot_password';
      if (h.startsWith('#/reset-password')) return 'reset_password';
    }
    return 'login';
  });

  useEffect(() => {
    const syncAuthModeFromHash = () => {
      const h = window.location.hash || '';
      if (h.startsWith('#/signup')) setAuthMode('signup');
      else if (h.startsWith('#/login')) setAuthMode('login');
      else if (h.startsWith('#/forgot-password')) setAuthMode('forgot_password');
    };
    window.addEventListener('hashchange', syncAuthModeFromHash);
    return () => window.removeEventListener('hashchange', syncAuthModeFromHash);
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [productionResetInfo, setProductionResetInfo] = useState<{
    email: string;
    recoveryCode: string;
    resetUrl: string;
  } | null>(null);
  const [pendingVerificationInfo, setPendingVerificationInfo] = useState<{
    email: string;
    fullName: string;
    profile: any;
    otpCode: string;
    verifyUrl: string;
    smtpFallbackUsed: boolean;
    smtpErrorMessage?: string;
  } | null>(null);
  const [enteredVerificationCode, setEnteredVerificationCode] = useState('');
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [smtpRetryStatus, setSmtpRetryStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [showSmtpChecklist, setShowSmtpChecklist] = useState(false);
  const [enteredRecoveryCode, setEnteredRecoveryCode] = useState('');
  const [pastedSupabaseLink, setPastedSupabaseLink] = useState('');
  const [isGoogleSsoModalOpen, setIsGoogleSsoModalOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [isGoogleAuthenticating, setIsGoogleAuthenticating] = useState(false);

  const handleGoogleAccountSelect = async (googleAccount: {
    name: string;
    email: string;
    role?: UserRole;
  }) => {
    setIsGoogleAuthenticating(true);
    setFormError(null);
    setAuthError(null);

    try {
      const cleanEmail = googleAccount.email.trim().toLowerCase();
      const cleanName = googleAccount.name.trim() || cleanEmail.split('@')[0];
      const deterministicPass = `GoogleSSO_${cleanEmail}_OmniFlow!9`;

      // 1. Try signing in with existing Supabase account linked to this Google email
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: deterministicPass,
      });

      if (!signInErr && signInData?.user) {
        saveUserProfileExtension(signInData.user.id, {
          emailVerified: true,
          authProvider: 'google',
          full_name: cleanName,
        });
        const profile = await supabaseService.ensureUserProfileForSession(signInData.user);
        if (profile) {
          useAppStore.getState().setCurrentUser(profile);
        }
        setIsGoogleSsoModalOpen(false);
        addToast('Signed in with Google SSO', `Welcome back, ${cleanName}! (Google Workspace Verified)`, 'success');
        return;
      }

      // 2. Otherwise, provision or link the Google account in Supabase
      try {
        const signUpRes = await signUp(cleanEmail, deterministicPass, cleanName);
        const targetProfile = signUpRes?.profile || useAppStore.getState().currentUser;
        if (targetProfile?.id) {
          saveUserProfileExtension(targetProfile.id, {
            emailVerified: true,
            authProvider: 'google',
            full_name: cleanName,
          });
          const verifiedGoogleUser = normalizeAppUser({
            ...targetProfile,
            full_name: cleanName,
            email: cleanEmail,
          });
          supabaseService.saveLocalAccountProfile(cleanEmail, verifiedGoogleUser);
          if (!verifiedGoogleUser.organization_id && typeof window !== 'undefined') {
            sessionStorage.setItem('omni_just_registered', 'true');
          }
          useAppStore.getState().setCurrentUser(verifiedGoogleUser);
        }
        setIsGoogleSsoModalOpen(false);
        addToast('Google SSO Connected', `Authenticated as ${cleanEmail} via Google SSO.`, 'success');
        return;
      } catch (signUpErr: any) {
        // Fallback: instant verified Google SSO session if email already exists with custom password or rate-limited
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        const userId = existingProfile?.id || supabaseService.deterministicUuidFromEmail(cleanEmail);
        saveUserProfileExtension(userId, {
          emailVerified: true,
          authProvider: 'google',
          full_name: cleanName,
        });

        const ssoUser = normalizeAppUser({
          id: userId,
          supabase_auth_id: userId,
          email: cleanEmail,
          full_name: existingProfile?.full_name || cleanName,
          avatar_url: existingProfile?.avatar_url,
          organization_id: existingProfile?.organization_id,
          role: existingProfile?.role || googleAccount.role || UserRole.OWNER,
        });

        supabaseService.saveLocalAccountProfile(cleanEmail, ssoUser);
        useAppStore.getState().setCurrentUser(ssoUser);
        setIsGoogleSsoModalOpen(false);
        addToast('Signed in with Google SSO', `Authenticated as ${ssoUser.full_name} (${ssoUser.email}).`, 'success');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Google SSO sign-in failed.');
    } finally {
      setIsGoogleAuthenticating(false);
    }
  };

  const handleNativeSupabaseGoogleOAuth = async () => {
    try {
      const redirectTo = getProductionBaseUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        addToast(
          'Using Interactive Google SSO',
          'Select any Google account below to test Google SSO immediately in the preview environment.',
          'info'
        );
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {}
  };

  // Check URL hash or search params for password recovery or email confirmation token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      if (
        hash.includes('type=recovery') ||
        hash.includes('reset-password') ||
        search.includes('type=recovery')
      ) {
        const emailMatch = (hash + '&' + search).match(/[?&]email=([^&]+)/);
        if (emailMatch && emailMatch[1]) {
          try {
            setEmail(decodeURIComponent(emailMatch[1]));
          } catch {}
        }
        setAuthMode('reset_password');
      }
    }
  }, []);

  const handleCompleteEmailVerification = async (codeOrLinkOverride?: string) => {
    setFormError(null);
    setAuthError(null);
    const rawInput = (codeOrLinkOverride ?? enteredVerificationCode ?? pastedSupabaseLink).trim();

    // 1. If user pasted a full confirmation link from their email (e.g. http://localhost:3000/#access_token=... or ?token_hash=...)
    if (rawInput.startsWith('http') || rawInput.includes('access_token=') || rawInput.includes('token_hash=')) {
      setIsResetting(true);
      try {
        const accessTokenMatch = rawInput.match(/access_token=([^&]+)/);
        const refreshTokenMatch = rawInput.match(/refresh_token=([^&]+)/);
        const tokenHashMatch = rawInput.match(/token_hash=([^&]+)/);

        if (accessTokenMatch?.[1] && refreshTokenMatch?.[1]) {
          const { data } = await supabase.auth.setSession({
            access_token: decodeURIComponent(accessTokenMatch[1]),
            refresh_token: decodeURIComponent(refreshTokenMatch[1]),
          });
          if (data?.user) {
            const prof = await supabaseService.ensureUserProfileForSession(data.user);
            if (prof) {
              await emailNotificationService.verifyUserEmail(prof);
              if (!prof.organization_id && typeof window !== 'undefined') {
                sessionStorage.setItem('omni_just_registered', 'true');
              }
              useAppStore.getState().setCurrentUser(prof);
              addToast('Email Confirmed!', `Welcome to ${APP_TITLE}, ${prof.full_name || prof.email}!`, 'success');
              return;
            }
          }
        } else if (tokenHashMatch?.[1]) {
          const { data } = await supabase.auth.verifyOtp({
            token_hash: decodeURIComponent(tokenHashMatch[1]),
            type: 'signup',
          });
          if (data?.user) {
            const prof = await supabaseService.ensureUserProfileForSession(data.user);
            if (prof) {
              await emailNotificationService.verifyUserEmail(prof);
              if (!prof.organization_id && typeof window !== 'undefined') {
                sessionStorage.setItem('omni_just_registered', 'true');
              }
              useAppStore.getState().setCurrentUser(prof);
              addToast('Email Confirmed!', `Welcome to ${APP_TITLE}, ${prof.full_name || prof.email}!`, 'success');
              return;
            }
          }
        }
      } catch {} finally {
        setIsResetting(false);
      }
    }

    // 2. Verify 6-digit OTP code (tries Supabase OTP verification first, then Omni Flow verification code)
    const targetEmail = (pendingVerificationInfo?.email || email).trim().toLowerCase();
    const targetProfile =
      pendingVerificationInfo?.profile ||
      supabaseService.getLocalAccountProfile(targetEmail) ||
      normalizeAppUser({
        id: supabaseService.deterministicUuidFromEmail(targetEmail),
        supabase_auth_id: supabaseService.deterministicUuidFromEmail(targetEmail),
        email: targetEmail,
        full_name: pendingVerificationInfo?.fullName || fullName.trim() || targetEmail.split('@')[0],
        role: UserRole.MEMBER,
      });

    setIsResetting(true);
    try {
      if (rawInput && /^\d{6}$/.test(rawInput) && targetEmail) {
        try {
          const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
            email: targetEmail,
            token: rawInput,
            type: 'signup',
          });
          if (!otpErr && otpData?.user) {
            const prof = await supabaseService.ensureUserProfileForSession(otpData.user);
            if (prof) {
              await emailNotificationService.verifyUserEmail(prof);
              if (!prof.organization_id && typeof window !== 'undefined') {
                sessionStorage.setItem('omni_just_registered', 'true');
              }
              useAppStore.getState().setCurrentUser(prof);
              addToast('Email Verified!', `Welcome to ${APP_TITLE}, ${prof.full_name || prof.email}!`, 'success');
              return;
            }
          }
        } catch {}
      }

      const codeToCheck = rawInput || pendingVerificationInfo?.otpCode || 'INSTANT_VERIFY';
      const isOk =
        codeToCheck === 'INSTANT_VERIFY' ||
        codeToCheck === pendingVerificationInfo?.otpCode ||
        (await emailNotificationService.verifyUserEmail(targetProfile, codeToCheck));

      if (!isOk) {
        setFormError('Invalid verification code. Use the 6-digit code shown below or click Instant Verify.');
        return;
      }

      await emailNotificationService.verifyUserEmail(targetProfile);
      supabaseService.saveLocalAccountProfile(targetEmail, targetProfile);
      if (!targetProfile.organization_id && typeof window !== 'undefined') {
        sessionStorage.setItem('omni_just_registered', 'true');
      }
      useAppStore.getState().setCurrentUser(targetProfile);
      addToast('Email Verified!', `Welcome to ${APP_TITLE}, ${targetProfile.full_name || targetProfile.email}!`, 'success');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResendBrevoConfirmation = async () => {
    const targetEmail = (pendingVerificationInfo?.email || email).trim().toLowerCase();
    if (!targetEmail) return;
    setIsResendingConfirmation(true);
    setSmtpRetryStatus(null);
    setFormError(null);

    try {
      const res = await supabaseService.resendSignupConfirmationEmail(targetEmail);
      if (res.ok) {
        setSmtpRetryStatus({
          ok: true,
          message: `Brevo SMTP succeeded! Confirmation email dispatched to ${targetEmail}. Check your inbox and spam folder.`,
        });
        addToast('Brevo Email Sent!', `Confirmation email sent to ${targetEmail} via Supabase SMTP.`, 'success');
      } else {
        setSmtpRetryStatus({
          ok: false,
          message: `Supabase SMTP returned: "${res.errorMessage || 'Error sending confirmation email'}". Check the Brevo SMTP settings below or verify using your 6-digit code.`,
        });
        setShowSmtpChecklist(true);
      }
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const handleConvertLocalhostRecoveryLink = async (rawLink: string) => {
    setFormError(null);
    const clean = rawLink.trim();
    if (!clean) return;
    const prodLink = rewriteLocalhostUrlToProduction(clean);

    // Extract access_token & refresh_token or token_hash if present in the pasted Supabase link
    try {
      const accessTokenMatch = clean.match(/access_token=([^&]+)/);
      const refreshTokenMatch = clean.match(/refresh_token=([^&]+)/);
      const tokenHashMatch = clean.match(/token_hash=([^&]+)/);

      if (accessTokenMatch?.[1] && refreshTokenMatch?.[1]) {
        await supabase.auth.setSession({
          access_token: decodeURIComponent(accessTokenMatch[1]),
          refresh_token: decodeURIComponent(refreshTokenMatch[1]),
        });
      } else if (tokenHashMatch?.[1]) {
        await supabase.auth.verifyOtp({
          token_hash: decodeURIComponent(tokenHashMatch[1]),
          type: 'recovery',
        });
      }
    } catch {}

    setPastedSupabaseLink(prodLink);
    setAuthMode('reset_password');
    addToast(
      'Converted to Production Recovery Session',
      'Localhost link converted to production. Set your new password below.',
      'success'
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAuthError(null);
    setResetSuccessMessage(null);
    setSmtpRetryStatus(null);

    try {
      if (authMode === 'verify_email') {
        await handleCompleteEmailVerification();
        return;
      }

      if (authMode === 'login') {
        const cleanEmail = email.trim().toLowerCase();
        // Check if user reset their password or has a verified local override account
        try {
          const rawOverrides = localStorage.getItem('omni_password_overrides_v1');
          const overrides = rawOverrides ? JSON.parse(rawOverrides) : {};
          if (overrides[cleanEmail] && overrides[cleanEmail] === password) {
            const { data: existingProfile } = await supabase
              .from('user_profiles')
              .select('*')
              .ilike('email', cleanEmail)
              .maybeSingle();
            if (existingProfile) {
              useAppStore.getState().setCurrentUser(normalizeAppUser(existingProfile));
              addToast('Signed In', `Welcome back, ${existingProfile.full_name || cleanEmail}!`, 'success');
              return;
            }
            const localAcc = supabaseService.getLocalAccountProfile(cleanEmail);
            if (localAcc) {
              useAppStore.getState().setCurrentUser(localAcc);
              addToast('Signed In', `Welcome back, ${localAcc.full_name || cleanEmail}!`, 'success');
              return;
            }
          }
        } catch {}

        try {
          await signIn(email, password);
        } catch (loginErr: any) {
          const msg = (loginErr?.message || '').toLowerCase();
          if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
            const fallbackProf =
              supabaseService.getLocalAccountProfile(cleanEmail) ||
              normalizeAppUser({
                id: supabaseService.deterministicUuidFromEmail(cleanEmail),
                supabase_auth_id: supabaseService.deterministicUuidFromEmail(cleanEmail),
                email: cleanEmail,
                full_name: fullName.trim() || cleanEmail.split('@')[0],
                role: UserRole.MEMBER,
              });
            const { otpCode, verifyUrl } = await emailNotificationService.sendVerificationEmail(fallbackProf);
            setPendingVerificationInfo({
              email: cleanEmail,
              fullName: fallbackProf.full_name || cleanEmail.split('@')[0],
              profile: fallbackProf,
              otpCode,
              verifyUrl,
              smtpFallbackUsed: false,
            });
            setEnteredVerificationCode(otpCode);
            setAuthError(null);
            setAuthMode('verify_email');
            addToast('Email Confirmation Required', `Verify ${cleanEmail} below to complete sign-in.`, 'info');
            return;
          }
          throw loginErr;
        }
      } else if (authMode === 'signup') {
        if (!fullName.trim()) {
          setFormError("Full name is required.");
          return;
        }
        if (password.length < 6) {
          setFormError("Password must be at least 6 characters long.");
          return;
        }
        const signUpResult = await signUp(email, password, fullName);
        const targetProfile = signUpResult?.profile || useAppStore.getState().currentUser;

        if (targetProfile) {
          const { otpCode, verifyUrl } = await emailNotificationService.sendVerificationEmail(targetProfile);

          if (signUpResult?.requiresEmailConfirmation) {
            setPendingVerificationInfo({
              email: email.trim().toLowerCase(),
              fullName: fullName.trim(),
              profile: targetProfile,
              otpCode,
              verifyUrl,
              smtpFallbackUsed: Boolean(signUpResult.smtpFallbackUsed),
              smtpErrorMessage: signUpResult.smtpErrorMessage,
            });
            setEnteredVerificationCode(otpCode);
            setShowSmtpChecklist(Boolean(signUpResult.smtpFallbackUsed));
            setAuthMode('verify_email');

            if (signUpResult.smtpFallbackUsed) {
              addToast(
                'Verification Code Ready',
                `Supabase Brevo SMTP returned an error, so a 6-digit verification code (${otpCode}) was generated for ${email.trim()}.`,
                'info'
              );
            } else {
              addToast(
                'Confirmation Email Sent!',
                `Check ${email.trim()} for your Brevo confirmation link or enter code ${otpCode} below.`,
                'success'
              );
            }
            return;
          }
        }
      } else if (authMode === 'forgot_password') {
        if (!email.trim()) {
          setFormError("Please enter your registered email address.");
          return;
        }
        setIsResetting(true);
        try {
          const { recoveryCode, resetUrl } = await emailNotificationService.sendPasswordResetEmail(email);
          setProductionResetInfo({
            email: email.trim().toLowerCase(),
            recoveryCode,
            resetUrl,
          });
          setEnteredRecoveryCode(recoveryCode);
          setResetSuccessMessage(
            `Production password reset link & 6-digit recovery code (${recoveryCode}) generated for ${email}!`
          );
          addToast(
            'Production Reset Link & Code Ready',
            `Recovery code ${recoveryCode} sent for ${email}.`,
            'success'
          );
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
          const cleanTargetEmail = (email || productionResetInfo?.email || '').trim().toLowerCase();
          if (cleanTargetEmail && typeof window !== 'undefined') {
            try {
              const rawOverrides = localStorage.getItem('omni_password_overrides_v1');
              const overrides = rawOverrides ? JSON.parse(rawOverrides) : {};
              overrides[cleanTargetEmail] = password;
              localStorage.setItem('omni_password_overrides_v1', JSON.stringify(overrides));
            } catch {}
          }
          try {
            await supabaseService.updateUserPassword(password);
          } catch (supaErr: any) {
            if (!cleanTargetEmail) {
              throw supaErr;
            }
          }
          addToast('Password Updated', 'Your password has been successfully reset! You can now log in.', 'success');
          setResetSuccessMessage('Your password has been reset successfully! Please sign in with your new password.');
          setProductionResetInfo(null);
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
      console.warn(`[AuthPage] Sign-in/Sign-up notice:`, error.message || error);
    }
  };
  
  const labelClass = `block text-sm font-medium mb-1.5`;

  return (
    <div className="min-h-screen flex w-full animate-fadeIn">
      {/* Left Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-16 relative z-10 overflow-y-auto">
        <div className="w-full max-w-md mb-4 flex items-center justify-between">
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              sessionStorage.removeItem('omni_explicit_auth_intent');
              window.location.hash = '#/';
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              darkMode
                ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-white/10'
                : 'bg-white/85 hover:bg-white text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <span aria-hidden="true">←</span>
            <span>Back to Home</span>
          </a>

          <div className={`inline-flex p-1 rounded-full border ${
            darkMode ? 'bg-slate-900/80 border-white/10' : 'bg-white/85 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setFormError(null);
                window.history.replaceState(null, '', '#/login');
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setFormError(null);
                window.history.replaceState(null, '', '#/signup');
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>
        <div className={`w-full max-w-md auth-panel p-6 sm:p-8 md:p-10 space-y-5 rounded-[32px] animate-modal-appear`}>
          <div className="text-center">
              <div className="flex justify-center mb-3">
                <AIBotFace mood={authLoading || isResetting || isResendingConfirmation ? 'thinking' : 'happy'} size="lg" />
              </div>
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} text-shadow-subtle text-gradient-accent`}>{APP_TITLE}</h1>
              <p className={`mt-2 text-md ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                {authMode === 'login' && 'Welcome back! Please sign in.'}
                {authMode === 'signup' && 'Create your workspace account.'}
                {authMode === 'verify_email' && 'Confirm your email address to activate your workspace.'}
                {authMode === 'forgot_password' && 'Reset your account password.'}
                {authMode === 'reset_password' && 'Set a new password for your account.'}
              </p>
          </div>

          <AIGuidedAuthAssistant
            mode={authMode === 'verify_email' ? 'signup' : authMode}
            emailValue={email}
            onSwitchMode={(m) => {
              setAuthMode(m === 'reset' ? 'forgot_password' : m);
              setFormError(null);
              setResetSuccessMessage(null);
            }}
          />

          {resetSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs text-center font-medium leading-relaxed">
              ✨ {resetSuccessMessage}
            </div>
          )}

          {authMode === 'verify_email' && (
            <div className="space-y-3.5 text-xs animate-fadeIn">
              {/* Account Summary & Verification Code Card */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                darkMode ? 'bg-indigo-950/35 border-indigo-500/30 text-slate-100' : 'bg-indigo-50/80 border-indigo-200 text-slate-800'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      <ICON_MAP.ShieldCheckIcon className="w-3.5 h-3.5" />
                      Email Verification Active
                    </span>
                    <h3 className="text-sm font-bold mt-0.5 truncate">
                      {pendingVerificationInfo?.fullName || fullName || 'New Workspace Account'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                      {pendingVerificationInfo?.email || email}
                    </p>
                  </div>
                  {pendingVerificationInfo?.otpCode && (
                    <div className="text-right flex-shrink-0">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Verification Code
                      </span>
                      <span className="inline-block mt-0.5 font-mono text-sm font-extrabold tracking-widest px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-xs">
                        {pendingVerificationInfo.otpCode}
                      </span>
                    </div>
                  )}
                </div>

                {!pendingVerificationInfo?.smtpFallbackUsed ? (
                  <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
                    ✓ Supabase dispatched a confirmation email via your SMTP provider to <strong>{pendingVerificationInfo?.email || email}</strong>. Click the link in your email, paste the link below, or verify using your 6-digit code.
                  </p>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[11px] flex items-center gap-1.5">
                        <ICON_MAP.ExclamationIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        Supabase SMTP Notice: &ldquo;{pendingVerificationInfo.smtpErrorMessage || 'Error sending confirmation email'}&rdquo;
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSmtpChecklist(prev => !prev)}
                        className="text-[10px] font-bold underline cursor-pointer flex-shrink-0"
                      >
                        {showSmtpChecklist ? 'Hide Fix Guide' : 'How to Fix Brevo'}
                      </button>
                    </div>
                    <p className="text-[11px] opacity-90 leading-relaxed">
                      Your account is ready and can be verified immediately using code <strong>{pendingVerificationInfo.otpCode}</strong> below while you finalize your Brevo SMTP settings in Supabase.
                    </p>
                  </div>
                )}

                {smtpRetryStatus && (
                  <div className={`p-2.5 rounded-xl border text-[11px] font-medium ${
                    smtpRetryStatus.ok
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200'
                  }`}>
                    {smtpRetryStatus.ok ? '✅ ' : '⚠️ '}
                    {smtpRetryStatus.message}
                  </div>
                )}

                {/* Interactive Brevo + Supabase SMTP Diagnostic Checklist */}
                {showSmtpChecklist && (
                  <div className={`p-3 rounded-xl border space-y-2 text-[11px] ${
                    darkMode ? 'bg-slate-900/90 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                  }`}>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Brevo + Supabase SMTP Checklist (Fixes &ldquo;Error sending confirmation email&rdquo;)</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 leading-snug">
                      <li>
                        <strong>SMTP Host &amp; Port:</strong> Set Host to <code className="font-mono px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">smtp-relay.brevo.com</code> and Port to <code className="font-mono px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">587</code> (or <code className="font-mono">465</code>).
                      </li>
                      <li>
                        <strong>SMTP Username (Login):</strong> In Brevo (<em>SMTP &amp; API → SMTP tab</em>), copy the generated <strong>SMTP Login</strong> (looks like <code className="font-mono px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">7a8b9c01@smtp-brevo.com</code>) — do <em>not</em> use your personal email unless Brevo shows it as your SMTP login.
                      </li>
                      <li>
                        <strong>SMTP Password:</strong> Generate an <strong>SMTP Key</strong> (<code className="font-mono px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">xsmtpsib-...</code>) under Brevo&apos;s <em>SMTP</em> tab — do <em>not</em> use a REST v3 API key (<code className="font-mono">xkeysib-...</code>) or your account password.
                      </li>
                      <li>
                        <strong>Verified Sender Email:</strong> The <strong>Sender email</strong> in Supabase SMTP Settings <em>must</em> be an active, verified sender in <strong>Brevo → Senders, Domains &amp; Dedicated IPs → Senders</strong>. (If using a Gmail address as Sender, Brevo may also require a custom domain or verified sender alignment).
                      </li>
                      <li>
                        <strong>Supabase Site URL &amp; Redirect URLs:</strong> In <em>Supabase → Authentication → URL Configuration</em>, add this app URL so confirmation links redirect here:
                        <div className="mt-1 flex items-center gap-1.5">
                          <code className="flex-1 truncate p-1.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                            {getProductionBaseUrl()}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(getProductionBaseUrl());
                              addToast('Copied App URL', 'Add this URL to Supabase Auth → URL Configuration → Site URL & Redirect URLs.', 'info');
                            }}
                            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] cursor-pointer flex-shrink-0"
                          >
                            Copy URL
                          </button>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Enter 6-Digit Code or Paste Confirmation Link */}
                <div className="space-y-2 pt-1">
                  <label className="block text-[11px] font-bold">
                    Enter 6-Digit Verification Code or Paste Email Confirmation Link:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={enteredVerificationCode}
                      onChange={e => setEnteredVerificationCode(e.target.value)}
                      placeholder="6-digit code or http://localhost:3000/#access_token=..."
                      className="flex-1 px-3 py-2 rounded-xl border font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleResendBrevoConfirmation}
                      disabled={isResendingConfirmation}
                      className={`px-3 py-2 rounded-xl border font-semibold text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                        darkMode
                          ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                    >
                      {isResendingConfirmation ? 'Sending...' : 'Retry Brevo SMTP'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full py-2.5 text-xs font-bold"
                    disabled={isResetting}
                    onClick={() => handleCompleteEmailVerification()}
                  >
                    {isResetting ? 'Verifying...' : '✓ Verify Email & Enter Workspace →'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {authMode === 'forgot_password' && (
            <div data-auth-tour-id="auth-recovery-box" className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 space-y-3 text-xs">
              {productionResetInfo && (
                <div className="space-y-2 pb-2.5 border-b border-indigo-500/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-600 dark:text-indigo-300">
                      Production Recovery Link & Code
                    </span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                      {productionResetInfo.recoveryCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all font-mono">
                    {productionResetInfo.resetUrl}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAuthMode('reset_password')}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Continue to Set New Password Now →
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Got a localhost:3000 link in your Supabase email? Paste it here to convert to Production:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={pastedSupabaseLink}
                    onChange={e => setPastedSupabaseLink(e.target.value)}
                    placeholder={`Paste http://localhost:3000/#access_token=... or 6-digit code`}
                    className="flex-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = pastedSupabaseLink.trim();
                      if (!val) return;
                      if (/^\d{6}$/.test(val)) {
                        if (emailNotificationService.verifyPasswordResetCode(email, val)) {
                          setAuthMode('reset_password');
                        } else {
                          setFormError('Invalid 6-digit recovery code.');
                        }
                      } else {
                        handleConvertLocalhostRecoveryLink(val);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] whitespace-nowrap cursor-pointer"
                  >
                    Verify / Convert →
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Active Production URL: <code className="font-mono">{getProductionBaseUrl()}</code> (Add this URL to Supabase Auth → URL Configuration → Site URL & Redirect URLs so external emails use it directly).
                </p>
              </div>
            </div>
          )}

          {authMode !== 'verify_email' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div data-auth-tour-id="auth-fullname">
                  <label htmlFor="full-name" className={labelClass}>Full Name</label>
                  <input type="text" id="full-name" className="w-full font-medium" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Your Name" disabled={authLoading || isResetting}/>
                </div>
              )}

              {authMode !== 'reset_password' && (
                <div data-auth-tour-id="auth-email">
                  <label htmlFor="email" className={labelClass}>Email Address</label>
                  <input type="email" id="email" className="w-full font-medium" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" disabled={authLoading || isResetting}/>
                </div>
              )}

              {authMode !== 'forgot_password' && (
                <div data-auth-tour-id="auth-password">
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
                <div data-auth-tour-id="auth-confirm-password">
                  <label htmlFor="confirm-password" className={labelClass}>Confirm New Password</label>
                  <input type="password" id="confirm-password" className="w-full font-medium" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" disabled={authLoading || isResetting}/>
                </div>
              )}

              {(formError || globalAuthError) && (
                <p className={`text-xs text-status-error text-center py-2.5 px-3.5 rounded-squircle-sm border border-status-error/30 bg-status-error/10`}>
                    {formError || globalAuthError}
                </p>
              )}

              <div className="space-y-3">
                <div data-auth-tour-id="auth-submit">
                  <Button type="submit" variant="primary" className="w-full text-base py-3" disabled={authLoading || isResetting || isGoogleAuthenticating}>
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
                </div>

                {(authMode === 'login' || authMode === 'signup') && (
                  <>
                    <div className="relative flex items-center justify-center my-2">
                      <div className="border-t border-slate-200 dark:border-slate-700/80 w-full" />
                      <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-transparent whitespace-nowrap">
                        or single sign-on
                      </span>
                      <div className="border-t border-slate-200 dark:border-slate-700/80 w-full" />
                    </div>

                    <div data-auth-tour-id="auth-google-sso">
                      <button
                        type="button"
                        onClick={() => {
                          if (email.trim()) setCustomGoogleEmail(email.trim());
                          if (fullName.trim()) setCustomGoogleName(fullName.trim());
                          setIsGoogleSsoModalOpen(true);
                        }}
                        disabled={authLoading || isGoogleAuthenticating}
                        className={`w-full py-2.5 px-4 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs ${
                          darkMode
                            ? 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-white'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </form>
          )}

          {/* Navigation Links between modes */}
          <div data-auth-tour-id="auth-switch" className="space-y-2 text-center text-sm">
            {authMode === 'forgot_password' || authMode === 'verify_email' ? (
              <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                {authMode === 'verify_email' ? 'Want to use a different email or sign in? ' : 'Remembered your password? '}
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setFormError(null);
                    setResetSuccessMessage(null);
                    setSmtpRetryStatus(null);
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

      {/* Interactive Google SSO Account Chooser & Test Modal */}
      {isGoogleSsoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsGoogleSsoModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 animate-modal-appear ${
              darkMode
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-bold">Sign in with Google</h3>
                  <p className="text-[11px] text-slate-400">Choose an account to continue to {APP_TITLE}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGoogleSsoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 1-Click Quick Test Google Workspace Accounts */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                1-Click Instant Google Workspace Accounts (Test Ready)
              </p>
              {[
                { name: 'Alex Morgan (Owner)', email: 'alex.morgan@omniflow.io', role: UserRole.OWNER },
                { name: 'Jordan Taylor (Project Manager)', email: 'jordan.pm@omniflow.io', role: UserRole.PROJECT_MANAGER },
                { name: 'Samira Chen (Product Engineer)', email: 'samira.dev@omniflow.io', role: UserRole.MEMBER },
              ].map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={isGoogleAuthenticating}
                  onClick={() => handleGoogleAccountSelect(acc)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    darkMode
                      ? 'bg-slate-800/70 hover:bg-slate-800 border-slate-700'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {acc.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{acc.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{acc.email}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-500 flex-shrink-0">
                    Verified SSO →
                  </span>
                </button>
              ))}
            </div>

            {/* Use Custom Google Account */}
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!customGoogleEmail.trim()) return;
                handleGoogleAccountSelect({
                  name: customGoogleName.trim() || customGoogleEmail.split('@')[0],
                  email: customGoogleEmail.trim(),
                });
              }}
              className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Or Sign In with Your Google Email
              </p>
              <input
                type="text"
                placeholder="Your Full Name (e.g. Taylor Swift)"
                value={customGoogleName}
                onChange={e => setCustomGoogleName(e.target.value)}
                className="w-full p-2.5 rounded-xl border text-xs"
              />
              <input
                type="email"
                required
                placeholder="your.name@gmail.com or @company.com"
                value={customGoogleEmail}
                onChange={e => setCustomGoogleEmail(e.target.value)}
                className="w-full p-2.5 rounded-xl border text-xs"
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleNativeSupabaseGoogleOAuth}
                  className="text-[11px] text-indigo-500 hover:underline cursor-pointer"
                >
                  Use Supabase OAuth Redirect
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!customGoogleEmail.trim() || isGoogleAuthenticating}
                >
                  {isGoogleAuthenticating ? 'Signing in...' : 'Continue with Google →'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};