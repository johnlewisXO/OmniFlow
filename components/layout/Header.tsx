import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { AnimatedPopover } from '../shared/Modal';
import { GLASS_SPRING } from '../shared/LiquidGlass';
import { QuickUtilitiesDrawer } from '../shared/QuickUtilitiesDrawer';
import { SegmentedTabs, SegmentedTabOption, StatusDot } from '../shared/EditorialUI';
import { Button, IconButton } from '../shared/Button';
import { DefaultGlassBrandMark } from '../shared/OrganizationLogoUploader';
import { collabService, formatAccurateLastSeen } from '../../services/collabService';
import soundService from '../../services/soundService';
import { isPriorityNotification, getNotificationCategoryMeta } from '../../utils/notificationPriority';
import { ActiveView, AvailabilityStatus, Notification, User, UserPresence, UserRole, normalizeUserRole } from '../../types';
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
    setActiveProject,
    openCreateProjectModal,
    currentUser,
    currentOrganization,
    openOrganizationModal,
    signOut,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    activeView,
    setActiveView,
    toggleMobileSidebar,
    isSidebarPinned,
    toggleSidebarPinned,
    openCommandPalette,
    openShortcutsModal,
    presences,
    users,
    projects,
    activeTimer,
    pauseTaskTimer,
    resumeTaskTimer,
    stopAndLogTaskTimer,
    tasks,
    openViewTaskModal,
    setHighlightedTaskId,
    isViewTaskModalOpen,
    taskToView,
    isEditTaskModalOpen,
    taskToEdit,
  } = useAppStore();

  const [timerTick, setTimerTick] = useState(0);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [openInboxPlacement, setOpenInboxPlacement] = useState<'desktop' | 'mobile' | null>(null);
  const [openQuickCreatePlacement, setOpenQuickCreatePlacement] = useState<'desktop' | 'mobile' | null>(null);
  const [isUtilitiesDrawerOpen, setIsUtilitiesDrawerOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const desktopInboxRef = useRef<HTMLDivElement>(null);
  const mobileInboxRef = useRef<HTMLDivElement>(null);
  const desktopQuickCreateRef = useRef<HTMLDivElement>(null);
  const mobileQuickCreateRef = useRef<HTMLDivElement>(null);

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
      const target = event.target as Node;
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        avatarButtonRef.current &&
        !avatarButtonRef.current.contains(target)
      ) {
        setProfileMenuOpen(false);
      }

      const insideDesktopInbox = desktopInboxRef.current?.contains(target);
      const insideMobileInbox = mobileInboxRef.current?.contains(target);
      if (!insideDesktopInbox && !insideMobileInbox) {
        setOpenInboxPlacement(null);
      }

      const insideDesktopQuick = desktopQuickCreateRef.current?.contains(target);
      const insideMobileQuick = mobileQuickCreateRef.current?.contains(target);
      if (!insideDesktopQuick && !insideMobileQuick) {
        setOpenQuickCreatePlacement(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        setOpenInboxPlacement(null);
        setOpenQuickCreatePlacement(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
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

  const priorityNotifications = useMemo(() => {
    return [...notifications]
      .filter(isPriorityNotification)
      .sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [notifications]);

  const topPriorityNotifications = useMemo(() => priorityNotifications.slice(0, 6), [priorityNotifications]);
  const unreadPriorityCount = useMemo(
    () => priorityNotifications.filter(n => !n.read).length,
    [priorityNotifications]
  );

  // Dynamic Centered Top View Tabs matched to active section with distinct modern icons
  const contextualTabs: SegmentedTabOption<ActiveView>[] = useMemo(() => {
    if (['overview', 'my_tasks_view', 'inbox_view'].includes(activeView)) {
      return [
        { id: 'overview', label: 'Overview', icon: <ICON_MAP.HomeIcon className="w-3.5 h-3.5" /> },
        { id: 'my_tasks_view', label: 'My Tasks', icon: <ICON_MAP.ClipboardListIcon className="w-3.5 h-3.5" /> },
        {
          id: 'inbox_view',
          label: 'Inbox',
          icon: <ICON_MAP.InboxIcon className="w-3.5 h-3.5" />,
          count: unreadPriorityCount > 0 ? unreadPriorityCount : undefined,
        },
      ];
    }
    if (['team_chat_view', 'calendar_view', 'async_clips_view', 'whiteboard_view'].includes(activeView)) {
      return [
        { id: 'team_chat_view', label: 'Chat & Meet', icon: <ICON_MAP.ChatBubbleLeftRightIcon className="w-3.5 h-3.5" /> },
        { id: 'calendar_view', label: 'Calendar', icon: <ICON_MAP.CalendarIcon className="w-3.5 h-3.5" /> },
        { id: 'async_clips_view', label: 'Video Clips', icon: <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" /> },
        { id: 'whiteboard_view', label: 'Whiteboard', icon: <ICON_MAP.WhiteboardIcon className="w-3.5 h-3.5" /> },
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
        { id: 'gantt_roadmap_view', label: 'Timeline', icon: <ICON_MAP.RoadmapIcon className="w-3.5 h-3.5" /> },
        { id: 'triage_intake_view', label: 'Requests', icon: <ICON_MAP.FilterIcon className="w-3.5 h-3.5" /> }
      );
      return workTabs;
    }
    if (['team_management', 'workload_capacity_view'].includes(activeView)) {
      return [
        { id: 'team_management', label: 'Team', icon: <ICON_MAP.UserGroupIcon className="w-3.5 h-3.5" /> },
        { id: 'workload_capacity_view', label: 'Workload & Timer', icon: <ICON_MAP.ClockIcon className="w-3.5 h-3.5" /> },
      ];
    }
    if (['reports_view', 'okrs_goals_view', 'docs_wiki_view', 'client_portal_view'].includes(activeView)) {
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
        { id: 'okrs_goals_view', label: 'Goals', icon: <ICON_MAP.FlagIcon className="w-3.5 h-3.5" /> },
        { id: 'docs_wiki_view', label: 'Docs', icon: <ICON_MAP.DocumentTextIcon className="w-3.5 h-3.5" /> },
        { id: 'client_portal_view', label: 'Client Portal', icon: <ICON_MAP.GlobeAltIcon className="w-3.5 h-3.5" /> }
      );
      return stratTabs;
    }
    if (['ai_copilot_view', 'task_automations', 'task_automations_view'].includes(activeView)) {
      return [
        { id: 'ai_copilot_view', label: 'AI Assistant', icon: <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" /> },
        { id: 'task_automations', label: 'Automations', icon: <ICON_MAP.BoltIcon className="w-3.5 h-3.5" /> },
      ];
    }
    const govTabs: SegmentedTabOption<ActiveView>[] = [];
    if (normalizedRole === UserRole.OWNER || normalizedRole === UserRole.ADMIN) {
      govTabs.push(
        { id: 'admin_settings', label: 'Workspace Admin', icon: <ICON_MAP.ShieldCheckIcon className="w-3.5 h-3.5" /> },
        { id: 'user_logs_view', label: 'Activity Log', icon: <ICON_MAP.AuditShieldListIcon className="w-3.5 h-3.5" /> }
      );
    }
    govTabs.push({
      id: 'profile_settings',
      label: 'Preferences',
      icon: <ICON_MAP.AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />,
    });
    return govTabs;
  }, [activeView, activeProject, unreadPriorityCount, normalizedRole]);

  const handleNotificationClick = (n: Notification) => {
    soundService.play('click_soft');
    markNotificationAsRead(n.id);
    setOpenInboxPlacement(null);

    const typeStr = String(n.type || '').toUpperCase();
    const titleStr = String(n.title || '').toLowerCase();
    const msgStr = String(n.message || n.content || '');
    const targetId = n.entity_id || n.reference_id;
    const isMention = typeStr === 'MENTION' || titleStr.includes('mention');

    if (n.entity_type === 'chat' || typeStr.includes('CHAT') || (n.title || '').startsWith('💬')) {
      setActiveView('team_chat_view');
      if (n.entity_id) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('omni_select_chat_contact', { detail: { userId: n.entity_id } }));
        }, 80);
      }
      return;
    }
    if (n.entity_type === 'calendar' || typeStr.includes('CALENDAR')) {
      setActiveView('calendar_view');
      return;
    }
    if (typeStr.includes('GOVERNANCE') || typeStr.includes('BILLING') || typeStr.includes('SECURITY') || typeStr.includes('ADMIN') || typeStr.includes('OWNER')) {
      setActiveView(normalizedRole === UserRole.OWNER || normalizedRole === UserRole.ADMIN ? 'admin_settings' : 'inbox_view');
      return;
    }
    if (n.entity_type === 'user' || typeStr.includes('ROLE') || typeStr.includes('INVITE') || typeStr.includes('JOIN_REQUEST')) {
      setActiveView('team_management');
      return;
    }
    if (typeStr.includes('SPRINT')) {
      setActiveView('sprints_view');
      return;
    }

    const matchedTask = tasks.find(
      t => t.id === targetId || (msgStr && t.title && msgStr.toLowerCase().includes(t.title.toLowerCase()))
    );
    const matchedProject =
      projects.find(p => p.id === targetId || p.id === matchedTask?.projectId) ||
      projects.find(p => msgStr && p.name && msgStr.toLowerCase().includes(p.name.toLowerCase()));

    if (matchedTask) {
      if (matchedProject) setActiveProject(matchedProject.id);
      setHighlightedTaskId(matchedTask.id);
      openViewTaskModal(matchedTask, isMention);
      return;
    }
    if (targetId && (n.entity_type === 'task' || typeStr.startsWith('TASK_'))) {
      openViewTaskModal(targetId, isMention);
      return;
    }
    if (matchedProject) {
      setActiveProject(matchedProject.id);
      setActiveView('kanban');
      return;
    }
    setActiveView('inbox_view');
  };

  const renderInboxPopoverBody = () => (
    <div className="flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-[var(--border-hairline)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-primary)]">Priority Inbox</span>
          {unreadPriorityCount > 0 && (
            <span className="text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)]">
              {unreadPriorityCount} new
            </span>
          )}
        </div>
        {unreadPriorityCount > 0 && (
          <button
            type="button"
            onClick={() => {
              soundService.play('click_soft');
              markAllNotificationsAsRead();
            }}
            className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--border-hairline)] scrollbar-thin">
        {topPriorityNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <ICON_MAP.CheckBadgeIcon className="w-7 h-7 mx-auto text-emerald-500/80 mb-2" />
            <p className="text-xs font-semibold text-[var(--text-primary)]">All caught up</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              No priority notifications right now.
            </p>
          </div>
        ) : (
          topPriorityNotifications.map(n => {
            const meta = getNotificationCategoryMeta(n);
            const relTime = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
            const isUnread = !n.read;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start gap-2.5 cursor-pointer ${
                  isUnread
                    ? 'bg-[var(--bg-surface-subtle)]/75 hover:bg-[var(--bg-surface-subtle)]'
                    : 'hover:bg-[var(--bg-surface-subtle)]/60 opacity-80'
                }`}
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    isUnread ? 'bg-[var(--accent-lime)] ring-2 ring-[var(--accent-lime)]/25' : 'bg-transparent border border-[var(--border-hairline)]'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <StatusDot tone={meta.tone} label={meta.label} className="text-[10px] font-semibold" />
                    <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                      {relTime}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[var(--text-primary)] line-clamp-1">
                    {n.title || String(n.type || 'Update').replace(/_/g, ' ')}
                  </div>
                  {(n.message || n.content) && (
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1 mt-0.5">
                      {n.message || n.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="p-2 border-t border-[var(--border-hairline)]">
        <button
          type="button"
          onClick={() => {
            soundService.play('click_soft');
            setOpenInboxPlacement(null);
            setActiveView('inbox_view');
          }}
          className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-sage)] flex items-center justify-between transition-colors cursor-pointer"
        >
          <span>Go to Inbox</span>
          <ICON_MAP.ArrowRightIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
        </button>
      </div>
    </div>
  );

  const quickCreateActions = useMemo(
    () => [
      {
        id: 'new_project',
        label: 'New Project',
        desc: 'Start blank or from a blueprint template',
        icon: ICON_MAP.FolderPlusIcon,
        action: () => openCreateProjectModal(),
      },
      {
        id: 'aether_ai',
        label: 'Ask Aether AI',
        desc: 'Plan sprints, extract tasks, balance capacity',
        icon: ICON_MAP.SparklesIcon,
        action: () => setActiveView('ai_copilot_view'),
      },
      {
        id: 'new_whiteboard',
        label: 'New Whiteboard',
        desc: 'Visual canvas, sticky notes & diagrams',
        icon: ICON_MAP.WhiteboardIcon,
        action: () => setActiveView('whiteboard_view'),
      },
      {
        id: 'new_doc',
        label: 'New Spec Doc',
        desc: 'Collaborative product & engineering wiki',
        icon: ICON_MAP.DocumentTextIcon,
        action: () => setActiveView('docs_wiki_view'),
      },
      {
        id: 'async_clip',
        label: 'Record Async Clip',
        desc: 'Screen & voice update with transcription',
        icon: ICON_MAP.VideoCameraIcon,
        action: () => setActiveView('async_clips_view'),
      },
    ],
    [openCreateProjectModal, setActiveView]
  );

  const renderQuickCreatePopoverBody = () => (
    <div className="p-1.5 space-y-0.5">
      <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Quick Create
      </div>
      {quickCreateActions.map(item => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              soundService.play('click_soft');
              setOpenQuickCreatePlacement(null);
              item.action();
            }}
            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[var(--bg-surface-subtle)] transition-colors flex items-start gap-2.5 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-sage)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent-text)] shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--text-primary)]">{item.label}</div>
              <div className="text-[10.5px] text-[var(--text-muted)] line-clamp-1">{item.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );

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
      {/* Desktop Sculpted Top Bezel Layout (lg+) */}
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
                d="M 92,9.75 C 72,9.75 66,17.75 60,32.75 C 54,46.75 43,53.75 27,53.75 C 13,53.75 3,56.75 0,65.75"
                fill="none"
                stroke="var(--bezel-edge)"
                strokeWidth="0.75"
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
                  : '!text-white !bg-white/10 hover:!bg-white/20 !border-white/20'
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
                  className="inline-flex items-center justify-center h-8 min-w-[34px] max-w-[140px] px-1.5 rounded-xl bg-[var(--surface-glass-2)] border border-[var(--glass-border)] text-[var(--accent-text)] overflow-hidden shrink-0"
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
              d="M -0.5,9.75 L 0,9.75 C 26,9.75 28,57.75 58,57.75 L 64.5,57.75"
              fill="none"
              stroke="var(--bezel-edge)"
              strokeWidth="0.75"
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
              className="!bg-[var(--surface-glass-2)] !border-[var(--glass-border)]"
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
              d="M -0.5,57.75 L 6,57.75 C 36,57.75 38,9.75 64,9.75 L 64.5,9.75"
              fill="none"
              stroke="var(--bezel-edge)"
              strokeWidth="0.75"
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
              d="M 0,9.75 C 20,9.75 33.75,17 33.75,34"
              fill="none"
              stroke="var(--bezel-edge)"
              strokeWidth="0.75"
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

            {/* Desktop Priority Inbox Bell Popover */}
            <div className="relative" ref={desktopInboxRef}>
              <IconButton
                variant="glass"
                size="md"
                onClick={() => {
                  soundService.play('click_soft');
                  setProfileMenuOpen(false);
                  setOpenQuickCreatePlacement(null);
                  setOpenInboxPlacement(prev => (prev === 'desktop' ? null : 'desktop'));
                }}
                className="relative"
                title="Priority Notifications"
                aria-label="Priority Notifications"
                aria-expanded={openInboxPlacement === 'desktop'}
                aria-haspopup="true"
              >
                <ICON_MAP.BellIcon className="w-4 h-4" />
                {unreadPriorityCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-[var(--surface-base)]" />
                )}
              </IconButton>

              <AnimatedPopover
                isOpen={openInboxPlacement === 'desktop'}
                direction="down"
                className="editorial-popover absolute right-0 mt-2 w-[368px] z-50 overflow-hidden"
              >
                {renderInboxPopoverBody()}
              </AnimatedPopover>
            </div>

            {/* Desktop Quick Create Hub (Replaces plain New Task button) */}
            <div className="relative" ref={desktopQuickCreateRef}>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  soundService.play('click_soft');
                  setProfileMenuOpen(false);
                  setOpenInboxPlacement(null);
                  setOpenQuickCreatePlacement(prev => (prev === 'desktop' ? null : 'desktop'));
                }}
                className="!px-3.5 !text-xs"
                aria-label="Quick Create"
                title="Quick Create"
                aria-expanded={openQuickCreatePlacement === 'desktop'}
                aria-haspopup="true"
              >
                <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Create</span>
              </Button>

              <AnimatedPopover
                isOpen={openQuickCreatePlacement === 'desktop'}
                direction="down"
                className="editorial-popover absolute right-0 mt-2 w-[272px] z-50"
              >
                {renderQuickCreatePopoverBody()}
              </AnimatedPopover>
            </div>

            {/* Compact Avatar Menu with Unobstructed Status Icon Overlay */}
            <div className="relative" ref={profileMenuRef}>
              {currentUser && (
                <motion.button
                  ref={avatarButtonRef}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  transition={GLASS_SPRING.micro}
                  onClick={() => {
                    setOpenInboxPlacement(null);
                    setOpenQuickCreatePlacement(null);
                    setProfileMenuOpen(prev => !prev);
                  }}
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

            <div className="relative" ref={mobileInboxRef}>
              <IconButton
                variant="glass"
                size="md"
                onClick={() => {
                  soundService.play('click_soft');
                  setOpenQuickCreatePlacement(null);
                  setOpenInboxPlacement(prev => (prev === 'mobile' ? null : 'mobile'));
                }}
                className="relative"
                aria-label="Priority Notifications"
                aria-expanded={openInboxPlacement === 'mobile'}
              >
                <ICON_MAP.BellIcon className="w-4 h-4" />
                {unreadPriorityCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-[var(--surface-base)]" />
                )}
              </IconButton>

              <AnimatedPopover
                isOpen={openInboxPlacement === 'mobile'}
                direction="down"
                className="editorial-popover absolute right-0 mt-2 w-[min(92vw,360px)] z-50 overflow-hidden"
              >
                {renderInboxPopoverBody()}
              </AnimatedPopover>
            </div>

            <div className="relative" ref={mobileQuickCreateRef}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  soundService.play('click_soft');
                  setOpenInboxPlacement(null);
                  setOpenQuickCreatePlacement(prev => (prev === 'mobile' ? null : 'mobile'));
                }}
                className="!px-3"
                aria-label="Quick Create"
                aria-expanded={openQuickCreatePlacement === 'mobile'}
              >
                <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Create</span>
              </Button>

              <AnimatedPopover
                isOpen={openQuickCreatePlacement === 'mobile'}
                direction="down"
                className="editorial-popover absolute right-0 mt-2 w-[260px] z-50"
              >
                {renderQuickCreatePopoverBody()}
              </AnimatedPopover>
            </div>
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
