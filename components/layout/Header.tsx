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
import { ProfileMiniMenu, StatusDynamicIcon, AvailabilityStatus } from './ProfileMiniMenu';
export { StatusDynamicIcon } from './ProfileMiniMenu';

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

  const [myStatus, setMyStatus] = useState<AvailabilityStatus>(() => {
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
    const handleStatusSync = (e: CustomEvent) => {
      const payload = e.detail;
      if (payload && currentUser && payload.userId === currentUser.id) {
        setMyStatus(payload.availabilityStatus);
      }
    };
    window.addEventListener('omni_remote_user_status_changed', handleStatusSync as EventListener);
    return () => window.removeEventListener('omni_remote_user_status_changed', handleStatusSync as EventListener);
  }, [currentUser?.id]);

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

  const handleStatusChange = (newStatus: AvailabilityStatus) => {
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

  // Dynamic Nova-Style Centered Top View Tabs matched to active section with icons
  const contextualTabs: SegmentedTabOption<ActiveView>[] = useMemo(() => {
    if (['overview', 'my_tasks_view', 'calendar_view', 'team_chat_view', 'inbox_view'].includes(activeView)) {
      return [
        { id: 'overview', label: 'Overview', icon: <ICON_MAP.HomeIcon className="w-3.5 h-3.5" /> },
        { id: 'my_tasks_view', label: 'My Tasks', icon: <ICON_MAP.ClipboardListIcon className="w-3.5 h-3.5" /> },
        { id: 'calendar_view', label: 'Calendar', icon: <ICON_MAP.CalendarIcon className="w-3.5 h-3.5" /> },
        { id: 'team_chat_view', label: 'Chat & Meet', icon: <ICON_MAP.ChatBubbleLeftRightIcon className="w-3.5 h-3.5" /> },
        {
          id: 'inbox_view',
          label: 'Inbox',
          icon: <ICON_MAP.InboxIcon className="w-3.5 h-3.5" />,
          count: unreadCount > 0 ? unreadCount : undefined,
        },
      ];
    }
    if (['projects_overview', 'kanban', 'sprints_view', 'gantt_roadmap_view', 'triage_intake_view'].includes(activeView)) {
      const workTabs: SegmentedTabOption<ActiveView>[] = [
        { id: 'projects_overview', label: 'Projects', icon: <ICON_MAP.FolderIcon className="w-3.5 h-3.5" /> },
      ];
      if (activeProject) {
        workTabs.push({ id: 'kanban', label: 'Board', icon: <ICON_MAP.ViewColumnsIcon className="w-3.5 h-3.5" /> });
      }
      workTabs.push(
        { id: 'sprints_view', label: 'Sprints', icon: <ICON_MAP.RocketLaunchIcon className="w-3.5 h-3.5" /> },
        { id: 'gantt_roadmap_view', label: 'Roadmap', icon: <ICON_MAP.CalendarIcon className="w-3.5 h-3.5" /> },
        { id: 'triage_intake_view', label: 'Triage', icon: <ICON_MAP.FilterIcon className="w-3.5 h-3.5" /> }
      );
      return workTabs;
    }
    if (['team_management', 'workload_capacity_view', 'user_logs_view'].includes(activeView)) {
      const teamTabs: SegmentedTabOption<ActiveView>[] = [
        { id: 'team_management', label: 'Directory', icon: <ICON_MAP.UserGroupIcon className="w-3.5 h-3.5" /> },
        { id: 'workload_capacity_view', label: 'Workload & Timer', icon: <ICON_MAP.ClockIcon className="w-3.5 h-3.5" /> },
      ];
      if (normalizedRole === UserRole.OWNER || normalizedRole === UserRole.ADMIN) {
        teamTabs.push({
          id: 'user_logs_view',
          label: 'Audit Logs',
          icon: <ICON_MAP.DocumentTextIcon className="w-3.5 h-3.5" />,
        });
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
        stratTabs.push({
          id: 'reports_view',
          label: 'Reports',
          icon: <ICON_MAP.ChartBarIcon className="w-3.5 h-3.5" />,
        });
      }
      stratTabs.push(
        { id: 'okrs_goals_view', label: 'OKRs', icon: <ICON_MAP.FlagIcon className="w-3.5 h-3.5" /> },
        { id: 'docs_wiki_view', label: 'Docs', icon: <ICON_MAP.DocumentTextIcon className="w-3.5 h-3.5" /> },
        { id: 'whiteboard_view', label: 'Whiteboard', icon: <ICON_MAP.Squares2X2Icon className="w-3.5 h-3.5" /> },
        { id: 'client_portal_view', label: 'Portal', icon: <ICON_MAP.GlobeAltIcon className="w-3.5 h-3.5" /> }
      );
      return stratTabs;
    }
    const adminTabs: SegmentedTabOption<ActiveView>[] = [];
    if (normalizedRole === UserRole.OWNER || normalizedRole === UserRole.ADMIN) {
      adminTabs.push({
        id: 'admin_settings',
        label: 'Governance',
        icon: <ICON_MAP.ShieldCheckIcon className="w-3.5 h-3.5" />,
      });
    }
    adminTabs.push(
      { id: 'task_automations', label: 'Automations', icon: <ICON_MAP.BoltIcon className="w-3.5 h-3.5" /> },
      { id: 'ai_copilot_view', label: 'AI Studio', icon: <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" /> },
      { id: 'profile_settings', label: 'Preferences', icon: <ICON_MAP.AdjustmentsHorizontalIcon className="w-3.5 h-3.5" /> }
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
      <div className="hidden lg:flex items-start justify-between w-full min-h-[60px]">
        {/* Left Bezel Circular Menu Pocket + Sweeping Shoulder Breadcrumb */}
        <div className="flex items-start flex-1 min-w-0">
          <div className="relative w-[88px] h-[60px] shrink-0 overflow-visible">
            <svg
              viewBox="-1 -1 89 70"
              className="absolute -top-[1px] -left-[1px] w-[89px] h-[70px] block pointer-events-none"
              aria-hidden="true"
            >
              <path
                d="M -1,-1 L 85,-1 L 84,0 A 28 28 0 0 0 56 28 A 28 28 0 0 1 28 56 A 28 12 0 0 0 0 68 L -1,68 Z"
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
              className={`absolute top-[10px] left-[10px] w-[36px] h-[36px] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer shadow-sm ${
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

          <div className="flex items-center gap-2 min-w-0 pt-4 pr-3 pl-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] min-w-0">
              <ICON_MAP.BuildingOfficeIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
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
        <div className="flex items-start shrink-0 max-w-[58vw]">
          <svg
            viewBox="0 0 72 56"
            className="w-[72px] h-[56px] shrink-0 -mr-[0.5px] pointer-events-none block"
            aria-hidden="true"
          >
            <path d="M 0,0 L 72,0 L 72,56 C 40,56 32,0 0,0 Z" fill="var(--bg-bezel)" />
          </svg>

          <div className="h-[56px] bg-[var(--bg-bezel)] px-4 py-[10px] flex items-center justify-center min-w-0">
            <SegmentedTabs
              options={contextualTabs}
              value={activeView === 'task_automations_view' ? 'task_automations' : activeView}
              onChange={view => {
                soundService.play('click_soft');
                setActiveView(view);
              }}
              size="sm"
              className="!bg-[#ECEFE6]/95 dark:!bg-[#1D2119]/95 !border-white/25 dark:!border-white/10 shadow-xs"
            />
          </div>

          <svg
            viewBox="0 0 72 56"
            className="w-[72px] h-[56px] shrink-0 -ml-[0.5px] pointer-events-none block"
            aria-hidden="true"
          >
            <path d="M 0,0 L 72,0 C 40,0 32,56 0,56 Z" fill="var(--bg-bezel)" />
          </svg>
        </div>

        {/* Right Curved Shoulder Utility Zone */}
        <div className="flex items-center justify-end gap-1.5 pt-3 pr-4 pl-2 flex-1 min-w-0">
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

          {/* Compact Avatar Menu with Unobstructed Status Icon Overlay */}
          <div className="relative" ref={profileMenuRef}>
            {currentUser && (
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => setProfileMenuOpen(prev => !prev)}
                className="flex items-center gap-1 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] cursor-pointer"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                title={currentUser.full_name || currentUser.email}
              >
                <span className="relative inline-flex shrink-0">
                  <Avatar user={currentUser} size="md" disableHoverCard />
                  <span className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center leading-none pointer-events-none">
                    <StatusDynamicIcon status={myStatus} className="w-3 h-3 block" />
                  </span>
                </span>
                <ICON_MAP.ChevronDownIcon
                  className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-150 ${
                    isProfileMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}

            <AnimatedPopover
              isOpen={Boolean(isProfileMenuOpen && currentUser)}
              direction="down"
              className="editorial-popover absolute right-0 mt-2 w-64 py-1.5 z-50"
            >
              {currentUser && (
                <ProfileMiniMenu
                  currentUser={currentUser}
                  currentOrganizationName={currentOrganization?.name}
                  normalizedRole={normalizedRole}
                  myStatus={myStatus}
                  onStatusChange={handleStatusChange}
                  darkMode={darkMode}
                  onToggleDarkMode={toggleDarkMode}
                  onNavigateProfile={() => setActiveView('profile_settings')}
                  onManageOrganization={() => openOrganizationModal('join')}
                  canViewSystemLogs={
                    normalizedRole === UserRole.OWNER || normalizedRole === UserRole.PROJECT_MANAGER
                  }
                  onOpenSystemLogs={() =>
                    window.dispatchEvent(new CustomEvent('omni_open_system_log_monitor'))
                  }
                  onOpenShortcuts={openShortcutsModal}
                  onSignOut={signOut}
                  onClose={() => setProfileMenuOpen(false)}
                />
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
