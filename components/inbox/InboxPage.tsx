
import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { formatDistanceToNow } from 'date-fns';

export const InboxPage: React.FC = () => {
  const { darkMode, notifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, openViewTaskModal } = useAppStore();
  const InboxIcon = ICON_MAP.InboxIcon;
  const CheckIcon = ICON_MAP.CheckIcon;
  const TrashIcon = ICON_MAP.TrashIcon;

  const [activeTab, setActiveTab] = useState<'all' | 'mentions' | 'task_updates'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = notifications;
    if (activeTab === 'mentions') {
      filtered = notifications.filter(n => n.type === 'MENTION');
    } else if (activeTab === 'task_updates') {
      filtered = notifications.filter(n => n.type?.startsWith('TASK_'));
    }

    // Sort: Unread first, then by date (newest first)
    return [...filtered].sort((a, b) => {
      if (a.read === b.read) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.read ? 1 : -1;
    });
  }, [notifications, activeTab]);

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <InboxIcon className={`w-8 h-8 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
          <h1 className="text-2xl md:text-3xl font-semibold">Inbox</h1>
          {unreadCount > 0 && (
            <span className="ml-3 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="flex space-x-2">
            {unreadCount > 0 && (
              <button 
                onClick={markAllNotificationsAsRead}
                className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
              >
                <CheckIcon className="w-4 h-4 mr-1.5" />
                Mark all read
              </button>
            )}
            <button 
              onClick={clearNotifications}
              className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${darkMode ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-600'}`}
            >
              <TrashIcon className="w-4 h-4 mr-1.5" />
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className={`flex space-x-4 mb-6 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : `border-transparent ${darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('mentions')}
          className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'mentions'
              ? 'border-primary text-primary'
              : `border-transparent ${darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`
          }`}
        >
          Mentions
        </button>
        <button
          onClick={() => setActiveTab('task_updates')}
          className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'task_updates'
              ? 'border-primary text-primary'
              : `border-transparent ${darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`
          }`}
        >
          Task Updates
        </button>
      </div>
      
      {filteredAndSortedNotifications.length === 0 ? (
        <div className={`text-center py-20 p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
          <InboxIcon className={`w-24 h-24 mx-auto mb-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'} opacity-70`} />
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>All Caught Up!</h2>
          <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-2 max-w-md mx-auto`}>
            Your inbox is currently empty. Notifications about mentions, task assignments, and project updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedNotifications.map((notification) => (
            <div 
              key={notification.id} 
              onClick={() => {
                const entityType = notification.entity_type || notification.metadata?.entity_type;
                const entityId = notification.entity_id || notification.metadata?.entity_id;
                
                if (entityType === 'task' && entityId) {
                  openViewTaskModal(entityId);
                  if (!notification.read) {
                    markNotificationAsRead(notification.id);
                  }
                }
              }}
              className={`p-4 rounded-xl border transition-all ${(notification.entity_type === 'task' || notification.metadata?.entity_type === 'task') ? 'cursor-pointer hover:shadow-md' : ''} ${
                !notification.read 
                  ? (darkMode ? 'bg-slate-800 border-primary/30 shadow-sm' : 'bg-white border-primary/20 shadow-sm') 
                  : (darkMode ? 'bg-slate-800/40 border-slate-700/50 opacity-70' : 'bg-slate-50/50 border-slate-200 opacity-70')
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                    )}
                    <h3 className={`font-medium ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {notification.title}
                    </h3>
                  </div>
                  <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'} ml-${!notification.read ? '4' : '0'}`}>
                    {notification.message}
                  </p>
                  <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'} ml-${!notification.read ? '4' : '0'}`}>
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
                
                {!notification.read && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      markNotificationAsRead(notification.id);
                    }}
                    className={`ml-4 p-1.5 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'}`}
                    title="Mark as read"
                  >
                    <CheckIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};