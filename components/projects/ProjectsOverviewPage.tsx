import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import {
  InlineKpiStrip,
  SegmentedTabs,
  HairlineCard,
  LiquidBezelSection,
  LiquidBezelCard,
  StatusDot,
  AnimatedViewStage,
} from '../shared/EditorialUI';
import { LiquidMetricProgress, SlimProgressBar } from '../charts/EditorialCharts';
import { TaskStatus } from '../../types';

export const ProjectsOverviewPage: React.FC = () => {
  const {
    projects,
    tasks,
    isLoadingProjects,
    projectsError,
    setActiveProject,
    setActiveView,
    openCreateProjectModal,
    currentOrganization,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on hold' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const FolderIcon = ICON_MAP.FolderIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const SearchIcon = ICON_MAP.SearchIcon;

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const projectMetrics = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'active').length;
    const onHold = projects.filter(p => p.status === 'on hold').length;
    const completed = projects.filter(p => p.status === 'completed').length;

    const avgProgress =
      total > 0
        ? Math.round(
            projects.reduce((acc, p) => {
              const pTasks = tasks.filter(t => t.projectId === p.id);
              const done = pTasks.filter(t => t.status === TaskStatus.DONE).length;
              const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : p.progress || 0;
              return acc + pct;
            }, 0) / total
          )
        : 0;

    return { total, active, onHold, completed, avgProgress };
  }, [projects, tasks]);

  const openProjectBoard = (projectId: string) => {
    setActiveProject(projectId);
    setActiveView('kanban');
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
      <LiquidBezelSection
        eyebrow={`${currentOrganization?.name || 'Workspace'} · Portfolio`}
        title="Projects"
        subtitle="Active delivery streams, velocity, and ownership."
        icon={<FolderIcon className="w-4 h-4" />}
        bezelRight={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setActiveView('ai_copilot_view')}>
              <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
              AI Planner
            </Button>
            <Button variant="lime" size="sm" onClick={openCreateProjectModal}>
              <PlusIcon className="w-3.5 h-3.5" />
              New Project
            </Button>
          </div>
        }
        bodyClassName="p-4 sm:p-5"
      >
        <InlineKpiStrip
          items={[
            {
              id: 'total',
              label: 'Total Projects',
              value: projectMetrics.total,
              sublabel: `${projectMetrics.completed} completed`,
              tone: 'default',
              onClick: () => setStatusFilter('all'),
            },
            {
              id: 'active',
              label: 'Active Streams',
              value: projectMetrics.active,
              sublabel: 'Currently executing',
              tone: 'success',
              onClick: () => setStatusFilter('active'),
            },
            {
              id: 'avg-progress',
              label: 'Portfolio Progress',
              value: `${projectMetrics.avgProgress}%`,
              sublabel: 'Average completion',
              visual: (
                <LiquidMetricProgress
                  value={projectMetrics.avgProgress}
                  tone="lime"
                  compact
                />
              ),
            },
            {
              id: 'paused',
              label: 'On Hold',
              value: projectMetrics.onHold,
              sublabel: projectMetrics.onHold === 0 ? 'All streams active' : 'Needs review',
              tone: projectMetrics.onHold > 0 ? 'warning' : 'default',
              onClick: () => setStatusFilter('on hold'),
            },
          ]}
        />
      </LiquidBezelSection>

      {/* Unified Filter + View Mode Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <SegmentedTabs
          size="sm"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { id: 'all', label: 'All', count: projects.length },
            { id: 'active', label: 'Active', count: projectMetrics.active },
            { id: 'on hold', label: 'On Hold', count: projectMetrics.onHold },
            { id: 'completed', label: 'Completed', count: projectMetrics.completed },
          ]}
        />

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <SearchIcon className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full search-input !pl-9 !pr-4 !py-1.5 text-xs !rounded-full"
            />
          </div>

          <SegmentedTabs
            size="sm"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { id: 'table', label: 'Table' },
              { id: 'cards', label: 'Cards' },
            ]}
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoadingProjects && (
        <HairlineCard padding="lg" className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 rounded-xl bg-[var(--bg-sage)]" />
          ))}
        </HairlineCard>
      )}

      {/* Error State */}
      {projectsError && !isLoadingProjects && (
        <HairlineCard padding="lg" className="text-center border-rose-500/30">
          <ExclamationIcon className="w-10 h-10 mx-auto mb-2 text-rose-500" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Unable to Load Projects</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{projectsError}</p>
        </HairlineCard>
      )}

      {/* Empty State */}
      {!isLoadingProjects && !projectsError && filteredProjects.length === 0 && (
        <HairlineCard padding="lg" className="text-center py-14 border-dashed">
          <FolderIcon className="w-10 h-10 mx-auto mb-2.5 text-[var(--text-muted)]" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            {searchQuery ? 'No matching projects found' : 'No projects yet'}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try clearing your search query or switching status filters.'
              : 'Create your first collaborative workspace project to begin tracking tasks and sprints.'}
          </p>
          <Button variant="primary" size="sm" onClick={openCreateProjectModal} className="mt-4">
            <PlusIcon className="w-3.5 h-3.5" />
            New Project
          </Button>
        </HairlineCard>
      )}

      {/* Table / Cards View with Smooth View Mode Transition */}
      {!isLoadingProjects && !projectsError && filteredProjects.length > 0 && (
        <AnimatedViewStage viewKey={viewMode}>
          {viewMode === 'table' ? (
            <HairlineCard padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-surface-subtle)]">
                      <th className="py-3 px-5">Project Name</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 w-56">Progress</th>
                      <th className="py-3 px-4">Tasks</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {filteredProjects.map(project => {
                      const projectTasks = tasks.filter(t => t.projectId === project.id);
                      const completedCount = projectTasks.filter(t => t.status === TaskStatus.DONE).length;
                      const progress =
                        projectTasks.length > 0
                          ? Math.round((completedCount / projectTasks.length) * 100)
                          : project.progress || 0;
                      const statusTone =
                        project.status === 'completed'
                          ? 'success'
                          : project.status === 'on hold'
                          ? 'warning'
                          : 'lime';

                      return (
                        <tr
                          key={project.id}
                          onClick={() => openProjectBoard(project.id)}
                          className="hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-8 h-8 rounded-xl bg-[var(--bg-sage)] flex items-center justify-center shrink-0">
                                <FolderIcon className="w-4 h-4 text-[var(--text-primary)]" />
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-[var(--text-primary)] truncate group-hover:underline">
                                  {project.name}
                                </p>
                                {project.description && (
                                  <p className="text-[11px] text-[var(--text-muted)] truncate max-w-md">
                                    {project.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 capitalize">
                            <StatusDot tone={statusTone} label={project.status || 'active'} />
                          </td>
                          <td className="py-3.5 px-4">
                            <SlimProgressBar
                              value={progress}
                              tone={progress >= 90 ? 'sage' : 'charcoal'}
                              showPercent
                            />
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-[var(--text-secondary)]">
                            {completedCount} / {projectTasks.length}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:underline">
                              Open →
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </HairlineCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(project => {
                const projectTasks = tasks.filter(t => t.projectId === project.id);
                const completedCount = projectTasks.filter(t => t.status === TaskStatus.DONE).length;
                const progress =
                  projectTasks.length > 0
                    ? Math.round((completedCount / projectTasks.length) * 100)
                    : project.progress || 0;
                const statusTone =
                  project.status === 'completed'
                    ? 'success'
                    : project.status === 'on hold'
                    ? 'warning'
                    : 'lime';

                return (
                  <LiquidBezelCard
                    key={project.id}
                    interactive
                    className="hover:border-[var(--border-strong)] transition-all group"
                    cornerLabel={
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            statusTone === 'success'
                              ? 'bg-emerald-400'
                              : statusTone === 'warning'
                                ? 'bg-amber-400'
                                : 'bg-[var(--accent-lime)]'
                          }`}
                        />
                        <span>{project.status || 'active'}</span>
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => openProjectBoard(project.id)}
                      className="text-left flex flex-col justify-between gap-4 w-full flex-1 cursor-pointer"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-[var(--bg-sage)] flex items-center justify-center shrink-0">
                              <FolderIcon className="w-4 h-4 text-[var(--text-primary)]" />
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:underline">
                                {project.name}
                              </h3>
                              <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                                {projectTasks.length} tasks
                              </span>
                            </div>
                          </div>
                          <div className="w-24 shrink-0 pt-1">
                            <LiquidMetricProgress
                              value={progress}
                              tone={progress >= 90 ? 'success' : 'lime'}
                            />
                          </div>
                        </div>

                        {project.description && (
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                            {project.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2">
                        <SlimProgressBar value={progress} tone={progress >= 90 ? 'sage' : 'charcoal'} showPercent />
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                          <span>{completedCount} completed</span>
                          <span className="font-sans font-semibold text-[var(--text-primary)] group-hover:underline">
                            Open →
                          </span>
                        </div>
                      </div>
                    </button>
                  </LiquidBezelCard>
                );
              })}
            </div>
          )}
        </AnimatedViewStage>
      )}
    </div>
  );
};
