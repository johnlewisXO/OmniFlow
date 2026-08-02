

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
    currentOrganization,
    darkMode,
    isLoadingProjects,
    projectsError,
    openCreateProjectModal,
    activeView, 
    setActiveView, 
    signOut,
  } = useAppStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isExpanded = isHovered || isPinned;

  const textColorClass = darkMode ? 'text-slate-300' : 'text-slate-600';
  const hoverBgClass = darkMode ? 'hover:bg-accent/15' : 'hover:bg-accent/10';
  const activeItemTextClass = darkMode ? 'text-accent-light' : 'text-accent-dark'; 
  const activeItemBgClass = darkMode ? 'bg-accent/20' : 'bg-accent/15'; 
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const CogIcon = ICON_MAP.CogIcon;
  const LogoutIcon = ICON_MAP.LogoutIcon;
  const FolderIcon = ICON_MAP.FolderIcon; 

  const handleSidenavItemClick = (id: ActiveView | string , _path: string) => {
    setActiveProject(null); 
    const targetView = id as ActiveView;

    const itemConfig = SIDENAV_ITEMS.find(item => item.id === id) || (id === 'admin_settings' ? { id: 'admin_settings' as ActiveView, label: 'Admin Settings', icon: 'CogIcon', path: '#', roles: [UserRole.ADMIN, UserRole.OWNER] as UserRole[] } : null);
    
    if (itemConfig && itemConfig.roles && currentUser?.role && !itemConfig.roles.includes(currentUser.role as UserRole)) {
        console.warn(`Attempted to navigate to "${id}" without sufficient permissions.`);
        setActiveView('overview');
        return;
    }
    
    if (ALL_ACTIVE_VIEWS.includes(targetView)) {
        setActiveView(targetView);
    } else {
        console.warn(`Navigation to "${id}" might need role-specific handling or is unmapped. Falling back to overview.`);
        setActiveView('overview');
    }
  };

  const isAdminOrOwner = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.OWNER;
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
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setProfileMenuOpen(false);
      }}
      className={`glass-panel rounded-squircle-lg flex flex-col h-full p-3.5 space-y-4 transition-all duration-300 ease-in-out z-30 select-none ${
        isExpanded ? 'w-72' : 'w-20'
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center space-x-3 overflow-hidden min-w-0">
            <ICON_MAP.SparklesIcon className="w-8 h-8 text-accent flex-shrink-0" />
            {isExpanded && (
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} text-shadow-subtle text-gradient-accent whitespace-nowrap truncate animate-fadeIn`}>
                {APP_TITLE}
              </h1>
            )}
          </div>
          <button
            onClick={() => setIsPinned((prev) => !prev)}
            title={isPinned ? "Unpin sidebar (hover mode active)" : "Pin sidebar expanded"}
            className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
              isPinned
                ? 'bg-accent/25 text-accent dark:text-accent-light shadow-xs'
                : darkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
          >
            <ICON_MAP.Bars3Icon className="w-5 h-5" />
          </button>
        </div>

        {/* Prominent Organization Display & Verification */}
        {currentUser && (
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${darkMode ? 'bg-slate-800/80 border-slate-700/80 shadow-inner' : 'bg-white/90 border-slate-200/90 shadow-sm'}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-accent flex items-center justify-center text-white flex-shrink-0 shadow-sm" title={currentOrganization?.name || 'Workspace'}>
              <ICON_MAP.BuildingOfficeIcon className="w-4.5 h-4.5" />
            </div>
            {isExpanded && (
              <div className="min-w-0 flex-1 animate-fadeIn">
                <div className="flex items-center space-x-1">
                  <span className={`text-xs font-bold truncate ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {currentOrganization?.name || (currentUser.organization_id ? 'Organization' : 'Personal Workspace')}
                  </span>
                  {currentUser.organization_id && (
                    <ICON_MAP.CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" title="Verified Organization Member" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                  {currentUser.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`flex-1 space-y-4 pr-1 overflow-x-hidden ${
        isExpanded ? 'overflow-y-auto scrollbar-thin' : 'overflow-hidden scrollbar-none'
      }`}>
        <nav className="space-y-1.5">
          {SIDENAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];
            const isItemActive = activeView === item.id || (item.id === 'projects_overview' && activeView === 'kanban');
            
            if (item.roles && currentUser?.role && !item.roles.includes(currentUser.role as UserRole)) {
                return null;
            }

            return (
              <button
                key={item.id}
                onClick={() => handleSidenavItemClick(item.id, item.path)}
                title={!isExpanded ? item.label : undefined}
                className={`w-full flex items-center ${isExpanded ? 'space-x-3 px-3' : 'justify-center px-0'} py-2.5 rounded-squircle-sm transition-all group text-left
                            ${isItemActive 
                              ? `${activeItemBgClass} ${activeItemTextClass}` 
                              : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                            }`}
              >
                {Icon && <Icon className={`w-5 h-5 flex-shrink-0 ${isItemActive ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500')} group-hover:text-accent transition-colors`} />}
                {isExpanded && (
                  <span className={`text-sm font-medium whitespace-nowrap truncate animate-fadeIn ${isItemActive ? 'font-semibold' : ''}`}>{item.label}</span>
                )}
              </button>
            );
          })}
          {isAdminOrOwner && (
            <button
              key="admin-settings"
              onClick={() => handleSidenavItemClick('admin_settings', '#')}
              title={!isExpanded ? 'Admin Settings' : undefined}
              className={`w-full flex items-center ${isExpanded ? 'space-x-3 px-3' : 'justify-center px-0'} py-2.5 rounded-squircle-sm transition-all group text-left
                          ${activeView === 'admin_settings' 
                            ? `${activeItemBgClass} ${activeItemTextClass}` 
                            : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                          }`}
            >
              <CogIcon className={`w-5 h-5 flex-shrink-0 ${activeView === 'admin_settings' ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500')} group-hover:text-accent transition-colors`} />
              {isExpanded && (
                <span className={`text-sm font-medium whitespace-nowrap truncate animate-fadeIn ${activeView === 'admin_settings' ? 'font-semibold' : ''}`}>Admin Settings</span>
              )}
            </button>
          )}
        </nav>

        <div className="pt-3">
          {isExpanded ? (
            <div className="flex items-center justify-between px-3 mb-2 animate-fadeIn">
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
          ) : (
            <div className="flex justify-center my-2" title="Projects">
              <div className="w-6 h-0.5 bg-slate-400/40 dark:bg-slate-700/50 rounded-full" />
            </div>
          )}

          <div className="space-y-1.5">
            {isLoadingProjects && isExpanded && (
              <div className={`flex items-center justify-center p-3 text-xs ${textColorClass}`}>
                <SpinnerIcon className="w-4 h-4 animate-spin mr-2 text-accent" /> Loading...
              </div>
            )}
            {!isLoadingProjects && !projectsError && projects.map((project: Project) => {
              const isActive = activeProject?.id === project.id && activeView === 'kanban';
              return (
                <button
                  key={project.id}
                  onClick={() => {
                    setActiveProject(project.id); 
                  }} 
                  title={!isExpanded ? project.name : undefined}
                  className={`w-full flex items-center ${isExpanded ? 'space-x-3 px-3' : 'justify-center px-0'} py-2.5 rounded-squircle-sm text-left text-sm font-medium transition-all group
                    ${isActive
                      ? `${activeItemBgClass} ${activeItemTextClass}`
                      : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                    }`} 
                >
                  <FolderIcon className={`w-5 h-5 flex-shrink-0 ${isActive ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500 group-hover:text-accent')} transition-colors`} />
                  {isExpanded && (
                    <span className={`transition-all truncate whitespace-nowrap animate-fadeIn ${isActive ? 'font-semibold' : ''}`}>{project.name}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className={`mt-auto border-t ${darkMode ? 'border-[var(--panel-border-dark)]' : 'border-[var(--panel-border-light)]'} pt-3 relative`} ref={profileMenuRef}>
        {currentUser ? (
          <button 
            onClick={() => setProfileMenuOpen(prev => !prev)}
            className={`w-full flex items-center ${isExpanded ? 'space-x-3 p-2' : 'justify-center p-1'} rounded-squircle-sm ${hoverBgClass} hover:text-accent-light cursor-pointer text-left transition-all`}
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="true"
            title={!isExpanded ? (currentUser.full_name || currentUser.email) : undefined}
          >
            <Avatar user={currentUser} size="md" />
            {isExpanded && (
              <>
                <div className="flex-1 min-w-0 animate-fadeIn">
                  <p className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{currentUser.full_name || currentUser.email}</p>
                  <p className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.email}</p>
                </div>
                <ICON_MAP.ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${isProfileMenuOpen ? 'transform rotate-180' : ''} ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              </>
            )}
          </button>
        ) : null}
        {isProfileMenuOpen && currentUser && (
          <div 
            className={`absolute bottom-full left-0 ${isExpanded ? 'right-0 w-full' : 'left-full ml-2 w-48'} mb-2 rounded-squircle-md shadow-glass-lg py-1 z-50 
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