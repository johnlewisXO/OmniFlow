import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Project, ActiveView, UserRole, normalizeUserRole, TaskStatus } from '../../types';
import { ICON_MAP, SIDENAV_ITEMS, APP_TITLE, ALL_ACTIVE_VIEWS } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button'; 
import { AnimatedPopover } from '../shared/Modal';
import { StatusDynamicIcon } from './Header';
import { collabService } from '../../services/collabService';
import soundService from '../../services/soundService';

type NavCategoryKey = 'workspace' | 'execution' | 'strategy' | 'admin';

const CATEGORY_META: Record<NavCategoryKey, { label: string }> = {
  workspace: { label: 'Workspace & Comms' },
  execution: { label: 'Delivery & Execution' },
  strategy: { label: 'Studio, Docs & Strategy' },
  admin: { label: 'Automation & Governance' },
};

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
    tasks,
    myTasks,
    presences,
    addToast,
  } = useAppStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState('');
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const userStorageSuffix = currentUser?.id || 'guest';
  const orderStorageKey = `omni_sidebar_order_v2_${userStorageSuffix}`;
  const favStorageKey = `omni_sidebar_favs_v2_${userStorageSuffix}`;
  const collapsedGroupsKey = `omni_sidebar_groups_v2_${userStorageSuffix}`;

  const [orderedItemIds, setOrderedItemIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(orderStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const allDefault = SIDENAV_ITEMS.map(i => i.id);
        const merged = [
          ...parsed.filter(id => allDefault.includes(id as ActiveView)),
          ...allDefault.filter(id => !parsed.includes(id)),
        ];
        return merged;
      }
    } catch {}
    return SIDENAV_ITEMS.map(i => i.id);
  });

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(favStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['overview', 'whiteboard_view', 'my_tasks_view'];
  });

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(collapsedGroupsKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [draggedNavId, setDraggedNavId] = useState<string | null>(null);
  const [dragOverNavId, setDragOverNavId] = useState<string | null>(null);

  // Track recent live updates per menu item so badges pulse when new activity arrives
  const [recentUpdatePulses, setRecentUpdatePulses] = useState<Record<string, number>>({});

  useEffect(() => {
    const markPulse = (viewId: string) => {
      setRecentUpdatePulses(prev => ({
        ...prev,
        [viewId]: (prev[viewId] || 0) + 1,
      }));
    };

    const onTeamUpdated = () => markPulse('team_management');
    const onChatMsg = () => markPulse('team_chat_view');
    const onTaskCreated = () => {
      markPulse('projects_overview');
      markPulse('my_tasks_view');
    };
    const onWhiteboardDelta = () => markPulse('whiteboard_view');

    window.addEventListener('omni_remote_team_member_updated', onTeamUpdated);
    window.addEventListener('omni_remote_team_member_removed', onTeamUpdated);
    window.addEventListener('omni_remote_task_created', onTaskCreated);
    window.addEventListener('omni_remote_whiteboard_delta', onWhiteboardDelta);
    window.addEventListener('omni_state_updated', ((e: CustomEvent) => {
      const entityType = e.detail?.entityType;
      if (entityType === 'team' || entityType === 'user') markPulse('team_management');
      if (entityType === 'chat') markPulse('team_chat_view');
    }) as EventListener);

    return () => {
      window.removeEventListener('omni_remote_team_member_updated', onTeamUpdated);
      window.removeEventListener('omni_remote_team_member_removed', onTeamUpdated);
      window.removeEventListener('omni_remote_task_created', onTaskCreated);
      window.removeEventListener('omni_remote_whiteboard_delta', onWhiteboardDelta);
    };
  }, []);

  // Clear pulse when user visits the active view
  useEffect(() => {
    if (activeView && recentUpdatePulses[activeView]) {
      setRecentUpdatePulses(prev => {
        const next = { ...prev };
        delete next[activeView];
        return next;
      });
    }
  }, [activeView, recentUpdatePulses]);

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
  const hoverBgClass = darkMode ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-900/[0.05]';
  const activeItemTextClass = 'text-white'; 
  const activeItemBgClass = 'bg-accent shadow-md shadow-accent/25';
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

  // Compute rich live badges for Sidebar items
  const navBadges = useMemo(() => {
    const badges: Record<
      string,
      { count?: number; label?: string; tone: 'danger' | 'accent' | 'emerald' | 'amber'; isNew?: boolean }
    > = {};

    // 1. Inbox unread notifications
    if (unreadCount > 0) {
      badges['inbox_view'] = {
        count: unreadCount,
        tone: 'danger',
        isNew: true,
      };
    }

    // 2. Teams Chat unread notifications
    const unreadChat = notifications.filter(
      n =>
        !n.read &&
        (n.entity_type === 'chat' ||
          (n.type || '').includes('CHAT') ||
          (n.title || '').startsWith('💬'))
    ).length + (recentUpdatePulses['team_chat_view'] || 0);
    if (unreadChat > 0) {
      badges['team_chat_view'] = {
        count: unreadChat,
        tone: 'accent',
        isNew: true,
      };
    }

    // 3. My Tasks active incomplete count
    const allTasksList = tasks.length > 0 ? tasks : myTasks;
    const myOpenCount = currentUser
      ? allTasksList.filter(
          t =>
            (t.assignee_id === currentUser.id || t.assigneeId === currentUser.id) &&
            t.status !== TaskStatus.DONE
        ).length
      : 0;
    if (myOpenCount > 0) {
      badges['my_tasks_view'] = {
        count: myOpenCount,
        tone: 'accent',
        isNew: Boolean(recentUpdatePulses['my_tasks_view']),
      };
    }

    // 4. Team Management updates (unread role/invite notifications or live team events)
    const unreadTeamNotifs = notifications.filter(
      n =>
        !n.read &&
        (n.entity_type === 'user' ||
          (n.type || '').includes('ROLE') ||
          (n.type || '').includes('INVITE') ||
          (n.type || '').includes('USER') ||
          (n.title || '').toLowerCase().includes('role') ||
          (n.title || '').toLowerCase().includes('invite') ||
          (n.title || '').toLowerCase().includes('team'))
    ).length + (recentUpdatePulses['team_management'] || 0);
    if (unreadTeamNotifs > 0) {
      badges['team_management'] = {
        count: unreadTeamNotifs,
        label: 'Update',
        tone: 'emerald',
        isNew: true,
      };
    }

    // 5. Triage Queue count
    let triageOpen = 0;
    try {
      const rawTriage = localStorage.getItem(
        `omni_triage_queue_v1_${currentUser?.organization_id || 'default'}`
      );
      if (rawTriage) {
        const parsed = JSON.parse(rawTriage);
        if (Array.isArray(parsed)) {
          triageOpen = parsed.filter((i: any) => i.status === 'pending').length;
        }
      } else {
        triageOpen = 3;
      }
    } catch {
      triageOpen = 3;
    }
    if (triageOpen > 0) {
      badges['triage_intake_view'] = {
        count: triageOpen,
        tone: 'amber',
      };
    }

    // 6. Whiteboard Studio active collaborators
    const wbPeers = presences.filter(
      p => p.currentView === 'whiteboard_view' && p.userId !== currentUser?.id
    ).length;
    if (wbPeers > 0 || recentUpdatePulses['whiteboard_view']) {
      badges['whiteboard_view'] = {
        label: wbPeers > 0 ? `${wbPeers} Live` : 'Updated',
        tone: 'emerald',
        isNew: true,
      };
    }

    return badges;
  }, [unreadCount, notifications, recentUpdatePulses, tasks, myTasks, currentUser, presences]);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    soundService.play('click_soft');
    setFavoriteIds(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      try {
        localStorage.setItem(favStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleCategoryCollapse = (cat: string) => {
    soundService.play('click_soft');
    setCollapsedCategories(prev => {
      const next = { ...prev, [cat]: !prev[cat] };
      try {
        localStorage.setItem(collapsedGroupsKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleNavDragStart = (e: React.DragEvent, id: string) => {
    soundService.play('drag_pickup');
    setDraggedNavId(id);
    e.dataTransfer.setData('text/sidebar-nav-id', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNavDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverNavId !== targetId) {
      setDragOverNavId(targetId);
    }
  };

  const handleNavDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/sidebar-nav-id') || draggedNavId;
    setDraggedNavId(null);
    setDragOverNavId(null);
    if (!sourceId || sourceId === targetId) return;

    setOrderedItemIds(prev => {
      const list = [...prev];
      const fromIdx = list.indexOf(sourceId);
      const toIdx = list.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      try {
        localStorage.setItem(orderStorageKey, JSON.stringify(list));
      } catch {}
      return list;
    });
    soundService.play('drag_drop');
  };

  const handleResetSidebarOrder = () => {
    soundService.play('state_updated');
    const defaults = SIDENAV_ITEMS.map(i => i.id);
    setOrderedItemIds(defaults);
    try {
      localStorage.removeItem(orderStorageKey);
    } catch {}
    addToast('Sidebar Order Reset', 'Restored default navigation order.', 'info');
  };

  const handleSidenavItemClick = (id: ActiveView | string, _path: string) => {
    soundService.play('click_soft');
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

  // Ordered & role-filtered navigation items
  const orderedNavItems = useMemo(() => {
    const itemMap = new Map(SIDENAV_ITEMS.map(i => [i.id, i]));
    const list = orderedItemIds
      .map(id => itemMap.get(id as ActiveView))
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;
        if (item.roles && currentUser?.role && !item.roles.includes(normalizedRole)) {
          return false;
        }
        if (sidebarFilter.trim()) {
          return item.label.toLowerCase().includes(sidebarFilter.trim().toLowerCase());
        }
        return true;
      });
    return list;
  }, [orderedItemIds, currentUser?.role, normalizedRole, sidebarFilter]);

  const favoriteNavItems = useMemo(() => {
    return orderedNavItems.filter(item => favoriteIds.includes(item.id));
  }, [orderedNavItems, favoriteIds]);

  const renderNavItemButton = (
    item: (typeof SIDENAV_ITEMS)[number],
    expanded: boolean,
    isMobile: boolean,
    inFavoritesSection = false
  ) => {
    const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];
    const isItemActive =
      activeView === item.id || (item.id === 'projects_overview' && activeView === 'kanban');
    const badge = navBadges[item.id];
    const isFav = favoriteIds.includes(item.id);
    const isBeingDragged = draggedNavId === item.id;
    const isDragTarget = dragOverNavId === item.id && draggedNavId !== item.id;

    const badgeToneClass =
      badge?.tone === 'danger'
        ? isItemActive
          ? 'bg-white text-rose-600'
          : 'bg-rose-500 text-white shadow-xs shadow-rose-500/30'
        : badge?.tone === 'emerald'
        ? isItemActive
          ? 'bg-white text-emerald-700'
          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
        : badge?.tone === 'amber'
        ? isItemActive
          ? 'bg-white text-amber-700'
          : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
        : isItemActive
        ? 'bg-white/25 text-white'
        : 'bg-accent/15 text-accent border border-accent/30';

    return (
      <div
        key={`${inFavoritesSection ? 'fav-' : ''}${item.id}`}
        draggable={expanded || isMobile}
        onDragStart={e => handleNavDragStart(e, item.id)}
        onDragOver={e => handleNavDragOver(e, item.id)}
        onDrop={e => handleNavDrop(e, item.id)}
        onDragEnd={() => {
          setDraggedNavId(null);
          setDragOverNavId(null);
        }}
        className={`relative group/navitem transition-all ${
          isBeingDragged ? 'opacity-40 scale-95' : ''
        } ${isDragTarget ? 'border-t-2 border-accent pt-0.5' : ''}`}
      >
        <button
          data-tour-id={`tour-nav-${item.id}`}
          onClick={() => handleSidenavItemClick(item.id, item.path)}
          title={
            !expanded && !isMobile
              ? `${item.label}${badge ? ` (${badge.count ?? badge.label})` : ''} — Drag to reorder`
              : 'Click to open • Drag to reorder'
          }
          className={`w-full flex items-center ${
            expanded || isMobile ? 'justify-between px-3' : 'justify-center px-0'
          } py-2 rounded-2xl transition-all text-left cursor-pointer ${
            isItemActive
              ? `${activeItemBgClass} ${activeItemTextClass}`
              : `${textColorClass} ${hoverBgClass} hover:text-accent`
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              {Icon && (
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isItemActive
                      ? 'text-white'
                      : darkMode
                      ? 'text-slate-400 group-hover/navitem:text-accent'
                      : 'text-slate-500 group-hover/navitem:text-accent'
                  } transition-colors`}
                />
              )}
              {/* Collapsed Compact Badge Dot */}
              {!expanded && !isMobile && badge && (
                <span
                  className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                    badge.tone === 'danger'
                      ? 'bg-rose-500 animate-pulse'
                      : badge.tone === 'emerald'
                      ? 'bg-emerald-500'
                      : badge.tone === 'amber'
                      ? 'bg-amber-500'
                      : 'bg-accent'
                  }`}
                />
              )}
            </div>
            {(expanded || isMobile) && (
              <span
                className={`text-xs font-medium whitespace-nowrap truncate ${
                  isItemActive ? 'font-bold text-white' : ''
                }`}
              >
                {item.label}
              </span>
            )}
          </div>

          {(expanded || isMobile) && (
            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
              {badge && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums leading-none ${badgeToneClass} ${
                    badge.isNew ? 'animate-pulse' : ''
                  }`}
                >
                  {badge.isNew && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-85" />
                  )}
                  {badge.count !== undefined ? badge.count : badge.label}
                </span>
              )}

              {/* Favorite Pin Star Toggle */}
              <span
                role="button"
                tabIndex={-1}
                onClick={e => toggleFavorite(e, item.id)}
                title={isFav ? 'Remove from Pinned Favorites' : 'Pin to Favorites'}
                className={`p-1 rounded-lg transition-opacity ${
                  isFav
                    ? 'opacity-100 text-amber-400 hover:text-amber-300'
                    : 'opacity-0 group-hover/navitem:opacity-100 text-slate-400 hover:text-amber-400'
                }`}
              >
                <ICON_MAP.StarIcon className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
              </span>
            </div>
          )}
        </button>
      </div>
    );
  };

  const renderSidebarContent = (expanded: boolean, isMobile: boolean = false) => (
    <>
      <div className="space-y-2.5">
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
              className={`p-1.5 rounded-lg transition-all flex-shrink-0 cursor-pointer ${
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

        {/* Quick Sidebar Filter Input when expanded */}
        {(expanded || isMobile) && (
          <div className="relative">
            <ICON_MAP.SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={sidebarFilter}
              onChange={e => setSidebarFilter(e.target.value)}
              placeholder="Filter menu & projects..."
              className={`w-full pl-8 pr-6 py-1.5 rounded-xl text-xs border outline-none transition-all ${
                darkMode
                  ? 'bg-slate-900/70 border-slate-700/70 text-slate-200 placeholder-slate-500 focus:border-accent'
                  : 'bg-white/80 border-slate-200/90 text-slate-800 placeholder-slate-400 focus:border-accent'
              }`}
            />
            {sidebarFilter && (
              <button
                type="button"
                onClick={() => setSidebarFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`flex-1 space-y-3 pr-1 overflow-x-hidden ${
        (expanded || isMobile) ? 'overflow-y-auto scrollbar-thin' : 'overflow-y-auto scrollbar-none'
      }`}>
        {/* 1. Pinned Favorites Section */}
        {favoriteNavItems.length > 0 && !sidebarFilter.trim() && (
          <div className="space-y-1">
            {(expanded || isMobile) && (
              <div className="flex items-center justify-between px-2.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/90 flex items-center gap-1">
                  <ICON_MAP.StarIcon className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Favorites
                </span>
                <span className="text-[9px] text-slate-400 font-mono">Drag to reorder</span>
              </div>
            )}
            <div className="space-y-0.5">
              {favoriteNavItems.map(item => renderNavItemButton(item, expanded, isMobile, true))}
            </div>
          </div>
        )}

        {/* 2. Categorized & Reorderable Navigation Groups */}
        <nav className="space-y-2.5">
          {(['workspace', 'execution', 'strategy', 'admin'] as NavCategoryKey[]).map(catKey => {
            const groupItems = orderedNavItems.filter(
              i => (i.category || 'workspace') === catKey
            );
            if (groupItems.length === 0) return null;
            const isCollapsed = Boolean(collapsedCategories[catKey]) && !sidebarFilter.trim();

            return (
              <div key={catKey} className="space-y-0.5">
                {(expanded || isMobile) ? (
                  <button
                    type="button"
                    onClick={() => toggleCategoryCollapse(catKey)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <span>{CATEGORY_META[catKey].label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono opacity-60">{groupItems.length}</span>
                      <ICON_MAP.ChevronDownIcon
                        className={`w-3 h-3 transition-transform ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                    </div>
                  </button>
                ) : (
                  <div className="flex justify-center my-1.5">
                    <div className="w-5 h-px bg-slate-400/30 dark:bg-slate-700/50 rounded-full" />
                  </div>
                )}

                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {groupItems.map(item => renderNavItemButton(item, expanded, isMobile, false))}
                  </div>
                )}
              </div>
            );
          })}

          {isAdminOrOwner && (
            <button
              key="admin-settings"
              onClick={() => handleSidenavItemClick('admin_settings', '#')}
              title={(!expanded && !isMobile) ? 'Admin Settings' : undefined}
              className={`w-full flex items-center ${(expanded || isMobile) ? 'space-x-2.5 px-3' : 'justify-center px-0'} py-2 rounded-2xl transition-all group text-left cursor-pointer
                          ${activeView === 'admin_settings' 
                            ? `${activeItemBgClass} ${activeItemTextClass}` 
                            : `${textColorClass} ${hoverBgClass} hover:text-accent`
                          }`}
            >
              <CogIcon className={`w-4 h-4 flex-shrink-0 ${activeView === 'admin_settings' ? 'text-white' : (darkMode ? 'text-slate-400' : 'text-slate-500')} group-hover:text-accent transition-colors`} />
              {(expanded || isMobile) && (
                <span className={`text-xs font-medium whitespace-nowrap truncate ${activeView === 'admin_settings' ? 'font-semibold text-white' : ''}`}>Admin Settings</span>
              )}
            </button>
          )}
        </nav>

        <div className="pt-2">
          {(expanded || isMobile) ? (
            <div className="flex items-center justify-between px-2.5 mb-1.5">
              <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Projects ({projects.length})
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleResetSidebarOrder}
                  className="text-[10px] text-slate-400 hover:text-accent px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                  title="Reset custom menu order"
                >
                  Reset
                </button>
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
            {!isLoadingProjects &&
              !projectsError &&
              projects
                .filter(
                  p =>
                    !sidebarFilter.trim() ||
                    p.name.toLowerCase().includes(sidebarFilter.trim().toLowerCase())
                )
                .map((project: Project) => {
                  const isActive = activeProject?.id === project.id && activeView === 'kanban';
                  const projTaskCount = tasks.filter(
                    t => t.projectId === project.id && t.status !== TaskStatus.DONE
                  ).length;
                  return (
                    <button
                      key={project.id}
                      onClick={() => {
                        soundService.play('click_soft');
                        setActiveProject(project.id);
                        if (isMobile) setIsMobileSidebarOpen(false);
                      }}
                      title={!expanded && !isMobile ? `${project.name} (${projTaskCount} open)` : undefined}
                      className={`w-full flex items-center ${
                        expanded || isMobile ? 'justify-between px-3' : 'justify-center px-0'
                      } py-2 rounded-2xl text-left text-xs font-medium transition-all group cursor-pointer ${
                        isActive
                          ? `${activeItemBgClass} ${activeItemTextClass}`
                          : `${textColorClass} ${hoverBgClass} hover:text-accent-light`
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <FolderIcon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isActive
                              ? 'text-white'
                              : darkMode
                              ? 'text-slate-400'
                              : 'text-slate-500 group-hover:text-accent'
                          } transition-colors`}
                        />
                        {(expanded || isMobile) && (
                          <span
                            className={`transition-all truncate whitespace-nowrap ${
                              isActive ? 'font-bold text-white' : ''
                            }`}
                          >
                            {project.name}
                          </span>
                        )}
                      </div>
                      {(expanded || isMobile) && projTaskCount > 0 && (
                        <span
                          className={`text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {projTaskCount}
                        </span>
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

        <AnimatedPopover
          isOpen={Boolean(isProfileMenuOpen && currentUser)}
          direction="up"
          className={`absolute bottom-full left-0 ${(expanded || isMobile) ? 'right-0 w-full min-w-[240px]' : 'left-full ml-2 w-64'} mb-2 rounded-2xl shadow-2xl py-2 z-50 
                     border ${darkMode ? 'bg-slate-900/95 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'} backdrop-blur-xl`}
        >
          {currentUser && (
            <>
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

              {(normalizedRole === UserRole.OWNER || normalizedRole === UserRole.PROJECT_MANAGER) && (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('omni_open_system_log_monitor'));
                    setProfileMenuOpen(false);
                    if (isMobile) setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                             ${darkMode ? 'text-emerald-300 hover:bg-slate-800' : 'text-emerald-700 hover:bg-emerald-50/70'} 
                             transition-colors`}
                >
                  <span className="flex items-center space-x-2.5">
                    <ICON_MAP.TerminalIcon className="w-4 h-4 text-emerald-400" />
                    <span>Log Monitor</span>
                  </span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                    {normalizedRole === UserRole.OWNER ? 'OWNER' : 'PM'}
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('omni_open_ai_guide'));
                  window.dispatchEvent(new CustomEvent('omni_open_ai_platform_guide'));
                  setProfileMenuOpen(false);
                  if (isMobile) setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
                           ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'} 
                           transition-colors`}
              >
                <span className="flex items-center space-x-2.5">
                  <ICON_MAP.SparklesIcon className="w-4 h-4 text-indigo-400" />
                  <span>AI Platform Guide</span>
                </span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400">Tour</span>
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
            </>
          )}
        </AnimatedPopover>
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
        className={`hidden md:flex glass-panel rounded-[32px] flex-col h-full p-3.5 space-y-3 transition-all duration-300 ease-in-out z-30 select-none ${
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
