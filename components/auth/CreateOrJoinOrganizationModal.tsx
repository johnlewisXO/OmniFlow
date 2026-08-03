import React, { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';
import { ICON_MAP } from '../../constants';
import supabaseService from '../../services/supabaseService';
import { UserRole } from '../../types';

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    return new Promise(resolve => {
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
  };
};

export const CreateOrJoinOrganizationModal: React.FC = () => {
  const { currentUser, setCurrentUser, joinOrCreateOrganization, authLoading, appLoading, darkMode, addNotification, addToast } = useAppStore();
  const [organizationName, setOrganizationName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);
  const [formError, setFormError] = useState<string | null>(null);
  const [isProcessingInvite, setIsProcessingInvite] = useState<boolean>(false);
  const [inviteStatusMsg, setInviteStatusMsg] = useState<string | null>(null);

  const [organizationCheck, setOrganizationCheck] = useState<{
    loading: boolean;
    exists: boolean | null;
    orgId?: string;
    orgSlug?: string;
    error: string | null;
  }>({ loading: false, exists: null, error: null });

  // Check for pending invitation token when user has no organization
  useEffect(() => {
    const checkAndApplyInviteToken = async () => {
      if (!currentUser || currentUser.organization_id) return;

      const hash = window.location.hash;
      const search = window.location.search;
      let token: string | null = localStorage.getItem('pending_invite_token');

      if (!token) {
        if (hash.includes('join-token=')) {
          token = hash.split('join-token=')[1]?.split('&')[0];
        } else if (search.includes('invite=')) {
          token = new URLSearchParams(search).get('invite');
        }
      }

      if (token) {
        setIsProcessingInvite(true);
        setInviteStatusMsg('Found invitation link! Joining organization...');
        try {
          const invite = await supabaseService.getInvitationByToken(token);
          if (invite && invite.status === 'pending') {
            const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
            if (isExpired) {
              setFormError('This organization invitation link has expired.');
              localStorage.removeItem('pending_invite_token');
              setIsProcessingInvite(false);
              return;
            }

            // Accept invitation: update user profile
            await supabaseService.client
              .from('user_profiles')
              .update({ organization_id: invite.organization_id, role: invite.role })
              .eq('id', currentUser.id);

            // Update local state
            setCurrentUser({
              ...currentUser,
              organization_id: invite.organization_id,
              role: invite.role
            });

            // Revoke / mark accepted
            await supabaseService.revokeInvitation(invite.id);
            localStorage.removeItem('pending_invite_token');

            // Log Audit Event
            await supabaseService.logAuditEvent({
              organization_id: invite.organization_id,
              actor_id: currentUser.id,
              actor_name: currentUser.full_name || currentUser.email,
              actor_email: currentUser.email,
              action: 'invite_accepted',
              target_type: 'user',
              target_id: currentUser.id,
              target_name: currentUser.full_name || currentUser.email,
              details: { role: invite.role, invitation_id: invite.id }
            });

            addNotification({
              id: crypto.randomUUID(),
              user_id: currentUser.id,
              title: 'Welcome to the Organization!',
              message: `You successfully joined the organization as ${invite.role}.`,
              read: false,
              created_at: new Date().toISOString()
            });

            window.history.replaceState(null, '', window.location.pathname + '#/app');
          } else {
            setFormError('Invalid or already accepted invitation link.');
            localStorage.removeItem('pending_invite_token');
          }
        } catch (err: any) {
          console.error('Failed processing invite token in modal:', err);
          setFormError('Failed to process invitation: ' + (err.message || 'Unknown error'));
          localStorage.removeItem('pending_invite_token');
        } finally {
          setIsProcessingInvite(false);
        }
      }
    };

    checkAndApplyInviteToken();
  }, [currentUser, setCurrentUser, addNotification]);

  const CheckmarkIconSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="checkmark-icon">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );

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
    []
  );

  const debouncedOrgCheck = useCallback(debounce(performOrgCheck, 700), [performOrgCheck]);

  useEffect(() => {
    if (organizationName.trim()) {
      debouncedOrgCheck(organizationName);
    } else {
      setOrganizationCheck({ loading: false, exists: null, orgId: undefined, orgSlug: undefined, error: null });
    }
  }, [organizationName, debouncedOrgCheck]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!organizationName.trim()) {
      setFormError("Organization name is required.");
      return;
    }

    try {
      await joinOrCreateOrganization(organizationName.trim(), selectedRole);
    } catch (error: any) {
      setFormError(error.message || "Failed to join or create organization.");
    }
  };

  const labelClass = `block text-sm font-medium mb-1.5`;

  const userRolesForSelection = Object.values(UserRole).filter(
    role => role !== UserRole.OWNER && role !== UserRole.ADMIN
  );

  const [shouldShowModal, setShouldShowModal] = useState(false);

  useEffect(() => {
    // If auth or app is loading, or user is not logged in, or user already has an organization_id, hide modal
    if (authLoading || appLoading || !currentUser || currentUser.organization_id) {
      setShouldShowModal(false);
      return;
    }

    // Add a 500ms grace period so initial profile sync finishes before showing modal
    const timer = setTimeout(() => {
      if (!currentUser.organization_id) {
        setShouldShowModal(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [authLoading, appLoading, currentUser?.id, currentUser?.organization_id]);

  // Only show if app and auth are finished loading, user is logged in, and genuinely has no organization
  if (!shouldShowModal || authLoading || appLoading || !currentUser || currentUser.organization_id) {
    return null;
  }

  return (
    <Modal
      isOpen={true}
      onClose={() => {}} // Prevent closing without joining/creating
      title="Welcome! Let's get you set up."
    >
      <div className="p-6 space-y-6">
        {isProcessingInvite ? (
          <div className="text-center py-8 space-y-4">
            <ICON_MAP.SpinnerIcon className="w-10 h-10 mx-auto text-accent animate-spin" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {inviteStatusMsg || 'Accepting Organization Invitation...'}
            </h3>
            <p className="text-xs text-slate-500">
              Please wait while we connect your account to the organization.
            </p>
          </div>
        ) : (
          <>
            <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              To start using the app, please create a new organization or join an existing one.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <label htmlFor="organization-name" className={labelClass}>
              Organization Name
            </label>
            <input
              type="text"
              id="organization-name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 text-sm"
              placeholder="Your Company Inc."
              disabled={authLoading}
              required
            />
            <div className="absolute right-3 top-9">
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
          
          {organizationCheck.exists && (
            <div className="mb-4">
              <label htmlFor="role" className={labelClass}>Your Role</label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                disabled={authLoading}
                className="w-full border rounded-md p-2"
              >
                {userRolesForSelection.map(role => (
                  <option key={role} value={role}>{role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
          )}
          
          {!organizationCheck.exists && organizationName.trim() && !organizationCheck.loading && (
             <p className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
               You will be assigned as Owner of this new organization.
             </p>
          )}

          {formError && (
            <p className={`text-xs text-status-error text-center py-2.5 px-3.5 rounded-squircle-sm border border-status-error/30 bg-status-error/10`}>
                {formError}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full text-base py-3" disabled={authLoading || !organizationName.trim()}>
            {authLoading ? 'Processing...' : (organizationCheck.exists ? 'Join Organization' : 'Create Organization')}
            {authLoading && <ICON_MAP.SpinnerIcon className="w-5 h-5 animate-spin ml-2" />}
          </Button>
        </form>
        </>
        )}
      </div>
    </Modal>
  );
};
