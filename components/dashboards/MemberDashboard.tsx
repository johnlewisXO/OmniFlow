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
      {/* 1. Sleek 32px Contributor Welcome Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[32px] p-5 sm:p-6 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-full bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                <SparklesIcon className="w-4 h-4 text-amber-300" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                Personal Execution Studio
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {currentUser?.full_name?.split(' ')[0] || 'Contributor'}
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/80 max-w-xl leading-relaxed">
              Manage your sprint tasks, track concentric completion rings, launch 1080p standups, and run your 20:00 focus timer.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-4 py-1.5 rounded-full bg-white/10 text-xs font-semibold text-indigo-200 border border-white/15">
              Role: <span className="text-white font-bold">{currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Unified 32px Taskly & Soft Glass Bento Workspace Hub */}
      <TasklyBentoWorkspaceHub
        roleBadgeLabel={currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER'}
      />

      {/* 3. Recent Team Activity Stream */}
      {recentActivities.length > 0 && (
        <div className={`p-5 sm:p-6 rounded-[32px] border shadow-xs ${darkMode ? 'bg-slate-900/75 border-white/10' : 'bg-white/88 border-white'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-500">
                <ChartBarIcon className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Workspace Activity</h2>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">{recentActivities.length} recent</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentActivities.map(activity => (
              <div
                key={activity.id}
                className="p-3.5 rounded-[24px] bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/[0.07] text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {activity.title || activity.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 line-clamp-2">
                  {activity.message || activity.content}
                </p>
                {activity.entity_id && activity.entity_type === 'task' && (
                  <button
                    onClick={() => openViewTaskModal(activity.entity_id, true)}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-0.5 cursor-pointer block"
                  >
                    Inspect Task →
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
