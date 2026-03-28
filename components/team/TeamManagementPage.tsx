

import React, { useState, useEffect } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { User, UserRole } from '../../types';
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
  } = useAppStore();

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRoleForUser, setSelectedRoleForUser] = useState<UserRole | null>(null);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState<string | null>(null); // Store userId to delete
  
  const UserGroupIcon = ICON_MAP.UserGroupIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const TrashIcon = ICON_MAP.TrashIcon;
  const selectWrapperClass = "relative"; 
  const selectArrowClass = `absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'} pointer-events-none`;


  useEffect(() => {
    if (currentUser?.organization_id && users.length === 0 && !isLoadingUsersForAssignment) {
      fetchUsersForAssignmentList();
    }
  }, [currentUser?.organization_id, users.length, isLoadingUsersForAssignment, fetchUsersForAssignmentList]);

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) {
        alert("You cannot change your own role from this interface.");
        return;
    }
    updateUserRoleInOrganization(userId, newRole);
    setEditingUserId(null); 
    setSelectedRoleForUser(null);
  };

  const handleRemoveUserConfirm = (userId: string) => {
    setShowConfirmDeleteModal(userId);
  };

  const executeRemoveUser = (userId: string) => {
    deleteUserFromOrganization(userId);
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
        <Button variant="primary" size="md" disabled> 
          <PlusIcon className="w-5 h-5 mr-2" />
          Invite User (Coming Soon)
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
      <div className="mt-8 p-6 rounded-squircle-md border text-center shadow-inner-glass" style={{backgroundColor: darkMode ? 'hsla(var(--page-background-base-dark),0.1)' : 'hsla(var(--page-background-base-light),0.2)', borderColor: 'hsl(var(--panel-border))'}}>
        <h3 className="text-lg font-semibold mb-2">Additional Management Tools</h3>
        <p className="text-sm opacity-70 mb-4">
          Features like revoking access, viewing detailed activity logs per user, and group management are planned for future updates.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" disabled>View User Logs (Soon)</Button>
            <Button variant="outline" disabled>Manage User Groups (Soon)</Button>
        </div>
      </div>

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