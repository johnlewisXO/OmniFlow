import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { AnimatedPopover } from '../shared/Modal';
import { QuickUtilitiesDrawer } from '../shared/QuickUtilitiesDrawer';
import { SegmentedTabs, SegmentedTabOption } from '../shared/EditorialUI';
import { collabService, formatAccurateLastSeen } from '../../services/collabService';
import soundService from '../../services/soundService';
import { ActiveView, User, UserPresence, UserRole, normalizeUserRole } from '../../types';

export const StatusDynamicIcon: React.FC<{ status: 'available' | 'away' | 'busy'; className?: string }> = ({
  status,
  className = 'w-4 h-4',
}) => {
  if (status === 'available') {
    return (
      <span className={`inline-block rounded-full bg-emerald-600 dark:bg-emerald-400 ${className}`} title="Available" />
    );
  }
  if (status === 'away') {
    return (
      <span className={`inline-block rounded-full bg-amber-500 ${className}`} title="Away" />
    );
  }
  return (
    <span className={`inline-block rounded-full bg-rose-600 ${className}`} title="Busy / DND" />
  );
};

export const Header: React.FC = () => {
  const {
    darkMode,
    toggleDarkMode,
    activeProject,
    openModal,
    openCreateProjectModal,
    currentUser,
    currentOrganization,
    openOrganizationModal,
    signOut,
    notifications,
    activeView,
    setActiveView,
    addToast,
    toggleMobileSidebar,
    isSidebarPinned,
    toggleSidebarPinned,
    openCommandPalette,
    openShortcutsModal,
    presences,
    users,
    activeTimer,
    pauseTaskTimer,
    resumeTaskTimer,
    stopAndLogTaskTimer,
    tasks,
    openViewTaskModal,
  } = useAppStore();

  const [timerTick, setTimerTick] = useState(0);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isUtilitiesDrawerOpen, setIsUtilitiesDrawerOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!activeTimer?.isRunning) return;
    const t = setInterval(() => setTimerTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [activeTimer?.isRunning]);

  const formattedFocusTimer = useMemo(() => {
    if (!activeTimer) return '00:00:00';
    const liveSeconds = activeTimer.isRunning
      ? Math.max(0, Math.floor((Date.now() - activeTimer.startedAt) / 1000))
      : 0;
    const total = Math.max(0, (activeTimer.accumulatedSeconds || 0) + liveSeconds);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':');
  }, [activeTimer, timerTick]);

  const [myStatus, setMyStatus] = useState<'available' | 'away' | 'busy'>(() => {
    if (typeof window !== 'undefined' && currentUser?.id) {
      try {
        const raw = localStorage.getItem('omni_team_statuses');
        const map = raw ? JSON.parse(raw) : {};
        if (map[currentUser.id]) return map[currentUser.id];
      } catch {}
    }
    return 'available';
  });

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusChange = (newStatus: 'available' | 'away' | 'busy') => {
    setMyStatus(newStatus);
    collabService.broadcastUserStatusChanged(newStatus);
    addToast('Status Updated', `Availability set to ${newStatus}.`, 'info');
  };

  const uniquePresences = useMemo(() => {
    const myOrgId = currentUser?.organization_id;
    if (!currentUser || !myOrgId) return [];
    const map = new Map<string, UserPresence>();
    presences.forEach(p => {
      if (!p?.userId) return;
      if (p.userId === currentUser.id) return;
      if (p.organizationId && p.organizationId !== myOrgId) return;
      map.set(p.userId, p);
    });
    return Array.from(map.values());
  }, [presences, currentUser]);

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Dynamic Nova-Style Centered Top View Tabs matched to active section
  const contextualTabs: SegmentedTabOption<ActiveView>[] = useMemo(() => {
    if (['overview', 'my_tasks_view', 'calendar_view', 'team_chat_view', 'inbox_view'].includes(activeView)) {
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'my_tasks_view', label: 'My Tasks' },
        { id: 'calendar_view', label: 'Calendar' },
        { id: 'team_chat_view', label: 'Chat & Meet' },
        { id: 'inbox_view', label: 'Inbox', count: unreadCount > 0 ? unreadCount : undefined },
      ];
    }
    if (['projects_overview', 'kanban', 'sprints_view', 'gantt_roadmap_view', 'triage_intake_view'].includes(activeView)) {
      const workTabs: SegmentedTabOption<ActiveView>[] = [
        { id: 'projects_overview', label: 'Projects' },
      ];
      if (activeProject) {
        workTabs.push({ id: 'kanban', label: 'Board' });
      }
      workTabs.push(
        { id: 'sprints_view', label: 'Sprints' },
        { id: 'gantt_roadmap_view', label: 'Roadmap' },
        { id: 'triage_intake_view', label: 'Triage' }
      );
      return workTabs;
    }
    if (['team_management', 'workload_capacity_view', 'user_logs_view'].includes(activeView)) {
      const teamTabs: SegmentedTabOption<ActiveView>[] = [
        { id: 'team_management', label: 'Directory' },
        { id: 'workload_capacity_view', label: 'Workload & Timer' },
      ];
      if (normalizedRole === UserRole.OWNER || normalizedRole === UserRole.ADMIN) {
        teamTabs.push({ id: 'user_logs_view', label: 'Audit Logs' });
      }
      return teamTabs;
    }
    if (['reports_view', 'okrs_goals_view', 'docs_wiki_view', 'whiteboard_view', 'async_clips_view', 'client_portal_view'].includes(activeView)) {
      const stratTabs: SegmentedTabOption<ActiveView>[] = [];
      if (
        normalizedRole === UserRole.OWNER ||
        normalizedRole === UserRole.ADMIN ||
        normalizedRole === UserRole.PROJECT_MANAGER
      ) {
        stratTabs.push({ id: 'reports_view', label: 'Reports' });
      }
      stratTabs.push(
        { id: 'okrs_goals_view', label: 'OKRs' },
        { id: 'docs_wiki_view', label: 'Docs' },
        { id: 'whiteboard_view', label: 'Whiteboard' },
        { id: 'client_portal_view', label: 'Portal' }
      );
      return stratTabs;
    }
    const adminTabs: SegmentedTabOption<ActiveView>[] = [];
    if (normalizedRole === UserRole.OWNER || normalizedRole === UserRole.ADMIN) {
      adminTabs.push({ id: 'admin_settings', label: 'Governance' });
    }
    adminTabs.push(
      { id: 'task_automations', label: 'Automations' },
      { id: 'ai_copilot_view', label: 'AI Studio' },
      { id: 'profile_settings', label: 'Preferences' }
    );
    return adminTabs;
  }, [activeView, activeProject, unreadCount, normalizedRole]);

  const handlePrimaryCta = () => {
    if (activeView === 'projects_overview') {
      openCreateProjectModal();
      return;
    }
    if (!activeProject) {
      openCreateProjectModal();
      return;
    }
    openModal();
  };

  const primaryCtaLabel = activeView === 'projects_overview' || !activeProject ? 'New Project' : 'New Task';

  return (
    <header className="relative z-30 shrink-0">
      {/* Desktop Sculpted Nova Top Bezel Layout (lg+) */}
      <div className="hidden lg:flex items-start justify-between w-full min-h-[54px]">
        {/* Left Bezel Circular Menu Pocket + Sweeping Shoulder Breadcrumb */}
        <div className="flex items-start flex-1 min-w-0">
          <div className="relative w-[84px] h-[54px] shrink-0">
            <svg
              viewBox="0 0 84 54"
              preserveAspectRatio="none"
              className="w-full h-full block pointer-events-none"
              aria-hidden="true"
            >
              <path
                d="M 0,0 L 84,0 C 66,0 59,7 56,20 C 52,35 42,45 26,45 C 12,45 0,49 0,54 Z"
                fill="var(--bg-bezel)"
              />
            </svg>
            <button
              type="button"
              onClick={() => {
                soundService.play('click_soft');
                toggleSidebarPinned();
              }}
              aria-pressed={isSidebarPinned}
              title={isSidebarPinned ? 'Unpin side menu (hover-to-expand)' : 'Pin side menu open'}
              aria-label={isSidebarPinned ? 'Unpin side menu' : 'Pin side menu open'}
              className={`absolute top-[4px] left-[9px] w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer shadow-sm ${
                isSidebarPinned
                  ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] ring-2 ring-[var(--accent-lime)]/35'
                  : 'bg-[#F4F4EF] text-[#191B17] hover:bg-white dark:bg-[#20241C] dark:text-[#F2F3EE] dark:hover:bg-[#2B3025]'
              }`}
            >
              {isSidebarPinned ? (
                <ICON_MAP.ChevronLeftIcon className="w-4 h-4 stroke-[2.2]" />
              ) : (
                <ICON_MAP.Bars3Icon className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 min-w-0 pt-2.5 pr-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] min-w-0">
              <span className="truncate max-w-[140px]">
                {currentOrganization?.name || 'Personal Workspace'}
              </span>
              {activeProject && (
                <>
                  <span className="text-[var(--text-muted)]">/</span>
                  <span className="text-[var(--text-primary)] font-semibold truncate max-w-[150px]">
                    {activeProject.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center Sculpted S-Curve Bezel Dock with Floating View Tabs */}
        <div className="flex items-start shrink-0 max-w-[54vw]">
          <svg
            viewBox="0 0 46 44"
            preserveAspectRatio="none"
            className="w-[46px] h-[44px] shrink-0 -mr-[0.5px] pointer-events-none block"
            aria-hidden="true"
          >
            <path d="M 0,0 L 46,0 L 46,44 C 24,44 22,0 0,0 Z" fill="var(--bg-bezel)" />
          </svg>

          <div className="h-[44px] bg-[var(--bg-bezel)] px-1.5 pb-1.5 flex items-center justify-center min-w-0">
            <SegmentedTabs
              options={contextualTabs}
              value={activeView === 'task_automations_view' ? 'task_automations' : activeView}
              onChange={view => {
                soundService.play('click_soft');
                setActiveView(view);
              }}
              size="sm"
              className="!bg-[#ECEFE6]/95 dark:!bg-[#1D2119]/95 !border-white/30 dark:!border-white/10 shadow-xs"
            />
          </div>

          <svg
            viewBox="0 0 46 44"
            preserveAspectRatio="none"
            className="w-[46px] h-[44px] shrink-0 -ml-[0.5px] pointer-events-none block"
            aria-hidden="true"
          >
            <path d="M 0,0 L 46,0 C 24,0 22,44 0,44 Z" fill="var(--bg-bezel)" />
          </svg>
        </div>

        {/* Right Curved Shoulder Utility Zone */}
        <div className="flex items-center justify-end gap-1.5 pt-2 pr-4 pl-2 flex-1 min-w-0">
          {uniquePresences.length > 0 && (
            <div className="hidden 2xl:flex items-center -space-x-1.5 mr-1">
              {uniquePresences.slice(0, 3).map(p => {
                const lsInfo = formatAccurateLastSeen(p, p.userId, p.userEmail, false);
                const matchedOrgUser = users.find(u => u.id === p.userId);
                return (
                  <div
                    key={p.userId}
                    className="relative ring-2 ring-white/80 dark:ring-[#1A1D17] rounded-full"
                    title={`${p.userName} · ${lsInfo.statusLabel}`}
                  >
                    <Avatar
                      user={
                        matchedOrgUser ||
                        ({
                          id: p.userId,
                          supabase_auth_id: p.userId,
                          full_name: p.userName,
                          email: p.userEmail || '',
                          avatar_url: p.userAvatar,
                          role: UserRole.MEMBER,
                        } as User)
                      }
                      size="xs"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {activeTimer && (
            <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/75 dark:bg-[#1E221A]/80 backdrop-blur-md border border-white/70 dark:border-white/10 text-xs shadow-2xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  activeTimer.isRunning ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  const found = tasks.find(t => t.id === activeTimer.taskId);
                  if (found) openViewTaskModal(found);
                  else setActiveView('workload_capacity_view');
                }}
                className="font-mono font-semibold tabular-nums text-[11px] text-[var(--text-primary)] cursor-pointer"
              >
                {formattedFocusTimer}
              </button>
              <button
                type="button"
                onClick={() => (activeTimer.isRunning ? pauseTaskTimer() : resumeTaskTimer())}
                className="text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer px-1"
              >
                {activeTimer.isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={stopAndLogTaskTimer}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)] cursor-pointer"
              >
                Log
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={openCommandPalette}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/75 dark:bg-[#1E221A]/80 backdrop-blur-md border border-white/70 dark:border-white/10 hover:border-[var(--border-strong)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shadow-2xs"
            title="Search & AI Command Palette (⌘K)"
            aria-label="Search workspace"
          >
            <ICON_MAP.SearchIcon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Search</span>
            <kbd className="hidden 2xl:inline font-mono text-[10px] text-[var(--text-muted)]">⌘K</kbd>
          </button>

          <button
            type="button"
            onClick={() => setIsUtilitiesDrawerOpen(true)}
            className="inline-flex p-2 rounded-full bg-white/75 dark:bg-[#1E221A]/80 backdrop-blur-md border border-white/70 dark:border-white/10 hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shadow-2xs"
            title="Quick Utilities (Split Screen, Huddle, Scratchpad)"
            aria-label="Quick Utilities"
          >
            <ICON_MAP.Squares2X2Icon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveView('inbox_view')}
            className="relative p-2 rounded-full bg-white/75 dark:bg-[#1E221A]/80 backdrop-blur-md border border-white/70 dark:border-white/10 hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shadow-2xs"
            title="Notifications & Inbox"
            aria-label="Notifications"
          >
            <ICON_MAP.BellIcon className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white dark:ring-[#1E221A]" />
            )}
          </button>

          <button
            type="button"
            onClick={handlePrimaryCta}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#191B17] text-white hover:bg-[#2C3028] dark:bg-[#CCF048] dark:text-[#131511] dark:hover:bg-[#D9F66A] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          >
            <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{primaryCtaLabel}</span>
          </button>

          {/* Compact Avatar Menu */}
          <div className="relative" ref={profileMenuRef}>
            {currentUser && (
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => setProfileMenuOpen(prev => !prev)}
                className="relative flex items-center gap-1.5 p-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] cursor-pointer"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
              >
                <Avatar user={currentUser} size="sm" disableHoverCard />
                <span className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-white dark:bg-[#1E221A]">
                  <StatusDynamicIcon status={myStatus} className="w-2 h-2" />
                </span>
              </button>
            )}

            <AnimatedPopover
              isOpen={Boolean(isProfileMenuOpen && currentUser)}
              direction="down"
              className="editorial-popover absolute right-0 mt-2 w-64 py-2 z-50"
            >
              {currentUser && (
                <div className="text-xs">
                  <div className="px-3.5 py-2.5 border-b border-[var(--border-hairline)]">
                    <p className="font-bold text-[var(--text-primary)] truncate">
                      {currentUser.full_name || currentUser.email}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{currentUser.email}</p>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mt-1">
                      {normalizedRole.replace(/_/g, ' ')} · {currentOrganization?.name || 'Personal'}
                    </p>
                  </div>

                  <div className="px-3 py-2 border-b border-[var(--border-hairline)] grid grid-cols-3 gap-1">
                    {(['available', 'away', 'busy'] as const).map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(st)}
                        className={`py-1 rounded-lg text-[11px] font-medium capitalize border cursor-pointer ${
                          myStatus === st
                            ? 'bg-[var(--bg-sage)] border-[var(--border-strong)] text-[var(--text-primary)] font-semibold'
                            : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView('profile_settings');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] cursor-pointer"
                    >
                      Profile &amp; Workspace Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openOrganizationModal('join');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] cursor-pointer"
                    >
                      Switch / Manage Organization
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        toggleDarkMode();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] cursor-pointer"
                    >
                      <span>Appearance</span>
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {darkMode ? 'Dark' : 'Light'}
                      </span>
                    </button>
                    {(normalizedRole === UserRole.OWNER || normalizedRole === UserRole.PROJECT_MANAGER) && (
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('omni_open_system_log_monitor'));
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] cursor-pointer"
                      >
                        System Log Monitor
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        openShortcutsModal();
                        setProfileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] cursor-pointer"
                    >
                      <span>Keyboard Shortcuts</span>
                      <kbd className="font-mono text-[10px] text-[var(--text-muted)]">?</kbd>
                    </button>
                  </div>

                  <div className="px-1.5 pt-1 border-t border-[var(--border-hairline)]">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        signOut();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-medium cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </AnimatedPopover>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Compact Header (< lg) */}
      <div className="lg:hidden px-4 py-2.5 frosted-shell-panel border-b border-[var(--border-hairline)]">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={toggleMobileSidebar}
              className="p-2 rounded-full bg-white/80 dark:bg-[#1E221A]/85 border border-[var(--border-hairline)] text-[var(--text-primary)] cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <ICON_MAP.Bars3Icon className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {activeProject ? activeProject.name : currentOrganization?.name || 'Workspace'}
              </p>
              {activeProject && (
                <p className="text-[10px] text-[var(--text-muted)] truncate">
                  {currentOrganization?.name || 'Personal'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openCommandPalette}
              className="p-2 rounded-full bg-white/75 dark:bg-[#1E221A]/80 border border-[var(--border-hairline)] text-[var(--text-secondary)] cursor-pointer"
              aria-label="Search workspace"
            >
              <ICON_MAP.SearchIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveView('inbox_view')}
              className="relative p-2 rounded-full bg-white/75 dark:bg-[#1E221A]/80 border border-[var(--border-hairline)] text-[var(--text-secondary)] cursor-pointer"
              aria-label="Notifications"
            >
              <ICON_MAP.BellIcon className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white dark:ring-[#1E221A]" />
              )}
            </button>
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#191B17] text-white dark:bg-[#CCF048] dark:text-[#131511] text-xs font-semibold cursor-pointer"
            >
              <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{primaryCtaLabel}</span>
            </button>
          </div>
        </div>

        <div className="mt-2 overflow-x-auto scrollbar-none">
          <SegmentedTabs
            options={contextualTabs}
            value={activeView === 'task_automations_view' ? 'task_automations' : activeView}
            onChange={view => {
              soundService.play('click_soft');
              setActiveView(view);
            }}
            size="sm"
          />
        </div>
      </div>

      <QuickUtilitiesDrawer
        isOpen={isUtilitiesDrawerOpen}
        onClose={() => setIsUtilitiesDrawerOpen(false)}
        darkMode={darkMode}
      />
    </header>
  );
};
