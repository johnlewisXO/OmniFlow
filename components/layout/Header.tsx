import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { AnimatedPopover } from '../shared/Modal';
import { GLASS_SPRING } from '../shared/LiquidGlass';
import { QuickUtilitiesDrawer } from '../shared/QuickUtilitiesDrawer';
import { SegmentedTabs, SegmentedTabOption } from '../shared/EditorialUI';
import { Button, IconButton } from '../shared/Button';
import { DefaultGlassBrandMark } from '../shared/OrganizationLogoUploader';
import { collabService, formatAccurateLastSeen } from '../../services/collabService';
import soundService from '../../services/soundService';
import { ActiveView, AvailabilityStatus, User, UserPresence, UserRole, normalizeUserRole } from '../../types';
import { ProfileMiniMenu, StatusDynamicIcon } from './ProfileMiniMenu';
export { StatusDynamicIcon } from './ProfileMiniMenu';

export const Header: React.FC = () => {
  const {
    darkMode,
    toggleDarkMode,
    accentColor,
    setAccentColor,
    ambientIntensity,
    setAmbientIntensity,
    autoCyclePalette,
    setAutoCyclePalette,
    myAvailabilityStatus,
    setMyAvailabilityStatus,
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
    isViewTaskModalOpen,
    taskToView,
    isEditTaskModalOpen,
    taskToEdit,
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
    setMyAvailabilityStatus(newStatus);
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

  const activeHeaderTask =
    (isViewTaskModalOpen && taskToView) || (isEditTaskModalOpen && taskToEdit) || null;
  const orgLogoUrl = currentOrganization?.logoUrl || currentOrganization?.logo_url || '';
  const contextTitle = activeHeaderTask
    ? activeHeaderTask.title
    : activeProject
      ? activeProject.name
      : '';

  return (
    <header className="relative z-30 shrink-0">
      {/* Desktop Sculpted Nova Top Bezel Layout (lg+) */}
      <div className="hidden lg:flex items-start justify-between w-full min-h-[62px] relative">
        {/* Left Bezel Circular Menu Pocket + Continuous Top Bezel Lip + Context Brand/Title */}
        <div className="flex items-start flex-1 min-w-0">
          <div className="relative w-[92px] h-[64px] shrink-0 overflow-visible">
            <svg
              viewBox="0 0 92 66"
              className="absolute top-0 left-0 w-[92px] h-[66px] block pointer-events-none"
              aria-hidden="true"
            >
              <path
                d="M 0,0 L 92,0 L 92,10 C 72,10 66,18 60,33 C 54,47 43,54 27,54 C 13,54 3,57 0,66 Z"
                fill="var(--bg-bezel)"
              />
              <path
                d="M 92,9.5 C 72,9.5 66,17.5 60,32.5 C 54,46.5 43,53.5 27,53.5 C 13,53.5 3,56.5 0,65.5"
                fill="none"
                stroke="var(--bezel-edge)"
                strokeWidth="1"
              />
            </svg>
            <IconButton
              variant={isSidebarPinned ? 'lime' : 'glass'}
              size="md"
              onClick={() => {
                soundService.play('click_soft');
                toggleSidebarPinned();
              }}
              aria-pressed={isSidebarPinned}
              title={isSidebarPinned ? 'Unpin side menu (hover-to-expand)' : 'Pin side menu open'}
              aria-label={isSidebarPinned ? 'Unpin side menu' : 'Pin side menu open'}
              className={`!absolute top-[10px] left-[10px] ${
                isSidebarPinned
                  ? 'ring-2 ring-[var(--accent-lime)]/35'
                  : '!text-[var(--text-primary)]'
              }`}
            >
              {isSidebarPinned ? (
                <ICON_MAP.ChevronLeftIcon className="w-4 h-4 stroke-[2.2]" />
              ) : (
                <ICON_MAP.Bars3Icon className="w-4 h-4 stroke-[2]" />
              )}
            </IconButton>
          </div>

          <div className="flex flex-col flex-1 min-w-0 -ml-[0.5px] -mr-[0.5px]">
            <div className="h-[10px] w-full bg-[var(--bg-bezel)] border-b border-[var(--bezel-edge)]" aria-hidden="true" />
            <div className="flex items-center gap-2 min-w-0 pr-3 pl-1 pt-2.5">
              {contextTitle ? (
                <>
                  {activeHeaderTask ? (
                    <ICON_MAP.CheckCircleIcon className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                  ) : (
                    <ICON_MAP.FolderIcon className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                  )}
                  <span
                    className="text-[13px] xl:text-sm font-bold text-[var(--text-primary)] truncate min-w-0"
                    title={contextTitle}
                  >
                    {contextTitle}
                  </span>
                </>
              ) : (
                <div
                  className="inline-flex items-center justify-center h-8 min-w-[34px] max-w-[140px] px-1.5 rounded-xl bg-[var(--surface-glass-2)] border border-[var(--glass-border)] shadow-[inset_0_1px_0_var(--glass-highlight)] text-[var(--accent-text)] overflow-hidden shrink-0"
                  title={orgLogoUrl ? 'Organization brand logo' : 'Workspace'}
                >
                  {orgLogoUrl ? (
                    <img
                      src={orgLogoUrl}
                      alt="Organization logo"
                      className="h-6 max-w-[124px] w-auto object-contain"
                    />
                  ) : (
                    <DefaultGlassBrandMark className="w-5 h-5" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Sculpted S-Curve Bezel Dock with Floating View Tabs */}
        <div className="flex items-start shrink-0 max-w-[54vw] xl:max-w-[58vw] z-10">
          <svg
            viewBox="0 0 64 58"
            className="w-[64px] h-[58px] shrink-0 -mr-[0.5px] pointer-events-none block"
            aria-hidden="true"
          >
            <path
              d="M -0.5,0 L 64.5,0 L 64.5,58 L 58,58 C 28,58 26,10 0,10 L -0.5,10 Z"
              fill="var(--bg-bezel)"
            />
            <path
              d="M -0.5,9.5 L 0,9.5 C 26,9.5 28,57.5 58,57.5 L 64.5,57.5"
              fill="none"
              stroke="var(--bezel-edge)"
              strokeWidth="1"
            />
          </svg>

          <div className="h-[58px] bg-[var(--bg-bezel)] border-b border-[var(--bezel-edge)] px-2 xl:px-3.5 pt-[10px] pb-[8px] flex items-center justify-center min-w-0">
            <SegmentedTabs
              options={contextualTabs}
              value={activeView === 'task_automations_view' ? 'task_automations' : activeView}
              onChange={view => {
                soundService.play('click_soft');
                setActiveView(view);
              }}
              size="sm"
              className="!bg-[var(--surface-glass-2)] !border-[var(--glass-border-strong)] shadow-xs"
            />
          </div>

          <svg
            viewBox="0 0 64 58"
            className="w-[64px] h-[58px] shrink-0 -ml-[0.5px] pointer-events-none block"
            aria-hidden="true"
          >
            <path
              d="M -0.5,0 L 64.5,0 L 64.5,10 L 64,10 C 38,10 36,58 6,58 L -0.5,58 Z"
              fill="var(--bg-bezel)"
            />
            <path
              d="M -0.5,57.5 L 6,57.5 C 36,57.5 38,9.5 64,9.5 L 64.5,9.5"
              fill="none"
              stroke="var(--bezel-edge)"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Right Curved Shoulder Utility Zone + Matching Corner Bezel Cap */}
        <div className="flex flex-col flex-1 min-w-0 -ml-[0.5px] relative">
          <div className="h-[10px] w-full bg-[var(--bg-bezel)] border-b border-[var(--bezel-edge)] pr-[32px]" aria-hidden="true" />
          <svg
            viewBox="0 0 34 34"
            className="absolute top-0 right-0 w-[34px] h-[34px] pointer-events-none block"
            aria-hidden="true"
          >
            <path
              d="M 0,0 L 34,0 L 34,34 C 34,17 20,10 0,10 Z"
              fill="var(--bg-bezel)"
            />
            <path
              d="M 0,9.5 C 20,9.5 33.5,17 33.5,34"
              fill="none"
              stroke="var(--bezel-edge)"
              strokeWidth="1"
            />
          </svg>
          <div className="flex items-center justify-end gap-1 xl:gap-1.5 pt-2.5 pr-4 xl:pr-5 pl-1.5 min-w-0">
          {uniquePresences.length > 0 && (
            <div className="hidden 2xl:flex items-center -space-x-1.5 mr-1">
              {uniquePresences.slice(0, 3).map(p => {
                const lsInfo = formatAccurateLastSeen(p, p.userId, p.userEmail, false);
                const matchedOrgUser = users.find(u => u.id === p.userId);
                return (
                  <div
                    key={p.userId}
                    className="relative ring-2 ring-[var(--surface-base)] rounded-full"
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
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={GLASS_SPRING.snappy}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-bubble-control text-xs"
            >
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
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                transition={GLASS_SPRING.micro}
                onClick={stopAndLogTaskTimer}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)] cursor-pointer"
              >
                Log
              </motion.button>
            </motion.div>
          )}

          <Button
            variant="outline"
            size="md"
            onClick={openCommandPalette}
            className="!px-3 !text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="Search & AI Command Palette (⌘K)"
            aria-label="Search workspace"
          >
            <ICON_MAP.SearchIcon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Search</span>
            <kbd className="hidden 2xl:inline font-mono text-[10px] text-[var(--text-muted)]">⌘K</kbd>
          </Button>

          <IconButton
            variant="glass"
            size="md"
            onClick={() => setIsUtilitiesDrawerOpen(true)}
            title="Quick Utilities (Split Screen, Huddle, Scratchpad)"
            aria-label="Quick Utilities"
          >
            <ICON_MAP.Squares2X2Icon className="w-4 h-4" />
          </IconButton>

          <IconButton
            variant="glass"
            size="md"
            onClick={() => setActiveView('inbox_view')}
            className="relative"
            title="Notifications & Inbox"
            aria-label="Notifications"
          >
            <ICON_MAP.BellIcon className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-[var(--surface-base)]" />
            )}
          </IconButton>

          <Button
            variant="primary"
            size="md"
            onClick={handlePrimaryCta}
            className="!px-3.5 !text-xs"
            aria-label={primaryCtaLabel}
            title={primaryCtaLabel}
          >
            <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{primaryCtaLabel}</span>
          </Button>

          {/* Compact Avatar Menu with Unobstructed Status Icon Overlay */}
          <div className="relative" ref={profileMenuRef}>
            {currentUser && (
              <motion.button
                ref={avatarButtonRef}
                type="button"
                whileTap={{ scale: 0.95 }}
                transition={GLASS_SPRING.micro}
                onClick={() => setProfileMenuOpen(prev => !prev)}
                className="flex items-center gap-1 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] cursor-pointer"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                title={currentUser.full_name || currentUser.email}
              >
                  <span className="relative inline-flex shrink-0">
                    <Avatar user={currentUser} size="md" disableHoverCard />
                    <span className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center leading-none pointer-events-none">
                      <StatusDynamicIcon status={myAvailabilityStatus} className="w-3 h-3 block" />
                    </span>
                  </span>
                  <ICON_MAP.ChevronDownIcon
                    className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-150 ${
                      isProfileMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </motion.button>
              )}

              <AnimatedPopover
                isOpen={Boolean(isProfileMenuOpen && currentUser)}
                direction="down"
                className="editorial-popover absolute right-0 mt-2 w-[276px] py-1.5 z-50"
              >
                {currentUser && (
                  <ProfileMiniMenu
                    currentUser={currentUser}
                    currentOrganizationName={currentOrganization?.name}
                    normalizedRole={normalizedRole}
                    myStatus={myAvailabilityStatus}
                    onStatusChange={handleStatusChange}
                    darkMode={darkMode}
                    onToggleDarkMode={toggleDarkMode}
                    accentColor={accentColor}
                    onSelectAccent={accent => {
                      setAccentColor(accent);
                    }}
                    ambientIntensity={ambientIntensity}
                    onSelectIntensity={setAmbientIntensity}
                    autoCyclePalette={autoCyclePalette}
                    onToggleAutoCyclePalette={() => setAutoCyclePalette(!autoCyclePalette)}
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
      </div>

      {/* Mobile & Tablet Compact Header (< lg) */}
      <div className="lg:hidden px-3 sm:px-4 py-2 frosted-shell-panel border-b border-[var(--border-hairline)]">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <IconButton
              variant="glass"
              size="md"
              onClick={toggleMobileSidebar}
              className="!text-[var(--text-primary)] shrink-0"
              aria-label="Open navigation menu"
            >
              <ICON_MAP.Bars3Icon className="w-4 h-4" />
            </IconButton>

            {contextTitle ? (
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                {activeHeaderTask ? (
                  <ICON_MAP.CheckCircleIcon className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                ) : (
                  <ICON_MAP.FolderIcon className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                )}
                <p
                  className="text-xs font-bold text-[var(--text-primary)] truncate min-w-0"
                  title={contextTitle}
                >
                  {contextTitle}
                </p>
              </div>
            ) : (
              <div
                className="inline-flex items-center justify-center h-8 min-w-[34px] max-w-[116px] px-1.5 rounded-xl bg-[var(--surface-glass-2)] border border-[var(--glass-border)] shadow-[inset_0_1px_0_var(--glass-highlight)] text-[var(--accent-text)] overflow-hidden shrink-0"
                title={orgLogoUrl ? 'Organization brand logo' : 'Workspace'}
              >
                {orgLogoUrl ? (
                  <img
                    src={orgLogoUrl}
                    alt="Organization logo"
                    className="h-5 max-w-[100px] w-auto object-contain"
                  />
                ) : (
                  <DefaultGlassBrandMark className="w-4 h-4" />
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <IconButton
              variant="glass"
              size="md"
              onClick={openCommandPalette}
              aria-label="Search workspace"
            >
              <ICON_MAP.SearchIcon className="w-4 h-4" />
            </IconButton>
            <IconButton
              variant="glass"
              size="md"
              onClick={() => setActiveView('inbox_view')}
              className="relative"
              aria-label="Notifications"
            >
              <ICON_MAP.BellIcon className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-[var(--surface-base)]" />
              )}
            </IconButton>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrimaryCta}
              className="!px-3"
              aria-label={primaryCtaLabel}
            >
              <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{primaryCtaLabel}</span>
            </Button>
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
