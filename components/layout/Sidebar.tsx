import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Project, ActiveView, UserRole, normalizeUserRole } from '../../types';
import { ICON_MAP, SIDENAV_ITEMS, APP_TITLE, ALL_ACTIVE_VIEWS } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button'; 
import { StatusDynamicIcon } from './Header';
import { collabService } from '../../services/collabService';

export const Sidebar: React.FC = () => {
  const { 
    projects, 
    activeProject, 
    setActiveProject, 
    currentUser, 
    currentOrganization,
    darkMode,
    toggleDarkMode,
    isLoadingProjects,
    projectsError,
    openCreateProjectModal,
    activeView, 
    setActiveView, 
    signOut,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    openCommandPalette,
    openShortcutsModal,
    notifications,
    addToast,
  } = useAppStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [myStatus, setMyStatus] = useState<'available' | 'away' | 'busy'>(() => {
    if (typeof window !== 'undefined' && currentUser?.id) {
      try {
        const raw = localStorage.getItem('omni_team_statuses');
        const map = raw ? JSON.parse(raw) : {};
        if (map[currentUser.id]) return map[currentUser.id];
      } catch (e) {}
    }
    return 'available';
  });

  useEffect(() => {
    const handleStatusSync = (e: CustomEvent) => {
      const payload = e.detail;
      if (payload && currentUser && payload.userId === currentUser.id) {
        setMyStatus(payload.availabilityStatus);
      }
    };
    window.addEventListener('omni_remote_user_status_changed', handleStatusSync as EventListener);
    return () => window.removeEventListener('omni_remote_user_status_changed', handleStatusSync as EventListener);
  }, [currentUser?.id]);

  const handleStatusChange = (newStatus: 'available' | 'away' | 'busy') => {
    setMyStatus(newStatus);
    collabService.broadcastUserStatusChanged(newStatus);
    const label = newStatus === 'available' ? 'Available' : newStatus === 'away' ? 'Away' : 'Busy / DND';
    addToast('Status Broadcast Live', `Your status is now "${label}" across all connected teammates.`, 'info');
  };

  const isExpanded = isHovered || isPinned;

  const textColorClass = darkMode ? 'text-slate-300' : 'text-slate-600';
  const hoverBgClass = darkMode ? 'hover:bg-accent/15' : 'hover:bg-accent/10';
  const activeItemTextClass = darkMode ? 'text-accent-light' : 'text-accent-dark'; 
  const activeItemBgClass = darkMode ? 'bg-accent/20' : 'bg-accent/15'; 
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const CogIcon = ICON_MAP.CogIcon;
  const LogoutIcon = ICON_MAP.LogoutIcon;
  const FolderIcon = ICON_MAP.FolderIcon; 
  const XMarkIcon = ICON_MAP.XMarkIcon;
  const SunIcon = ICON_MAP.SunIcon;
  const MoonIcon = ICON_MAP.MoonIcon;

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSidenavItemClick = (id: ActiveView | string , _path: string) => {
    setActiveProject(null); 
    const targetView = id as ActiveView;

    const itemConfig = SIDENAV_ITEMS.find(item => item.id === id) || (id === 'admin_settings' ? { id: 'admin_settings' as ActiveView, label: 'Admin Settings', icon: 'CogIcon', path: '#', roles: [UserRole.ADMIN, UserRole.OWNER] as UserRole[] } : null);
    
    if (itemConfig && itemConfig.roles && currentUser?.role && !itemConfig.roles.includes(normalizedRole)) {
        console.warn(`Attempted to navigate to "${id}" without sufficient permissions.`);
        setActiveView('overview');
        setIsMobileSidebarOpen(false);
        return;
    }
    
    if (ALL_ACTIVE_VIEWS.includes(targetView)) {
        setActiveView(targetView);
    } else {
        setActiveView('overview');
    }
    setIsMobileSidebarOpen(false);
  };

  const isAdminOrOwner = normalizedRole === UserRole.ADMIN || normalizedRole === UserRole.OWNER;
  const canCreateProjectsBasedOnRole = isAdminOrOwner || normalizedRole === UserRole.PROJECT_MANAGER || normalizedRole === UserRole.MEMBER;

  const handleLogout = async () => {
    try {
      await signOut();
      setProfileMenuOpen(false); 
      setIsMobileSidebarOpen(false);
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
    (!!currentUser.organization_id && !canCreateProjectsBasedOnRole);

  let createProjectButtonTitle = "Create new project";
  if (!currentUser) {
    createProjectButtonTitle = "Login to create projects";
  } else if (currentUser.organization_id && !canCreateProjectsBasedOnRole) {
    createProjectButtonTitle = "You do not have permission to create projects in this organization";
  } else if (!currentUser.organization_id) {
    createProjectButtonTitle = "Create a personal project";
  }

  const statusLabelText = myStatus === 'available' ? 'Available' : myStatus === 'away' ? 'Away' : 'Busy / DND';

  const renderSidebarContent = (expanded: boolean, isMobile: boolean = false) => (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center space-x-2.5 overflow-hidden min-w-0">
            <ICON_MAP.SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0" />
            {(expanded || isMobile) && (
              <h1 className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tight text-gradient-accent whitespace-nowrap truncate`}>
                {APP_TITLE}
              </h1>
            )}
          </div>
          {isMobile ? (
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close menu"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setIsPinned((prev) => !prev)}
              title={isPinned ? "Unpin sidebar" : "Pin sidebar expanded"}
              className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                isPinned
                  ? 'bg-accent/25 text-accent dark:text-accent-light shadow-xs'
                  : darkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <ICON_MAP.Bars3Icon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Prominent Organization Display & Verification */}
        {currentUser && (
          <div className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${darkMode ? 'bg-slate-800/80 border-slate-700/80 shadow-inner' : 'bg-white/90 border-slate-200/90 shadow-xs'}`}>
            <div className="w-6.5 h-6.5 rounded-lg bg-gradient-to-br from-indigo-500 to-accent flex items-center justify-center text-white flex-shrink-0 shadow-xs" title={currentOrganization?.name || 'Workspace'}>
              <ICON_MAP.BuildingOfficeIcon className="w-3.5 h-3.5" />
            </div>
            {(expanded || isMobile) && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1">
                  <span className={`text-xs font-bold truncate ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {currentOrganization?.name || (currentUser.organization_id ? 'Organization' : 'Personal Workspace')}
                  </span>
                  {currentUser.organization_id && (
                    <span title="Verified Organization Member" className="flex items-center">
                      <ICON_MAP.CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate uppercase tracking-wider">
                  {normalizedRole.replace(/_/g, ' ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`flex-1 space-y-3 pr-1 overflow-x-hidden ${
        (expanded || isMobile) ? 'overflow-y-auto scrollbar-thin' : 'overflow-hidden scrollbar-none'
      }`}>
        <nav className="space-y-1">
          {SIDENAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];
            const isItemActive = activeView === item.id || (item.id === 'projects_overview' && activeView === 'kanban');
            
            if (item.roles && currentUser?.role && !item.roles.includes(normalizedRole)) {
                return null;
            }

            return (
              <button
                key={item.id}
                onClick={() => handleSidenavItemClick(item.id, item.path)}
                title={(!expanded && !isMobile) ? item.label : undefined}
                className={`w-full flex items-center ${(expanded || isMobile) ? 'space-x-2.5 px-3' : 'justify-center px-0'} py-2 rounded-xl transition-all group text-left
                            ${isItemActive 
                              ? `${activeItemBgClass} ${activeItemTextClass}` 
                              : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                            }`}
              >
                {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${isItemActive ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500')} group-hover:text-accent transition-colors`} />}
                {(expanded || isMobile) && (
                  <span className={`text-xs font-medium whitespace-nowrap truncate ${isItemActive ? 'font-semibold' : ''}`}>{item.label}</span>
                )}
              </button>
            );
          })}
          {isAdminOrOwner && (
            <button
              key="admin-settings"
              onClick={() => handleSidenavItemClick('admin_settings', '#')}
              title={(!expanded && !isMobile) ? 'Admin Settings' : undefined}
              className={`w-full flex items-center ${(expanded || isMobile) ? 'space-x-2.5 px-3' : 'justify-center px-0'} py-2 rounded-xl transition-all group text-left
                          ${activeView === 'admin_settings' 
                            ? `${activeItemBgClass} ${activeItemTextClass}` 
                            : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                          }`}
            >
              <CogIcon className={`w-4 h-4 flex-shrink-0 ${activeView === 'admin_settings' ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500')} group-hover:text-accent transition-colors`} />
              {(expanded || isMobile) && (
                <span className={`text-xs font-medium whitespace-nowrap truncate ${activeView === 'admin_settings' ? 'font-semibold' : ''}`}>Admin Settings</span>
              )}
            </button>
          )}
        </nav>

        <div className="pt-2">
          {(expanded || isMobile) ? (
            <div className="flex items-center justify-between px-3 mb-1.5">
              <h2 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                Projects
              </h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  openCreateProjectModal();
                  if (isMobile) setIsMobileSidebarOpen(false);
                }} 
                className={`p-1 ${darkMode ? 'text-slate-400 hover:text-accent-light' : 'text-slate-500 hover:text-accent'}`}
                title={createProjectButtonTitle}
                disabled={createProjectButtonDisabled}
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex justify-center my-2" title="Projects">
              <div className="w-6 h-0.5 bg-slate-400/40 dark:bg-slate-700/50 rounded-full" />
            </div>
          )}

          <div className="space-y-1">
            {isLoadingProjects && (expanded || isMobile) && (
              <div className={`flex items-center justify-center p-2 text-xs ${textColorClass}`}>
                <SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-1.5 text-accent" /> Loading...
              </div>
            )}
            {!isLoadingProjects && !projectsError && projects.map((project: Project) => {
              const isActive = activeProject?.id === project.id && activeView === 'kanban';
              return (
                <button
                  key={project.id}
                  onClick={() => {
                    setActiveProject(project.id);
                    if (isMobile) setIsMobileSidebarOpen(false);
                  }} 
                  title={(!expanded && !isMobile) ? project.name : undefined}
                  className={`w-full flex items-center ${(expanded || isMobile) ? 'space-x-2.5 px-3' : 'justify-center px-0'} py-2 rounded-xl text-left text-xs font-medium transition-all group
                    ${isActive
                      ? `${activeItemBgClass} ${activeItemTextClass}`
                      : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                    }`} 
                >
                  <FolderIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? (darkMode ? 'text-accent-light' : 'text-accent') : (darkMode ? 'text-slate-400' : 'text-slate-500 group-hover:text-accent')} transition-colors`} />
                  {(expanded || isMobile) && (
                    <span className={`transition-all truncate whitespace-nowrap ${isActive ? 'font-semibold' : ''}`}>{project.name}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className={`mt-auto border-t ${darkMode ? 'border-[var(--panel-border-dark)]' : 'border-[var(--panel-border-light)]'} pt-2.5 relative`} ref={profileMenuRef}>
        {currentUser ? (
          <button 
            onClick={() => setProfileMenuOpen(prev => !prev)}
            className={`w-full flex items-center ${(expanded || isMobile) ? 'space-x-2.5 p-1.5' : 'justify-center p-1'} rounded-xl ${hoverBgClass} hover:text-accent-light cursor-pointer text-left transition-all`}
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="true"
            title={(!expanded && !isMobile) ? `${currentUser.full_name || currentUser.email} (${statusLabelText})` : undefined}
          >
            <div className="relative flex-shrink-0">
              <Avatar user={currentUser} size="sm" />
              <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-slate-900 p-0.5">
                <StatusDynamicIcon status={myStatus} className="w-2.5 h-2.5" />
              </span>
            </div>
            {(expanded || isMobile) && (
              <>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{currentUser.full_name || currentUser.email}</p>
                  <p className={`text-[10px] truncate flex items-center gap-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>{statusLabelText}</span>
                    <span>•</span>
                    <span>{normalizedRole.replace(/_/g, ' ')}</span>
                  </p>
                </div>
                <ICON_MAP.ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${isProfileMenuOpen ? 'transform rotate-180' : ''} ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              </>
            )}
          </button>
        ) : null}

        {isProfileMenuOpen && currentUser && (
          <div 
            className={`absolute bottom-full left-0 ${(expanded || isMobile) ? 'right-0 w-full min-w-[240px]' : 'left-full ml-2 w-64'} mb-2 rounded-2xl shadow-2xl py-2 z-50 
                       border ${darkMode ? 'bg-slate-900/95 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'} backdrop-blur-xl animate-fadeIn`}
          >
            {/* Identity Summary */}
            <div className={`px-3.5 py-2 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <p className="text-xs font-bold truncate">{currentUser.full_name || currentUser.email}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
            </div>

            {/* Dynamic Status Switcher */}
            <div className={`px-3 py-2 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                  <StatusDynamicIcon status={myStatus} className="w-3 h-3" />
                  {statusLabelText}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['available', 'away', 'busy'] as const).map((st) => {
                  const active = myStatus === st;
                  const label = st === 'available' ? 'Online' : st === 'away' ? 'Away' : 'Busy';
                  return (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(st)}
                      className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                        active
                          ? darkMode
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                            : 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : darkMode
                            ? 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <StatusDynamicIcon status={st} className="w-3 h-3" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menu Actions */}
            <div className="py-1 px-1.5 space-y-0.5">
              <button
                onClick={() => {
                  setActiveView('profile_settings');
                  setProfileMenuOpen(false);
                  if (isMobile) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                           ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'} 
                           transition-colors`}
              >
                <ICON_MAP.UserCircleIcon className="w-4 h-4 text-indigo-400" />
                <span>Profile Settings</span>
              </button>

              <button
                onClick={() => {
                  setActiveView('my_tasks_view');
                  setProfileMenuOpen(false);
                  if (isMobile) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                           ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'} 
                           transition-colors`}
              >
                <ICON_MAP.ClipboardListIcon className="w-4 h-4 text-emerald-400" />
                <span>My Tasks</span>
              </button>

              <button
                onClick={() => {
                  setActiveView('team_management');
                  setProfileMenuOpen(false);
                  if (isMobile) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                           ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'} 
                           transition-colors`}
              >
                <ICON_MAP.UserGroupIcon className="w-4 h-4 text-sky-400" />
                <span>Team & RBAC</span>
              </button>

              <button
                onClick={() => {
                  setActiveView('inbox_view');
                  setProfileMenuOpen(false);
                  if (isMobile) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                           ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'} 
                           transition-colors`}
              >
                <span className="flex items-center space-x-2.5">
                  <ICON_MAP.BellIcon className="w-4 h-4 text-amber-400" />
                  <span>Notifications</span>
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  toggleDarkMode();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                           ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'} 
                           transition-colors`}
              >
                <span className="flex items-center space-x-2.5">
                  {darkMode ? <SunIcon className="w-4 h-4 text-amber-400" /> : <MoonIcon className="w-4 h-4 text-indigo-500" />}
                  <span>Theme Mode</span>
                </span>
                <span className="text-[10px] font-semibold opacity-75">{darkMode ? 'Dark' : 'Light'}</span>
              </button>

              <button
                onClick={() => {
                  openCommandPalette();
                  setProfileMenuOpen(false);
                  if (isMobile) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                           ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'} 
                           transition-colors`}
              >
                <span className="flex items-center space-x-2.5">
                  <ICON_MAP.SparklesIcon className="w-4 h-4 text-purple-400" />
                  <span>AI Command Centre</span>
                </span>
                <kbd className="text-[9px] font-mono opacity-60">⌘K</kbd>
              </button>

              <button
                onClick={() => {
                  openShortcutsModal();
                  setProfileMenuOpen(false);
                  if (isMobile) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                           ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'} 
                           transition-colors`}
              >
                <span className="flex items-center space-x-2.5">
                  <ICON_MAP.KeyboardIcon className="w-4 h-4 text-slate-400" />
                  <span>Shortcuts</span>
                </span>
                <kbd className="text-[9px] font-mono opacity-60">?</kbd>
              </button>
            </div>

            <div className={`h-px w-full my-1 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
            <div className="px-1.5">
              <button
                onClick={handleLogout}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer
                           ${darkMode ? 'text-rose-400 hover:bg-rose-500/15' : 'text-rose-600 hover:bg-rose-50'} 
                           transition-colors`}
              >
                <LogoutIcon className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setProfileMenuOpen(false);
        }}
        className={`hidden md:flex glass-panel rounded-2xl flex-col h-full p-3 space-y-3 transition-all duration-300 ease-in-out z-30 select-none ${
          isExpanded ? 'w-64' : 'w-16'
        }`}
      >
        {renderSidebarContent(isExpanded, false)}
      </aside>

      {/* Mobile Drawer Overlay (shown on mobile when toggled) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className={`relative w-72 max-w-[80vw] h-full p-4 flex flex-col space-y-3 z-50 shadow-2xl transition-all border-r ${
            darkMode ? 'bg-slate-900/98 border-slate-800 text-slate-100' : 'bg-white/98 border-slate-200 text-slate-900'
          }`}>
            {renderSidebarContent(true, true)}
          </aside>
        </div>
      )}
    </>
  );
};
