
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { OverviewPage } from '../overview/OverviewPage'; 
import { Button } from '../shared/Button';

export const AdminDashboard: React.FC = () => {
  const { currentUser, darkMode } = useAppStore();
  const CogIcon = ICON_MAP.CogIcon;
  const UserCircleIcon = ICON_MAP.UserCircleIcon; // Using UserCircle for users section
  const FolderIcon = ICON_MAP.FolderIcon; // For global project settings
  const ClipboardListIcon = ICON_MAP.ClipboardListIcon; // For activity log


  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Admin Dashboard</h1>
        <p className={`text-md ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage users, projects, and organization settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {/* User Management Placeholder */}
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
          <div className="flex items-center mb-3">
            <UserCircleIcon className={`w-6 h-6 mr-2 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
            <h2 className="text-lg font-semibold">User Management</h2>
          </div>
          <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Invite new users, manage roles, and view user activity.</p>
          <Button variant="outline" size="sm" className="w-full">Manage Users (Coming Soon)</Button>
        </div>

        {/* Organization Settings Placeholder */}
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
          <div className="flex items-center mb-3">
            <CogIcon className={`w-6 h-6 mr-2 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
            <h2 className="text-lg font-semibold">Organization Settings</h2>
          </div>
          <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Configure organization name, domain, and default preferences.</p>
          <Button variant="outline" size="sm" className="w-full">Configure Settings (Coming Soon)</Button>
        </div>
        
        {/* Global Project Settings Placeholder */}
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
          <div className="flex items-center mb-3">
            <FolderIcon className={`w-6 h-6 mr-2 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
            <h2 className="text-lg font-semibold">Global Project Settings</h2>
          </div>
          <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage project templates, default statuses, and custom fields.</p>
          <Button variant="outline" size="sm" className="w-full">Project Templates (Coming Soon)</Button>
        </div>
      </div>
      
      {/* Activity Log Placeholder */}
       <div className={`mt-8 p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
        <div className="flex items-center mb-4">
          <ClipboardListIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
          <h2 className="text-xl font-semibold">Organization Activity Log</h2>
        </div>
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          A detailed log of important actions taken across the organization will be displayed here. (e.g., project creation, user invitations, role changes).
        </p>
         <div className="mt-4 h-48 flex items-center justify-center border-2 border-dashed rounded-md ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
            <p className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Activity Feed Area [Coming Soon]</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">General App Overview</h2>
        <OverviewPage showWelcomeMessage={false} /> 
      </div>
    </div>
  );
};