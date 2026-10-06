import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { formatDistanceToNow } from 'date-fns';

export const InboxPage: React.FC = () => {
  const { 
    darkMode, 
    notifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    clearNotifications,
    openViewTaskModal 
  } = useAppStore();

  const InboxIcon = ICON_MAP.InboxIcon;
  const CheckIcon = ICON_MAP.CheckIcon;
  const TrashIcon = ICON_MAP.TrashIcon;
  const BellIcon = ICON_MAP.SparklesIcon;
  const CheckBadgeIcon = ICON_MAP.CheckBadgeIcon;

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'mentions' | 'task_updates'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = notifications.filter(n => !n.read).length;
  const mentionsCount = notifications.filter(n => n.type === 'MENTION').length;
  const taskUpdatesCount = notifications.filter(n => n.type?.startsWith('TASK_')).length;
  const readPercentage = notifications.length > 0 
    ? Math.round(((notifications.length - unreadCount) / notifications.length) * 100) 
    : 100;

  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = notifications;
    if (activeTab === 'unread') {
      filtered = notifications.filter(n => !n.read);
    } else if (activeTab === 'mentions') {
      filtered = notifications.filter(n => n.type === 'MENTION');
    } else if (activeTab === 'task_updates') {
      filtered = notifications.filter(n => n.type?.startsWith('TASK_'));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.message && n.message.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q))
      );
    }

    // Sort: Unread first, then by date (newest first)
    return [...filtered].sort((a, b) => {
      if (a.read === b.read) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.read ? 1 : -1;
    });
  }, [notifications, activeTab, searchQuery]);

  return (
    <div className={`p-4 md:p-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'} space-y-6`}>
      
      {/* 1. Analytics Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                <InboxIcon className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                Notification Feed & Updates
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Inbox & Alerts
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-xl leading-relaxed">
              Stay up to date with task assignments, collaborator mentions, sprint changes, and system triggers.
            </p>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5">
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsAsRead}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <CheckIcon className="w-4 h-4" />
                <span>Mark All Read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-300 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
              >
                <TrashIcon className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Analytics KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Unread Alerts</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${unreadCount > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                {unreadCount}
              </span>
              <span className="text-xs text-indigo-300 font-medium">pending</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              {unreadCount > 0 ? 'Requires your review' : 'Inbox zero achieved!'}
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Mentions</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{mentionsCount}</span>
              <span className="text-xs text-purple-300 font-medium">direct tags</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Comments where you were mentioned
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Task Updates</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{taskUpdatesCount}</span>
              <span className="text-xs text-blue-300 font-medium">activity logs</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Status changes & assignments
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Inbox Hygiene</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{readPercentage}%</span>
              <span className="text-xs text-emerald-300 font-medium">cleared</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${readPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: `All (${notifications.length})` },
            { id: 'unread', label: `Unread (${unreadCount})` },
            { id: 'mentions', label: `Mentions (${mentionsCount})` },
            { id: 'task_updates', label: `Task Updates (${taskUpdatesCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
          />
          <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* 3. Notifications List */}
      <div className="space-y-3">
        {filteredAndSortedNotifications.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <CheckBadgeIcon className="w-14 h-14 mx-auto mb-3 text-emerald-500/60" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
              {searchQuery ? 'No matching notifications' : 'All caught up!'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'Try clearing your search query.' : 'You have no pending notifications in this view. Enjoy your day!'}
            </p>
          </div>
        ) : (
          filteredAndSortedNotifications.map(notification => {
            const isUnread = !notification.read;
            const isMention = notification.type === 'MENTION';
            const isTaskRelated = notification.entity_type === 'task' || notification.type?.startsWith('TASK_');

            return (
              <div
                key={notification.id}
                className={`p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3.5 ${
                  isUnread
                    ? (darkMode ? 'bg-slate-800 border-indigo-500/40 shadow-xs' : 'bg-indigo-50/50 border-indigo-200 shadow-xs')
                    : (darkMode ? 'bg-slate-800/50 border-slate-700/70 hover:bg-slate-800' : 'bg-white border-slate-200/80 hover:bg-slate-50')
                }`}
              >
                {/* Status Dot / Icon */}
                <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                  isMention ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                  isUnread ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                  'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  {isMention ? (
                    <ICON_MAP.ChatBubbleLeftIcon className="w-4 h-4" />
                  ) : (
                    <ICON_MAP.SparklesIcon className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className={`text-xs font-bold ${isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {notification.title || notification.type.replace(/_/g, ' ')}
                    </h4>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {notification.message || notification.content}
                  </p>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/50 text-xs">
                    {isTaskRelated && notification.entity_id && (
                      <button
                        onClick={() => openViewTaskModal(notification.entity_id, true)}
                        className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Task</span>
                        <ICON_MAP.ArrowRightIcon className="w-3 h-3" />
                      </button>
                    )}

                    {isUnread && (
                      <button
                        onClick={() => markNotificationAsRead(notification.id)}
                        className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
