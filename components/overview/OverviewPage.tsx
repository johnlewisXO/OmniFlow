import React, { useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { MyTasksWidget } from './MyTasksWidget';
import { ProjectStatusWidget } from './ProjectStatusWidget';
import { TeamWorkloadWidget } from './TeamWorkloadWidget';
import { KeyMilestonesWidget } from './KeyMilestonesWidget';
import { ICON_MAP } from '../../constants';
import { TaskStatus } from '../../types';

interface OverviewPageProps {
  showWelcomeMessage?: boolean; 
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ showWelcomeMessage = true }) => {
  const { currentUser, darkMode, projects, tasks, users, currentOrganization } = useAppStore();
  const SparklesIcon = ICON_MAP.SparklesIcon;

  // Global KPIs across organization
  const metrics = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE).length;
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const overallCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { totalProjects, activeProjects, totalTasks, completedTasks, inProgressTasks, overallCompletionRate };
  }, [projects, tasks]);

  if (!currentUser && showWelcomeMessage) { 
    return (
      <div className="p-6 text-center">
        <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading user data or not logged in.</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col p-4 md:p-6 space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      
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
                {currentOrganization?.name || 'Workspace'} · Executive Overview
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {showWelcomeMessage && currentUser ? `Welcome back, ${currentUser.full_name || currentUser.email}` : 'Workspace Performance'}
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-xl leading-relaxed">
              Comprehensive organization throughput, milestone roadmaps, cross-team workload, and sprint delivery velocity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-white/10 text-xs font-semibold text-indigo-200 border border-white/10">
              Role: <span className="text-white font-bold">{currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER'}</span>
            </span>
          </div>
        </div>

        {/* Analytics Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Active Portfolios</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{metrics.activeProjects}</span>
              <span className="text-xs text-indigo-300 font-medium">/ {metrics.totalProjects} total</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Live projects in organization
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Shipped Deliverables</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{metrics.completedTasks}</span>
              <span className="text-xs text-slate-400">tasks done</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              {metrics.inProgressTasks} currently in development
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Organization Velocity</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{metrics.overallCompletionRate}%</span>
              <span className="text-xs text-indigo-300 font-medium">completion</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${metrics.overallCompletionRate}%` }}
              />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Team Capacity</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-300">{users.length}</span>
              <span className="text-xs text-slate-400">members</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Collaborating across pipelines
            </p>
          </div>
        </div>
      </div>

      {/* Row 1: My Tasks & Project Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-shrink-0">
        <MyTasksWidget />
        <ProjectStatusWidget />
      </div>

      {/* Row 2: Team Workload Overview & Key Project Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-shrink-0">
        <TeamWorkloadWidget />
        <KeyMilestonesWidget />
      </div>
    </div>
  );
};
