import React, { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';
import { ICON_MAP } from '../../constants';
import supabaseService, { normalizeAppUser, saveUserProfileExtension } from '../../services/supabaseService';
import { OrganizationJoinRequest, UserRole } from '../../types';
import { AIBotFace } from '../ai/AIBotFace';

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
  const {
    currentUser,
    setCurrentUser,
    joinOrCreateOrganization,
    signOut,
    authLoading,
    appLoading,
    darkMode,
    addNotification,
    addToast,
  } = useAppStore();

  const [setupMode, setSetupMode] = useState<'join' | 'create'>('join');
  const [organizationName, setOrganizationName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);
  const [requestNote, setRequestNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isProcessingInvite, setIsProcessingInvite] = useState<boolean>(false);
  const [inviteStatusMsg, setInviteStatusMsg] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; name: string; slug: string; memberCount?: number; leadName?: string }>
  >([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedExistingOrg, setSelectedExistingOrg] = useState<{
    id: string;
    name: string;
    slug: string;
    memberCount?: number;
    leadName?: string;
  } | null>(null);

  const [pendingJoinRequest, setPendingJoinRequest] = useState<OrganizationJoinRequest | null>(null);

  const [organizationCheck, setOrganizationCheck] = useState<{
    loading: boolean;
    exists: boolean | null;
    orgId?: string;
    orgName?: string;
    orgSlug?: string;
    error: string | null;
  }>({ loading: false, exists: null, error: null });

  // Load initial directory of organizations & check if user already has a pending or approved join request
  const checkExistingJoinRequestAndApproval = useCallback(async () => {
    if (!currentUser || currentUser.organization_id) return;
    try {
      // 1. Check if user's profile in DB or extension was already approved by a PM/Owner
      const freshProfile = await supabaseService.getUserProfile(currentUser.id);
      if (freshProfile?.organization_id) {
        setCurrentUser(freshProfile);
        addToast(
          'Organization Access Approved',
          `Your request was approved! You now have ${String(freshProfile.role).replace(/_/g, ' ')} access.`,
          'success'
        );
        return;
      }

      // 2. Check pending join request for this user
      const req = await supabaseService.getPendingJoinRequestForUser(currentUser.id, currentUser.email);
      if (req) {
        if (req.status === 'approved' && req.organization_id) {
          const finalRole = req.approved_role || req.requested_role || UserRole.MEMBER;
          saveUserProfileExtension(currentUser.id, {
            organization_id: req.organization_id,
            roleOverride: finalRole,
            removedFromOrgId: null,
          });
          const updatedUser = normalizeAppUser({
            ...currentUser,
            organization_id: req.organization_id,
            role: finalRole,
          });
          setCurrentUser(updatedUser);
          addToast(
            'Welcome to ' + req.organization_name,
            `Approved as ${String(finalRole).replace(/_/g, ' ')}!`,
            'success'
          );
          return;
        }
        setPendingJoinRequest(req);
      }
    } catch {}
  }, [currentUser, setCurrentUser, addToast]);

  useEffect(() => {
    if (!currentUser || currentUser.organization_id) return;
    checkExistingJoinRequestAndApproval();

    // Preload known organizations for instant search
    supabaseService.searchOrganizations('').then(list => {
      setSearchResults(list);
    });
  }, [currentUser?.id, currentUser?.organization_id, checkExistingJoinRequestAndApproval]);

  // Listen in real-time for Project Manager / Owner approval across tabs or DB
  useEffect(() => {
    if (!currentUser || currentUser.organization_id) return;

    const handleJoinRequestUpdate = (req: OrganizationJoinRequest) => {
      if (!req) return;
      const isMine =
        req.requester_id === currentUser.id ||
        req.requester_email?.toLowerCase() === currentUser.email?.toLowerCase();
      if (!isMine) return;

      if (req.status === 'approved' && req.organization_id) {
        const finalRole = req.approved_role || req.requested_role || UserRole.MEMBER;
        saveUserProfileExtension(currentUser.id, {
          organization_id: req.organization_id,
          roleOverride: finalRole,
          removedFromOrgId: null,
        });
        setCurrentUser(
          normalizeAppUser({
            ...currentUser,
            organization_id: req.organization_id,
            role: finalRole,
          })
        );
        addToast(
          `Approved for ${req.organization_name}!`,
          `A Project Manager approved your request with ${String(finalRole).replace(/_/g, ' ')} access.`,
          'success'
        );
      } else {
        setPendingJoinRequest(req);
      }
    };

    const winHandler = (e: Event) => {
      const custom = e as CustomEvent<OrganizationJoinRequest>;
      if (custom.detail) handleJoinRequestUpdate(custom.detail);
    };
    window.addEventListener('omni_org_join_request_updated', winHandler);

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('omni_collab_sync');
      bc.onmessage = ev => {
        if (ev.data?.type === 'ORG_JOIN_REQUEST_UPSERT' && ev.data?.payload) {
          handleJoinRequestUpdate(ev.data.payload);
        }
      };
    }

    const pollInterval = setInterval(() => {
      checkExistingJoinRequestAndApproval();
    }, 6000);

    return () => {
      window.removeEventListener('omni_org_join_request_updated', winHandler);
      if (bc) bc.close();
      clearInterval(pollInterval);
    };
  }, [currentUser, setCurrentUser, addToast, checkExistingJoinRequestAndApproval]);

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

            saveUserProfileExtension(currentUser.id, {
              organization_id: invite.organization_id,
              roleOverride: invite.role,
              removedFromOrgId: null,
            });

            await supabaseService.updateUserRole(currentUser.id, invite.role, invite.organization_id);

            setCurrentUser(
              normalizeAppUser({
                ...currentUser,
                organization_id: invite.organization_id,
                role: invite.role,
              })
            );

            await supabaseService.revokeInvitation(invite.id);
            localStorage.removeItem('pending_invite_token');

            await supabaseService.logAuditEvent({
              organization_id: invite.organization_id,
              actor_id: currentUser.id,
              actor_name: currentUser.full_name || currentUser.email,
              actor_email: currentUser.email,
              action: 'invite_accepted',
              target_type: 'user',
              target_id: currentUser.id,
              target_name: currentUser.full_name || currentUser.email,
              details: { role: invite.role, invitation_id: invite.id },
            });

            addNotification({
              id: crypto.randomUUID(),
              user_id: currentUser.id,
              type: 'ORGANIZATION_INVITE_ACCEPTED',
              title: 'Welcome to the Organization!',
              message: `You successfully joined the organization as ${invite.role}.`,
              read: false,
              created_at: new Date().toISOString(),
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

  const performOrgCheck = useCallback(async (name: string) => {
    const trimmed = name.trim();
    const matches = await supabaseService.searchOrganizations(trimmed);
    setSearchResults(matches);

    if (!trimmed) {
      setOrganizationCheck({ loading: false, exists: null, orgId: undefined, orgName: undefined, orgSlug: undefined, error: null });
      setSelectedExistingOrg(null);
      return;
    }

    setOrganizationCheck({ loading: true, exists: null, error: null });
    try {
      const result = await supabaseService.checkOrganizationExists(trimmed);
      if (result.error) {
        setOrganizationCheck({ loading: false, exists: false, error: null });
      } else if (result.exists && result.id) {
        const matchedOrg = matches.find(m => m.id === result.id) || {
          id: result.id,
          name: result.name || trimmed,
          slug: result.slug || supabaseService.generateSlug(trimmed),
        };
        setSelectedExistingOrg(matchedOrg);
        setOrganizationCheck({
          loading: false,
          exists: true,
          orgId: result.id,
          orgName: result.name || trimmed,
          orgSlug: result.slug,
          error: null,
        });
      } else {
        setSelectedExistingOrg(null);
        setOrganizationCheck({
          loading: false,
          exists: false,
          orgId: undefined,
          orgName: undefined,
          orgSlug: undefined,
          error: null,
        });
      }
    } catch (error: any) {
      setOrganizationCheck({ loading: false, exists: false, error: null });
    }
  }, []);

  const debouncedOrgCheck = useCallback(debounce(performOrgCheck, 350), [performOrgCheck]);

  useEffect(() => {
    debouncedOrgCheck(organizationName);
  }, [organizationName, debouncedOrgCheck]);

  const handleSelectOrganizationFromDropdown = (org: {
    id: string;
    name: string;
    slug: string;
    memberCount?: number;
    leadName?: string;
  }) => {
    setSetupMode('join');
    setOrganizationName(org.name);
    setSelectedExistingOrg(org);
    setOrganizationCheck({
      loading: false,
      exists: true,
      orgId: org.id,
      orgName: org.name,
      orgSlug: org.slug,
      error: null,
    });
    setIsDropdownOpen(false);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = organizationName.trim();
    if (!cleanName) {
      setFormError('Organization name is required.');
      return;
    }

    if (!currentUser) return;

    // Resolve target existing organization ID if user selected Join Existing mode or org exists in DB
    let targetExistingOrgId = selectedExistingOrg?.id || organizationCheck.orgId;
    let targetExistingOrgName = selectedExistingOrg?.name || organizationCheck.orgName || cleanName;

    if (!targetExistingOrgId && setupMode === 'join') {
      const allMatches = await supabaseService.searchOrganizations(cleanName);
      const exactOrFirst =
        allMatches.find(
          m =>
            m.name.toLowerCase() === cleanName.toLowerCase() ||
            m.slug.toLowerCase() === supabaseService.generateSlug(cleanName)
        ) || (allMatches.length === 1 ? allMatches[0] : null);
      if (exactOrFirst) {
        targetExistingOrgId = exactOrFirst.id;
        targetExistingOrgName = cleanName;
      }
    }

    // Case 1: Joining an existing organization -> Submit Join Request for Project Manager / Owner approval
    if ((setupMode === 'join' || organizationCheck.exists) && targetExistingOrgId) {
      setIsSubmittingRequest(true);
      try {
        const joinReq = await supabaseService.createJoinRequest({
          organizationId: targetExistingOrgId,
          organizationName: targetExistingOrgName,
          requester: currentUser,
          requestedRole:
            selectedRole === UserRole.PROJECT_MANAGER ? UserRole.PROJECT_MANAGER : UserRole.MEMBER,
          message: requestNote,
        });
        setPendingJoinRequest(joinReq);
        addToast(
          'Join Request Sent!',
          `Requested to join ${targetExistingOrgName} as ${selectedRole.replace(/_/g, ' ')}. A Project Manager will review your request.`,
          'success'
        );
      } catch (err: any) {
        setFormError(err.message || 'Failed to submit join request.');
      } finally {
        setIsSubmittingRequest(false);
      }
      return;
    }

    if (setupMode === 'join' && !targetExistingOrgId) {
      // Check if any organization exists in DB at all (in case RLS hid the name of the single workspace)
      const allKnown = await supabaseService.searchOrganizations('');
      if (allKnown.length > 0) {
        const fallbackOrg = allKnown[0];
        setIsSubmittingRequest(true);
        try {
          const joinReq = await supabaseService.createJoinRequest({
            organizationId: fallbackOrg.id,
            organizationName: cleanName,
            requester: currentUser,
            requestedRole:
              selectedRole === UserRole.PROJECT_MANAGER ? UserRole.PROJECT_MANAGER : UserRole.MEMBER,
            message: requestNote,
          });
          setPendingJoinRequest(joinReq);
          addToast(
            'Join Request Sent!',
            `Requested to join ${cleanName} as ${selectedRole.replace(/_/g, ' ')}. A Project Manager will review your request.`,
            'success'
          );
          return;
        } catch (err: any) {
          setFormError(err.message || 'Failed to submit join request.');
        } finally {
          setIsSubmittingRequest(false);
        }
      } else {
        setFormError(
          `Could not find an existing organization named "${cleanName}". Switch to "Create New Organization" above if you want to create it.`
        );
        return;
      }
    }

    // Case 2: Create New Organization and assign user as OWNER
    try {
      await joinOrCreateOrganization(cleanName, UserRole.OWNER);
      addToast(
        'Organization Created!',
        `Welcome to ${cleanName}! You have been assigned as Organization Owner.`,
        'success'
      );
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (
        msg.toLowerCase().includes('duplicate') ||
        msg.toLowerCase().includes('unique') ||
        msg.toLowerCase().includes('rls')
      ) {
        const allKnown = await supabaseService.searchOrganizations('');
        if (allKnown.length > 0) {
          setSetupMode('join');
          setSelectedExistingOrg(allKnown[0]);
          setFormError(
            `"${cleanName}" already exists! Switched to Request Access mode — click the button below to send your Join Request to the Project Manager.`
          );
          return;
        }
      }
      setFormError(error.message || 'Failed to create organization.');
    }
  };

  const handleWithdrawJoinRequest = async () => {
    if (pendingJoinRequest && currentUser) {
      await supabaseService.cancelJoinRequest(pendingJoinRequest.id, currentUser.id);
    }
    setPendingJoinRequest(null);
  };

  const labelClass = `block text-xs font-bold uppercase tracking-wider mb-1.5 ${
    darkMode ? 'text-slate-300' : 'text-slate-600'
  }`;

  const requestableRoles: Array<{ role: UserRole; title: string; desc: string }> = [
    {
      role: UserRole.MEMBER,
      title: 'Team Member (MEMBER)',
      desc: 'Collaborate on tasks, sprints, Kanban boards, and Teams Chat & Video Calls.',
    },
    {
      role: UserRole.PROJECT_MANAGER,
      title: 'Project Manager (PROJECT_MANAGER)',
      desc: 'Manage projects, sprints, team roles, and approve incoming organization requests.',
    },
  ];

  // Show modal whenever user is authenticated and does NOT yet belong to an organization
  if (authLoading || appLoading || !currentUser || currentUser.organization_id) {
    return null;
  }

  return (
    <Modal
      isOpen={true}
      backdropBlur={true}
      onClose={() => {}}
      title={
        pendingJoinRequest
          ? 'Organization Access Request Status'
          : 'Workspace Setup — Search or Create Organization'
      }
    >
      <div className="p-6 space-y-5">
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
        ) : pendingJoinRequest ? (
          <div className="space-y-5">
            <div
              className={`p-5 rounded-2xl border ${
                pendingJoinRequest.status === 'declined'
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-indigo-500/10 border-indigo-500/30'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <AIBotFace
                  mood={pendingJoinRequest.status === 'declined' ? 'thinking' : 'guiding'}
                  size="md"
                  className="flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">
                      {pendingJoinRequest.status === 'declined'
                        ? 'Access Request Declined'
                        : 'Awaiting Project Manager Approval'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        pendingJoinRequest.status === 'declined'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      }`}
                    >
                      {pendingJoinRequest.status === 'declined' ? 'Declined' : 'Pending Review'}
                    </span>
                  </div>
                  <h3
                    className={`text-base font-bold mt-1.5 ${
                      darkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {pendingJoinRequest.organization_name}
                  </h3>
                  <p className={`text-xs mt-1 leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {pendingJoinRequest.status === 'declined'
                      ? 'Your request to join this organization was declined by an administrator. You can request another organization or create a new workspace below.'
                      : `Your request to join "${pendingJoinRequest.organization_name}" as ${pendingJoinRequest.requested_role.replace(
                          /_/g,
                          ' '
                        )} has been sent to the organization's Project Managers & Owners. As soon as they approve your request and assign your role, this screen will unlock automatically in real time.`}
                  </p>
                </div>
              </div>

              <div
                className={`mt-4 pt-3.5 border-t grid grid-cols-2 gap-3 text-xs ${
                  darkMode ? 'border-slate-700/60 text-slate-300' : 'border-slate-200 text-slate-600'
                }`}
              >
                <div>
                  <span className="block text-[10px] uppercase tracking-wider opacity-60">
                    Account Email
                  </span>
                  <span className="font-semibold">{currentUser.email}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider opacity-60">
                    Requested Access Role
                  </span>
                  <span className="font-semibold text-indigo-400">
                    {pendingJoinRequest.requested_role.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                type="button"
                variant="primary"
                className="flex-1 py-2.5 text-xs font-bold"
                disabled={isCheckingStatus}
                onClick={async () => {
                  setIsCheckingStatus(true);
                  await checkExistingJoinRequestAndApproval();
                  setTimeout(() => setIsCheckingStatus(false), 500);
                }}
              >
                {isCheckingStatus ? 'Checking Approval Status...' : 'Check Approval Status Now'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="py-2.5 text-xs font-semibold"
                onClick={handleWithdrawJoinRequest}
              >
                Choose Another Organization
              </Button>
            </div>

            <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs">
              <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                Testing as a Project Manager? Sign in with your PM/Owner account to approve.
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-start gap-3">
              <AIBotFace mood="guiding" size="md" className="flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-indigo-600 dark:text-indigo-300">
                  Zero-Trust Organization Access & Discovery
                </div>
                <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                  Search for an existing organization below to <strong>request access</strong> (a Project Manager or Owner will approve your role as <strong>MEMBER</strong> or <strong>PROJECT_MANAGER</strong>), or enter a new name to create your own workspace as <strong>OWNER</strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mode Selector Tabs */}
              <div
                className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${
                  darkMode ? 'bg-slate-900/80 border-slate-700/70' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSetupMode('join');
                    setFormError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    setupMode === 'join'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : darkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🔍 Join Existing Organization</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupMode('create');
                    setSelectedExistingOrg(null);
                    setFormError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    setupMode === 'create'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : darkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>✦ Create New Workspace</span>
                </button>
              </div>

              <div className="relative">
                <label htmlFor="organization-name" className={labelClass}>
                  {setupMode === 'join'
                    ? 'Search & Select Existing Organization'
                    : 'New Organization Workspace Name'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="organization-name"
                    value={organizationName}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={e => {
                      setOrganizationName(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    className="w-full pl-4 pr-10 py-2.5 text-sm rounded-xl border transition-all"
                    placeholder="Search organization name (e.g. Acme Corp)..."
                    disabled={authLoading || isSubmittingRequest}
                    autoComplete="off"
                    required
                  />
                  <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
                    {organizationCheck.loading && (
                      <ICON_MAP.SpinnerIcon className="w-5 h-5 text-accent animate-spin" />
                    )}
                    {!organizationCheck.loading &&
                      organizationCheck.exists === true &&
                      !organizationCheck.error && <CheckmarkIconSvg />}
                  </div>
                </div>

                {/* Interactive Search Directory Dropdown */}
                {isDropdownOpen && searchResults.length > 0 && (
                  <div
                    className={`mt-1.5 rounded-xl border shadow-xl max-h-48 overflow-y-auto z-30 ${
                      darkMode
                        ? 'bg-slate-900/95 border-slate-700/80 divide-y divide-slate-800'
                        : 'bg-white border-slate-200 divide-y divide-slate-100'
                    }`}
                  >
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Matching Organizations in Database ({searchResults.length})</span>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        Close
                      </button>
                    </div>
                    {searchResults.map(org => {
                      const isSelected =
                        selectedExistingOrg?.id === org.id ||
                        organizationCheck.orgId === org.id;
                      return (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => handleSelectOrganizationFromDropdown(org)}
                          className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/20 text-indigo-300'
                              : darkMode
                              ? 'hover:bg-slate-800/80 text-slate-200'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate flex items-center gap-2">
                              <span>{org.name}</span>
                              <span className="text-[10px] font-mono opacity-60">/{org.slug}</span>
                            </div>
                            {org.memberCount !== undefined && (
                              <span className="text-[10px] text-slate-400">
                                {org.memberCount} active member{org.memberCount === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                            {isSelected ? 'Selected ✓' : 'Select Organization'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!organizationCheck.loading &&
                  organizationCheck.exists === true &&
                  organizationName.trim() && (
                    <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-400">
                      <span>
                        ✓ Found existing organization:{' '}
                        <strong>{organizationCheck.orgName || organizationName}</strong>
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20">
                        Approval Required
                      </span>
                    </div>
                  )}

                {!organizationCheck.loading &&
                  organizationCheck.exists === false &&
                  organizationName.trim() && (
                    <div className="mt-2 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-xs text-sky-400">
                      <span>
                        ✦ New workspace: <strong>{organizationName.trim()}</strong>
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-500/20">
                        You become Owner
                      </span>
                    </div>
                  )}
              </div>

              {(setupMode === 'join' || organizationCheck.exists) && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className={labelClass}>Requested Access Level</label>
                    <div className="grid grid-cols-1 gap-2">
                      {requestableRoles.map(item => {
                        const active = selectedRole === item.role;
                        return (
                          <button
                            key={item.role}
                            type="button"
                            onClick={() => setSelectedRole(item.role)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              active
                                ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40'
                                : darkMode
                                ? 'bg-slate-900/50 border-slate-700/70 hover:border-slate-600'
                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-bold ${
                                  active
                                    ? 'text-indigo-400'
                                    : darkMode
                                    ? 'text-slate-200'
                                    : 'text-slate-800'
                                }`}
                              >
                                {item.title}
                              </span>
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  active ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-500'
                                }`}
                              >
                                {active && '✓'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="join-request-note" className={labelClass}>
                      Note to Project Manager / Owner (Optional)
                    </label>
                    <input
                      id="join-request-note"
                      type="text"
                      value={requestNote}
                      onChange={e => setRequestNote(e.target.value)}
                      placeholder="e.g. Joining the Q4 Product Engineering squad..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border"
                    />
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-xs text-status-error text-center py-2.5 px-3.5 rounded-squircle-sm border border-status-error/30 bg-status-error/10">
                  {formError}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full text-sm font-bold py-3"
                disabled={authLoading || isSubmittingRequest || !organizationName.trim()}
              >
                {authLoading || isSubmittingRequest
                  ? 'Processing...'
                  : setupMode === 'join' || organizationCheck.exists
                  ? `Request to Join "${organizationCheck.orgName || organizationName.trim() || '...'}"`
                  : `Create New Organization "${organizationName.trim() || '...'}"`}
                {(authLoading || isSubmittingRequest) && (
                  <ICON_MAP.SpinnerIcon className="w-5 h-5 animate-spin ml-2" />
                )}
              </Button>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Signed in as {currentUser.email}</span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-rose-400 hover:text-rose-300 font-semibold underline cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
};
