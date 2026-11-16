import React, { useState, useMemo } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { useAppStore } from '../../hooks/useAppStore';
import { Task, TaskPriority, TaskStatus, UserRole, normalizeUserRole } from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import {
  HairlineCard,
  InlineKpiStrip,
  SegmentedTabs,
  SlideOverDrawer,
  StatusDot,
} from '../shared/EditorialUI';
import {
  HatchedActivityHeatmap,
  HeatmapDayCell,
  LiquidHealthDistribution,
  LiquidMetricProgress,
  SlimProgressBar,
} from '../charts/EditorialCharts';
import soundService from '../../services/soundService';

interface TasklyBentoWorkspaceHubProps {
  roleBadgeLabel?: string;
  customSubtitle?: string;
}

export const TasklyBentoWorkspaceHub: React.FC<TasklyBentoWorkspaceHubProps> = () => {
  const {
    currentUser,
    projects,
    tasks,
    myTasks,
    users,
    presences,
    setActiveProject,
    setActiveView,
    openViewTaskModal,
    openModal,
    openCreateProjectModal,
  } = useAppStore();

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const allTasks = tasks.length > 0 ? tasks : myTasks;

  const [focusScope, setFocusScope] = useState<'all' | 'mine' | 'high'>(() =>
    normalizedRole === UserRole.MEMBER ? 'mine' : 'all'
  );

  // Drill-down drawer when clicking heatmap cells or health segments
  const [drillDown, setDrillDown] = useState<{
    title: string;
    subtitle: string;
    items: Task[];
  } | null>(null);

  // Core workspace metrics
  const metrics = useMemo(() => {
    const total = allTasks.length;
    const done = allTasks.filter(t => t.status === TaskStatus.DONE).length;
    const inReview = allTasks.filter(t => t.status === TaskStatus.REVIEW).length;
    const open = total - done;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

    const now = Date.now();
    const overdue = allTasks.filter(t => {
      if (t.status === TaskStatus.DONE) return false;
      const due = t.dueDate || t.due_date;
      return due ? new Date(due).getTime() < now : false;
    }).length;

    const myOpen = currentUser
      ? allTasks.filter(t => t.assignee_id === currentUser.id && t.status !== TaskStatus.DONE).length
      : 0;

    return { total, done, open, inReview, overdue, progressPct, myOpen };
  }, [allTasks, currentUser]);

  // Focus task list (max 6 crisp rows)
  const focusTasks = useMemo(() => {
    const priorityWeight: Record<string, number> = {
      urgent: 4,
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const filtered = allTasks.filter(t => {
      if (t.status === TaskStatus.DONE) return false;
      if (focusScope === 'mine' && currentUser) {
        return t.assignee_id === currentUser.id;
      }
      if (focusScope === 'high') {
        const p = (t.priority || '').toLowerCase();
        return p === 'urgent' || p === 'critical' || p === 'high';
      }
      return true;
    });

    return [...filtered]
      .sort((a, b) => {
        const wa = priorityWeight[(a.priority || '').toLowerCase()] || 0;
        const wb = priorityWeight[(b.priority || '').toLowerCase()] || 0;
        return wb - wa;
      })
      .slice(0, 6);
  }, [allTasks, focusScope, currentUser]);

  // Project health breakdown for LiquidHealthDistribution
  const healthSummary = useMemo(() => {
    if (projects.length === 0) {
      return {
        pct: 100,
        statusLabel: 'Ready',
        onTrack: 0,
        atRisk: 0,
        delayed: 0,
      };
    }

    let onTrack = 0;
    let atRisk = 0;
    let delayed = 0;
    const now = Date.now();

    projects.forEach(p => {
      const pTasks = allTasks.filter(t => t.projectId === p.id);
      const overdueCount = pTasks.filter(t => {
        if (t.status === TaskStatus.DONE) return false;
        const due = t.dueDate || t.due_date;
        return due ? new Date(due).getTime() < now : false;
      }).length;

      if (overdueCount >= 3 || p.status === 'on hold') delayed += 1;
      else if (overdueCount > 0) atRisk += 1;
      else onTrack += 1;
    });

    const pct = Math.round(((onTrack + atRisk * 0.5) / projects.length) * 100);
    const statusLabel = pct >= 75 ? 'Healthy' : pct >= 50 ? 'Attention' : 'At Risk';
    return { pct, statusLabel, onTrack, atRisk, delayed };
  }, [projects, allTasks]);

  // 15-week Activity Heatmap (105 days) mapped from real completed/updated tasks
  const heatmapCells = useMemo<HeatmapDayCell[]>(() => {
    const totalDays = 105; // 15 weeks x 7 days
    const today = startOfDay(new Date());
    const countMap = new Map<string, { count: number; points: number }>();

    allTasks.forEach(t => {
      const refDateStr = t.updated_at || t.created_at;
      if (!refDateStr) return;
      const d = startOfDay(new Date(refDateStr));
      const key = format(d, 'yyyy-MM-dd');
      const existing = countMap.get(key) || { count: 0, points: 0 };
      countMap.set(key, {
        count: existing.count + 1,
        points: existing.points + (t.story_points || 2),
      });
    });

    const list: HeatmapDayCell[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const entry = countMap.get(key) || { count: 0, points: 0 };
      list.push({
        dateKey: key,
        label: format(d, 'MMM d, yyyy'),
        count: entry.count,
        points: entry.points,
      });
    }
    return list;
  }, [allTasks]);

  // Top 4 Active Projects with real completion progress
  const activeProjectsList = useMemo(() => {
    return projects.slice(0, 4).map(p => {
      const pTasks = allTasks.filter(t => t.projectId === p.id);
      const pDone = pTasks.filter(t => t.status === TaskStatus.DONE).length;
      const pct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : p.progress || 0;
      return {
        project: p,
        totalTasks: pTasks.length,
        doneTasks: pDone,
        pct,
      };
    });
  }, [projects, allTasks]);

  const getPriorityTone = (priority?: TaskPriority | string): 'danger' | 'warning' | 'neutral' => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent' || p === 'critical') return 'danger';
    if (p === 'high') return 'warning';
    return 'neutral';
  };

  const getProjectName = (projectId?: string | null) =>
    projects.find(p => p.id === projectId)?.name || 'General';

  return (
    <div className="space-y-5">
      {/* 1. Unified Unboxed Inline KPI Strip */}
      <InlineKpiStrip
        items={[
          {
            id: 'overall',
            label: 'Overall Completion',
            value: `${metrics.progressPct}%`,
            sublabel: `${metrics.done} of ${metrics.total} tasks`,
            visual: <LiquidMetricProgress value={metrics.progressPct} tone="charcoal" compact />,
          },
          {
            id: 'open',
            label: 'Open Tasks',
            value: metrics.open,
            delta: `${metrics.myOpen} mine`,
            tone: 'lime',
            onClick: () => setActiveView('my_tasks_view'),
          },
          {
            id: 'review',
            label: 'In Review',
            value: metrics.inReview,
            sublabel: metrics.overdue > 0 ? `${metrics.overdue} overdue` : 'On schedule',
            tone: metrics.overdue > 0 ? 'danger' : 'success',
          },
          {
            id: 'projects',
            label: 'Active Projects',
            value: projects.length,
            sublabel: `${presences.length} online now`,
            tone: 'default',
            onClick: () => setActiveView('projects_overview'),
          },
        ]}
      />

      {/* 2. Primary 7:5 Asymmetric Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Primary Column (7 cols): My Focus + Activity Heatmap */}
        <div className="xl:col-span-7 space-y-5 min-w-0">
          <HairlineCard padding="none">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">My Focus</h2>
                <span className="text-xs font-mono text-[var(--text-muted)] tabular-nums">
                  {focusTasks.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <SegmentedTabs
                  size="sm"
                  value={focusScope}
                  onChange={setFocusScope}
                  options={[
                    { id: 'all', label: 'All Open' },
                    { id: 'mine', label: 'Assigned' },
                    { id: 'high', label: 'High Priority' },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setActiveView('my_tasks_view')}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer pl-1"
                >
                  View all →
                </button>
              </div>
            </div>

            {focusTasks.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">No open tasks in this view</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Create a new task or switch scope to see upcoming deliverables.
                </p>
                <button
                  type="button"
                  onClick={() => (projects.length > 0 ? openModal() : openCreateProjectModal())}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-xs font-semibold cursor-pointer"
                >
                  <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                  <span>{projects.length > 0 ? 'Add Task' : 'Create Project'}</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {focusTasks.map(task => {
                  const assignee = users.find(u => u.id === task.assignee_id);
                  const dueStr = task.dueDate || task.due_date;
                  const dueLabel = dueStr ? format(new Date(dueStr), 'MMM d') : 'No due date';
                  const pTone = getPriorityTone(task.priority);

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        soundService.play('click_soft');
                        openViewTaskModal(task);
                      }}
                      className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            pTone === 'danger'
                              ? 'bg-rose-600'
                              : pTone === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-[var(--text-muted)]'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate group-hover:underline">
                            {task.title}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] truncate">
                            {getProjectName(task.projectId)} · {task.status.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                          {dueLabel}
                        </span>
                        {assignee && <Avatar user={assignee} size="xs" disableHoverCard />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </HairlineCard>

          <HatchedActivityHeatmap
            cells={heatmapCells}
            title="Delivery Activity"
            onCellClick={cell => {
              const matching = allTasks.filter(t => {
                const ref = t.updated_at || t.created_at;
                return ref && format(startOfDay(new Date(ref)), 'yyyy-MM-dd') === cell.dateKey;
              });
              setDrillDown({
                title: cell.label,
                subtitle: `${matching.length} task updates recorded`,
                items: matching,
              });
            }}
          />
        </div>

        {/* Right Secondary Column (5 cols): Liquid Health Distribution + Active Projects */}
        <div className="xl:col-span-5 space-y-5 min-w-0">
          <LiquidHealthDistribution
            percentage={healthSummary.pct}
            title="Project Health"
            statusLabel={healthSummary.statusLabel}
            segments={[
              { id: 'on_track', label: 'On Track', count: healthSummary.onTrack, tone: 'on_track' },
              { id: 'at_risk', label: 'At Risk', count: healthSummary.atRisk, tone: 'at_risk' },
              { id: 'delayed', label: 'Delayed', count: healthSummary.delayed, tone: 'delayed' },
            ]}
            onSegmentClick={() => setActiveView('projects_overview')}
          />

          <HairlineCard padding="none">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Active Projects</h3>
              <button
                type="button"
                onClick={() => setActiveView('projects_overview')}
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                All projects →
              </button>
            </div>

            {activeProjectsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                No active projects yet. Create one to begin tracking delivery.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {activeProjectsList.map(({ project, totalTasks, doneTasks, pct }) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setActiveProject(project.id);
                      setActiveView('kanban');
                    }}
                    className="w-full px-4 sm:px-5 py-3 text-left hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {project.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusDot
                          tone={pct >= 75 ? 'lime' : pct >= 35 ? 'success' : 'neutral'}
                          label={`${doneTasks}/${totalTasks}`}
                        />
                      </div>
                    </div>
                    <SlimProgressBar value={pct} tone={pct >= 80 ? 'lime' : 'charcoal'} showPercent />
                  </button>
                ))}
              </div>
            )}
          </HairlineCard>
        </div>
      </div>

      {/* Progressive Disclosure: Heatmap Cell Drill-Down Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(drillDown)}
        onClose={() => setDrillDown(null)}
        title={drillDown?.title || 'Activity Detail'}
        subtitle={drillDown?.subtitle}
      >
        {drillDown && drillDown.items.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-6 text-center">
            No task transitions logged on this date.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {drillDown?.items.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setDrillDown(null);
                  openViewTaskModal(t);
                }}
                className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-surface-subtle)] px-2 rounded-xl cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{t.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {getProjectName(t.projectId)} · {t.status.replace(/_/g, ' ')}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[var(--text-secondary)] shrink-0">
                  {t.story_points || 2} pts
                </span>
              </button>
            ))}
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
};
