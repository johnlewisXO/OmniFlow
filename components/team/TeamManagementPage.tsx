

import React, { useState, useEffect, useMemo } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { User, UserRole, OrganizationInvitation, AuditLog, UserPresence } from '../../types';
import supabaseService from '../../services/supabaseService';
import { collabService } from '../../services/collabService';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { Avatar } from '../shared/Avatar';

const formatRoleForDisplay = (role?: UserRole): string => {
  if (!role) return 'N/A';
  return role.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.PROJECT_MANAGER,
  UserRole.MEMBER,
  UserRole.CLIENT_VIEWER,
];

export const TeamManagementPage: React.FC = () => {
  const {
    users,
    currentUser,
    darkMode,
    activeView,
    isLoadingUsersForAssignment,
    usersForAssignmentError,
    fetchUsersForAssignmentList,
    updateUserRoleInOrganization,
    isUpdatingUserRole,
    updateUserRoleError,
    deleteUserFromOrganization,
    isDeletingUser,
    deleteUserError,
    setActiveView,
    addToast,
    presences
  } = useAppStore();

  useEffect(() => {
    collabService.requestRemotePresences();
  }, []);

  const [activeTab, setActiveTab] = useState<'directory' | 'invitations' | 'audit_logs'>(
    activeView === 'user_logs_view' ? 'audit_logs' : 'directory'
  );

  useEffect(() => {
    if (activeView === 'user_logs_view') {
      setActiveTab('audit_logs');
    }
  }, [activeView]);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRoleForUser, setSelectedRoleForUser] = useState<UserRole | null>(null);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState<string | null>(null);

  // Invitations State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.MEMBER);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteExpiryDays, setInviteExpiryDays] = useState<number>(7);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditFilterType, setAuditFilterType] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const UserGroupIcon = ICON_MAP.UserGroupIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const TrashIcon = ICON_MAP.TrashIcon;
  const PaperClipIcon = ICON_MAP.PaperClipIcon || ICON_MAP.DocumentTextIcon;

  const selectWrapperClass = "relative"; 
  const selectArrowClass = `absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'} pointer-events-none`;

  useEffect(() => {
    if (currentUser?.organization_id && users.length === 0 && !isLoadingUsersForAssignment) {
      fetchUsersForAssignmentList();
    }
  }, [currentUser?.organization_id, users.length, isLoadingUsersForAssignment, fetchUsersForAssignmentList]);

  useEffect(() => {
    if (currentUser?.organization_id) {
      loadInvitations();
      loadAuditLogs();
    }
  }, [currentUser?.organization_id]);

  const loadInvitations = async () => {
    if (!currentUser?.organization_id) return;
    setIsLoadingInvites(true);
    try {
      const inviteList = await supabaseService.getInvitations(currentUser.organization_id);
      setInvitations(inviteList);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!currentUser?.organization_id) return;
    setIsLoadingAuditLogs(true);
    try {
      const logs = await supabaseService.getAuditLogs(currentUser.organization_id);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch = !auditSearchQuery.trim() ||
        (log.actor_name && log.actor_name.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
        (log.actor_email && log.actor_email.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
        (log.action && log.action.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
        (log.target_name && log.target_name.toLowerCase().includes(auditSearchQuery.toLowerCase()));

      const matchesType = auditFilterType === 'all' || log.target_type === auditFilterType;
      return matchesSearch && matchesType;
    });
  }, [auditLogs, auditSearchQuery, auditFilterType]);

  const handleCreateInvitation = async (e: React.FormEvent, sendEmailDirect = false) => {
    e.preventDefault();
    if (!currentUser?.organization_id) return;

    setIsGeneratingInvite(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + inviteExpiryDays);

      const invite = await supabaseService.createInvitation({
        organization_id: currentUser.organization_id,
        invited_by: currentUser.id,
        inviter_name: currentUser.full_name || currentUser.email,
        email: inviteEmail.trim() || undefined,
        role: inviteRole,
        expires_at: expiresAt.toISOString()
      });

      const fullLink = `${window.location.origin}${window.location.pathname}#join-token=${invite.token}`;

      // Audit log
      await supabaseService.logAuditEvent({
        organization_id: currentUser.organization_id,
        actor_id: currentUser.id,
        actor_name: currentUser.full_name || currentUser.email,
        actor_email: currentUser.email,
        action: sendEmailDirect ? 'invite_email_sent' : 'user_invited',
        target_type: 'invitation',
        target_id: invite.id,
        target_name: inviteEmail || inviteRole,
        details: { role: inviteRole, expires_at: expiresAt.toISOString(), email_sent: sendEmailDirect, link: fullLink }
      });

      setGeneratedInviteLink(fullLink);
      loadInvitations();
      addToast('Invitation Created', sendEmailDirect ? `Invite sent to ${inviteEmail}` : 'Shareable invitation link generated successfully.', 'success');
    } catch (err: any) {
      console.error('Failed creating invitation:', err);
      addToast('Invitation Failed', err?.message || 'Unable to create invitation.', 'error');
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedToken(id);
    addToast('Link Copied', 'Invitation link copied to clipboard.', 'info');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevokeInvite = async (invitationId: string) => {
    await supabaseService.revokeInvitation(invitationId);
    if (currentUser?.organization_id) {
      await supabaseService.logAuditEvent({
        organization_id: currentUser.organization_id,
        actor_id: currentUser.id,
        actor_name: currentUser.full_name || currentUser.email,
        actor_email: currentUser.email,
        action: 'invite_revoked',
        target_type: 'invitation',
        target_id: invitationId,
        details: { revoked_by: currentUser.id }
      });
    }
    addToast('Invite Revoked', 'The invitation has been revoked.', 'warning');
    loadInvitations();
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) {
        addToast('Action Restricted', 'You cannot change your own role from this interface.', 'warning');
        return;
    }
    updateUserRoleInOrganization(userId, newRole);
    addToast('Role Updated', `User role changed to ${formatRoleForDisplay(newRole)}.`, 'success');
    setEditingUserId(null); 
    setSelectedRoleForUser(null);
  };

  const handleRemoveUserConfirm = (userId: string) => {
    setShowConfirmDeleteModal(userId);
  };

  const executeRemoveUser = (userId: string) => {
    deleteUserFromOrganization(userId);
    addToast('Member Removed', 'Team member has been removed from organization.', 'error');
    setShowConfirmDeleteModal(null);
  };
  
  const canManageRole = (targetUserRole?: UserRole): boolean => {
    if (!currentUser?.role) return false;
    // OWNER can manage anyone
    if (currentUser.role === UserRole.OWNER) return true; 
    // ADMIN can manage anyone except other OWNERs
    if (currentUser.role === UserRole.ADMIN) {
      return targetUserRole !== UserRole.OWNER; 
    }
    // PROJECT_MANAGER can manage other users on the project (non-Owners/non-Admins)
    if (currentUser.role === UserRole.PROJECT_MANAGER) {
      return targetUserRole !== UserRole.OWNER && targetUserRole !== UserRole.ADMIN;
    }
    return false; // Other roles cannot manage
  };

  const getAssignableRolesForUser = (targetUserRole?: UserRole): UserRole[] => {
    let roles: UserRole[] = [];
    if (currentUser?.role === UserRole.OWNER) {
      roles = Object.values(UserRole); // OWNER can assign any role
    } else if (currentUser?.role === UserRole.ADMIN) {
      roles = ASSIGNABLE_ROLES.filter(r => r !== UserRole.OWNER); // ADMIN can assign any role except OWNER
    } else if (currentUser?.role === UserRole.PROJECT_MANAGER) {
      // PM can assign PROJECT_MANAGER, MEMBER, or CLIENT_VIEWER to project teammates
      roles = [UserRole.PROJECT_MANAGER, UserRole.MEMBER, UserRole.CLIENT_VIEWER];
    }
    if (targetUserRole && !roles.includes(targetUserRole)) {
      roles = [targetUserRole, ...roles];
    }
    return roles;
  };


  if (!currentUser?.organization_id) {
    return (
      <div className={`flex-1 p-4 md:p-6 text-center ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
        <ExclamationIcon className="w-12 h-12 mx-auto mb-4 text-status-warning" />
        <h2 className="text-xl font-semibold">Organization Required</h2>
        <p>Team management features are available when you are part of an organization.</p>
      </div>
    );
  }

  const adminCount = users.filter(u => u.role === UserRole.OWNER || u.role === UserRole.ADMIN).length;
  const pmCount = users.filter(u => u.role === UserRole.PROJECT_MANAGER).length;
  const memberCount = users.filter(u => u.role === UserRole.MEMBER).length;
  const distinctActorsCount = useMemo(() => new Set(auditLogs.map(l => l.actor_id)).size, [auditLogs]);
  const securityEventCount = useMemo(() => auditLogs.filter(l => l.action?.includes('role') || l.action?.includes('user_') || l.action?.includes('invite')).length, [auditLogs]);
  const taskEventCount = useMemo(() => auditLogs.filter(l => l.target_type === 'task' || l.action?.includes('task') || l.action?.includes('sprint')).length, [auditLogs]);

  return (
    <div className={`p-4 md:p-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'} space-y-6`}>
      {/* 1. Analytics Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                {activeTab === 'audit_logs' ? <ICON_MAP.ClockIcon className="w-5 h-5" /> : <UserGroupIcon className="w-5 h-5" />}
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                {activeTab === 'audit_logs' ? 'Security & User Activity Audit' : 'Organization Access Control & Directory'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {activeTab === 'audit_logs' ? 'User Activity & Audit Logs' : 'Team Directory & Roles'}
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-xl leading-relaxed">
              {activeTab === 'audit_logs' 
                ? 'Immutable audit trail of team actions, task transitions, role assignments, and security events.'
                : 'Manage member seats, access permission levels (RBAC), and invitation links for your organization.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'audit_logs' ? (
              <button
                onClick={loadAuditLogs}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer"
              >
                <ICON_MAP.ArrowPathIcon className="w-4 h-4 mr-1" />
                <span>Refresh Audit Logs</span>
              </button>
            ) : (
              <button
                onClick={() => { setShowInviteModal(true); setGeneratedInviteLink(null); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-500/30 transition-all transform active:scale-95 cursor-pointer"
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                <span>Invite Member</span>
              </button>
            )}
          </div>
        </div>

        {/* Analytics KPI Metric Cards */}
        {activeTab === 'audit_logs' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Total Audit Events</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white">{auditLogs.length}</span>
                <span className="text-xs text-indigo-300 font-medium">events</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Logged user operations
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Active Actors</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-300">{distinctActorsCount}</span>
                <span className="text-xs text-slate-400">members</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Initiating operations
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">RBAC & Security</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-amber-300">{securityEventCount}</span>
                <span className="text-xs text-slate-400">changes</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Roles & access updates
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Task & Sprint Events</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-400">{taskEventCount}</span>
                <span className="text-xs text-slate-400">updates</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Sprint & delivery lifecycle
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Total Members</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white">{users.length}</span>
                <span className="text-xs text-indigo-300 font-medium">seats</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Active accounts in workspace
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Administrators</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-300">{adminCount}</span>
                <span className="text-xs text-slate-400">admin / owner</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Full workspace governance
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Project Managers</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-blue-400">{pmCount}</span>
                <span className="text-xs text-slate-400">managers</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Portfolio & sprint leads
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Members & Guests</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-400">{memberCount}</span>
                <span className="text-xs text-slate-400">contributors</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Active engineering & design
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Team Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'invitations'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Invitations ({invitations.length})
        </button>
        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'audit_logs'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          User Activity Logs ({auditLogs.length})
        </button>
      </div>

      {/* Tab Content: 1. Directory */}
      {activeTab === 'directory' && (
        <>
          {isLoadingUsersForAssignment && (
            <div className="text-center py-10">
              <SpinnerIcon className={`w-12 h-12 mx-auto text-accent animate-spin`} />
              <p className={`mt-4 text-lg ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Loading Team Members...</p>
            </div>
          )}

          {usersForAssignmentError && !isLoadingUsersForAssignment && (
            <div className={`text-center p-6 rounded-squircle-md border shadow-glass ${darkMode ? 'bg-status-error/20 text-red-300 border-status-error/40' : 'bg-status-error/10 text-red-700 border-status-error/30'}`}>
              <ExclamationIcon className={`w-12 h-12 mx-auto mb-4 text-status-error`} />
              <h2 className={`text-xl font-semibold text-status-error`}>Error Loading Team</h2>
              <p className={`${darkMode ? 'text-red-300' : 'text-red-700'} mt-1`}>{usersForAssignmentError}</p>
            </div>
          )}
          
          {updateUserRoleError && (
             <div className={`my-4 p-3 text-center rounded-squircle-sm border ${darkMode ? 'bg-status-error/20 text-red-300 border-status-error/40' : 'bg-status-error/10 text-red-700 border-status-error/30'}`}>
                {updateUserRoleError}
            </div>
          )}
          {deleteUserError && (
             <div className={`my-4 p-3 text-center rounded-squircle-sm border ${darkMode ? 'bg-status-error/20 text-red-300 border-status-error/40' : 'bg-status-error/10 text-red-700 border-status-error/30'}`}>
                {deleteUserError}
            </div>
          )}

          {!isLoadingUsersForAssignment && !usersForAssignmentError && users.length === 0 && (
            <div className="text-center py-10">
              <UserGroupIcon className={`w-20 h-20 mx-auto mb-6 ${darkMode ? 'text-slate-600' : 'text-slate-400'} opacity-60`} />
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>No Team Members Found</h2>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
                Your organization doesn't have any other members yet, or you might need to invite them.
              </p>
            </div>
          )}

          {!isLoadingUsersForAssignment && !usersForAssignmentError && users.length > 0 && (
            <div className={`shadow-glass rounded-squircle-md overflow-x-auto border border-[hsl(var(--panel-border))]`} style={{backgroundColor: 'hsl(var(--panel-background))'}}>
              <table className={`min-w-full divide-y divide-[hsl(var(--panel-border))]`}>
                <thead style={{backgroundColor: darkMode ? 'hsla(var(--page-background-base-dark),0.1)' : 'hsla(var(--page-background-base-light),0.2)'}}>
                  <tr>
                    <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">User</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Current Role</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider min-w-[200px]">New Role</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-[hsl(var(--panel-border))]`}>
                  {users.map((user) => {
                    const isCurrentUserRow = user.id === currentUser?.id;
                    const userCanBeManaged = canManageRole(user.role);
                    const assignableRolesForThisUser = getAssignableRolesForUser(user.role);
                    const isThisUserBeingDeleted = isDeletingUser === user.id;
                    const uEmail = user.email?.toLowerCase();
                    const uName = user.full_name?.toLowerCase();
                    const userPresence = presences.find(
                      (p: UserPresence) =>
                        p.userId === user.id ||
                        (uEmail && p.userEmail && p.userEmail.toLowerCase() === uEmail) ||
                        (uName && p.userName && p.userName.toLowerCase() === uName)
                    );
                    const isUserOnline = isCurrentUserRow || !!userPresence;
                    const availStatus = userPresence?.availabilityStatus || 'available';
                    const statusLabel = !isUserOnline
                      ? 'Offline'
                      : availStatus === 'away'
                        ? 'Away'
                        : availStatus === 'busy'
                          ? 'Busy / DND'
                          : 'Available';
                    const statusDotColor = !isUserOnline
                      ? 'bg-slate-400'
                      : availStatus === 'away'
                        ? 'bg-amber-400'
                        : availStatus === 'busy'
                          ? 'bg-rose-500'
                          : 'bg-emerald-500';

                    return (
                    <tr key={user.id} className={`${darkMode ? 'hover:bg-accent/10' : 'hover:bg-accent/5'} transition-colors duration-150 ${isThisUserBeingDeleted ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="relative mr-3">
                            <Avatar user={user} size="md" />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${statusDotColor}`} />
                          </div>
                          <div>
                            <span className="font-medium text-sm block">{user.full_name || 'N/A'}</span>
                            {userPresence?.currentTaskId && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                {userPresence.isEditing ? 'Editing task' : 'Viewing task'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          !isUserOnline
                            ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            : availStatus === 'away'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : availStatus === 'busy'
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm opacity-80">{user.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm opacity-90">{formatRoleForDisplay(user.role)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!isCurrentUserRow && userCanBeManaged ? (
                          <div className={selectWrapperClass}>
                            <select
                              value={editingUserId === user.id ? selectedRoleForUser || user.role : user.role}
                              onChange={(e) => {
                                  setEditingUserId(user.id);
                                  setSelectedRoleForUser(e.target.value as UserRole);
                              }}
                              disabled={(isUpdatingUserRole && editingUserId === user.id) || isThisUserBeingDeleted}
                              className="w-full max-w-[180px]" 
                            >
                              {assignableRolesForThisUser.map(role => (
                                <option key={role} value={role}>{formatRoleForDisplay(role)}</option>
                              ))}
                            </select>
                            <ICON_MAP.ChevronDownIcon className={selectArrowClass} />
                          </div>
                        ) : (
                          <span className="text-sm italic opacity-60">{isCurrentUserRow ? '(Your Role)' : '(Not Manageable)'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap space-x-2">
                        {!isCurrentUserRow && userCanBeManaged && editingUserId === user.id && selectedRoleForUser && selectedRoleForUser !== user.role && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleRoleChange(user.id, selectedRoleForUser as UserRole)}
                            disabled={(isUpdatingUserRole && editingUserId === user.id) || isThisUserBeingDeleted}
                          >
                            {(isUpdatingUserRole && editingUserId === user.id) && <SpinnerIcon className="w-4 h-4 animate-spin mr-1.5" />}
                            Update Role
                          </Button>
                        )}
                        {!isCurrentUserRow && userCanBeManaged && user.role !== UserRole.OWNER && ( // Prevent removing OWNER via UI
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRemoveUserConfirm(user.id)}
                            disabled={isThisUserBeingDeleted || (isUpdatingUserRole && editingUserId === user.id)}
                            title={`Remove ${user.full_name || user.email} from organization`}
                          >
                            {isThisUserBeingDeleted ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <TrashIcon className="w-4 h-4" />}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab Content: 2. Active Invitations */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ICON_MAP.MailIcon className="w-5 h-5 text-accent" />
                Active Organization Invitations ({invitations.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Generate and monitor single-use invitation tokens with pre-configured roles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={loadInvitations}>
                Refresh Invites
              </Button>
              <Button variant="primary" size="sm" onClick={() => { setShowInviteModal(true); setGeneratedInviteLink(null); }}>
                + Create Invite
              </Button>
            </div>
          </div>

          {isLoadingInvites ? (
            <div className="text-center py-6">
              <SpinnerIcon className="w-6 h-6 animate-spin mx-auto text-accent" />
            </div>
          ) : invitations.length === 0 ? (
            <div className={`p-8 rounded-xl border text-center ${darkMode ? 'bg-slate-800/30 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              <ICON_MAP.MailIcon className="w-10 h-10 mx-auto mb-2 text-slate-400 opacity-60" />
              <p className="font-semibold text-sm">No active invitation links.</p>
              <p className="text-xs mt-1">Click "Create Invite" to generate a secure join link for a new team member.</p>
            </div>
          ) : (
            <div className={`shadow-glass rounded-xl overflow-x-auto border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className={darkMode ? 'bg-slate-900/40' : 'bg-slate-50'}>
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase">Recipient Email</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase">Pre-assigned Role</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase">Expires</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                  {invitations.map(inv => {
                    const fullLink = `${window.location.origin}${window.location.pathname}#join-token=${inv.token}`;
                    const isRevoked = inv.status === 'revoked';
                    const isExpired = inv.expires_at ? new Date(inv.expires_at) < new Date() : false;

                    return (
                      <tr key={inv.id} className={isRevoked || isExpired ? 'opacity-50' : ''}>
                        <td className="px-4 py-3 font-medium">
                          {inv.email || <span className="italic opacity-60">Any person with link</span>}
                        </td>
                        <td className="px-4 py-3">{formatRoleForDisplay(inv.role)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-semibold border ${
                            isRevoked ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400' :
                            isExpired ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400' :
                            'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                          }`}>
                            {isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs opacity-70">
                          {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {!isRevoked && !isExpired && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleCopyLink(fullLink, inv.id)}
                              >
                                {copiedToken === inv.id ? 'Copied!' : 'Copy Link'}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="danger" 
                                onClick={() => handleRevokeInvite(inv.id)}
                              >
                                Revoke
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: 3. User & Audit Logs */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-4">
          {/* Search & Filter Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search audit trail by actor, action, or target..."
                value={auditSearchQuery}
                onChange={e => setAuditSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  darkMode ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <ICON_MAP.SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditFilterType}
                onChange={e => setAuditFilterType(e.target.value)}
                className={`text-xs rounded-xl border px-3 py-2 font-medium focus:outline-hidden ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">All Entity Types</option>
                <option value="user">User & Roles</option>
                <option value="task">Tasks & Sprints</option>
                <option value="project">Projects</option>
                <option value="invitation">Invitations</option>
                <option value="organization">Organization</option>
              </select>

              <button
                onClick={loadAuditLogs}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ICON_MAP.ArrowPathIcon className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          {isLoadingAuditLogs ? (
            <div className="text-center py-12">
              <SpinnerIcon className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
              <p className="text-xs text-slate-400 mt-2">Loading audit trail records...</p>
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${darkMode ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              <ICON_MAP.ClockIcon className="w-10 h-10 mx-auto mb-2 opacity-60 text-indigo-400" />
              <p className="font-bold text-sm">No Audit Logs Found</p>
              <p className="text-xs mt-1">
                {auditSearchQuery || auditFilterType !== 'all' 
                  ? 'No activity matches your active search filters.' 
                  : 'Actions performed in the workspace will automatically be recorded here.'}
              </p>
            </div>
          ) : (
            <div className={`rounded-2xl border overflow-hidden shadow-xs ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/80 text-xs">
                  <thead className={darkMode ? 'bg-slate-900/60' : 'bg-slate-50/80'}>
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-500">Timestamp</th>
                      <th scope="col" className="px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-500">Actor</th>
                      <th scope="col" className="px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-500">Action</th>
                      <th scope="col" className="px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-500">Target Entity</th>
                      <th scope="col" className="px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-500">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {filteredAuditLogs.map(log => {
                      const isExpanded = expandedLogId === log.id;
                      const isSecurityAction = log.action?.includes('role') || log.action?.includes('user_') || log.action?.includes('invite');
                      const isTaskAction = log.target_type === 'task' || log.action?.includes('task') || log.action?.includes('sprint');

                      return (
                        <React.Fragment key={log.id}>
                          <tr className={`hover:bg-slate-500/5 transition-colors ${isExpanded ? (darkMode ? 'bg-slate-800' : 'bg-slate-50') : ''}`}>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                                  {(log.actor_name || log.actor_email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {log.actor_name || log.actor_email || 'System'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                isSecurityAction
                                  ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                                  : isTaskAction
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                              }`}>
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-mono text-[10px] uppercase">{log.target_type}:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                                  {log.target_name || log.target_id || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {log.details ? (
                                <button
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{isExpanded ? 'Hide Payload' : 'View Payload'}</span>
                                  <ICON_MAP.ChevronDownIcon className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No payload</span>
                              )}
                            </td>
                          </tr>

                          {isExpanded && log.details && (
                            <tr className={darkMode ? 'bg-slate-900/50' : 'bg-slate-100/60'}>
                              <td colSpan={5} className="px-6 py-3">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Event Context Payload:</span>
                                  <pre className="text-[11px] font-mono p-3 rounded-xl bg-slate-950 text-emerald-400 overflow-x-auto border border-slate-800 max-h-48">
                                    {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn p-4">
          <div className={`p-6 rounded-squircle-lg shadow-2xl w-full max-w-lg border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ICON_MAP.MailIcon className="w-5 h-5 text-accent" />
                Invite Member to Organization
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-sm opacity-60 hover:opacity-100">✕</button>
            </div>

            {!generatedInviteLink ? (
              <form onSubmit={handleCreateInvitation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Pre-assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className={`w-full p-2.5 rounded-md border text-sm focus:ring-2 focus:ring-accent outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    {ASSIGNABLE_ROLES.map(r => (
                      <option key={r} value={r}>{formatRoleForDisplay(r)}</option>
                    ))}
                  </select>
                  <p className="text-xs opacity-60 mt-1">
                    The member will be automatically assigned this role upon accepting the invitation link.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Recipient Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className={`w-full p-2.5 rounded-md border text-sm focus:ring-2 focus:ring-accent outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                  <p className="text-xs opacity-60 mt-1">If specified, only this email will be invited.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Link Expiration</label>
                  <select
                    value={inviteExpiryDays}
                    onChange={(e) => setInviteExpiryDays(Number(e.target.value))}
                    className={`w-full p-2.5 rounded-md border text-sm focus:ring-2 focus:ring-accent outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    <option value={1}>24 Hours</option>
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button variant="outline" type="button" onClick={() => setShowInviteModal(false)}>Cancel</Button>
                  {inviteEmail.trim() && (
                    <Button
                      variant="outline"
                      type="button"
                      disabled={isGeneratingInvite}
                      onClick={(e) => handleCreateInvitation(e as any, true)}
                      className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <ICON_MAP.MailIcon className="w-4 h-4 mr-1.5 text-emerald-500" />
                      Send Direct Email Invite
                    </Button>
                  )}
                  <Button variant="primary" type="submit" disabled={isGeneratingInvite}>
                    {isGeneratingInvite ? <SpinnerIcon className="w-4 h-4 animate-spin mr-2" /> : null}
                    Generate Invite Link
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm">
                  ✨ <strong>Invitation Created!</strong> Share the single-use token link below with your team member:
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider opacity-70">Invitation URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteLink}
                      className={`flex-1 p-2 text-xs font-mono rounded-md border ${darkMode ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleCopyLink(generatedInviteLink, 'modal')}
                    >
                      {copiedToken === 'modal' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={() => setShowInviteModal(false)}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showConfirmDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn p-4">
          <div className="p-6 rounded-squircle-lg shadow-glass-lg w-full max-w-md" style={{backgroundColor: 'hsl(var(--panel-background))', border: `1px solid hsl(var(--panel-border))`}}>
            <h3 className="text-lg font-semibold text-status-error mb-3">Confirm Removal</h3>
            <p className="text-sm mb-5">
              Are you sure you want to remove <strong className="font-medium">{users.find(u=>u.id === showConfirmDeleteModal)?.full_name || 'this user'}</strong> from the organization? They will lose access to all organization projects and data.
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowConfirmDeleteModal(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => executeRemoveUser(showConfirmDeleteModal)}>
                Yes, Remove User
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};