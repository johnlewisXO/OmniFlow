import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { Avatar } from '../shared/Avatar';
import { AnimatedPopover } from '../shared/Modal';
import { collabService, formatAccurateLastSeen } from '../../services/collabService';
import { UserPresence, normalizeUserRole } from '../../types';

export const StatusDynamicIcon: React.FC<{ status: 'available' | 'away' | 'busy'; className?: string }> = ({ status, className = 'w-4 h-4' }) => {
  if (status === 'available') {
    return (
      <span className={`relative inline-flex items-center justify-center ${className}`}>
        <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-60"></span>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-emerald-500">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (status === 'away') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-amber-400`}>
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-rose-500`}>
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-3.75 9a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5z" clipRule="evenodd" />
    </svg>
  );
};

export const Header: React.FC = () => {
  const { 
    darkMode, 
    toggleDarkMode, 
    activeProject, 
    openModal, 
    currentUser, 
    currentOrganization,
    signOut,
    notifications,
    setActiveView,
    addToast,
    toggleMobileSidebar,
    openCommandPalette,
    openShortcutsModal,
    presences,
    users,
  } = useAppStore();

  const [lastSeenTick, setLastSeenTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLastSeenTick(v => v + 1), 10000);
    return () => clearInterval(t);
  }, []);

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

  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const statusPopoverRef = useRef<HTMLDivElement>(null);

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
    setIsStatusPopoverOpen(false);
    collabService.broadcastUserStatusChanged(newStatus);
    const label = newStatus === 'available' ? 'Available' : newStatus === 'away' ? 'Away' : 'Busy / DND';
    addToast('Status Broadcast Live', `Your status is now "${label}" across all connected teammates.`, 'info');
  };

  // Deduplicated presences by userId for the header bar, strictly isolated to currentUser.organization_id
  const uniquePresences = useMemo(() => {
    const myOrgId = currentUser?.organization_id;
    if (!currentUser || !myOrgId) return [];

    const map = new Map<string, UserPresence>();
    presences.forEach(p => {
      if (!p || !p.userId) return;
      // Enforce strict multi-tenant organization isolation
      const isSelf = p.userId === currentUser.id;
      const matchesOrgId = p.organizationId === myOrgId;
      const isKnownOrgMember = users.some(
        u =>
          u.organization_id === myOrgId &&
          (u.id === p.userId ||
            (u.email && p.userEmail && u.email.toLowerCase() === p.userEmail.toLowerCase()))
      );

      if (!isSelf && !matchesOrgId && !isKnownOrgMember) {
        return;
      }
      if (p.organizationId && p.organizationId !== myOrgId) {
        return;
      }

      const existing = map.get(p.userId);
      if (!existing) {
        map.set(p.userId, p);
      } else {
        map.set(p.userId, {
          ...existing,
          ...p,
          availabilityStatus: p.availabilityStatus || existing.availabilityStatus,
          currentTaskId: p.currentTaskId || existing.currentTaskId,
          isEditing: Boolean(existing.isEditing || p.isEditing),
        });
      }
    });
    return Array.from(map.values());
  }, [presences, currentUser?.id, currentUser?.organization_id, users, lastSeenTick]);

  const handleAddTaskClick = () => {
    if (!activeProject) {
      addToast('Select a Project Required', 'Please select or create a project from the sidebar to start adding tasks.', 'warning');
      return;
    }
    openModal();
  };

  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  const SunIcon = ICON_MAP.SunIcon;
  const MoonIcon = ICON_MAP.MoonIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const LogoutIcon = ICON_MAP.LogoutIcon;
  const BellIcon = ICON_MAP.BellIcon;
  const Bars3Icon = ICON_MAP.Bars3Icon;

  const subTextColor = darkMode ? 'text-slate-400' : 'text-slate-500';
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    try {
      await signOut();
      setProfileMenuOpen(false);
    } catch (error) {
      console.error("Failed to sign out from header:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current && 
        !profileMenuRef.current.contains(event.target as Node) &&
        avatarButtonRef.current && 
        !avatarButtonRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
      if (statusPopoverRef.current && !statusPopoverRef.current.contains(event.target as Node)) {
        setIsStatusPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const statusLabelText = myStatus === 'available' ? 'Available' : myStatus === 'away' ? 'Away' : 'Busy / DND';

  return (
    <header className="glass-panel rounded-2xl px-3.5 sm:px-5 py-3 relative z-20">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Mobile Hamburger Button */}
          <button
            onClick={toggleMobileSidebar}
            className={`md:hidden p-2 rounded-xl transition-all ${
              darkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            aria-label="Open sidebar navigation"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-gradient-accent tracking-tight truncate">
              {activeProject ? activeProject.name : 'Dashboard'}
            </h1>
            {activeProject && (
              <p className={`text-xs ${subTextColor} truncate hidden sm:block`}>
                Manage tasks and progress for {activeProject.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
          {/* Minimal Team Presence Avatars */}
          {uniquePresences.length > 0 && (
            <div className="hidden lg:flex items-center -space-x-1.5 mr-1">
              {uniquePresences.slice(0, 4).map((p) => {
                const lsInfo = formatAccurateLastSeen(
                  p,
                  p.userId,
                  p.userEmail,
                  p.userId === currentUser?.id
                );
                const matchedOrgUser = users.find(
                  u =>
                    u.id === p.userId ||
                    (u.email && p.userEmail && u.email.toLowerCase() === p.userEmail.toLowerCase())
                );
                return (
                  <div
                    key={p.userId}
                    className="relative inline-block ring-2 ring-white dark:ring-slate-900 rounded-full"
                    title={`${p.userName} • ${lsInfo.statusLabel}`}
                  >
                    <Avatar
                      user={
                        matchedOrgUser || {
                          id: p.userId,
                          full_name: p.userName,
                          email: p.userEmail || '',
                          avatar_url: p.userAvatar,
                          organization_id: p.organizationId || currentUser?.organization_id,
                        }
                      }
                      size="sm"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1 ring-white dark:ring-slate-900 pointer-events-none ${lsInfo.dotColorClass}`}
                    />
                  </div>
                );
              })}
              {uniquePresences.length > 4 && (
                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900">
                  +{uniquePresences.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Quick Command Palette Button */}
          <button
            data-tour-id="tour-header-command"
            onClick={openCommandPalette}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              darkMode 
                ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300' 
                : 'bg-slate-100/90 hover:bg-slate-200/90 border-slate-200 text-slate-600'
            }`}
            title="Open Command Palette (Cmd+K / Ctrl+K)"
          >
            <ICON_MAP.SearchIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Search or command...</span>
            <kbd className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              darkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-300 text-slate-500'
            }`}>
              ⌘K
            </kbd>
          </button>

          {/* Keyboard Shortcuts Button */}
          <button
            onClick={openShortcutsModal}
            className={`p-2 rounded-xl border transition-all text-xs font-medium ${
              darkMode 
                ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-400 hover:text-slate-200' 
                : 'bg-slate-100/90 hover:bg-slate-200/90 border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
          >
            <ICON_MAP.KeyboardIcon className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveView('inbox_view')}
            className={`relative p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'}`}
            aria-label="Notifications"
          >
            <BellIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>

          <Button
            variant="secondary" 
            size="icon"
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="w-8 h-8 sm:w-9 sm:h-9"
          >
            {darkMode ? <SunIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <MoonIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </Button>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleAddTaskClick}
            disabled={!currentUser}
            title={!activeProject ? "Select a project to add tasks" : (!currentUser ? "Login to add tasks" : "Add new task")}
            className="px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4 sm:mr-1" /> 
            <span className="hidden sm:inline">Add Task</span>
          </Button>
          
          {/* Rich Profile Dropdown Menu */}
          <div className="relative" ref={profileMenuRef} data-tour-id="tour-header-profile">
            {currentUser ? (
              <button 
                ref={avatarButtonRef}
                onClick={() => setProfileMenuOpen(prev => !prev)}
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ring-offset-background cursor-pointer"
              >
                <Avatar user={currentUser} size="md" />
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-slate-900 p-0.5 shadow-xs">
                  <StatusDynamicIcon status={myStatus} className="w-2.5 h-2.5" />
                </span>
              </button>
            ) : (
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-700/70 text-slate-400' : 'bg-slate-300/70 text-slate-500'} border ${darkMode ? 'border-slate-600' : 'border-slate-400'}`} title="Not logged in">
                <ICON_MAP.UserCircleIcon className="w-5 h-5" />
              </div>
            )}

            <AnimatedPopover
              isOpen={Boolean(isProfileMenuOpen && currentUser)}
              direction="down"
              className={`absolute right-0 mt-2.5 w-72 rounded-2xl shadow-2xl py-2 z-50 border backdrop-blur-xl ${
                darkMode ? 'bg-slate-900/95 border-slate-700/80 text-slate-100' : 'bg-white/95 border-slate-200/90 text-slate-800'
              }`}
            >
              {currentUser && (
                <>
                {/* User Identity Header */}
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar user={currentUser} size="md" />
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-slate-900 p-0.5">
                        <StatusDynamicIcon status={myStatus} className="w-3 h-3" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{currentUser.full_name || currentUser.email}</p>
                      <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                          {normalizedRole.replace(/_/g, ' ')}
                        </span>
                        {currentOrganization?.name && (
                          <span className="text-[10px] text-slate-400 truncate">• {currentOrganization.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Status Selector inside Profile Menu */}
                <div className={`px-3 py-2 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Status</span>
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
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
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                            active
                              ? darkMode
                                ? 'bg-indigo-500/20 border-indigo-500/50 text-white shadow-xs'
                                : 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs'
                              : darkMode
                                ? 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                                : 'bg-slate-50 border-slate-200/70 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <StatusDynamicIcon status={st} className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation & Quick Workspace Links */}
                <div className="py-1 px-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setActiveView('profile_settings');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.UserCircleIcon className="w-4 h-4 text-indigo-400" />
                      <span>Profile & Workspace Settings</span>
                    </span>
                    <span className="text-[10px] text-slate-400">⚙️</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView('my_tasks_view');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.ClipboardListIcon className="w-4 h-4 text-emerald-400" />
                      <span>My Assigned Tasks</span>
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView('ai_copilot_view');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.SparklesIcon className="w-4 h-4 text-purple-400" />
                      <span>AI Co-Pilot & Virtual PM</span>
                    </span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">AI</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView('team_management');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.UserGroupIcon className="w-4 h-4 text-sky-400" />
                      <span>Team & RBAC Directory</span>
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView('inbox_view');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <BellIcon className="w-4 h-4 text-amber-400" />
                      <span>Inbox & Notifications</span>
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Preferences & Utilities */}
                <div className={`py-1 px-1.5 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'} space-y-0.5`}>
                  <button
                    onClick={() => {
                      toggleDarkMode();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {darkMode ? <SunIcon className="w-4 h-4 text-amber-400" /> : <MoonIcon className="w-4 h-4 text-indigo-500" />}
                      <span>Appearance Mode</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-amber-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      {darkMode ? 'Dark' : 'Light'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      openCommandPalette();
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.SearchIcon className="w-4 h-4 text-slate-400" />
                      <span>AI Command Centre</span>
                    </span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400 border border-slate-700/50">⌘K</kbd>
                  </button>

                  {(normalizeUserRole(currentUser.role) === 'OWNER' || normalizeUserRole(currentUser.role) === 'PROJECT_MANAGER') && (
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('omni_open_system_log_monitor'));
                        setProfileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        darkMode ? 'text-emerald-300 hover:bg-slate-800' : 'text-emerald-700 hover:bg-emerald-50/70'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <ICON_MAP.TerminalIcon className="w-4 h-4 text-emerald-400" />
                        <span>Exception & Console Log Monitor</span>
                      </span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        {normalizeUserRole(currentUser.role) === 'OWNER' ? 'OWNER' : 'PM'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('omni_open_email_center', { detail: { tab: 'verify' } }));
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
                      <span>Email Verification & Outbox</span>
                    </span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                      SMTP
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('omni_open_ai_guide'));
                      window.dispatchEvent(new CustomEvent('omni_open_ai_platform_guide'));
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.SparklesIcon className="w-4 h-4 text-indigo-400" />
                      <span>Interactive AI Platform Guide</span>
                    </span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400">Tour</span>
                  </button>

                  <button
                    onClick={() => {
                      openShortcutsModal();
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.KeyboardIcon className="w-4 h-4 text-slate-400" />
                      <span>Keyboard Shortcuts</span>
                    </span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400 border border-slate-700/50">?</kbd>
                  </button>
                </div>

                {/* Sign out */}
                <div className={`pt-1 px-1.5 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      darkMode ? 'text-rose-400 hover:bg-rose-500/15' : 'text-rose-600 hover:bg-rose-50'
                    } transition-colors`}
                  >
                    <LogoutIcon className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
                </>
              )}
            </AnimatedPopover>
          </div>
        </div>
      </div>
    </header>
  );
};
