import React, { useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { TasklyBentoWorkspaceHub } from './TasklyBentoWorkspaceHub';
import { ICON_MAP } from '../../constants';

export const MemberDashboard: React.FC = () => {
  const { 
    currentUser, 
    darkMode, 
    notifications,
    openViewTaskModal 
  } = useAppStore();

  const ChartBarIcon = ICON_MAP.ChartBarIcon;
  const SparklesIcon = ICON_MAP.SparklesIcon;

  const recentActivities = useMemo(() => {
    return notifications.slice(0, 4);
  }, [notifications]);

  return (
    <div className={`p-4 md:p-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'} space-y-6`}>
      {/* 1. Contributor Welcome Header (Ultra-sheer frosted glass) */}
      <div className="glass-panel bg-white/20 dark:bg-slate-900/35 backdrop-blur-2xl text-slate-800 dark:text-white rounded-[20px] p-5 sm:p-6 shadow-xl border border-white/35 dark:border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-[20px] bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-400/30">
                <SparklesIcon className="w-4 h-4 text-amber-500 dark:text-amber-300" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-300">
                Workspace
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Welcome back, {currentUser?.full_name?.split(' ')[0] || 'Teammate'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Manage your tasks, track daily progress, connect with your team, and stay focused on what matters today.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-[20px] bg-white/30 dark:bg-white/10 text-xs font-semibold text-slate-800 dark:text-indigo-200 border border-white/35 dark:border-white/15 backdrop-blur-md">
              Role: <span className="font-bold">{currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Unified Taskly & Soft Glass Bento Workspace Hub */}
      <TasklyBentoWorkspaceHub
        roleBadgeLabel={currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER'}
      />

      {/* 3. Recent Team Activity Stream (Ultra-sheer frosted glass) */}
      {recentActivities.length > 0 && (
        <div className={`p-5 sm:p-6 rounded-[20px] border shadow-xs backdrop-blur-2xl ${darkMode ? 'bg-slate-900/35 border-white/10' : 'bg-white/25 border-white/40'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-[20px] bg-indigo-500/15 text-indigo-500">
                <ChartBarIcon className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Team Activity</h2>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{recentActivities.length} recent</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentActivities.map(activity => (
              <div
                key={activity.id}
                className="p-3.5 rounded-[20px] bg-white/30 dark:bg-slate-800/40 border border-white/40 dark:border-white/10 backdrop-blur-md text-xs space-y-1.5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {activity.title || activity.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                  {activity.message || activity.content}
                </p>
                {activity.entity_id && activity.entity_type === 'task' && (
                  <button
                    onClick={() => openViewTaskModal(activity.entity_id, true)}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-0.5 cursor-pointer block"
                  >
                    View Task →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
