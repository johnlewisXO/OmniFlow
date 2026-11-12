import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Project, ActiveView, UserRole, normalizeUserRole, TaskStatus } from '../../types';
import { ICON_MAP, SIDENAV_ITEMS, APP_TITLE } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { AnimatedPopover } from '../shared/Modal';
import { StatusDynamicIcon } from './Header';
import { collabService } from '../../services/collabService';
import soundService from '../../services/soundService';

type RailGroupId = 'home' | 'comms' | 'work' | 'people' | 'strategy' | 'admin';

interface RailGroupConfig {
  id: RailGroupId;
  label: string;
  defaultView: ActiveView;
  icon: React.FC<{ className?: string }>;
  matchViews: ActiveView[];
}

export const Sidebar: React.FC = () => {
  const {
    projects,
    activeProject,
    setActiveProject,
    currentUser,
    currentOrganization,
    darkMode,
    toggleDarkMode,
    openCreateProjectModal,
    activeView,
    setActiveView,
    signOut,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    isSidebarPinned,
    toggleSidebarPinned,
    openCommandPalette,
    openShortcutsModal,
    notifications,
    tasks,
    myTasks,
    addToast,
  } = useAppStore();

  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<RailGroupId>('home');
  const [sidebarFilter, setSidebarFilter] = useState('');
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);

  const railRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const hoverEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const unreadCount = notifications.filter(n => !n.read).length;
  const isAdminOrOwner = normalizedRole === UserRole.OWNER || normalizedRole === UserRole.ADMIN;

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
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHoverExpanded(false);
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverEnterTimerRef.current) clearTimeout(hoverEnterTimerRef.current);
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    };
  }, []);

  const handleStatusChange = (newStatus: 'available' | 'away' | 'busy') => {
    setMyStatus(newStatus);
    collabService.broadcastUserStatusChanged(newStatus);
    const label = newStatus === 'available' ? 'Available' : newStatus === 'away' ? 'Away' : 'Busy / DND';
    addToast('Status Broadcast Live', `Your status is now "${label}".`, 'info');
  };

  const navBadges = useMemo(() => {
    const badges: Record<string, number> = {};
    if (unreadCount > 0) badges['inbox_view'] = unreadCount;
    const allTasksList = tasks.length > 0 ? tasks : myTasks;
    const myOpen = currentUser
      ? allTasksList.filter(t => t.assignee_id === currentUser.id && t.status !== TaskStatus.DONE).length
      : 0;
    if (myOpen > 0) badges['my_tasks_view'] = myOpen;
    return badges;
  }, [unreadCount, tasks, myTasks, currentUser]);

  const roleFilteredItems = useMemo(() => {
    return SIDENAV_ITEMS.filter(item => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.includes(normalizedRole);
    });
  }, [normalizedRole]);

  const railGroups: RailGroupConfig[] = useMemo(() => {
    const groups: RailGroupConfig[] = [
      {
        id: 'home',
        label: 'Home & Focus',
        defaultView: 'overview',
        icon: ICON_MAP.HomeIcon,
        matchViews: ['overview', 'my_tasks_view'],
      },
      {
        id: 'comms',
        label: 'Inbox & Meet',
        defaultView: 'inbox_view',
        icon: ICON_MAP.ChatBubbleLeftRightIcon,
        matchViews: ['inbox_view', 'team_chat_view', 'calendar_view'],
      },
      {
        id: 'work',
        label: 'Projects & Delivery',
        defaultView: 'projects_overview',
        icon: ICON_MAP.FolderIcon,
        matchViews: ['projects_overview', 'kanban', 'sprints_view', 'gantt_roadmap_view', 'triage_intake_view'],
      },
      {
        id: 'people',
        label: 'Team & Capacity',
        defaultView: 'team_management',
        icon: ICON_MAP.UserGroupIcon,
        matchViews: ['team_management', 'workload_capacity_view', 'user_logs_view'],
      },
      {
        id: 'strategy',
        label: 'Reports & Strategy',
        defaultView:
          normalizedRole === UserRole.OWNER ||
          normalizedRole === UserRole.ADMIN ||
          normalizedRole === UserRole.PROJECT_MANAGER
            ? 'reports_view'
            : 'okrs_goals_view',
        icon: ICON_MAP.ChartBarIcon,
        matchViews: [
          'reports_view',
          'okrs_goals_view',
          'docs_wiki_view',
          'whiteboard_view',
          'async_clips_view',
          'client_portal_view',
        ],
      },
      {
        id: 'admin',
        label: isAdminOrOwner ? 'Governance & AI' : 'Automations & AI',
        defaultView: isAdminOrOwner ? 'admin_settings' : 'task_automations',
        icon: ICON_MAP.CogIcon,
        matchViews: ['admin_settings', 'task_automations', 'task_automations_view', 'ai_copilot_view', 'profile_settings'],
      },
    ];
    return groups;
  }, [normalizedRole, isAdminOrOwner]);

  // Keep accordion synced to whichever category owns the active view
  useEffect(() => {
    const matched = railGroups.find(g => g.matchViews.includes(activeView));
    if (matched) setExpandedGroup(matched.id);
  }, [activeView, railGroups]);

  const getGroupItems = (groupId: RailGroupId) => {
    const matchMap: Record<RailGroupId, ActiveView[]> = {
      home: ['overview', 'my_tasks_view'],
      comms: ['inbox_view', 'team_chat_view', 'calendar_view'],
      work: ['projects_overview', 'sprints_view', 'gantt_roadmap_view', 'triage_intake_view'],
      people: ['team_management', 'workload_capacity_view', 'user_logs_view'],
      strategy: [
        'reports_view',
        'okrs_goals_view',
        'docs_wiki_view',
        'whiteboard_view',
        'async_clips_view',
        'client_portal_view',
      ],
      admin: ['task_automations', 'ai_copilot_view'],
    };

    return roleFilteredItems.filter(i => matchMap[groupId].includes(i.id));
  };

  const navigateTo = (view: ActiveView) => {
    soundService.play('click_soft');
    setActiveView(view);
    if (!isSidebarPinned) {
      setIsHoverExpanded(false);
    }
    setIsMobileSidebarOpen(false);
  };

  const openProjectBoard = (project: Project) => {
    soundService.play('click_soft');
    setActiveProject(project.id);
    setActiveView('kanban');
    if (!isSidebarPinned) {
      setIsHoverExpanded(false);
    }
    setIsMobileSidebarOpen(false);
  };

  const handleRailMouseEnter = () => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    if (isSidebarPinned || isHoverExpanded) return;
    if (hoverEnterTimerRef.current) clearTimeout(hoverEnterTimerRef.current);
    hoverEnterTimerRef.current = setTimeout(() => {
      setIsHoverExpanded(true);
    }, 110);
  };

  const handleRailMouseLeave = () => {
    if (hoverEnterTimerRef.current) {
      clearTimeout(hoverEnterTimerRef.current);
      hoverEnterTimerRef.current = null;
    }
    if (isSidebarPinned || isProfileMenuOpen) return;
    if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    hoverLeaveTimerRef.current = setTimeout(() => {
      setIsHoverExpanded(false);
    }, 180);
  };

  const isExpanded = isSidebarPinned || isHoverExpanded;

  return (
    <>
      {/* Desktop Frosted Glass Rail + Hover Overlay Drawer (lg+) */}
      <div
        ref={railRef}
        onMouseEnter={handleRailMouseEnter}
        onMouseLeave={handleRailMouseLeave}
        className={`hidden lg:block relative h-full shrink-0 z-40 select-none transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarPinned ? 'w-[256px]' : 'w-[68px]'
        }`}
      >
        <aside
          aria-label="Workspace Navigation"
          className={`h-full rounded-[20px] frosted-rail-panel flex flex-col justify-between transition-[width,box-shadow,padding] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isExpanded
              ? isSidebarPinned
                ? 'w-[256px] p-3'
                : 'absolute inset-y-0 left-0 w-[264px] p-3 shadow-2xl'
              : 'w-[68px] py-3 px-2 items-center'
          }`}
        >
          {/* Top Brand Header + Quick Search */}
          <div className={`w-full space-y-2.5 shrink-0 ${isExpanded ? '' : 'flex flex-col items-center'}`}>
            <div className={`flex items-center ${isExpanded ? 'justify-between gap-2 px-1' : 'justify-center'}`}>
              <button
                type="button"
                onClick={() => navigateTo('overview')}
                className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                title={`${APP_TITLE} · ${currentOrganization?.name || 'Workspace'}`}
              >
                <span className="w-9 h-9 rounded-xl bg-[#191B17] dark:bg-[#CCF048] text-[#D4F542] dark:text-[#131511] flex items-center justify-center font-display font-extrabold text-sm shadow-xs shrink-0">
                  OF
                </span>
                {isExpanded && (
                  <div className="text-left min-w-0">
                    <span className="block text-sm font-bold tracking-tight text-[var(--text-primary)] truncate">
                      {APP_TITLE}
                    </span>
                    <span className="block text-[10px] text-[var(--text-muted)] truncate max-w-[128px]">
                      {currentOrganization?.name || 'Personal Workspace'}
                    </span>
                  </div>
                )}
              </button>

              {isExpanded && (
                <button
                  type="button"
                  onClick={() => {
                    soundService.play('click_soft');
                    toggleSidebarPinned();
                    if (isSidebarPinned) setIsHoverExpanded(false);
                  }}
                  title={isSidebarPinned ? 'Unpin sidebar (return to hover-to-expand)' : 'Pin sidebar open'}
                  aria-label={isSidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
                  className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer shrink-0 ${
                    isSidebarPinned
                      ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] border-[var(--accent-ink)]/15'
                      : 'bg-white/60 dark:bg-white/5 text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)]'
                  }`}
                >
                  {isSidebarPinned ? 'Pinned' : 'Pin'}
                </button>
              )}
            </div>

            {isExpanded ? (
              <button
                type="button"
                onClick={() => {
                  openCommandPalette();
                  if (!isSidebarPinned) setIsHoverExpanded(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/55 dark:bg-white/5 border border-[var(--border-hairline)] hover:border-[var(--border-strong)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
                  <ICON_MAP.SearchIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Quick jump...</span>
                </span>
                <kbd className="font-mono text-[10px]">⌘K</kbd>
              </button>
            ) : (
              <button
                type="button"
                onClick={openCommandPalette}
                title="Quick jump & Search (⌘K)"
                aria-label="Quick jump"
                className="w-10 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
              >
                <ICON_MAP.SearchIcon className="w-4 h-4" />
              </button>
            )}

            <div className="w-full h-px bg-[var(--border-hairline)]" />
          </div>

          {/* Center Navigation List: Collapsed Icon Stack OR Expanded Accordion Groups */}
          <nav
            className={`flex-1 min-h-0 overflow-y-auto scrollbar-none py-2 w-full ${
              isExpanded ? 'space-y-1' : 'flex flex-col items-center space-y-1.5'
            }`}
          >
            {railGroups.map(group => {
              const Icon = group.icon;
              const isActiveGroup = group.matchViews.includes(activeView);
              const isGroupOpen = isExpanded && expandedGroup === group.id;
              const groupItems = getGroupItems(group.id);
              const hasUnreadComms = group.id === 'comms' && unreadCount > 0;
              const myOpenCount = group.id === 'home' ? navBadges['my_tasks_view'] || 0 : 0;

              if (!isExpanded) {
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => navigateTo(group.defaultView)}
                    title={group.label}
                    aria-label={group.label}
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
                      isActiveGroup
                        ? 'bg-[#191B17] text-[#D4F542] dark:bg-[#CCF048] dark:text-[#131511] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)]'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    {hasUnreadComms && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#181C15]" />
                    )}
                    {!hasUnreadComms && myOpenCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-lime)] ring-1 ring-[var(--accent-ink)]/30" />
                    )}
                  </button>
                );
              }

              return (
                <div key={group.id} className="w-full">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      setExpandedGroup(prev => (prev === group.id ? prev : group.id));
                      if (!isActiveGroup) {
                        navigateTo(group.defaultView);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                      isActiveGroup
                        ? 'bg-[#191B17] text-white dark:bg-[#CCF048] dark:text-[#131511] font-semibold shadow-2xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActiveGroup ? 'text-[#D4F542] dark:text-[#131511]' : ''
                        }`}
                      />
                      <span className="truncate">{group.label}</span>
                    </span>

                    <span className="flex items-center gap-1.5 shrink-0">
                      {hasUnreadComms && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white">
                          {unreadCount}
                        </span>
                      )}
                      <ICON_MAP.ChevronDownIcon
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          isGroupOpen ? 'rotate-180 opacity-80' : 'opacity-50'
                        }`}
                      />
                    </span>
                  </button>

                  {isGroupOpen && (
                    <div className="mt-1 ml-3 pl-2.5 border-l border-[var(--border-hairline)] space-y-0.5">
                      {groupItems.map(item => {
                        const ItemIcon = ICON_MAP[item.icon] || ICON_MAP.SparklesIcon;
                        const itemActive = activeView === item.id;
                        const count = navBadges[item.id];
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigateTo(item.id)}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                              itemActive
                                ? 'bg-[var(--bg-sage)] text-[var(--text-primary)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/45 dark:hover:bg-white/5'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <ItemIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                              <span className="truncate">{item.label}</span>
                            </span>
                            {count !== undefined && count > 0 && (
                              <span className="font-mono text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)]">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {group.id === 'admin' && isAdminOrOwner && (
                        <button
                          type="button"
                          onClick={() => navigateTo('admin_settings')}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                            activeView === 'admin_settings'
                              ? 'bg-[var(--bg-sage)] text-[var(--text-primary)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/45 dark:hover:bg-white/5'
                          }`}
                        >
                          <ICON_MAP.ShieldCheckIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span className="truncate">Org Governance &amp; Admin</span>
                        </button>
                      )}

                      {group.id === 'work' && (
                        <div className="pt-1.5 mt-1.5 border-t border-[var(--border-hairline)] space-y-0.5">
                          <div className="flex items-center justify-between px-2 py-0.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Boards ({projects.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                openCreateProjectModal();
                                if (!isSidebarPinned) setIsHoverExpanded(false);
                              }}
                              className="text-[10px] font-semibold text-[var(--text-primary)] hover:underline cursor-pointer"
                            >
                              + New
                            </button>
                          </div>
                          {projects.slice(0, 5).map(p => {
                            const isSelected = activeProject?.id === p.id && activeView === 'kanban';
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => openProjectBoard(p)}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] font-semibold'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/45 dark:hover:bg-white/5'
                                }`}
                              >
                                <span className="truncate">{p.name}</span>
                                <span className="text-[9px] font-mono opacity-70">Board</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Bottom Utility Cluster + User Profile Switcher */}
          <div className={`w-full space-y-1 pt-2.5 border-t border-[var(--border-hairline)] shrink-0 ${isExpanded ? '' : 'flex flex-col items-center'}`}>
            <button
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to Editorial Light' : 'Switch to Obsidian Sage Dark'}
              className={`flex items-center transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] ${
                isExpanded ? 'w-full gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium' : 'w-10 h-9 justify-center rounded-xl'
              }`}
            >
              {darkMode ? <ICON_MAP.SunIcon className="w-4 h-4 shrink-0" /> : <ICON_MAP.MoonIcon className="w-4 h-4 shrink-0" />}
              {isExpanded && <span className="truncate">{darkMode ? 'Light Canvas' : 'Dark Canvas'}</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                openShortcutsModal();
                if (!isSidebarPinned) setIsHoverExpanded(false);
              }}
              title="Keyboard Shortcuts (?)"
              className={`flex items-center transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] ${
                isExpanded ? 'w-full justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium' : 'w-10 h-9 justify-center rounded-xl'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <ICON_MAP.KeyboardIcon className="w-4 h-4 shrink-0" />
                {isExpanded && <span>Shortcuts</span>}
              </span>
              {isExpanded && <kbd className="font-mono text-[10px] text-[var(--text-muted)]">?</kbd>}
            </button>

            <div className="relative w-full flex justify-center pt-0.5" ref={profileMenuRef}>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(prev => !prev)}
                  className={`flex items-center transition-colors cursor-pointer hover:bg-[var(--bg-sage)] ${
                    isExpanded ? 'w-full gap-2.5 p-1.5 rounded-xl text-left' : 'w-10 h-10 justify-center rounded-xl'
                  }`}
                  title={currentUser.full_name || currentUser.email}
                >
                  <div className="relative shrink-0">
                    <Avatar user={currentUser} size="sm" disableHoverCard />
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-[#1E221A] p-0.5">
                      <StatusDynamicIcon status={myStatus} className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {currentUser.full_name || currentUser.email}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">
                        {normalizedRole.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                </button>
              )}

              <AnimatedPopover
                isOpen={Boolean(isProfileMenuOpen && currentUser)}
                direction="up"
                className="editorial-popover absolute bottom-0 left-full ml-3 w-60 p-2 z-50"
              >
                {currentUser && (
                  <div className="space-y-1.5 text-xs">
                    <div className="px-2.5 py-2 border-b border-[var(--border-hairline)]">
                      <p className="font-bold text-[var(--text-primary)] truncate">
                        {currentUser.full_name || currentUser.email}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">{currentUser.email}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1">
                      {(['available', 'away', 'busy'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(st)}
                          className={`py-1 rounded-lg text-[11px] font-medium border cursor-pointer capitalize ${
                            myStatus === st
                              ? 'bg-[var(--bg-sage)] border-[var(--border-strong)] text-[var(--text-primary)] font-semibold'
                              : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1 border-t border-[var(--border-hairline)] space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigateTo('profile_settings');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-sage)] text-[var(--text-primary)] cursor-pointer"
                      >
                        Profile &amp; Preferences
                      </button>
                      <button
                        type="button"
                        onClick={() => signOut()}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </AnimatedPopover>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile & Tablet Full Navigation Drawer (< lg) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="relative w-76 max-w-[84vw] h-full frosted-rail-panel border-r border-[var(--border-hairline)] p-4 flex flex-col gap-3 z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-[#191B17] dark:bg-[#CCF048] text-[#D4F542] dark:text-[#131511] flex items-center justify-center font-display font-extrabold text-xs">
                  OF
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{APP_TITLE}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    {currentOrganization?.name || 'Workspace'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Close navigation drawer"
              >
                <ICON_MAP.XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <ICON_MAP.SearchIcon className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={sidebarFilter}
                onChange={e => setSidebarFilter(e.target.value)}
                placeholder="Jump to view or project..."
                className="w-full search-input !py-1.5 !pr-3 text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4">
              {railGroups.map(group => {
                const groupItems = getGroupItems(group.id).filter(
                  item =>
                    !sidebarFilter.trim() ||
                    item.label.toLowerCase().includes(sidebarFilter.trim().toLowerCase())
                );
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.id} className="space-y-1">
                    <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {group.label}
                    </p>
                    {groupItems.map(item => {
                      const Icon = ICON_MAP[item.icon] || ICON_MAP.SparklesIcon;
                      const active = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.id)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs cursor-pointer ${
                            active
                              ? 'bg-[#191B17] text-white dark:bg-[#CCF048] dark:text-[#131511] font-semibold'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-sage)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 truncate">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {navBadges[item.id] ? (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)]">
                              {navBadges[item.id]}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {projects.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-[var(--border-hairline)]">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Projects ({projects.length})
                  </p>
                  {projects
                    .filter(
                      p =>
                        !sidebarFilter.trim() ||
                        p.name.toLowerCase().includes(sidebarFilter.trim().toLowerCase())
                    )
                    .map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openProjectBoard(p)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-sage)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] font-mono opacity-65">Board</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={openCommandPalette}
                className="flex-1 py-2 px-3 rounded-xl bg-[var(--bg-sage)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
              >
                Search (⌘K)
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="py-2 px-3 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
