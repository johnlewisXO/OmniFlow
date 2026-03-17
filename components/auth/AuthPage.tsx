
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
    organizationCheck,
    setOrganizationCheck
  } = useAppStore();
  const [isLoginView, setIsLoginView] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);
  const [formError, setFormError] = useState<string | null>(null);

  const CheckmarkIconSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="checkmark-icon">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )

  const performOrgCheck = useCallback(
    async (name: string) => {
      if (!name.trim()) {
        setOrganizationCheck({ loading: false, exists: null, orgId: undefined, orgSlug: undefined, error: null });
        return;
      }
      setOrganizationCheck({ loading: true, exists: null, error: null });
      try {
        const result = await supabaseService.checkOrganizationExists(name);
        if (result.error) {
          setOrganizationCheck({ loading: false, exists: false, error: result.error });
        } else {
          setOrganizationCheck({ loading: false, exists: result.exists, orgId: result.id, orgSlug: result.slug, error: null });
        }
      } catch (error: any) {
        console.error("Org check service call failed:", error);
        setOrganizationCheck({ loading: false, exists: false, error: error.message || "Failed to check organization status." });
      }
    },
    [setOrganizationCheck]
  );

  const debouncedOrgCheck = useCallback(debounce(performOrgCheck, 700), [performOrgCheck]);

  useEffect(() => {
    if (!isLoginView && organizationName.trim()) {
      debouncedOrgCheck(organizationName);
    } else if (!isLoginView && !organizationName.trim()) {
      setOrganizationCheck({ loading: false, exists: null, orgId: undefined, orgSlug: undefined, error: null });
    }
  }, [organizationName, isLoginView, debouncedOrgCheck, setOrganizationCheck]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAuthError(null);
    console.log(`[AuthPage] handleSubmit: View is ${isLoginView ? 'Login' : 'Signup'}. Email: ${email}`);

    try {
      if (isLoginView) {
        console.log('[AuthPage] Attempting Sign In...');
        await signIn(email, password);
        console.log('[AuthPage] Sign In action completed (further handling in store/App.tsx).');
      } else {
        console.log('[AuthPage] Attempting Sign Up...');
        if (!fullName.trim()) {
            const msg = "Full name is required.";
            console.warn('[AuthPage] Signup Validation Error:', msg);
            setFormError(msg);
            return;
        }
        if (password.length < 6) {
            const msg = "Password must be at least 6 characters long.";
            console.warn('[AuthPage] Signup Validation Error:', msg);
            setFormError(msg);
            return;
        }
        console.log(`[AuthPage] Calling signUp with: Email: ${email}, Name: ${fullName}, Org: "${organizationName.trim() || 'N/A'}", Role: ${selectedRole}`);
        await signUp(email, password, fullName, organizationName.trim() || undefined, selectedRole);
        console.log('[AuthPage] Sign Up action completed (further handling in store/App.tsx).');
      }
    } catch (error: any) {
      console.error(`[AuthPage] Error during ${isLoginView ? 'Login' : 'Signup'} handleSubmit:`, error.message || error);
    }
  };
  
  // inputCombinedClass and labelClass will pick up global styles from index.html
  const labelClass = `block text-sm font-medium mb-1.5`;

  const userRolesForSelection = Object.values(UserRole).filter(
    role => role !== UserRole.OWNER && role !== UserRole.ADMIN
  );

  return (
    <div className="min-h-screen flex w-full animate-fadeIn">
      {/* Left Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-24 relative z-10">
        <div className={`w-full max-w-md auth-panel p-8 md:p-10 space-y-6 rounded-squircle-lg`}>
          <div className="text-center">
              <ICON_MAP.SparklesIcon className="w-12 h-12 text-accent mx-auto mb-3" />
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} text-shadow-subtle text-gradient-accent`}>{APP_TITLE}</h1>
              <p className={`mt-2 text-md ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
              {isLoginView ? 'Welcome back! Please sign in.' : 'Create your account.'}
              </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLoginView && (
              <>
                <div>
                  <label htmlFor="full-name" className={labelClass}>Full Name</label>
                  <input type="text" id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLoginView} placeholder="Your Name" disabled={authLoading}/>
                </div>
                <div className="relative">
                  <label htmlFor="organization-name" className={labelClass}>
                    Organization Name <span className="text-xs"> (Optional, to create or join)</span>
                  </label>
                  <input type="text" id="organization-name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="pr-10" placeholder="Your Company Inc." disabled={authLoading}/>
                  <div className="checkmark-icon-container">
                    {organizationCheck.loading && <ICON_MAP.SpinnerIcon className="w-5 h-5 text-accent animate-spin" />}
                    {!organizationCheck.loading && organizationCheck.exists === true && !organizationCheck.error && (
                      <CheckmarkIconSvg />
                    )}
                  </div>
                  {organizationCheck.error && (
                      <p className="mt-1 text-xs text-status-error">{organizationCheck.error}</p>
                  )}
                   {!organizationCheck.loading && organizationCheck.exists === true && !organizationCheck.error && organizationName.trim() &&(
                       <p className="mt-1 text-xs text-status-success">Joining existing organization: {organizationName}</p>
                   )}
                   {!organizationCheck.loading && organizationCheck.exists === false && organizationName.trim() && !organizationCheck.error && (
                      <p className="mt-1 text-xs text-status-info">New organization will be created: {organizationName}</p>
                  )}
                </div>
                 <div className="mb-4">
                  <label htmlFor="role" className={labelClass}>Your Role</label>
                  <select id="role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as UserRole)} disabled={authLoading}>
                    {userRolesForSelection.map(role => (
                      <option key={role} value={role}>{role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                  <p className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    If creating a new organization, you'll be assigned as Owner.
                  </p>
                </div>
              </>
            )}
            <div>
              <label htmlFor="email" className={labelClass}>Email Address</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" disabled={authLoading}/>
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>Password</label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" disabled={authLoading}/>
            </div>

            {(formError || globalAuthError) && (
              <p className={`text-xs text-status-error text-center py-2.5 px-3.5 rounded-squircle-sm border border-status-error/30 bg-status-error/10`}>
                  {formError || globalAuthError}
              </p>
            )}

            <Button type="submit" variant="primary" className="w-full text-base py-3" disabled={authLoading}>
              {authLoading ? (isLoginView ? 'Signing In...' : 'Creating Account...') : (isLoginView ? 'Sign In' : 'Create Account')}
              {authLoading && <ICON_MAP.SpinnerIcon className="w-5 h-5 animate-spin ml-2" />}
            </Button>
          </form>

          <p className={`text-center text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {isLoginView ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                  setIsLoginView(!isLoginView);
                  setFormError(null);
                  setAuthError(null);
                  setOrganizationCheck({loading: false, exists: null, orgId: undefined, orgSlug: undefined, error: null});
                  setEmail('');
                  setPassword('');
                  setFullName('');
                  setOrganizationName('');
                  setSelectedRole(UserRole.MEMBER);
              }}
              className="font-medium text-accent hover:text-accent-dark dark:hover:text-accent-light transition-colors"
              disabled={authLoading}
              type="button"
            >
              {isLoginView ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
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