import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { User, UserRole, normalizeUserRole, OrganizationInvitation, AuditLog, UserPresence } from '../../types';
import supabaseService, { normalizeAppUser } from '../../services/supabaseService';
import { collabService } from '../../services/collabService';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { Avatar } from '../shared/Avatar';

const formatRoleForDisplay = (role?: UserRole | string): string => {
  const normalized = normalizeUserRole(role);
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.PROJECT_MANAGER,
  UserRole.MEMBER,
  UserRole.CLIENT_VIEWER,
];

const DEPARTMENTS = [
  'Engineering',
  'Product & Design',
  'Architecture & Platform',
  'Data & AI',
  'Quality Assurance',
  'Operations & PMO',
  'Executive Leadership',
  'Customer Success',
];

const RBAC_PERMISSION_MATRIX: {
  capability: string;
  category: string;
  roles: Record<UserRole, boolean | string>;
}[] = [
  {
    capability: 'Organization Billing, Ownership & Domain Settings',
    category: 'Workspace Governance',
    roles: {
      [UserRole.OWNER]: true,
      [UserRole.ADMIN]: false,
      [UserRole.PROJECT_MANAGER]: false,
      [UserRole.MEMBER]: false,
      [UserRole.CLIENT_VIEWER]: false,
    },
  },
  {
    capability: 'Update Member Roles (Excluding OWNER)',
    category: 'RBAC & Team Directory',
    roles: {
      [UserRole.OWNER]: 'All Roles',
      [UserRole.ADMIN]: 'Non-Owner Roles',
      [UserRole.PROJECT_MANAGER]: 'Non-Owner Roles',
      [UserRole.MEMBER]: false,
      [UserRole.CLIENT_VIEWER]: false,
    },
  },
  {
    capability: 'Invite New Members & Manage Single-Use Tokens',
    category: 'RBAC & Team Directory',
    roles: {
      [UserRole.OWNER]: true,
      [UserRole.ADMIN]: true,
      [UserRole.PROJECT_MANAGER]: true,
      [UserRole.MEMBER]: false,
      [UserRole.CLIENT_VIEWER]: false,
    },
  },
  {
    capability: 'Create, Archive & Configure Projects & Sprints',
    category: 'Portfolio & Delivery',
    roles: {
      [UserRole.OWNER]: true,
      [UserRole.ADMIN]: true,
      [UserRole.PROJECT_MANAGER]: true,
      [UserRole.MEMBER]: 'Create & Edit Tasks',
      [UserRole.CLIENT_VIEWER]: false,
    },
  },
  {
    capability: 'AI Co-Pilot Blueprint Architect & Workload Rebalancer',
    category: 'AI Intelligence',
    roles: {
      [UserRole.OWNER]: true,
      [UserRole.ADMIN]: true,
      [UserRole.PROJECT_MANAGER]: true,
      [UserRole.MEMBER]: 'Task Co-Pilot',
      [UserRole.CLIENT_VIEWER]: false,
    },
  },
  {
    capability: 'Configure Automated Triggers, Rules & Webhooks',
    category: 'Automation & Security',
    roles: {
      [UserRole.OWNER]: true,
      [UserRole.ADMIN]: true,
      [UserRole.PROJECT_MANAGER]: true,
      [UserRole.MEMBER]: false,
      [UserRole.CLIENT_VIEWER]: false,
    },
  },
  {
    capability: 'Inspect Immutable Security & Audit Logs',
    category: 'Automation & Security',
    roles: {
      [UserRole.OWNER]: true,
      [UserRole.ADMIN]: true,
      [UserRole.PROJECT_MANAGER]: true,
      [UserRole.MEMBER]: false,
      [UserRole.CLIENT_VIEWER]: false,
    },
  },
];

export const TeamManagementPage: React.FC = () => {
  const {
    users,
    setUsers,
    tasks,
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
    addToast,
    presences,
  } = useAppStore();

  useEffect(() => {
    collabService.requestRemotePresences();
  }, []);

  const [activeTab, setActiveTab] = useState<'directory' | 'rbac_matrix' | 'invitations' | 'audit_logs'>(
    activeView === 'user_logs_view' ? 'audit_logs' : 'directory'
  );

  useEffect(() => {
    if (activeView === 'user_logs_view') {
      setActiveTab('audit_logs');
    }
  }, [activeView]);

  // Directory Search, Filter & Bulk States
  const [directorySearch, setDirectorySearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRoleForUser, setSelectedRoleForUser] = useState<UserRole | null>(null);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState<string | null>(null);

  // Add / Onboard Member Directly Modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>(UserRole.MEMBER);
  const [newMemberDept, setNewMemberDept] = useState('Engineering');
  const [newMemberCapacity, setNewMemberCapacity] = useState(40);

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

  const currentActorRole = normalizeUserRole(currentUser?.role);

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

  /**
   * RBAC Hierarchy Rules:
   * - OWNER: can manage anyone (except their own row to prevent accidental lockout).
   * - ADMIN: can manage anyone excluding users with OWNER role.
   * - PROJECT_MANAGER: can manage anyone excluding users with OWNER role.
   * - MEMBER / CLIENT_VIEWER: read-only directory access.
   */
  const canManageRole = (targetUserRole?: UserRole | string): boolean => {
    if (!currentUser) return false;
    const targetNorm = normalizeUserRole(targetUserRole);
    if (currentActorRole === UserRole.OWNER) return true;
    if (currentActorRole === UserRole.ADMIN || currentActorRole === UserRole.PROJECT_MANAGER) {
      return targetNorm !== UserRole.OWNER;
    }
    return false;
  };

  const getAssignableRolesForUser = (targetUserRole?: UserRole | string): UserRole[] => {
    const targetNorm = normalizeUserRole(targetUserRole);
    let roles: UserRole[] = [];
    if (currentActorRole === UserRole.OWNER) {
      roles = [
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.PROJECT_MANAGER,
        UserRole.MEMBER,
        UserRole.CLIENT_VIEWER,
      ];
    } else if (currentActorRole === UserRole.ADMIN || currentActorRole === UserRole.PROJECT_MANAGER) {
      // Both ADMIN and PROJECT_MANAGER can assign any non-OWNER role
      roles = [...ASSIGNABLE_ROLES];
    }
    if (targetNorm && !roles.includes(targetNorm)) {
      roles = [targetNorm, ...roles];
    }
    return Array.from(new Set(roles));
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const normalizedNew = normalizeUserRole(newRole);
    if (userId === currentUser?.id) {
      addToast('Action Restricted', 'You cannot change your own role from this interface.', 'warning');
      return;
    }
    await updateUserRoleInOrganization(userId, normalizedNew);
    addToast('Role Updated in Realtime', `Member role updated to ${formatRoleForDisplay(normalizedNew)}.`, 'success');
    setEditingUserId(null);
    setSelectedRoleForUser(null);
    loadAuditLogs();
  };

  const handleUpdateMemberDepartmentOrCapacity = async (
    user: User,
    updates: { department?: string; weekly_capacity_hours?: number }
  ) => {
    if (!currentUser) return;
    await supabaseService.updateTeamMemberMetadata(user.id, updates);
    const updatedList = users.map(u => (u.id === user.id ? normalizeAppUser({ ...u, ...updates }) : u));
    setUsers(updatedList);

    collabService.broadcastTeamMemberUpdated({
      userId: user.id,
      userName: user.full_name || user.email,
      updates,
      actor: {
        id: currentUser.id,
        name: currentUser.full_name || currentUser.email,
      },
    });

    if (currentUser.organization_id) {
      await supabaseService.logAuditEvent({
        organization_id: currentUser.organization_id,
        actor_id: currentUser.id,
        actor_name: currentUser.full_name || currentUser.email,
        actor_email: currentUser.email,
        action: 'member_parameters_updated',
        target_type: 'user',
        target_id: user.id,
        target_name: user.full_name || user.email,
        details: updates,
      });
      loadAuditLogs();
    }
    addToast('Member Parameters Saved', `Updated ${user.full_name || user.email}'s team parameters.`, 'info');
  };

  const handleOnboardDirectMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.organization_id || !newMemberName.trim() || !newMemberEmail.trim()) return;

    const normalizedNewRole = normalizeUserRole(newMemberRole);
    const newUser: User = normalizeAppUser({
      id: crypto.randomUUID(),
      supabase_auth_id: crypto.randomUUID(),
      full_name: newMemberName.trim(),
      email: newMemberEmail.trim().toLowerCase(),
      organization_id: currentUser.organization_id,
      role: normalizedNewRole,
      department: newMemberDept,
      weekly_capacity_hours: newMemberCapacity,
    });

    try {
      const raw = localStorage.getItem('omni_custom_team_members');
      const existing: User[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem('omni_custom_team_members', JSON.stringify([newUser, ...existing]));
    } catch (err) {}

    setUsers([newUser, ...users]);

    await supabaseService.logAuditEvent({
      organization_id: currentUser.organization_id,
      actor_id: currentUser.id,
      actor_name: currentUser.full_name || currentUser.email,
      actor_email: currentUser.email,
      action: 'member_provisioned',
      target_type: 'user',
      target_id: newUser.id,
      target_name: newUser.full_name,
      details: { email: newUser.email, role: normalizedNewRole, department: newMemberDept, capacity: newMemberCapacity },
    });

    addToast('Team Member Added', `${newUser.full_name} added as ${formatRoleForDisplay(normalizedNewRole)}.`, 'success');
    setNewMemberName('');
    setNewMemberEmail('');
    setShowAddMemberModal(false);
    loadAuditLogs();
  };

  const handleRemoveUserConfirm = (userId: string) => {
    setShowConfirmDeleteModal(userId);
  };

  const executeRemoveUser = (userId: string) => {
    deleteUserFromOrganization(userId);
    addToast('Member Removed', 'Team member has been removed from organization.', 'error');
    setShowConfirmDeleteModal(null);
    setTimeout(loadAuditLogs, 400);
  };

  const handleCreateInvitation = async (e: React.FormEvent, sendEmailDirect = false) => {
    e.preventDefault();
    if (!currentUser?.organization_id) return;

    setIsGeneratingInvite(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + inviteExpiryDays);

      const normalizedInviteRole = normalizeUserRole(inviteRole);

      const invite = await supabaseService.createInvitation({
        organization_id: currentUser.organization_id,
        invited_by: currentUser.id,
        inviter_name: currentUser.full_name || currentUser.email,
        email: inviteEmail.trim() || undefined,
        role: normalizedInviteRole,
        expires_at: expiresAt.toISOString(),
      });

      const fullLink = `${window.location.origin}${window.location.pathname}#join-token=${invite.token}`;

      await supabaseService.logAuditEvent({
        organization_id: currentUser.organization_id,
        actor_id: currentUser.id,
        actor_name: currentUser.full_name || currentUser.email,
        actor_email: currentUser.email,
        action: sendEmailDirect ? 'invite_email_sent' : 'user_invited',
        target_type: 'invitation',
        target_id: invite.id,
        target_name: inviteEmail || normalizedInviteRole,
        details: { role: normalizedInviteRole, expires_at: expiresAt.toISOString(), email_sent: sendEmailDirect, link: fullLink },
      });

      setGeneratedInviteLink(fullLink);
      loadInvitations();
      loadAuditLogs();
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
        details: { revoked_by: currentUser.id },
      });
    }
    addToast('Invite Revoked', 'The invitation has been revoked.', 'warning');
    loadInvitations();
    loadAuditLogs();
  };

  const filteredDirectoryUsers = useMemo(() => {
    return users.filter(u => {
      const normRole = normalizeUserRole(u.role);
      const dept = u.department || 'Engineering';
      const uEmail = u.email?.toLowerCase() || '';
      const uName = u.full_name?.toLowerCase() || '';

      const matchesSearch =
        !directorySearch.trim() ||
        uName.includes(directorySearch.toLowerCase()) ||
        uEmail.includes(directorySearch.toLowerCase()) ||
        dept.toLowerCase().includes(directorySearch.toLowerCase());

      const matchesRole = roleFilter === 'all' || normRole === roleFilter;
      const matchesDept = departmentFilter === 'all' || dept === departmentFilter;

      if (availabilityFilter !== 'all') {
        const isCurrentUserRow = u.id === currentUser?.id;
        const userPresence = presences.find(
          (p: UserPresence) =>
            p.userId === u.id ||
            (uEmail && p.userEmail && p.userEmail.toLowerCase() === uEmail) ||
            (uName && p.userName && p.userName.toLowerCase() === uName)
        );
        const isOnline = isCurrentUserRow || !!userPresence;
        if (availabilityFilter === 'online' && !isOnline) return false;
        if (availabilityFilter === 'offline' && isOnline) return false;
      }

      return matchesSearch && matchesRole && matchesDept;
    });
  }, [users, directorySearch, roleFilter, departmentFilter, availabilityFilter, presences, currentUser?.id]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch =
        !auditSearchQuery.trim() ||
        (log.actor_name && log.actor_name.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
        (log.actor_email && log.actor_email.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
        (log.action && log.action.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
        (log.target_name && log.target_name.toLowerCase().includes(auditSearchQuery.toLowerCase()));

      const matchesType = auditFilterType === 'all' || log.target_type === auditFilterType;
      return matchesSearch && matchesType;
    });
  }, [auditLogs, auditSearchQuery, auditFilterType]);

  if (!currentUser?.organization_id) {
    return (
      <div className={`flex-1 p-4 md:p-6 text-center ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
        <ExclamationIcon className="w-12 h-12 mx-auto mb-4 text-status-warning" />
        <h2 className="text-xl font-semibold">Organization Required</h2>
        <p>Team management features are available when you are part of an organization.</p>
      </div>
    );
  }

  const adminCount = users.filter(u => {
    const r = normalizeUserRole(u.role);
    return r === UserRole.OWNER || r === UserRole.ADMIN;
  }).length;
  const pmCount = users.filter(u => normalizeUserRole(u.role) === UserRole.PROJECT_MANAGER).length;
  const memberCount = users.filter(u => {
    const r = normalizeUserRole(u.role);
    return r === UserRole.MEMBER || r === UserRole.CLIENT_VIEWER;
  }).length;
  const distinctActorsCount = useMemo(() => new Set(auditLogs.map(l => l.actor_id)).size, [auditLogs]);
  const securityEventCount = useMemo(
    () => auditLogs.filter(l => l.action?.includes('role') || l.action?.includes('user_') || l.action?.includes('invite') || l.action?.includes('member')).length,
    [auditLogs]
  );
  const taskEventCount = useMemo(
    () => auditLogs.filter(l => l.target_type === 'task' || l.action?.includes('task') || l.action?.includes('sprint')).length,
    [auditLogs]
  );

  const canActorManageTeam =
    currentActorRole === UserRole.OWNER ||
    currentActorRole === UserRole.ADMIN ||
    currentActorRole === UserRole.PROJECT_MANAGER;

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
                {activeTab === 'audit_logs'
                  ? 'Security & User Activity Audit'
                  : activeTab === 'rbac_matrix'
                    ? 'Enterprise Governance & Access Hierarchy'
                    : 'Organization Access Control & Directory'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {activeTab === 'audit_logs'
                ? 'User Activity & Audit Logs'
                : activeTab === 'rbac_matrix'
                  ? 'RBAC Hierarchy & Permission Matrix'
                  : 'Team Directory, Roles & Capacity'}
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-xl leading-relaxed">
              {activeTab === 'audit_logs'
                ? 'Immutable audit trail of team actions, task transitions, role assignments, and security events.'
                : 'Manage member seats, normalized RBAC permissions, department allocations, and sprint capacity in real time.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'audit_logs' ? (
              <button
                onClick={loadAuditLogs}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer"
              >
                <ICON_MAP.ArrowPathIcon className="w-4 h-4 mr-1" />
                <span>Refresh Audit Logs</span>
              </button>
            ) : (
              <>
                {canActorManageTeam && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all cursor-pointer"
                  >
                    <ICON_MAP.UserPlusIcon className="w-4 h-4" />
                    <span>Provision Member</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowInviteModal(true);
                    setGeneratedInviteLink(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-500/30 transition-all transform active:scale-95 cursor-pointer"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Invite via Link</span>
                </button>
              </>
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
              <p className="text-[11px] text-indigo-200/70 mt-1">Logged user operations</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Active Actors</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-300">{distinctActorsCount}</span>
                <span className="text-xs text-slate-400">members</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">Initiating operations</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">RBAC & Security</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-amber-300">{securityEventCount}</span>
                <span className="text-xs text-slate-400">changes</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">Roles & access updates</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Task & Sprint Events</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-400">{taskEventCount}</span>
                <span className="text-xs text-slate-400">updates</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">Sprint & delivery lifecycle</p>
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
              <p className="text-[11px] text-indigo-200/70 mt-1">Active accounts in workspace</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Owners & Admins</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-300">{adminCount}</span>
                <span className="text-xs text-slate-400">governance</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">Full workspace authority</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Project Managers</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-blue-400">{pmCount}</span>
                <span className="text-xs text-slate-400">managers</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">Can manage all non-Owner roles</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Members & Viewers</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-400">{memberCount}</span>
                <span className="text-xs text-slate-400">contributors</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">Active engineering & stakeholders</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
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
          onClick={() => setActiveTab('rbac_matrix')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rbac_matrix'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          RBAC Permission Matrix
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
        <div className="space-y-4">
          {/* Directory Filter & Search Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-2xl border bg-white/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search members by name, email, or department..."
                value={directorySearch}
                onChange={e => setDirectorySearch(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <ICON_MAP.SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className={`text-xs rounded-xl border px-3 py-2 font-semibold ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">All Roles</option>
                {Object.values(UserRole).map(r => (
                  <option key={r} value={r}>{formatRoleForDisplay(r)}</option>
                ))}
              </select>

              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className={`text-xs rounded-xl border px-3 py-2 font-semibold ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">All Departments</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={availabilityFilter}
                onChange={e => setAvailabilityFilter(e.target.value)}
                className={`text-xs rounded-xl border px-3 py-2 font-semibold ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">All Statuses</option>
                <option value="online">Online Now</option>
                <option value="offline">Offline</option>
              </select>

              <button
                onClick={fetchUsersForAssignmentList}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                title="Refresh Team Directory"
              >
                <ICON_MAP.ArrowPathIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {updateUserRoleError && (
            <div className={`my-2 p-3 text-center rounded-xl text-xs font-semibold border ${darkMode ? 'bg-rose-950/40 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {updateUserRoleError}
            </div>
          )}
          {deleteUserError && (
            <div className={`my-2 p-3 text-center rounded-xl text-xs font-semibold border ${darkMode ? 'bg-rose-950/40 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {deleteUserError}
            </div>
          )}

          {isLoadingUsersForAssignment ? (
            <div className="text-center py-10">
              <SpinnerIcon className="w-10 h-10 mx-auto text-indigo-500 animate-spin" />
              <p className="mt-3 text-sm text-slate-400">Synchronizing organization directory...</p>
            </div>
          ) : filteredDirectoryUsers.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-slate-200 dark:border-slate-800">
              <UserGroupIcon className="w-12 h-12 mx-auto mb-3 text-slate-400 opacity-60" />
              <h2 className="text-base font-bold">No Matching Team Members</h2>
              <p className="text-xs text-slate-400 mt-1">Adjust your search filters or invite a new member to your workspace.</p>
            </div>
          ) : (
            <div className={`shadow-xs rounded-2xl overflow-x-auto border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'}`}>
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className={darkMode ? 'bg-slate-950/50' : 'bg-slate-50'}>
                  <tr>
                    <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Member</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Live Status</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Department</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Workload & Capacity</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Role</th>
                    <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 min-w-[200px]">Assign Role (RBAC)</th>
                    <th scope="col" className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
                  {filteredDirectoryUsers.map(user => {
                    const normalizedUserRole = normalizeUserRole(user.role);
                    const isCurrentUserRow = user.id === currentUser?.id;
                    const userCanBeManaged = canManageRole(normalizedUserRole);
                    const assignableRolesForThisUser = getAssignableRolesForUser(normalizedUserRole);
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

                    // Calculate active tasks & points assigned to this member
                    const memberActiveTasks = tasks.filter(t => t.assignee_id === user.id && t.status !== 'done');
                    const memberPoints = memberActiveTasks.reduce((sum, t) => sum + (t.story_points || 1), 0);
                    const weeklyCap = user.weekly_capacity_hours ?? 40;

                    const activeSelectRole =
                      editingUserId === user.id && selectedRoleForUser
                        ? selectedRoleForUser
                        : normalizedUserRole;

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors ${darkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80'} ${isThisUserBeingDeleted ? 'opacity-50' : ''}`}
                      >
                        {/* Member Identity */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <Avatar user={user} size="md" />
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${statusDotColor}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs sm:text-sm truncate">{user.full_name || 'Team Member'}</span>
                                {isCurrentUserRow && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-indigo-500/20 text-indigo-400">You</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                              {userPresence?.currentTaskId && (
                                <span className="text-[10px] text-emerald-500 font-semibold block">
                                  {userPresence.isEditing ? '⚡ Editing task live' : '👁️ Viewing task'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Live Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                              !isUserOnline
                                ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                : availStatus === 'away'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                  : availStatus === 'busy'
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
                            {statusLabel}
                          </span>
                        </td>

                        {/* Department Selector */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {canActorManageTeam ? (
                            <select
                              value={user.department || 'Engineering'}
                              onChange={e => handleUpdateMemberDepartmentOrCapacity(user, { department: e.target.value })}
                              className={`text-xs rounded-lg border px-2 py-1 font-medium ${
                                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              {DEPARTMENTS.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs font-medium">{user.department || 'Engineering'}</span>
                          )}
                        </td>

                        {/* Workload & Capacity */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-xs font-bold">
                                {memberActiveTasks.length} tasks <span className="text-slate-400 font-normal">({memberPoints} pts)</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] text-slate-400">Cap:</span>
                                {canActorManageTeam ? (
                                  <select
                                    value={weeklyCap}
                                    onChange={e => handleUpdateMemberDepartmentOrCapacity(user, { weekly_capacity_hours: Number(e.target.value) })}
                                    className="text-[10px] font-semibold bg-transparent border-b border-dashed border-slate-500 focus:outline-hidden cursor-pointer"
                                  >
                                    {[20, 30, 35, 40, 45, 50].map(h => (
                                      <option key={h} value={h} className="bg-slate-900 text-white">{h}h/wk</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-400">{weeklyCap}h/wk</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Normalized Current Role Badge */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                              normalizedUserRole === UserRole.OWNER
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : normalizedUserRole === UserRole.ADMIN
                                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                  : normalizedUserRole === UserRole.PROJECT_MANAGER
                                    ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                                    : normalizedUserRole === UserRole.CLIENT_VIEWER
                                      ? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {formatRoleForDisplay(normalizedUserRole)}
                          </span>
                        </td>

                        {/* Role Assignment Dropdown */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {!isCurrentUserRow && userCanBeManaged ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={activeSelectRole}
                                onChange={e => {
                                  const nextRole = normalizeUserRole(e.target.value as UserRole);
                                  setEditingUserId(user.id);
                                  setSelectedRoleForUser(nextRole);
                                }}
                                disabled={(isUpdatingUserRole && editingUserId === user.id) || isThisUserBeingDeleted}
                                className={`text-xs rounded-xl border px-3 py-1.5 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none ${
                                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                                }`}
                              >
                                {assignableRolesForThisUser.map(role => (
                                  <option key={role} value={role}>
                                    {formatRoleForDisplay(role)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className="text-xs italic text-slate-400">
                              {isCurrentUserRow
                                ? 'Your Active Role'
                                : normalizedUserRole === UserRole.OWNER
                                  ? 'Protected (Owner)'
                                  : 'Read Only'}
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-2">
                          {!isCurrentUserRow &&
                            userCanBeManaged &&
                            editingUserId === user.id &&
                            selectedRoleForUser &&
                            normalizeUserRole(selectedRoleForUser) !== normalizedUserRole && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleRoleChange(user.id, selectedRoleForUser)}
                                disabled={(isUpdatingUserRole && editingUserId === user.id) || isThisUserBeingDeleted}
                              >
                                {isUpdatingUserRole && editingUserId === user.id && (
                                  <SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                )}
                                Save Role
                              </Button>
                            )}
                          {!isCurrentUserRow && userCanBeManaged && normalizedUserRole !== UserRole.OWNER && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleRemoveUserConfirm(user.id)}
                              disabled={isThisUserBeingDeleted || (isUpdatingUserRole && editingUserId === user.id)}
                              title={`Remove ${user.full_name || user.email} from organization`}
                            >
                              {isThisUserBeingDeleted ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <TrashIcon className="w-3.5 h-3.5" />}
                            </Button>
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

      {/* Tab Content: 2. RBAC Permission Matrix */}
      {activeTab === 'rbac_matrix' && (
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ICON_MAP.ShieldCheckIcon className="w-5 h-5 text-indigo-400" />
                  <span>Normalized Role-Based Access Control (RBAC) Governance</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Project Managers and Administrators can update any member’s role except users holding the Organization Owner role.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                Your Role: {formatRoleForDisplay(currentActorRole)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <thead className={darkMode ? 'bg-slate-950/60' : 'bg-slate-50'}>
                  <tr>
                    <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-400">Platform Capability</th>
                    {Object.values(UserRole).map(role => (
                      <th key={role} className="px-4 py-3 text-center font-bold uppercase tracking-wider text-slate-400">
                        {formatRoleForDisplay(role)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
                  {RBAC_PERMISSION_MATRIX.map((row, idx) => (
                    <tr key={idx} className={darkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-xs">{row.capability}</div>
                        <div className="text-[10px] text-slate-400">{row.category}</div>
                      </td>
                      {Object.values(UserRole).map(role => {
                        const val = row.roles[role];
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            {val === true ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                                ✓
                              </span>
                            ) : val === false ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-500/10 text-slate-500">
                                —
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: 3. Active Invitations */}
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
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowInviteModal(true);
                  setGeneratedInviteLink(null);
                }}
              >
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
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-semibold border ${
                              isRevoked
                                ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400'
                                : isExpired
                                  ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}
                          >
                            {isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs opacity-70">
                          {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {!isRevoked && !isExpired && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleCopyLink(fullLink, inv.id)}>
                                {copiedToken === inv.id ? 'Copied!' : 'Copy Link'}
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => handleRevokeInvite(inv.id)}>
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

      {/* Tab Content: 4. User & Audit Logs */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-4">
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
                      const isSecurityAction = log.action?.includes('role') || log.action?.includes('user_') || log.action?.includes('invite') || log.action?.includes('member');
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
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${
                                  isSecurityAction
                                    ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                                    : isTaskAction
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                                }`}
                              >
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

      {/* Provision / Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn p-4">
          <div className={`p-6 rounded-2xl shadow-2xl w-full max-w-lg border ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ICON_MAP.UserPlusIcon className="w-5 h-5 text-indigo-400" />
                Provision Team Member Seat
              </h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-sm opacity-60 hover:opacity-100 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleOnboardDirectMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Elena Rostova"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="elena@organization.io"
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">RBAC Role</label>
                  <select
                    value={newMemberRole}
                    onChange={e => setNewMemberRole(normalizeUserRole(e.target.value as UserRole))}
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    {ASSIGNABLE_ROLES.map(r => (
                      <option key={r} value={r}>{formatRoleForDisplay(r)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Department</label>
                  <select
                    value={newMemberDept}
                    onChange={e => setNewMemberDept(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Weekly Capacity</label>
                  <input
                    type="number"
                    min={10}
                    max={60}
                    value={newMemberCapacity}
                    onChange={e => setNewMemberCapacity(Number(e.target.value))}
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setShowAddMemberModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Provision Member</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn p-4">
          <div className={`p-6 rounded-2xl shadow-2xl w-full max-w-lg border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
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
                    onChange={e => setInviteRole(normalizeUserRole(e.target.value as UserRole))}
                    className={`w-full p-2.5 rounded-md border text-sm focus:ring-2 focus:ring-accent outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    {ASSIGNABLE_ROLES.map(r => (
                      <option key={r} value={r}>{formatRoleForDisplay(r)}</option>
                    ))}
                  </select>
                  <p className="text-xs opacity-60 mt-1">
                    The member will be automatically assigned this normalized RBAC role upon accepting the invitation link.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Recipient Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className={`w-full p-2.5 rounded-md border text-sm focus:ring-2 focus:ring-accent outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Link Expiration</label>
                  <select
                    value={inviteExpiryDays}
                    onChange={e => setInviteExpiryDays(Number(e.target.value))}
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
                      onClick={e => handleCreateInvitation(e as any, true)}
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
                  ✓ <strong>Invitation Created!</strong> Share the single-use token link below with your team member:
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
                    <Button variant="primary" size="sm" onClick={() => handleCopyLink(generatedInviteLink, 'modal')}>
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
          <div className={`p-6 rounded-2xl shadow-2xl w-full max-w-md border ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className="text-lg font-semibold text-status-error mb-3">Confirm Removal</h3>
            <p className="text-sm mb-5">
              Are you sure you want to remove <strong className="font-medium">{users.find(u => u.id === showConfirmDeleteModal)?.full_name || 'this user'}</strong> from the organization? They will lose access to all organization projects and data.
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
