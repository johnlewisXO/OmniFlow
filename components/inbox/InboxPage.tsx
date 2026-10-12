import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { formatDistanceToNow } from 'date-fns';

export const InboxPage: React.FC = () => {
  const {
    darkMode,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    openViewTaskModal,
    tasks,
    projects,
    users,
    currentUser,
    setActiveView,
    setActiveProject,
    setHighlightedTaskId,
    lastUndoAction,
    triggerUndo,
  } = useAppStore();

  const InboxIcon = ICON_MAP.InboxIcon;
  const CheckIcon = ICON_MAP.CheckIcon;
  const TrashIcon = ICON_MAP.TrashIcon;
  const CheckBadgeIcon = ICON_MAP.CheckBadgeIcon;

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'mentions' | 'task_updates' | 'chat'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'system'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;
  const mentionsCount = notifications.filter(n => n.type === 'MENTION' || (n.title || '').toLowerCase().includes('mention')).length;
  const taskUpdatesCount = notifications.filter(n => n.type?.startsWith('TASK_') || n.entity_type === 'task').length;
  const chatUpdatesCount = notifications.filter(
    n => n.entity_type === 'chat' || (n.type || '').includes('CHAT') || (n.title || '').startsWith('💬')
  ).length;
  const readPercentage =
    notifications.length > 0
      ? Math.round(((notifications.length - unreadCount) / notifications.length) * 100)
      : 100;

  // Enrich each notification with Actor, Project/Channel context, Status/Priority diff, and Category metadata
  const enrichedNotifications = useMemo(() => {
    return notifications.map(n => {
      const typeStr = (n.type || '').toUpperCase();
      const titleStr = (n.title || '').toLowerCase();
      const msgStr = n.message || n.content || '';
      const targetId = n.entity_id || n.reference_id;

      const matchedTask = tasks.find(
        t => t.id === targetId || (msgStr && t.title && msgStr.toLowerCase().includes(t.title.toLowerCase()))
      );
      const matchedProject =
        projects.find(p => p.id === targetId || p.id === matchedTask?.project_id) ||
        projects.find(p => msgStr && p.name && msgStr.toLowerCase().includes(p.name.toLowerCase()));

      const matchedActor =
        users.find(
          u =>
            u.id === (n as any).metadata?.actorId ||
            u.id === targetId ||
            (u.full_name &&
              (msgStr.toLowerCase().includes(u.full_name.toLowerCase()) ||
                titleStr.includes(u.full_name.toLowerCase())))
        ) || currentUser;

      const isMention = typeStr === 'MENTION' || titleStr.includes('mention');
      const isChat = n.entity_type === 'chat' || typeStr.includes('CHAT') || (n.title || '').startsWith('💬');
      const isTask = n.entity_type === 'task' || typeStr.startsWith('TASK_') || Boolean(matchedTask);
      const isCalendar = n.entity_type === 'calendar' || typeStr.includes('CALENDAR') || (n.title || '').startsWith('📅');
      const isTeam = n.entity_type === 'user' || typeStr.includes('ROLE') || typeStr.includes('INVITE');
      const isSprint = typeStr.includes('SPRINT') || titleStr.includes('sprint');

      let categoryLabel = 'System';
      let categoryColor = 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      if (isMention) {
        categoryLabel = 'Mention';
        categoryColor = 'bg-purple-500/15 text-purple-500 dark:text-purple-400 border-purple-500/30';
      } else if (isChat) {
        categoryLabel = 'Chat';
        categoryColor = 'bg-sky-500/15 text-sky-500 dark:text-sky-400 border-sky-500/30';
      } else if (isTask) {
        categoryLabel = 'Task';
        categoryColor = 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
      } else if (isCalendar) {
        categoryLabel = 'Calendar';
        categoryColor = 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30';
      } else if (isSprint) {
        categoryLabel = 'Sprint';
        categoryColor = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      } else if (isTeam) {
        categoryLabel = 'Team';
        categoryColor = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      }

      let diffPill: string | null = null;
      const arrowMatch = msgStr.match(/([A-Za-z ]+)\s*(?:→|->|to)\s*([A-Za-z ]+)/i);
      if (arrowMatch && arrowMatch[1] && arrowMatch[2] && arrowMatch[1].length < 20 && arrowMatch[2].length < 20) {
        diffPill = `${arrowMatch[1].trim()} → ${arrowMatch[2].trim()}`;
      } else if (matchedTask?.status) {
        diffPill = String(matchedTask.status);
      }

      const priority = matchedTask?.priority || (typeStr.includes('DELETED') || typeStr.includes('OVERDUE') ? 'High' : null);

      return {
        ...n,
        matchedTask,
        matchedProject,
        matchedActor,
        isMention,
        isChat,
        isTask,
        isCalendar,
        isTeam,
        isSprint,
        categoryLabel,
        categoryColor,
        diffPill,
        priority,
      };
    });
  }, [notifications, tasks, projects, users, currentUser]);

  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = enrichedNotifications;
    if (activeTab === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (activeTab === 'mentions') {
      filtered = filtered.filter(n => n.isMention);
    } else if (activeTab === 'task_updates') {
      filtered = filtered.filter(n => n.isTask);
    } else if (activeTab === 'chat') {
      filtered = filtered.filter(n => n.isChat);
    }

    if (priorityFilter === 'high') {
      filtered = filtered.filter(
        n =>
          n.priority === 'High' ||
          n.priority === 'Critical' ||
          n.isMention ||
          (n.type || '').includes('OVERDUE')
      );
    } else if (priorityFilter === 'system') {
      filtered = filtered.filter(n => !n.isTask && !n.isChat);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        n =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.message && n.message.toLowerCase().includes(q)) ||
          (n.content && n.content.toLowerCase().includes(q)) ||
          (n.matchedProject?.name && n.matchedProject.name.toLowerCase().includes(q)) ||
          (n.matchedActor?.full_name && n.matchedActor.full_name.toLowerCase().includes(q))
      );
    }

    return [...filtered].sort((a, b) => {
      if (a.read === b.read) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.read ? 1 : -1;
    });
  }, [enrichedNotifications, activeTab, priorityFilter, searchQuery]);

  const handleOpenNotificationTarget = (n: (typeof enrichedNotifications)[0]) => {
    markNotificationAsRead(n.id);
    if (n.isChat) {
      setActiveView('team_chat_view');
      if (n.entity_id) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('omni_select_chat_contact', { detail: { userId: n.entity_id } }));
        }, 80);
      }
      return;
    }
    if (n.isCalendar) {
      setActiveView('calendar_view');
      return;
    }
    if (n.isTeam) {
      setActiveView('team_management');
      return;
    }
    if (n.isSprint) {
      setActiveView('sprints_view');
      return;
    }
    if (n.matchedTask) {
      if (n.matchedProject) setActiveProject(n.matchedProject);
      setHighlightedTaskId(n.matchedTask.id);
      openViewTaskModal(n.matchedTask, n.isMention);
      return;
    }
    if (n.entity_id && n.isTask) {
      openViewTaskModal(n.entity_id, n.isMention);
      return;
    }
    if (n.matchedProject) {
      setActiveProject(n.matchedProject);
      setActiveView('kanban');
    }
  };

  return (
    <div className={`p-4 md:p-6 ${darkMode ? 'text-slate-100' : 'text-slate-900'} space-y-5`}>
      {/* 1. Compact Icon-First Header & KPI Strip */}
      <div
        className={`rounded-3xl p-5 border shadow-sm transition-all ${
          darkMode
            ? 'bg-[#090A0F] border-white/10 text-white'
            : 'bg-white border-slate-200/80 text-slate-900'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500 shrink-0">
              <InboxIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Inbox & Activity Feed</h1>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums bg-indigo-500 text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time task diffs, @mentions, direct messages, and workspace events
              </p>
            </div>
          </div>

          {/* Icon-First Top Actions */}
          <div className="flex items-center gap-2">
            {lastUndoAction && (
              <button
                type="button"
                onClick={() => triggerUndo()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                title={`Undo last action: ${lastUndoAction.label}`}
              >
                <span>↶</span>
                <span className="hidden sm:inline">Undo</span>
              </button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsAsRead}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Mark all unread notifications as read"
              >
                <CheckIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Mark All Read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  darkMode
                    ? 'bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border-white/10'
                    : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200'
                }`}
                title="Clear all notifications"
                aria-label="Clear all notifications"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Icon-First KPI Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-200/70 dark:border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'unread'
                ? 'border-amber-500/50 bg-amber-500/10'
                : darkMode
                ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/80'
            }`}
            title="Filter by Unread Alerts"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <ICON_MAP.BellIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black tabular-nums leading-none">{unreadCount}</div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-1">Unread</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mentions')}
            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'mentions'
                ? 'border-purple-500/50 bg-purple-500/10'
                : darkMode
                ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/80'
            }`}
            title="Filter by @Mentions"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
              <ICON_MAP.ChatBubbleLeftIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black tabular-nums leading-none">{mentionsCount}</div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-1">@Mentions</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('task_updates')}
            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'task_updates'
                ? 'border-indigo-500/50 bg-indigo-500/10'
                : darkMode
                ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/80'
            }`}
            title="Filter by Task Diffs & Assignments"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
              <ICON_MAP.CheckBadgeIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black tabular-nums leading-none">{taskUpdatesCount}</div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-1">Task Diffs</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              darkMode
                ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/80'
            }`}
            title="Inbox Zero Hygiene Score"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <ICON_MAP.SparklesIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black tabular-nums leading-none text-emerald-500">{readPercentage}%</div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-1">Cleared</div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Icon-First Filter Bar & Non-Overlapping Search Input */}
      <div
        className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-2xl border ${
          darkMode ? 'bg-[#090A0F] border-white/10' : 'bg-white border-slate-200/80 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'All', count: notifications.length, icon: <ICON_MAP.InboxIcon className="w-3.5 h-3.5" /> },
            { id: 'unread', label: 'Unread', count: unreadCount, icon: <ICON_MAP.BellIcon className="w-3.5 h-3.5" /> },
            { id: 'mentions', label: 'Mentions', count: mentionsCount, icon: <ICON_MAP.ChatBubbleLeftIcon className="w-3.5 h-3.5" /> },
            { id: 'task_updates', label: 'Tasks', count: taskUpdatesCount, icon: <ICON_MAP.CheckBadgeIcon className="w-3.5 h-3.5" /> },
            { id: 'chat', label: 'Chat', count: chatUpdatesCount, icon: <ICON_MAP.UsersIcon className="w-3.5 h-3.5" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : darkMode
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : darkMode
                    ? 'bg-white/10 text-slate-300'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Priority quick pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
            {[
              { id: 'all', label: 'All', title: 'All priorities' },
              { id: 'high', label: '⚡ Priority', title: 'High priority & mentions' },
              { id: 'system', label: '⚙ System', title: 'System & team events' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriorityFilter(p.id as any)}
                title={p.title}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  priorityFilter === p.id
                    ? darkMode
                      ? 'bg-white/15 text-white'
                      : 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search input with guaranteed non-overlapping left icon padding */}
          <div className="relative flex-1 sm:w-64">
            <ICON_MAP.SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search actor, task, project..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-1.5 text-xs rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Clear search"
              >
                <ICON_MAP.XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Enriched Notifications Feed */}
      <div className="space-y-2.5">
        {filteredAndSortedNotifications.length === 0 ? (
          <div
            className={`text-center py-16 rounded-3xl border border-dashed ${
              darkMode ? 'bg-[#090A0F]/60 border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <CheckBadgeIcon className="w-12 h-12 mx-auto mb-3 text-emerald-500/70" />
            <h3 className="text-base font-bold">
              {searchQuery ? 'No matching activity found' : 'Inbox Zero Achieved'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Try clearing your search or switching category filters.'
                : 'All notifications and task transitions have been reviewed.'}
            </p>
          </div>
        ) : (
          filteredAndSortedNotifications.map(n => {
            const isUnread = !n.read;
            const exactTime = new Date(n.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const relTime = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
            const actorName = n.matchedActor?.full_name || n.matchedActor?.email?.split('@')[0] || 'Workspace';
            const actorRole = n.matchedActor?.role ? String(n.matchedActor.role).replace(/_/g, ' ') : 'Member';

            return (
              <div
                key={n.id}
                onClick={() => handleOpenNotificationTarget(n)}
                className={`group relative overflow-hidden p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3.5 cursor-pointer ${
                  isUnread
                    ? darkMode
                      ? 'bg-[#0D0F17] border-indigo-500/40 shadow-sm hover:border-indigo-400/60'
                      : 'bg-indigo-50/40 border-indigo-200/90 shadow-2xs hover:bg-indigo-50/70'
                    : darkMode
                    ? 'bg-[#090A0F] border-white/8 hover:bg-[#0E1017] hover:border-white/15'
                    : 'bg-white border-slate-200/80 hover:bg-slate-50/80'
                }`}
              >
                {/* Left Unread Indicator Strip */}
                {isUnread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}

                {/* Actor Avatar with Category Corner Badge */}
                <div className="relative shrink-0 mt-0.5">
                  {n.matchedActor ? (
                    <Avatar user={n.matchedActor} size="md" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-500 flex items-center justify-center font-bold text-xs">
                      {actorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border shadow-2xs ${
                      darkMode ? 'bg-[#090A0F] border-white/15' : 'bg-white border-slate-200'
                    }`}
                    title={n.categoryLabel}
                  >
                    {n.isMention ? (
                      <ICON_MAP.ChatBubbleLeftIcon className="w-3 h-3 text-purple-500" />
                    ) : n.isChat ? (
                      <ICON_MAP.UsersIcon className="w-3 h-3 text-sky-500" />
                    ) : n.isTask ? (
                      <ICON_MAP.CheckBadgeIcon className="w-3 h-3 text-indigo-500" />
                    ) : n.isCalendar ? (
                      <ICON_MAP.CalendarIcon className="w-3 h-3 text-cyan-500" />
                    ) : (
                      <ICON_MAP.SparklesIcon className="w-3 h-3 text-amber-500" />
                    )}
                  </span>
                </div>

                {/* Enriched Main Content */}
                <div className="flex-1 min-w-0">
                  {/* Top Metadata Bar: Category + Project + Diff Pill + Timestamp */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${n.categoryColor}`}
                      >
                        {n.categoryLabel}
                      </span>

                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                        {actorName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                        {actorRole}
                      </span>

                      {n.matchedProject && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 truncate max-w-[160px]">
                          <ICON_MAP.FolderIcon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{n.matchedProject.name}</span>
                        </span>
                      )}

                      {n.diffPill && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25">
                          {n.diffPill}
                        </span>
                      )}

                      {n.priority && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            n.priority === 'Critical' || n.priority === 'High'
                              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                          }`}
                        >
                          {n.priority}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                      <span>{relTime}</span>
                      <span className="opacity-50">·</span>
                      <span>{exactTime}</span>
                    </div>
                  </div>

                  {/* Notification Headline & Body */}
                  <h4
                    className={`text-xs sm:text-sm font-bold leading-snug ${
                      isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {n.title || n.type.replace(/_/g, ' ')}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                    {n.message || n.content}
                  </p>
                </div>

                {/* Right Icon-First Quick Action Bar */}
                <div
                  className="flex items-center gap-1 shrink-0 self-center"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenNotificationTarget(n)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      darkMode
                        ? 'bg-white/5 hover:bg-indigo-500/20 border-white/10 text-slate-300 hover:text-indigo-300'
                        : 'bg-slate-100 hover:bg-indigo-50 border-slate-200/80 text-slate-600 hover:text-indigo-600'
                    }`}
                    title={
                      n.isChat
                        ? 'Open Conversation & Reply'
                        : n.isMention
                        ? 'View Mention & Reply'
                        : 'Inspect Target'
                    }
                  >
                    {n.isChat || n.isMention ? (
                      <ICON_MAP.ChatBubbleLeftIcon className="w-4 h-4" />
                    ) : (
                      <ICON_MAP.ArrowRightIcon className="w-4 h-4" />
                    )}
                  </button>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markNotificationAsRead(n.id)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        darkMode
                          ? 'bg-white/5 hover:bg-emerald-500/20 border-white/10 text-slate-400 hover:text-emerald-300'
                          : 'bg-slate-100 hover:bg-emerald-50 border-slate-200/80 text-slate-500 hover:text-emerald-600'
                      }`}
                      title="Mark as read"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
