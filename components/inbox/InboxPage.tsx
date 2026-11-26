import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader, InlineKpiStrip, SegmentedTabs, HairlineCard, StatusDot } from '../shared/EditorialUI';
import { LiquidMetricProgress } from '../charts/EditorialCharts';
import { Button, IconButton } from '../shared/Button';
import { isPriorityNotification, getNotificationCategoryMeta } from '../../utils/notificationPriority';
import { UserRole, normalizeUserRole } from '../../types';

export const InboxPage: React.FC = () => {
  const {
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

  const CheckIcon = ICON_MAP.CheckIcon;
  const TrashIcon = ICON_MAP.TrashIcon;
  const CheckBadgeIcon = ICON_MAP.CheckBadgeIcon;

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'mentions' | 'task_updates' | 'chat'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'priority' | 'all' | 'system'>('priority');

  const normalizedRole = normalizeUserRole(currentUser?.role);

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
        projects.find(p => p.id === targetId || p.id === matchedTask?.projectId) ||
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
      const isTeam = n.entity_type === 'user' || typeStr.includes('ROLE') || typeStr.includes('INVITE') || typeStr.includes('JOIN_REQUEST');
      const isSprint = typeStr.includes('SPRINT') || titleStr.includes('sprint');
      const isPriority = isPriorityNotification(n);
      const categoryMeta = getNotificationCategoryMeta(n);
      const isAdminGov = categoryMeta.label === 'Admin';

      let diffText: string | null = null;
      const arrowMatch = msgStr.match(/([A-Za-z ]+)\s*(?:→|->|to)\s*([A-Za-z ]+)/i);
      if (arrowMatch && arrowMatch[1] && arrowMatch[2] && arrowMatch[1].length < 20 && arrowMatch[2].length < 20) {
        diffText = `${arrowMatch[1].trim()} → ${arrowMatch[2].trim()}`;
      } else if (matchedTask?.status) {
        diffText = String(matchedTask.status).replace('_', ' ');
      }

      const priority =
        matchedTask?.priority || (typeStr.includes('DELETED') || typeStr.includes('OVERDUE') ? 'High' : null);

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
        isAdminGov,
        isPriority,
        categoryLabel: categoryMeta.label,
        categoryTone: categoryMeta.tone,
        diffText,
        priority,
      };
    });
  }, [notifications, tasks, projects, users, currentUser]);

  const priorityCount = useMemo(
    () => enrichedNotifications.filter(n => n.isPriority).length,
    [enrichedNotifications]
  );
  const lowSystemCount = enrichedNotifications.length - priorityCount;

  const baseScopedNotifications = useMemo(() => {
    if (priorityFilter === 'priority') return enrichedNotifications.filter(n => n.isPriority);
    if (priorityFilter === 'system') return enrichedNotifications.filter(n => !n.isPriority);
    return enrichedNotifications;
  }, [enrichedNotifications, priorityFilter]);

  const unreadCount = baseScopedNotifications.filter(n => !n.read).length;
  const mentionsCount = baseScopedNotifications.filter(n => n.isMention).length;
  const taskUpdatesCount = baseScopedNotifications.filter(n => n.isTask).length;
  const chatUpdatesCount = baseScopedNotifications.filter(n => n.isChat).length;
  const readPercentage =
    baseScopedNotifications.length > 0
      ? Math.round(((baseScopedNotifications.length - unreadCount) / baseScopedNotifications.length) * 100)
      : 100;

  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = baseScopedNotifications;
    if (activeTab === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (activeTab === 'mentions') {
      filtered = filtered.filter(n => n.isMention);
    } else if (activeTab === 'task_updates') {
      filtered = filtered.filter(n => n.isTask);
    } else if (activeTab === 'chat') {
      filtered = filtered.filter(n => n.isChat);
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
  }, [baseScopedNotifications, activeTab, searchQuery]);

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
    if (n.isAdminGov && (normalizedRole === UserRole.OWNER || normalizedRole === UserRole.ADMIN)) {
      setActiveView('admin_settings');
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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full text-[var(--text-primary)] space-y-5 animate-fadeIn">
      <PageHeader
        eyebrow="Activity Stream"
        title="Inbox & Notifications"
        subtitle="Priority task updates, @mentions, messages, and governance alerts."
        actions={
          <div className="flex items-center gap-2">
            {lastUndoAction && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => triggerUndo()}
                title={`Undo last action: ${lastUndoAction.label}`}
              >
                <span>↶</span>
                <span className="hidden sm:inline ml-1">Undo</span>
              </Button>
            )}
            {notifications.some(n => !n.read) && (
              <Button
                variant="primary"
                size="sm"
                onClick={markAllNotificationsAsRead}
                title="Mark all unread notifications as read"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </Button>
            )}
            {notifications.length > 0 && (
              <IconButton
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                title="Clear all notifications"
                aria-label="Clear all notifications"
              >
                <TrashIcon className="w-4 h-4 text-[var(--text-muted)] hover:text-rose-500" />
              </IconButton>
            )}
          </div>
        }
      />

      <InlineKpiStrip
        items={[
          {
            id: 'unread',
            label: 'Unread Alerts',
            value: unreadCount,
            sublabel: unreadCount > 0 ? 'Needs triage' : 'Caught up',
            tone: unreadCount > 0 ? 'warning' : 'success',
            onClick: () => setActiveTab('unread'),
          },
          {
            id: 'mentions',
            label: '@Mentions',
            value: mentionsCount,
            sublabel: 'Direct tags',
            tone: 'lime',
            onClick: () => setActiveTab('mentions'),
          },
          {
            id: 'task_diffs',
            label: 'Task Updates',
            value: taskUpdatesCount,
            sublabel: 'Status & assignments',
            tone: 'default',
            onClick: () => setActiveTab('task_updates'),
          },
          {
            id: 'cleared',
            label: 'Inbox Cleared',
            value: `${readPercentage}%`,
            sublabel: `${baseScopedNotifications.length} in view`,
            visual: <LiquidMetricProgress value={readPercentage} tone="lime" compact />,
            onClick: () => setActiveTab('all'),
          },
        ]}
      />

      <HairlineCard padding="sm" className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SegmentedTabs
          value={activeTab}
          onChange={setActiveTab}
          size="sm"
          options={[
            { id: 'all', label: 'All', count: baseScopedNotifications.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'mentions', label: 'Mentions', count: mentionsCount },
            { id: 'task_updates', label: 'Tasks', count: taskUpdatesCount },
            { id: 'chat', label: 'Chat', count: chatUpdatesCount },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs
            value={priorityFilter}
            onChange={setPriorityFilter}
            size="sm"
            options={[
              { id: 'priority', label: 'Priority', count: priorityCount },
              { id: 'all', label: 'All', count: enrichedNotifications.length },
              { id: 'system', label: 'Minor Settings', count: lowSystemCount },
            ]}
          />

          <div className="relative flex-1 sm:w-60">
            <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search actor, task, project..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full search-input !pl-10 !pr-8 !py-1.5 text-xs rounded-full"
            />
            {searchQuery && (
              <IconButton
                variant="ghost"
                size="xs"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                title="Clear search"
                aria-label="Clear search"
              >
                <ICON_MAP.XMarkIcon className="w-3.5 h-3.5" />
              </IconButton>
            )}
          </div>
        </div>
      </HairlineCard>

      <div className="space-y-2.5">
        {filteredAndSortedNotifications.length === 0 ? (
          <HairlineCard className="text-center py-14 border-dashed">
            <CheckBadgeIcon className="w-10 h-10 mx-auto mb-3 text-emerald-600 dark:text-emerald-400 opacity-75" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {searchQuery ? 'No matching activity found' : 'Inbox Zero Achieved'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Try clearing your search or switching category filters.'
                : priorityFilter === 'priority'
                ? 'All priority task, mention, and governance notifications are reviewed.'
                : 'No notifications in this filter.'}
            </p>
          </HairlineCard>
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
                role="button"
                tabIndex={0}
                onClick={() => handleOpenNotificationTarget(n)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenNotificationTarget(n);
                  }
                }}
                className={`group relative overflow-hidden p-4 rounded-2xl border transition-all duration-150 flex items-start gap-3.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  isUnread
                    ? 'bg-[var(--bg-surface)] border-[var(--border-strong)] hover:bg-[var(--bg-surface-subtle)]'
                    : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                }`}
              >
                {isUnread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent-lime)]" />}

                <div className="relative shrink-0 mt-0.5">
                  {n.matchedActor ? (
                    <Avatar user={n.matchedActor} size="md" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[var(--bg-sage)] text-[var(--text-primary)] flex items-center justify-center font-bold text-xs">
                      {actorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 text-[11px] text-[var(--text-secondary)]">
                      <StatusDot
                        tone={n.categoryTone}
                        label={n.categoryLabel}
                        className="font-semibold text-[var(--text-primary)]"
                      />
                      <span className="text-[var(--text-muted)]">·</span>
                      <span className="font-semibold text-[var(--text-primary)] truncate">{actorName}</span>
                      <span className="text-[var(--text-muted)] hidden sm:inline capitalize">({actorRole})</span>
                      {n.matchedProject && (
                        <>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span className="truncate max-w-[160px]">{n.matchedProject.name}</span>
                        </>
                      )}
                      {n.diffText && (
                        <>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span className="font-mono text-[10px] text-[var(--text-primary)] capitalize">
                            {n.diffText}
                          </span>
                        </>
                      )}
                      {n.priority && (
                        <>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span
                            className={`font-semibold uppercase text-[10px] ${
                              n.priority === 'Critical' || n.priority === 'High'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {n.priority}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono tabular-nums shrink-0">
                      <span>{relTime}</span>
                      <span className="opacity-50">·</span>
                      <span>{exactTime}</span>
                    </div>
                  </div>

                  <h4
                    className={`text-xs sm:text-sm font-bold leading-snug ${
                      isUnread ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {n.title || n.type.replace(/_/g, ' ')}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed line-clamp-2">
                    {n.message || n.content}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-center" onClick={e => e.stopPropagation()}>
                  <IconButton
                    variant="glass"
                    size="sm"
                    onClick={() => handleOpenNotificationTarget(n)}
                    aria-label={
                      n.isChat
                        ? 'Open Conversation and Reply'
                        : n.isMention
                        ? 'View Mention and Reply'
                        : 'Inspect Target'
                    }
                    title={
                      n.isChat
                        ? 'Open Conversation & Reply'
                        : n.isMention
                        ? 'View Mention & Reply'
                        : 'Inspect Target'
                    }
                  >
                    {n.isChat || n.isMention ? (
                      <ICON_MAP.ChatBubbleLeftRightIcon className="w-4 h-4" />
                    ) : (
                      <ICON_MAP.ArrowRightIcon className="w-4 h-4" />
                    )}
                  </IconButton>

                  {isUnread && (
                    <IconButton
                      variant="lime"
                      size="sm"
                      onClick={() => markNotificationAsRead(n.id)}
                      aria-label="Mark notification as read"
                      title="Mark as read"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </IconButton>
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
