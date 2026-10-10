import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { TasklyBentoWorkspaceHub } from './TasklyBentoWorkspaceHub';
import { TaskStatus } from '../../types';
import soundService from '../../services/soundService';

export const ClientViewerDashboard: React.FC = () => {
  const { darkMode, projects, tasks, setActiveProject, setActiveView } = useAppStore();
  const EyeIcon = ICON_MAP.EyeIcon || ICON_MAP.InboxIcon;

  const sharedProjects = projects;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[32px] p-5 sm:p-6 shadow-xl border border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold mb-2">
            <EyeIcon className="w-3.5 h-3.5" />
            Stakeholder &amp; Client Portal
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Project Viewer Dashboard</h1>
          <p className="text-xs sm:text-sm text-indigo-200/80 mt-1">
            Live read-only visibility into shared project milestones, concentric completion rings, and upcoming releases.
          </p>
        </div>
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-xs font-bold text-indigo-200 border border-white/15 self-start sm:self-auto">
          VIEWER ACCESS
        </span>
      </div>

      {/* 1. Unified Taskly & Soft Glass Bento Hub at the TOP (Task Overview, Project Status, Meet Schedule & Calendar) */}
      <TasklyBentoWorkspaceHub roleBadgeLabel="CLIENT VIEWER" />

      {/* 2. Shared Projects Bento Portfolio */}
      <div
        className={`p-5 sm:p-6 rounded-[32px] border shadow-xs ${
          darkMode ? 'bg-slate-900/75 border-white/10' : 'bg-white/88 border-white'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <EyeIcon className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Shared Project Portfolio</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Click any project to inspect its board</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            {sharedProjects.length} Active
          </span>
        </div>

        {sharedProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedProjects.map(p => {
              const projTasks = tasks.filter(t => t.projectId === p.id);
              const doneTasks = projTasks.filter(t => t.status === TaskStatus.DONE).length;
              const pct = projTasks.length > 0 ? Math.round((doneTasks / projTasks.length) * 100) : p.progress || 0;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    soundService.play('click_soft');
                    setActiveProject(p.id);
                    setActiveView('kanban');
                  }}
                  className={`p-4 rounded-[24px] border cursor-pointer transition-all hover:-translate-y-0.5 ${
                    darkMode
                      ? 'bg-slate-800/70 border-white/[0.08] hover:border-indigo-500/40'
                      : 'bg-slate-50/90 border-slate-200/70 hover:bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{p.name}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      {pct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                    {p.description || 'Active delivery stream tracked in real time.'}
                  </p>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center rounded-[24px] border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-400">
            No shared projects yet.
          </div>
        )}
      </div>
    </div>
  );
};