import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';

export const ProjectsOverviewPage: React.FC = () => {
  const { 
    projects, 
    tasks,
    isLoadingProjects, 
    projectsError, 
    setActiveProject, 
    openCreateProjectModal, 
    darkMode,
    currentOrganization 
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on hold' | 'completed'>('all');

  const FolderIcon = ICON_MAP.FolderIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const SearchIcon = ICON_MAP.SearchIcon;

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  // Analytics Metrics
  const projectMetrics = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'active').length;
    const onHold = projects.filter(p => p.status === 'on hold').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    
    // Calculate average progress
    const avgProgress = total > 0 
      ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / total)
      : 0;

    return { total, active, onHold, completed, avgProgress };
  }, [projects]);

  return (
    <div className={`p-4 md:p-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'} space-y-6`}>
      
      {/* 1. Analytics Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#60a5fa_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 ring-1 ring-blue-400/30">
                <FolderIcon className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-blue-300">
                {currentOrganization?.name || 'Workspace'} · Project Portfolio
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Projects & Portfolios
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Track project delivery pipelines, cross-functional sprints, and milestone health in one unified portfolio view.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateProjectModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all transform active:scale-95 cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          </div>
        </div>

        {/* Analytics Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-700/60">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Projects</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{projectMetrics.total}</span>
              <span className="text-xs text-slate-400">portfolios</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {projectMetrics.active} actively in progress
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Active Delivery</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{projectMetrics.active}</span>
              <span className="text-xs text-slate-400">active</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {projectMetrics.completed} successfully shipped
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Avg Completion</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{projectMetrics.avgProgress}%</span>
              <span className="text-xs text-indigo-300">overall</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-indigo-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${projectMetrics.avgProgress}%` }}
              />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pipeline Health</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-300">{projectMetrics.onHold}</span>
              <span className="text-xs text-slate-400">on hold</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {projectMetrics.active + projectMetrics.completed > 0 ? 'Healthy flow' : 'No activity'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
          {(['all', 'active', 'on hold', 'completed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab === 'all' ? `All (${projects.length})` : tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
          />
          <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoadingProjects && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`p-6 rounded-2xl border shadow-xs animate-pulse ${darkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white/50 border-slate-200/50'}`}>
              <div className="flex items-center mb-4">
                <div className={`w-8 h-8 rounded-lg mr-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                <div className={`h-5 w-32 rounded ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
              </div>
              <div className={`h-4 w-24 rounded mb-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <div className={`h-3 w-full rounded mb-1 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <div className={`h-2 w-full rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'} mt-4`} />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {projectsError && !isLoadingProjects && (
        <div className={`text-center p-6 rounded-2xl ${darkMode ? 'bg-red-900/20 border-red-700/40' : 'bg-red-50 border-red-200'} border shadow-xs`}>
          <ExclamationIcon className="w-12 h-12 mx-auto mb-3 text-red-500" />
          <h2 className="text-lg font-bold text-red-600 dark:text-red-400">Error Loading Projects</h2>
          <p className="text-xs text-red-500 dark:text-red-300 mt-1">{projectsError}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingProjects && !projectsError && filteredProjects.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <FolderIcon className="w-16 h-16 mx-auto mb-3 text-slate-400 opacity-60" />
          <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">
            {searchQuery ? 'No matching projects found' : 'No Projects Found'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery ? 'Try clearing your search query or switching filters.' : 'Get started by creating your first collaborative project workspace.'}
          </p>
          <button
            onClick={openCreateProjectModal}
            className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            Create New Project
          </button>
        </div>
      )}

      {/* 3. Project Cards Grid */}
      {!isLoadingProjects && !projectsError && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map(project => {
            const projectTaskCount = tasks.filter(t => t.projectId === project.id).length;
            const completedCount = tasks.filter(t => t.projectId === project.id && t.status === 'done').length;
            const progress = projectTaskCount > 0 ? Math.round((completedCount / projectTaskCount) * 100) : (project.progress || 0);

            return (
              <div 
                key={project.id} 
                className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 ease-out transform hover:-translate-y-1 hover:shadow-lg
                           ${darkMode ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-blue-500/50' 
                                     : 'bg-white hover:bg-slate-50/80 border-slate-200/90 hover:border-blue-300'} 
                           border shadow-xs flex flex-col justify-between`}
                onClick={() => setActiveProject(project.id)}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
                        <FolderIcon className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-bold truncate text-slate-900 dark:text-white">
                        {project.name}
                      </h3>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md flex-shrink-0 ${
                      project.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                      project.status === 'completed' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {project.status}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    <span>Delivery Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>{projectTaskCount} total tasks</span>
                    <span>{completedCount} shipped</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
