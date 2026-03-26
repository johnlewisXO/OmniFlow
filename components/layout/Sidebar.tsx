

import React, { useState, useEffect, useRef } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { Project, ActiveView, UserRole } from '../../types';
import { ICON_MAP, SIDENAV_ITEMS, APP_TITLE, ALL_ACTIVE_VIEWS } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button'; 

export const Sidebar: React.FC = () => {
  const { 
    projects, 
    activeProject, 
    setActiveProject, 
    currentUser, 
    darkMode,
    isLoadingProjects,
    projectsError,
    openCreateProjectModal,
    activeView, 
    setActiveView, 
    signOut,
  } = useAppStore();

  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const textColorClass = darkMode ? 'text-slate-300' : 'text-slate-600'; // Adjusted for better contrast on glass
  const hoverBgClass = darkMode ? 'hover:bg-accent/15' : 'hover:bg-accent/10'; // Use accent for hover
  const activeItemTextClass = darkMode ? 'text-accent-light' : 'text-accent-dark'; 
  const activeItemBgClass = darkMode ? 'bg-accent/20' : 'bg-accent/15'; 
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const CogIcon = ICON_MAP.CogIcon;
  const LogoutIcon = ICON_MAP.LogoutIcon;
  const FolderIcon = ICON_MAP.FolderIcon; 
  const UserGroupIcon = ICON_MAP.UserGroupIcon;

  const handleSidenavItemClick = (id: ActiveView | string , _path: string) => { // path parameter is not used here
    setActiveProject(null); 
    const targetView = id as ActiveView;

    // Check permissions for role-restricted views
    const itemConfig = SIDENAV_ITEMS.find(item => item.id === id) || (id === 'admin_settings' ? { id: 'admin_settings' as ActiveView, label: 'Admin Settings', icon: 'CogIcon', path: '#', roles: [UserRole.ADMIN, UserRole.OWNER] as UserRole[] } : null);
    
    if (itemConfig && itemConfig.roles && currentUser?.role && !itemConfig.roles.includes(currentUser.role as UserRole)) {
        console.warn(`Attempted to navigate to "${id}" without sufficient permissions.`);
        setActiveView('overview'); // Fallback to a safe view
        return;
    }
    
    if (ALL_ACTIVE_VIEWS.includes(targetView)) { // Use ALL_ACTIVE_VIEWS for robust check
        setActiveView(targetView);
    } else {
        console.warn(`Navigation to "${id}" might need role-specific handling or is unmapped. Falling back to overview.`);
        setActiveView('overview');
    }
  };

  const isAdminOrOwner = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.OWNER;
  const canManageTeam = isAdminOrOwner || currentUser?.role === UserRole.PROJECT_MANAGER;
  const canCreateProjectsBasedOnRole = isAdminOrOwner || currentUser?.role === UserRole.PROJECT_MANAGER || currentUser?.role === UserRole.MEMBER;

  const handleLogout = async () => {
    try {
      await signOut();
      setProfileMenuOpen(false); 
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);
  
  const createProjectButtonDisabled = !currentUser || 
    (!!currentUser.organization_id && !canCreateProjectsBasedOnRole && currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.PROJECT_MANAGER);

  let createProjectButtonTitle = "Create new project";
  if (!currentUser) {
    createProjectButtonTitle = "Login to create projects";
  } else if (currentUser.organization_id && !canCreateProjectsBasedOnRole && currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.PROJECT_MANAGER) {
    createProjectButtonTitle = "You do not have permission to create projects in this organization";
  } else if (!currentUser.organization_id) {
    createProjectButtonTitle = "Create a personal project";
  }


  return (
    <aside className="w-72 glass-panel rounded-squircle-lg flex flex-col h-full p-4 space-y-6">
      <div className="flex items-center space-x-3 px-2 pt-2">
        <ICON_MAP.SparklesIcon className="w-8 h-8 text-accent" />
        <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} text-shadow-subtle text-gradient-accent`}>{APP_TITLE}</h1>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
        <nav className="space-y-1.5">
          {SIDENAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];
            const isItemActive = activeView === item.id || (item.id === 'projects_overview' && activeView === 'kanban');
            
            // Role-based rendering for sidebar items
            if (item.roles && currentUser?.role && !item.roles.includes(currentUser.role as UserRole)) {
                return null;
            }

            return (
              <button
                key={item.id}
                onClick={() => handleSidenavItemClick(item.id, item.path)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-squircle-sm transition-colors group text-left
                            ${isItemActive 
                              ? `${activeItemBgClass} ${activeItemTextClass}` 
                              : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                            }`}
              >
                {Icon && <Icon className={`w-5 h-5 ${isItemActive ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500')} group-hover:text-accent transition-colors`} />}
                <span className={`text-sm font-medium ${isItemActive ? 'font-semibold' : ''}`}>{item.label}</span>
              </button>
            );
          })}
          {isAdminOrOwner && (
            <button
              key="admin-settings"
              onClick={() => handleSidenavItemClick('admin_settings', '#')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-squircle-sm transition-colors group text-left
                          ${activeView === 'admin_settings' 
                            ? `${activeItemBgClass} ${activeItemTextClass}` 
                            : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                          }`}
            >
              <CogIcon className={`w-5 h-5 ${activeView === 'admin_settings' ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500')} group-hover:text-accent transition-colors`} />
              <span className={`text-sm font-medium ${activeView === 'admin_settings' ? 'font-semibold' : ''}`}>Admin Settings</span>
            </button>
          )}
        </nav>

        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <h2 className={`text-xs font-semibold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-500'} tracking-wider`}>
              Projects
            </h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={openCreateProjectModal} 
              className={`p-1 ${darkMode ? 'text-slate-400 hover:text-accent-light' : 'text-slate-500 hover:text-accent'}`}
              title={createProjectButtonTitle}
              disabled={createProjectButtonDisabled}
            >
              <PlusIcon className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {isLoadingProjects && (
              <div className={`flex items-center justify-center p-4 ${textColorClass}`}>
                <SpinnerIcon className="w-5 h-5 animate-spin mr-2 text-accent" /> Loading projects...
              </div>
            )}
            {projectsError && !isLoadingProjects && (
               <div className={`flex items-center p-3 text-xs text-status-error/80 dark:text-status-error rounded-squircle-sm bg-status-error/10`}>
                <ExclamationIcon className="w-4 h-4 mr-2" />
                Error: {projectsError}
              </div>
            )}
            {!isLoadingProjects && !projectsError && projects.length === 0 && currentUser && ( 
              <p className={`px-3 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                No projects yet. Click '+' to create.
              </p>
            )}
            {!isLoadingProjects && !projectsError && projects.map((project: Project) => {
              const isActive = activeProject?.id === project.id && activeView === 'kanban';
              return (
                <button
                  key={project.id}
                  onClick={() => {
                    setActiveProject(project.id); 
                  }} 
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-squircle-sm text-left text-sm font-medium transition-all duration-300 group
                    ${isActive
                      ? `${activeItemBgClass} ${activeItemTextClass}`
                      : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                    }
                    `} 
                >
                  <FolderIcon className={`w-5 h-5 ${isActive ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500 group-hover:text-accent') } transition-colors`} />
                  <span className={`transition-all duration-300 ${isActive ? 'font-semibold' : ''}`}>{project.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className={`mt-auto border-t ${darkMode ? 'border-[var(--panel-border-dark)]' : 'border-[var(--panel-border-light)]'} pt-4 relative`} ref={profileMenuRef}>
        {currentUser ? (
          <button 
            onClick={() => setProfileMenuOpen(prev => !prev)}
            className={`w-full flex items-center space-x-3 p-2 rounded-squircle-sm ${hoverBgClass} hover:text-accent-light cursor-pointer text-left`}
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="true"
          >
            <Avatar user={currentUser} size="md" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{currentUser.full_name || currentUser.email}</p>
              <p className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.email}</p>
              {currentUser.role && <p className={`text-xs font-mono truncate ${darkMode ? 'text-accent-light/70' : 'text-accent/70'}`}>{currentUser.role.replace(/_/g, ' ')}</p>}
            </div>
            <ICON_MAP.ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isProfileMenuOpen ? 'transform rotate-180' : ''} ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        ) : (
          <div className={`p-2 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Not logged in.
          </div>
        )}
        {isProfileMenuOpen && currentUser && (
          <div 
            className={`absolute bottom-full left-0 right-0 mb-2 w-full rounded-squircle-md shadow-glass-lg py-1 z-10 
                       border ${darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-300'} backdrop-blur-md`}
          >
            <button
              onClick={() => {
                setActiveView('profile_settings');
                setProfileMenuOpen(false);
              }}
              className={`w-full flex items-center space-x-2 px-4 py-2 text-sm 
                         ${darkMode ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'} 
                         transition-colors`}
            >
              <ICON_MAP.UserCircleIcon className="w-4 h-4" />
              <span>Profile Settings</span>
            </button>
            <div className={`h-px w-full my-1 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <button
              onClick={handleLogout}
              className={`w-full flex items-center space-x-2 px-4 py-2 text-sm 
                         ${darkMode ? 'text-status-error hover:bg-status-error/20' : 'text-status-error hover:bg-status-error/10'} 
                         transition-colors`}
            >
              <LogoutIcon className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};