import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { TaskStatus, TaskPriority } from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { TaskLivePresenceBadge } from '../shared/TaskLivePresenceBadge';
import { collabService } from '../../services/collabService';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';
import {
  InlineKpiStrip,
  SegmentedTabs,
  HairlineCard,
  LiquidBezelSection,
  StatusDot,
} from '../shared/EditorialUI';
import { LiquidMetricProgress, SlimProgressBar } from '../charts/EditorialCharts';

export const SprintPlanningView: React.FC = () => {
  const {
    activeProject,
    projects,
    tasks,
    sprints,
    users,
    createSprint,
    deleteSprint,
    startSprint,
    completeSprint,
    assignTaskToSprint,
    updateTask,
    openViewTaskModal,
    openModal,
    currentUser,
    currentOrganization,
    presences,
    fetchAllTasksForAllProjects,
    fetchTasksForProject,
  } = useAppStore();

  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>(activeProject?.id || 'all');
  const [targetProjectId, setTargetProjectId] = useState<string>(activeProject?.id || 'all');
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sprintViewTab, setSprintViewTab] = useState<'all' | 'active' | 'planned' | 'completed'>('all');
  const [backlogFilterMode, setBacklogFilterMode] = useState<'backlog_only' | 'all_tasks'>('backlog_only');

  const defaultSprintDuration =
    currentOrganization?.defaultSprintDurationDays ||
    (currentOrganization as any)?.default_sprint_duration_days ||
    14;

  // Whenever project scope changes, load tasks for that project or all workspace tasks
  useEffect(() => {
    if (selectedProjectFilter === 'all') {
      fetchAllTasksForAllProjects();
    } else {
      fetchTasksForProject(selectedProjectFilter);
    }
  }, [selectedProjectFilter]);

  const getProjectName = (projId?: string | null) => {
    if (!projId || projId === 'all') return 'Cross-Project';
    return projects.find(p => p.id === projId)?.name || 'Project';
  };

  // Filter sprints for selected project or cross-project view
  const visibleSprints = useMemo(() => {
    if (selectedProjectFilter === 'all') return sprints;
    return sprints.filter(s => !s.projectId || s.projectId === 'all' || s.projectId === selectedProjectFilter);
  }, [sprints, selectedProjectFilter]);

  const activeSprint = useMemo(() => visibleSprints.find(s => s.status === 'active') || null, [visibleSprints]);
  const plannedSprints = useMemo(() => visibleSprints.filter(s => s.status === 'planned'), [visibleSprints]);
  const completedSprints = useMemo(() => visibleSprints.filter(s => s.status === 'completed'), [visibleSprints]);

  // Tasks eligible for backlog display based on current project filter
  const eligibleTasks = useMemo(() => {
    if (selectedProjectFilter === 'all') return tasks;
    return tasks.filter(t => t.projectId === selectedProjectFilter || (t as any).project_id === selectedProjectFilter);
  }, [tasks, selectedProjectFilter]);

  // Tasks displayed in backlog column: either unassigned backlog items or all tasks in selected scope
  const backlogTasks = useMemo(() => {
    return eligibleTasks.filter(t => {
      const matchesSearch =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      if (!matchesSearch || !matchesPriority) return false;

      if (backlogFilterMode === 'all_tasks') return true;

      const isUnassignedToSprint = !t.sprintId || !sprints.some(s => s.id === t.sprintId && s.status !== 'completed');
      return isUnassignedToSprint;
    });
  }, [eligibleTasks, searchQuery, priorityFilter, sprints, backlogFilterMode]);

  const getSprintStats = (sprintId: string) => {
    const sprintTasks = tasks.filter(t => t.sprintId === sprintId);
    const total = sprintTasks.length;
    const done = sprintTasks.filter(t => t.status === TaskStatus.DONE).length;
    const inProgress = sprintTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const totalPoints = sprintTasks.reduce((acc, t) => acc + (t.story_points || 1), 0);
    const completedPoints = sprintTasks
      .filter(t => t.status === TaskStatus.DONE)
      .reduce((acc, t) => acc + (t.story_points || 1), 0);
    const remainingPoints = totalPoints - completedPoints;
    const percent = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    return { total, done, inProgress, totalPoints, completedPoints, remainingPoints, percent, tasks: sprintTasks };
  };

  const backlogAnalytics = useMemo(() => {
    const unassignedTasks = eligibleTasks.filter(
      t => !t.sprintId || !sprints.some(s => s.id === t.sprintId && s.status !== 'completed')
    );
    const totalBacklogPoints = unassignedTasks.reduce((acc, t) => acc + (t.story_points || 1), 0);
    const estimatedTasks = unassignedTasks.filter(t => t.story_points !== undefined).length;
    const groomingPercentage =
      unassignedTasks.length > 0 ? Math.round((estimatedTasks / unassignedTasks.length) * 100) : 100;
    const activeStats = activeSprint ? getSprintStats(activeSprint.id) : null;

    return {
      totalBacklogTasks: unassignedTasks.length,
      totalBacklogPoints,
      groomingPercentage,
      activeSprintStats: activeStats,
      totalSprints: visibleSprints.length,
    };
  }, [eligibleTasks, activeSprint, visibleSprints, sprints, tasks]);

  const handleOpenCreateSprint = () => {
    const today = new Date();
    const startStr = today.toISOString().split('T')[0];
    const end = new Date(today.getTime() + defaultSprintDuration * 24 * 60 * 60 * 1000);
    const endStr = end.toISOString().split('T')[0];
    setTargetProjectId(selectedProjectFilter);
    setStartDate(startStr);
    setEndDate(endStr);
    setIsCreateSprintOpen(true);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val) {
      const d = new Date(val);
      d.setDate(d.getDate() + defaultSprintDuration);
      setEndDate(d.toISOString().split('T')[0]);
    }
  };

  const handleCreateSprintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim()) return;

    const start = startDate || new Date().toISOString().split('T')[0];
    const end =
      endDate || new Date(Date.now() + defaultSprintDuration * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await createSprint({
      projectId: targetProjectId || 'all',
      projectName: getProjectName(targetProjectId),
      name: sprintName.trim(),
      goal: sprintGoal.trim() || undefined,
      status: 'planned',
      startDate: start,
      endDate: end,
    });

    setSprintName('');
    setSprintGoal('');
    setStartDate('');
    setEndDate('');
    setIsCreateSprintOpen(false);
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => (prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]));
  };

  const selectAllBacklog = () => {
    if (selectedTaskIds.length === backlogTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(backlogTasks.map(t => t.id));
    }
  };

  const handleBatchMove = async (targetSprintId: string | null) => {
    if (selectedTaskIds.length === 0) return;
    for (const taskId of selectedTaskIds) {
      await assignTaskToSprint(taskId, targetSprintId);
    }
    setSelectedTaskIds([]);
  };

  const activeVelocityPct = backlogAnalytics.activeSprintStats?.percent || 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5 pb-12">
      <LiquidBezelSection
        eyebrow="Agile Iteration & Backlog Center"
        title="Sprint Planning & Backlog"
        subtitle={`Scope: ${
          selectedProjectFilter === 'all' ? 'All Workspace Projects' : getProjectName(selectedProjectFilter)
        }`}
        icon={<ICON_MAP.RocketLaunchIcon className="w-4 h-4" />}
        bezelRight={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-xs">
              <span className="text-[var(--text-muted)] font-medium">Scope:</span>
              <select
                value={selectedProjectFilter}
                onChange={e => setSelectedProjectFilter(e.target.value)}
                aria-label="Filter sprints and backlog by project scope"
                className="!w-auto !p-0 !border-0 !bg-transparent !shadow-none outline-none cursor-pointer font-semibold text-xs text-[var(--text-primary)]"
              >
                <option value="all">All Projects (Workspace)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="lime" size="sm" onClick={handleOpenCreateSprint}>
              <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
              New Sprint
            </Button>
          </div>
        }
        bodyClassName="p-4 sm:p-5"
      >
        <InlineKpiStrip
          items={[
            {
              id: 'velocity',
              label: 'Active Velocity',
              value: `${backlogAnalytics.activeSprintStats?.completedPoints || 0}/${backlogAnalytics.activeSprintStats?.totalPoints || 0}p`,
              sublabel: activeSprint ? activeSprint.name : 'No active cycle',
              visual: <LiquidMetricProgress value={activeVelocityPct} tone="lime" compact />,
            },
            {
              id: 'backlog-depth',
              label: 'Unassigned Backlog',
              value: backlogAnalytics.totalBacklogTasks,
              sublabel: `${backlogAnalytics.totalBacklogPoints} story pts ready`,
              tone: 'default',
            },
            {
              id: 'grooming',
              label: 'Estimation Coverage',
              value: `${backlogAnalytics.groomingPercentage}%`,
              sublabel: 'Fibonacci sized',
              tone: 'success',
            },
            {
              id: 'cadence',
              label: 'Sprint Cadence',
              value: `${defaultSprintDuration}d`,
              sublabel: `${plannedSprints.length} planned · ${completedSprints.length} done`,
              tone: 'lime',
            },
          ]}
        />
      </LiquidBezelSection>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Sprints (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <SegmentedTabs
              size="sm"
              value={sprintViewTab}
              onChange={setSprintViewTab}
              options={[
                { id: 'all', label: 'All Cycles', count: visibleSprints.length },
                { id: 'active', label: 'Active', count: activeSprint ? 1 : 0 },
                { id: 'planned', label: 'Planned', count: plannedSprints.length },
                { id: 'completed', label: 'Completed', count: completedSprints.length },
              ]}
            />
          </div>

          {/* Active Sprint Section */}
          {(sprintViewTab === 'all' || sprintViewTab === 'active') &&
            (activeSprint ? (
              (() => {
                const stats = getSprintStats(activeSprint.id);
                return (
                  <HairlineCard padding="lg" className="border-[var(--text-primary)]/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <StatusDot tone="lime" label="Active Sprint" />
                          <span className="text-[var(--text-muted)]">·</span>
                          <span className="font-medium text-[var(--text-secondary)]">
                            {getProjectName(activeSprint.projectId)}
                          </span>
                          {activeSprint.startDate && activeSprint.endDate && (
                            <>
                              <span className="text-[var(--text-muted)]">·</span>
                              <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                                {activeSprint.startDate} → {activeSprint.endDate}
                              </span>
                            </>
                          )}
                        </div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">{activeSprint.name}</h2>
                        {activeSprint.goal && (
                          <p className="text-xs text-[var(--text-secondary)]">{activeSprint.goal}</p>
                        )}
                      </div>

                      <Button
                        variant="lime"
                        size="sm"
                        onClick={() => completeSprint(activeSprint.id)}
                        className="shrink-0"
                      >
                        <ICON_MAP.CheckCircleIcon className="w-3.5 h-3.5" />
                        Complete Sprint
                      </Button>
                    </div>

                    <div className="editorial-surface-subtle p-3.5 space-y-2.5">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Committed</p>
                          <p className="text-sm font-bold font-mono tabular-nums text-[var(--text-primary)]">
                            {stats.totalPoints}p
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Done</p>
                          <p className="text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                            {stats.completedPoints}p
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Remaining</p>
                          <p className="text-sm font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
                            {stats.remainingPoints}p
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Progress</p>
                          <p className="text-sm font-bold font-mono tabular-nums text-[var(--text-primary)]">
                            {stats.percent}%
                          </p>
                        </div>
                      </div>
                      <SlimProgressBar value={stats.percent} tone={stats.percent >= 80 ? 'sage' : 'charcoal'} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                        <span>Tasks in Sprint ({stats.tasks.length})</span>
                        <span className="font-mono tabular-nums">
                          {stats.done}/{stats.total} completed
                        </span>
                      </div>

                      {stats.tasks.length === 0 ? (
                        <div className="p-6 text-center rounded-xl border border-dashed border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                          No tasks committed yet. Assign tasks from the Product Backlog panel.
                        </div>
                      ) : (
                        <div className="divide-y divide-[var(--border-hairline)] border border-[var(--border-hairline)] rounded-xl overflow-hidden">
                          {stats.tasks.map(task => {
                            const taskAssignee = users.find(u => u.id === task.assignee_id);
                            const activeParticipants = presences.filter(
                              p =>
                                p.currentTaskId === task.id &&
                                p.userId !== currentUser?.id &&
                                (!p.sessionId || p.sessionId !== collabService.sessionId)
                            );
                            const isBusy = activeParticipants.length > 0;
                            return (
                              <div
                                key={task.id}
                                className={`flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                                  isBusy ? 'ring-1 ring-inset ring-emerald-500/40' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      task.status === TaskStatus.DONE
                                        ? 'bg-emerald-600'
                                        : task.status === TaskStatus.IN_PROGRESS
                                        ? 'bg-[var(--accent-lime)] ring-1 ring-[var(--accent-ink)]/20'
                                        : task.status === TaskStatus.REVIEW
                                        ? 'bg-amber-500'
                                        : 'bg-[var(--text-muted)]'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => openViewTaskModal(task.id)}
                                    className="text-xs font-medium text-[var(--text-primary)] hover:underline truncate text-left cursor-pointer"
                                  >
                                    {task.title}
                                  </button>
                                  {task.projectId && selectedProjectFilter === 'all' && (
                                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                                      · {getProjectName(task.projectId)}
                                    </span>
                                  )}
                                  <TaskLivePresenceBadge taskId={task.id} compact />
                                </div>

                                <div className="flex items-center gap-2.5 ml-3 shrink-0">
                                  <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                                    {task.story_points || 1}p
                                  </span>
                                  {taskAssignee && <Avatar user={taskAssignee} size="xs" />}
                                  <button
                                    type="button"
                                    onClick={() => assignTaskToSprint(task.id, null)}
                                    title="Return task to Backlog"
                                    className="text-[11px] font-medium text-[var(--text-muted)] hover:text-rose-600 cursor-pointer"
                                  >
                                    Backlog
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </HairlineCard>
                );
              })()
            ) : (
              <HairlineCard padding="lg" className="text-center border-dashed space-y-2">
                <ICON_MAP.PlayIcon className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">No Active Sprint</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  Start one of your planned sprints below or create a new sprint cycle.
                </p>
              </HairlineCard>
            ))}

          {/* Planned Sprints List */}
          {(sprintViewTab === 'all' || sprintViewTab === 'planned') && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Planned Sprints ({plannedSprints.length})
              </h2>

              {plannedSprints.length === 0 ? (
                <HairlineCard padding="md" className="text-center text-xs text-[var(--text-muted)]">
                  No upcoming planned sprints.
                </HairlineCard>
              ) : (
                plannedSprints.map(sprint => {
                  const stats = getSprintStats(sprint.id);
                  return (
                    <HairlineCard key={sprint.id} padding="md" className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--text-muted)]">
                            <StatusDot tone="neutral" label="Planned" />
                            <span>·</span>
                            <span>{getProjectName(sprint.projectId)}</span>
                            {sprint.startDate && sprint.endDate && (
                              <>
                                <span>·</span>
                                <span className="font-mono tabular-nums">
                                  {sprint.startDate} → {sprint.endDate}
                                </span>
                              </>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)] mt-1">{sprint.name}</h3>
                          {sprint.goal && (
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sprint.goal}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button variant="primary" size="sm" onClick={() => startSprint(sprint.id)}>
                            Start Sprint
                          </Button>
                          <button
                            type="button"
                            onClick={() => deleteSprint(sprint.id)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Sprint"
                          >
                            <ICON_MAP.TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-hairline)] font-mono tabular-nums">
                        <span>{stats.tasks.length} tasks committed</span>
                        <span className="font-semibold text-[var(--text-primary)]">{stats.totalPoints} pts</span>
                      </div>

                      {stats.tasks.length > 0 && (
                        <div className="divide-y divide-[var(--border-hairline)] border border-[var(--border-hairline)] rounded-xl overflow-hidden">
                          {stats.tasks.map(t => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between px-3 py-2 bg-[var(--bg-surface-subtle)] text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => openViewTaskModal(t.id)}
                                  className="font-medium text-[var(--text-primary)] hover:underline truncate text-left cursor-pointer"
                                >
                                  {t.title}
                                </button>
                                {t.projectId && selectedProjectFilter === 'all' && (
                                  <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                                    · {getProjectName(t.projectId)}
                                  </span>
                                )}
                                <TaskLivePresenceBadge taskId={t.id} compact />
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0 ml-2">
                                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                                  {t.story_points || 1}p
                                </span>
                                <button
                                  type="button"
                                  onClick={() => assignTaskToSprint(t.id, null)}
                                  className="text-[11px] text-[var(--text-muted)] hover:text-rose-600 cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </HairlineCard>
                  );
                })
              )}
            </div>
          )}

          {/* Completed Sprints */}
          {(sprintViewTab === 'all' || sprintViewTab === 'completed') && completedSprints.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Completed Sprints ({completedSprints.length})
              </h2>
              {completedSprints.map(sprint => {
                const stats = getSprintStats(sprint.id);
                return (
                  <HairlineCard key={sprint.id} padding="sm" className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <StatusDot tone="success" label="Completed" />
                        <span className="font-semibold text-[var(--text-primary)] truncate">{sprint.name}</span>
                      </div>
                      <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                        {getProjectName(sprint.projectId)} · {sprint.startDate} → {sprint.endDate}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold text-[var(--text-secondary)] shrink-0">
                      {stats.completedPoints}/{stats.totalPoints} pts
                    </span>
                  </HairlineCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Product Backlog (5 cols) */}
        <div className="lg:col-span-5">
          <HairlineCard padding="md" className="space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">Product Backlog</h2>
                  <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                    {backlogTasks.length}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {backlogFilterMode === 'all_tasks'
                    ? `All ${eligibleTasks.length} tasks in ${
                        selectedProjectFilter === 'all' ? 'all projects' : getProjectName(selectedProjectFilter)
                      }`
                    : `${backlogAnalytics.totalBacklogPoints} story points unassigned`}
                </p>
              </div>

              <Button variant="primary" size="sm" onClick={() => openModal()}>
                <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                Add Task
              </Button>
            </div>

            {/* Scope View Toggle: Unassigned Backlog vs All Tasks */}
            <SegmentedTabs
              size="sm"
              value={backlogFilterMode}
              onChange={setBacklogFilterMode}
              className="w-full"
              options={[
                { id: 'backlog_only', label: 'Unassigned Backlog' },
                { id: 'all_tasks', label: 'All Tasks in Scope', count: eligibleTasks.length },
              ]}
            />

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full search-input !pl-9 !pr-4 !py-1.5 text-xs !rounded-full"
                />
              </div>

              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="text-xs rounded-full border px-3 py-1.5 cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value={TaskPriority.CRITICAL}>Critical</option>
                <option value={TaskPriority.HIGH}>High</option>
                <option value={TaskPriority.MEDIUM}>Medium</option>
                <option value={TaskPriority.LOW}>Low</option>
              </select>
            </div>

            {/* Batch Action Bar */}
            {backlogTasks.length > 0 && (
              <div className="editorial-surface-subtle flex items-center justify-between px-3 py-2 text-xs gap-2 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--text-primary)] select-none">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.length === backlogTasks.length && backlogTasks.length > 0}
                    onChange={selectAllBacklog}
                    className="w-3.5 h-3.5 rounded accent-[var(--accent-cta)] cursor-pointer"
                  />
                  <span>
                    Select All ({selectedTaskIds.length}/{backlogTasks.length})
                  </span>
                </label>

                {selectedTaskIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {activeSprint && (
                      <Button variant="lime" size="sm" onClick={() => handleBatchMove(activeSprint.id)}>
                        + Active ({selectedTaskIds.length})
                      </Button>
                    )}
                    {plannedSprints.length > 0 && (
                      <select
                        onChange={e => {
                          if (e.target.value) handleBatchMove(e.target.value);
                        }}
                        defaultValue=""
                        className="text-[11px] font-semibold rounded-full border px-2.5 py-1 cursor-pointer"
                      >
                        <option value="" disabled>
                          Move {selectedTaskIds.length} to...
                        </option>
                        {plannedSprints.map(ps => (
                          <option key={ps.id} value={ps.id}>
                            {ps.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Backlog Items List */}
            <div className="space-y-2.5 max-h-[680px] overflow-y-auto scrollbar-thin pr-0.5">
              {backlogTasks.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  {searchQuery
                    ? 'No tasks match your search filter.'
                    : 'No tasks in this scope. Click "Add Task" above to create items.'}
                </div>
              ) : (
                backlogTasks.map(task => {
                  const taskAssignee = users.find(u => u.id === task.assignee_id);
                  const isSelected = selectedTaskIds.includes(task.id);
                  const assignedSprint = task.sprintId ? sprints.find(s => s.id === task.sprintId) : null;

                  return (
                    <div
                      key={task.id}
                      className={`glass-interactive-card p-3.5 rounded-xl border space-y-2 ${
                        isSelected
                          ? 'bg-[var(--bg-sage)] border-[var(--text-primary)]'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="mt-0.5 w-3.5 h-3.5 rounded accent-[var(--accent-cta)] cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => openViewTaskModal(task.id)}
                              className="text-xs font-semibold text-[var(--text-primary)] hover:underline leading-snug text-left line-clamp-2 cursor-pointer"
                            >
                              {task.title}
                            </button>
                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[var(--text-muted)] mt-0.5">
                              {task.projectId && <span>{getProjectName(task.projectId)}</span>}
                              {assignedSprint && (
                                <>
                                  <span>·</span>
                                  <span className="font-medium text-[var(--text-secondary)]">
                                    {assignedSprint.status === 'active' ? 'Active: ' : 'Planned: '}
                                    {assignedSprint.name}
                                  </span>
                                </>
                              )}
                              <TaskLivePresenceBadge taskId={task.id} compact />
                            </div>
                          </div>
                        </div>

                        <select
                          value={task.story_points || 1}
                          onChange={e => updateTask(task.id, { story_points: parseInt(e.target.value, 10) })}
                          title="Story Points"
                          className="text-[11px] font-mono font-semibold border rounded-lg px-2 py-0.5 cursor-pointer shrink-0"
                        >
                          <option value={1}>1p</option>
                          <option value={2}>2p</option>
                          <option value={3}>3p</option>
                          <option value={5}>5p</option>
                          <option value={8}>8p</option>
                          <option value={13}>13p</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[var(--border-hairline)] gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <span
                            className={`font-semibold uppercase text-[10px] ${
                              task.priority === TaskPriority.CRITICAL
                                ? 'text-rose-700 dark:text-rose-400'
                                : task.priority === TaskPriority.HIGH
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {task.priority}
                          </span>
                          {taskAssignee && (
                            <>
                              <span>·</span>
                              <div className="flex items-center gap-1">
                                <Avatar user={taskAssignee} size="xs" />
                                <span className="truncate max-w-[80px]">
                                  {taskAssignee.full_name?.split(' ')[0] || 'User'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {task.sprintId && (
                            <Button variant="outline" size="sm" onClick={() => assignTaskToSprint(task.id, null)}>
                              ↩ Backlog
                            </Button>
                          )}
                          {activeSprint && task.sprintId !== activeSprint.id && (
                            <Button
                              variant="lime"
                              size="sm"
                              onClick={() => assignTaskToSprint(task.id, activeSprint.id)}
                            >
                              + Active
                            </Button>
                          )}
                          {plannedSprints.filter(ps => ps.id !== task.sprintId).length > 0 && (
                            <select
                              onChange={e => {
                                if (e.target.value) assignTaskToSprint(task.id, e.target.value);
                              }}
                              defaultValue=""
                              className="text-[11px] font-medium rounded-full border px-2.5 py-1 cursor-pointer"
                            >
                              <option value="" disabled>
                                Assign sprint...
                              </option>
                              {plannedSprints
                                .filter(ps => ps.id !== task.sprintId)
                                .map(ps => (
                                  <option key={ps.id} value={ps.id}>
                                    {ps.name}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </HairlineCard>
        </div>
      </div>

      <Modal
        isOpen={isCreateSprintOpen}
        onClose={() => setIsCreateSprintOpen(false)}
        title="Create New Sprint"
        size="md"
      >
        <form onSubmit={handleCreateSprintSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[var(--text-secondary)] mb-1.5">
              Sprint Scope / Project
            </label>
            <select
              value={targetProjectId}
              onChange={e => setTargetProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-xs cursor-pointer"
            >
              <option value="all">Workspace Sprint (Supports Tasks From All Projects)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-secondary)] mb-1.5">
              Sprint Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sprint 14 - Q3 Release"
              value={sprintName}
              onChange={e => setSprintName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-secondary)] mb-1.5">
              Sprint Goal
            </label>
            <textarea
              rows={2}
              placeholder="What is the objective of this iteration?"
              value={sprintGoal}
              onChange={e => setSprintGoal(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1.5">
                End Date ({defaultSprintDuration}d default)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateSprintOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Create Sprint
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
