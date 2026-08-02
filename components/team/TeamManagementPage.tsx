

import React, { useState, useEffect } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { User, UserRole, OrganizationInvitation } from '../../types';
import supabaseService from '../../services/supabaseService';
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
    addToast
  } = useAppStore();

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
    // PROJECT_MANAGER can manage MEMBERs and CLIENT_VIEWERs
    if (currentUser.role === UserRole.PROJECT_MANAGER) {
      return targetUserRole === UserRole.MEMBER || targetUserRole === UserRole.CLIENT_VIEWER;
    }
    return false; // Other roles cannot manage
  };

  const getAssignableRolesForUser = (targetUserRole?: UserRole): UserRole[] => {
    if (currentUser?.role === UserRole.OWNER) {
      return Object.values(UserRole); // OWNER can assign any role
    }
    if (currentUser?.role === UserRole.ADMIN) {
      return ASSIGNABLE_ROLES.filter(r => r !== UserRole.OWNER); // ADMIN can assign any role except OWNER
    }
    if (currentUser?.role === UserRole.PROJECT_MANAGER) {
      // PM can only change MEMBER to CLIENT_VIEWER and vice-versa (or assign if user is one of these)
      if (targetUserRole === UserRole.MEMBER || targetUserRole === UserRole.CLIENT_VIEWER) {
        return [UserRole.MEMBER, UserRole.CLIENT_VIEWER]; 
      }
      return [];
    }
    return [];
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

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div className="flex items-center mb-3 sm:mb-0">
            <UserGroupIcon className={`w-8 h-8 mr-3 text-accent`} />
            <h1 className="text-2xl md:text-3xl font-semibold text-gradient-accent">Team Management</h1>
        </div>
        <Button variant="primary" size="md" onClick={() => { setShowInviteModal(true); setGeneratedInviteLink(null); }}> 
          <PlusIcon className="w-5 h-5 mr-2" />
          Invite Member
        </Button>
      </div>

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

                return (
                <tr key={user.id} className={`${darkMode ? 'hover:bg-accent/10' : 'hover:bg-accent/5'} transition-colors duration-150 ${isThisUserBeingDeleted ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <Avatar user={user} size="md" className="mr-3" />
                      <span className="font-medium text-sm">{user.full_name || 'N/A'}</span>
                    </div>
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

      {/* Active Invitations Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ICON_MAP.MailIcon className="w-5 h-5 text-accent" />
            Active Organization Invitations ({invitations.length})
          </h2>
          <Button variant="secondary" size="sm" onClick={loadInvitations}>
            Refresh Invites
          </Button>
        </div>

        {isLoadingInvites ? (
          <div className="text-center py-6">
            <SpinnerIcon className="w-6 h-6 animate-spin mx-auto text-accent" />
          </div>
        ) : invitations.length === 0 ? (
          <div className={`p-6 rounded-squircle-md border text-center ${darkMode ? 'bg-slate-800/30 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            No active invitation links right now. Click "Invite Member" above to create a single-use join link.
          </div>
        ) : (
          <div className={`shadow-glass rounded-squircle-md overflow-x-auto border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
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

      {/* Additional Management Tools */}
      <div className="mt-8 p-6 rounded-squircle-md border text-center shadow-inner-glass" style={{backgroundColor: darkMode ? 'hsla(var(--page-background-base-dark),0.1)' : 'hsla(var(--page-background-base-light),0.2)', borderColor: 'hsl(var(--panel-border))'}}>
        <h3 className="text-lg font-semibold mb-2">Additional Management Tools</h3>
        <p className="text-sm opacity-70 mb-4">
          View full organizational audit trails, security activity, and member activity history.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={() => setCurrentView('user_logs_view')}>
            <ICON_MAP.ShieldCheckIcon className="w-4 h-4 mr-2" />
            View Audit Logs
          </Button>
        </div>
      </div>

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