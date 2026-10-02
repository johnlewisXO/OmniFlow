import React, { useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { MyTasksWidget } from '../overview/MyTasksWidget'; 
import { ProjectStatusWidget } from '../overview/ProjectStatusWidget'; 
import { ICON_MAP } from '../../constants';
import { TaskStatus, TaskPriority } from '../../types';

export const MemberDashboard: React.FC = () => {
  const { 
    currentUser, 
    darkMode, 
    myTasks, 
    projects, 
    notifications,
    openViewTaskModal 
  } = useAppStore();

  const ChartBarIcon = ICON_MAP.ChartBarIcon;
  const SparklesIcon = ICON_MAP.SparklesIcon;
  const CheckCircleIcon = ICON_MAP.CheckCircleIcon;
  const ClockIcon = ICON_MAP.ClockIcon;

  const completedCount = useMemo(() => 
    myTasks.filter(t => t.status === TaskStatus.DONE).length, 
    [myTasks]
  );
  const activeCount = myTasks.length - completedCount;
  const criticalCount = useMemo(() => 
    myTasks.filter(t => t.priority === TaskPriority.CRITICAL && t.status !== TaskStatus.DONE).length,
    [myTasks]
  );
  const completionRate = myTasks.length > 0 ? Math.round((completedCount / myTasks.length) * 100) : 0;

  // Recent activity stream from notifications and task events
  const recentActivities = useMemo(() => {
    return notifications.slice(0, 6);
  }, [notifications]);

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'} space-y-6`}>
      
      {/* 1. Analytics Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                <SparklesIcon className="w-5 h-5 text-amber-300" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                Workspace Dashboard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {currentUser?.full_name?.split(' ')[0] || 'Contributor'}
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-xl leading-relaxed">
              Here is your daily execution summary, active milestone deliverables, and recent collaboration updates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-semibold text-indigo-200 border border-white/10">
              Role: <span className="text-white font-bold">{currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER'}</span>
            </span>
          </div>
        </div>

        {/* Analytics Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">In-Flight Tasks</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{activeCount}</span>
              <span className="text-xs text-indigo-300 font-medium">active</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Assigned deliverables to complete
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Completed</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{completedCount}</span>
              <span className="text-xs text-slate-400">tasks</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Shipped across projects
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Delivery Rate</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{completionRate}%</span>
              <span className="text-xs text-indigo-300 font-medium">ratio</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Critical Priority</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-rose-400">{criticalCount}</span>
              <span className="text-xs text-slate-400">critical</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Across {projects.length} portfolios
            </p>
          </div>
        </div>
      </div>
      
      {/* 2. Tasks & Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MyTasksWidget /> 
          <ProjectStatusWidget />
        </div>

        {/* 3. Real Live Activity Stream */}
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border shadow-xs ${darkMode ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <ChartBarIcon className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Team Activity</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold">{recentActivities.length} recent</span>
            </div>

            {recentActivities.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl border-slate-200 dark:border-slate-700">
                No recent workspace events logged yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map(activity => (
                  <div 
                    key={activity.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {activity.title || activity.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
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
                        Open Task →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
