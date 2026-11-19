import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { isBefore, isToday, startOfDay, parseISO, format } from 'date-fns';
import { generateTaskSummary } from '../../services/aiService';
import { TaskLivePresenceBadge } from '../shared/TaskLivePresenceBadge';
import { InlineKpiStrip, SegmentedTabs, HairlineCard, LiquidBezelSection, StatusDot } from '../shared/EditorialUI';
import { LiquidMetricProgress } from '../charts/EditorialCharts';
import { Button } from '../shared/Button';
import soundService from '../../services/soundService';

export const MyTasksPage: React.FC = () => {
  const { myTasks, tasks, currentUser, projects, openViewTaskModal, updateTask, addToast } = useAppStore();
  const [workScope, setWorkScope] = useState<'assigned' | 'created'>('assigned');
  const [summary, setSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'dueToday' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const scopedTasks = useMemo(() => {
    if (workScope === 'assigned') return myTasks;
    if (!currentUser) return [];
    return tasks.filter(t => t.creator_id === currentUser.id);
  }, [workScope, myTasks, tasks, currentUser]);

  const ClipboardListIcon = ICON_MAP.ClipboardListIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const SparklesIcon = ICON_MAP.SparklesIcon;
  const ClockIcon = ICON_MAP.ClockIcon;

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const result = await generateTaskSummary(myTasks);
      setSummary(result);
    } catch {
      setSummary('Could not generate task summary right now. Please check your tasks directly below.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'General Workspace';
  };

  const filteredBaseTasks = useMemo(() => {
    return scopedTasks.filter(task => {
      if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesProj = getProjectName(task.projectId).toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesProj) return false;
      }
      return true;
    });
  }, [scopedTasks, projectFilter, priorityFilter, searchQuery, projects]);

  const { overdue, dueToday, upcoming, completed } = useMemo(() => {
    const today = startOfDay(new Date());

    const categorized = {
      overdue: [] as Task[],
      dueToday: [] as Task[],
      upcoming: [] as Task[],
      completed: [] as Task[],
    };

    filteredBaseTasks.forEach(task => {
      if (task.status === TaskStatus.DONE) {
        categorized.completed.push(task);
        return;
      }

      if (!task.dueDate) {
        categorized.upcoming.push(task);
        return;
      }

      const dueDate = startOfDay(parseISO(task.dueDate));

      if (isBefore(dueDate, today)) {
        categorized.overdue.push(task);
      } else if (isToday(dueDate)) {
        categorized.dueToday.push(task);
      } else {
        categorized.upcoming.push(task);
      }
    });

    const sortTasks = (tasksToSort: Task[]) =>
      [...tasksToSort].sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;

        const priorityOrder = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW];
        return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      });

    return {
      overdue: sortTasks(categorized.overdue),
      dueToday: sortTasks(categorized.dueToday),
      upcoming: sortTasks(categorized.upcoming),
      completed: sortTasks(categorized.completed),
    };
  }, [filteredBaseTasks]);

  // Overall stats computed from all assigned tasks (for stable KPI header)
  const overallStats = useMemo(() => {
    const today = startOfDay(new Date());
    let overdueCount = 0;
    let dueTodayCount = 0;
    let completedCount = 0;
    let criticalCount = 0;

    myTasks.forEach(t => {
      if (t.status === TaskStatus.DONE) {
        completedCount++;
        return;
      }
      if (t.priority === TaskPriority.CRITICAL) criticalCount++;
      if (t.dueDate) {
        const d = startOfDay(parseISO(t.dueDate));
        if (isBefore(d, today)) overdueCount++;
        else if (isToday(d)) dueTodayCount++;
      }
    });

    const total = myTasks.length;
    const rate = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    return { total, overdueCount, dueTodayCount, completedCount, criticalCount, rate };
  }, [myTasks]);

  const currentDisplayTasks = useMemo(() => {
    if (activeFilterTab === 'dueToday') return dueToday;
    if (activeFilterTab === 'overdue') return overdue;
    if (activeFilterTab === 'upcoming') return upcoming;
    if (activeFilterTab === 'completed') return completed;
    return [...overdue, ...dueToday, ...upcoming, ...completed];
  }, [activeFilterTab, overdue, dueToday, upcoming, completed]);

  const agendaSections = useMemo(() => {
    if (activeFilterTab === 'all') {
      return [
        { id: 'overdue', title: 'Overdue', tone: 'danger' as const, tasks: overdue },
        { id: 'dueToday', title: 'Due Today', tone: 'warning' as const, tasks: dueToday },
        { id: 'upcoming', title: 'Upcoming & Scheduled', tone: 'lime' as const, tasks: upcoming },
        { id: 'completed', title: 'Completed', tone: 'success' as const, tasks: completed },
      ].filter(sec => sec.tasks.length > 0);
    }

    const titleMap = {
      dueToday: { title: 'Due Today', tone: 'warning' as const },
      overdue: { title: 'Overdue', tone: 'danger' as const },
      upcoming: { title: 'Upcoming & Scheduled', tone: 'lime' as const },
      completed: { title: 'Completed', tone: 'success' as const },
    };

    const meta = titleMap[activeFilterTab];
    return currentDisplayTasks.length > 0
      ? [{ id: activeFilterTab, title: meta.title, tone: meta.tone, tasks: currentDisplayTasks }]
      : [];
  }, [activeFilterTab, overdue, dueToday, upcoming, completed, currentDisplayTasks]);

  const handleToggleDone = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
    soundService.play(nextStatus === TaskStatus.DONE ? 'task_complete' : 'click_soft');
    await updateTask(task.id, { status: nextStatus });
    addToast(
      nextStatus === TaskStatus.DONE ? 'Task Completed' : 'Task Reopened',
      `"${task.title}" moved to ${nextStatus === TaskStatus.DONE ? 'Done' : 'To Do'}.`,
      nextStatus === TaskStatus.DONE ? 'success' : 'info'
    );
  };

  const getPriorityTone = (priority: TaskPriority): 'danger' | 'warning' | 'neutral' => {
    if (priority === TaskPriority.CRITICAL) return 'danger';
    if (priority === TaskPriority.HIGH) return 'warning';
    return 'neutral';
  };

  const getStatusTone = (status: TaskStatus): 'success' | 'lime' | 'warning' | 'neutral' => {
    if (status === TaskStatus.DONE) return 'success';
    if (status === TaskStatus.IN_PROGRESS) return 'lime';
    if (status === TaskStatus.REVIEW) return 'warning';
    return 'neutral';
  };

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return 'No due date';
    const parsed = parseISO(dueDate);
    if (isToday(parsed)) return 'Today';
    return format(parsed, 'MMM d');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full text-[var(--text-primary)] space-y-5 animate-fadeIn">
      {/* 1. Sculpted Bezel Command Section + Inline KPI Strip */}
      <LiquidBezelSection
        eyebrow="Personal Focus"
        title="My Assigned Tasks"
        subtitle="Prioritized focus agenda with instant completion controls."
        icon={<ClipboardListIcon className="w-4 h-4" />}
        bezelRight={
          <Button
            variant="lime"
            size="sm"
            onClick={handleGenerateSummary}
            disabled={isGenerating || myTasks.length === 0}
          >
            {isGenerating ? (
              <SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <SparklesIcon className="w-3.5 h-3.5 mr-1.5" />
            )}
            <span>{isGenerating ? 'Analyzing Workload...' : 'AI Daily Briefing'}</span>
          </Button>
        }
        bodyClassName="p-4 sm:p-5"
      >
        <InlineKpiStrip
          items={[
            {
              id: 'due_today',
              label: 'Due Today',
              value: overallStats.dueTodayCount,
              sublabel: overallStats.dueTodayCount > 0 ? 'Focus required' : 'Clear schedule',
              tone: overallStats.dueTodayCount > 0 ? 'warning' : 'success',
              onClick: () => setActiveFilterTab('dueToday'),
            },
            {
              id: 'overdue',
              label: 'Overdue',
              value: overallStats.overdueCount,
              sublabel: overallStats.overdueCount > 0 ? 'Needs reschedule' : 'All on track',
              tone: overallStats.overdueCount > 0 ? 'danger' : 'success',
              onClick: () => setActiveFilterTab('overdue'),
            },
            {
              id: 'completion',
              label: 'Completion Rate',
              value: `${overallStats.rate}%`,
              sublabel: `${overallStats.completedCount}/${overallStats.total} finished`,
              visual: (
                <LiquidMetricProgress
                  value={overallStats.rate}
                  tone={overallStats.rate >= 70 ? 'lime' : 'charcoal'}
                  compact
                />
              ),
              onClick: () => setActiveFilterTab('completed'),
            },
            {
              id: 'critical',
              label: 'Critical Open',
              value: overallStats.criticalCount,
              sublabel: `${overallStats.total - overallStats.completedCount} active items`,
              tone: overallStats.criticalCount > 0 ? 'danger' : 'lime',
              onClick: () => setActiveFilterTab('all'),
            },
          ]}
        />
      </LiquidBezelSection>

      {/* AI Briefing Card (clean hairline, zero thick borders) */}
      {summary && (
        <HairlineCard className="bg-[var(--bg-sage)]/55 flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)] flex items-center justify-center shrink-0 mt-0.5">
            <SparklesIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              AI Daily Briefing & Prioritization
            </h4>
            <p className="text-xs text-[var(--text-primary)] whitespace-pre-line leading-relaxed">
              {summary}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSummary(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
            aria-label="Dismiss summary"
          >
            <ICON_MAP.XMarkIcon className="w-4 h-4" />
          </button>
        </HairlineCard>
      )}

      {/* 3. Streamlined Navigation & Filter Bar */}
      <HairlineCard padding="sm" className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedTabs
            value={workScope}
            onChange={setWorkScope}
            size="sm"
            options={[
              { id: 'assigned', label: 'Assigned to Me', count: myTasks.length },
              {
                id: 'created',
                label: 'Created by Me',
                count: currentUser ? tasks.filter(t => t.creator_id === currentUser.id).length : 0,
              },
            ]}
          />
          <SegmentedTabs
            value={activeFilterTab}
            onChange={setActiveFilterTab}
            size="sm"
            options={[
              { id: 'all', label: 'All', count: filteredBaseTasks.length },
              { id: 'dueToday', label: 'Today', count: dueToday.length },
              { id: 'overdue', label: 'Overdue', count: overdue.length },
              { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
              { id: 'completed', label: 'Done', count: completed.length },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            aria-label="Filter by project"
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] max-w-[180px]"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            aria-label="Filter by priority"
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
          >
            <option value="all">All Priorities</option>
            <option value={TaskPriority.CRITICAL}>Critical</option>
            <option value={TaskPriority.HIGH}>High</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.LOW}>Low</option>
          </select>

          <div className="relative w-full sm:w-52 flex items-center">
            <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full search-input !pl-9 !pr-8 !py-1.5 text-xs rounded-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="Clear search"
              >
                <ICON_MAP.XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <SegmentedTabs
            value={viewMode}
            onChange={setViewMode}
            size="sm"
            options={[
              { id: 'list', label: 'List', icon: <ICON_MAP.ListBulletIcon className="w-3.5 h-3.5" /> },
              { id: 'grid', label: 'Cards', icon: <ICON_MAP.Squares2X2Icon className="w-3.5 h-3.5" /> },
            ]}
          />
        </div>
      </HairlineCard>

      {/* 4. Task Views: Focus Agenda List OR Editorial Cards Grid */}
      {currentDisplayTasks.length === 0 ? (
        <HairlineCard className="text-center py-14 border-dashed">
          <ClipboardListIcon className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-60" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {searchQuery || projectFilter !== 'all' || priorityFilter !== 'all'
              ? 'No tasks match your filters'
              : 'No tasks in this category'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            {activeFilterTab === 'overdue'
              ? 'Great job! You have zero overdue items.'
              : 'Adjust your filters or check project boards to pick up new deliverables.'}
          </p>
        </HairlineCard>
      ) : viewMode === 'list' ? (
        <div className="space-y-4">
          {agendaSections.map(section => (
            <HairlineCard key={section.id} padding="none" className="overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-hairline)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot tone={section.tone} label={section.title} className="text-xs font-bold text-[var(--text-primary)]" />
                </div>
                <span className="font-mono tabular-nums text-[11px] font-semibold text-[var(--text-muted)]">
                  {section.tasks.length} {section.tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              <div className="divide-y divide-[var(--border-hairline)]">
                {section.tasks.map(task => {
                  const isDone = task.status === TaskStatus.DONE;
                  const isTaskOverdue =
                    task.dueDate &&
                    isBefore(startOfDay(parseISO(task.dueDate)), startOfDay(new Date())) &&
                    !isDone;
                  const isTaskDueToday = task.dueDate && isToday(parseISO(task.dueDate)) && !isDone;

                  return (
                    <div
                      key={task.id}
                      onClick={() => openViewTaskModal(task.id, true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openViewTaskModal(task.id, true);
                        }
                      }}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={e => handleToggleDone(e, task)}
                          aria-label={isDone ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
                          title={isDone ? 'Reopen task' : 'Complete task'}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            isDone
                              ? 'bg-[var(--accent-lime)] border-[var(--accent-ink)]/20 text-[var(--accent-ink)]'
                              : 'border-[var(--border-strong)] hover:border-[var(--text-primary)] bg-[var(--bg-surface)]'
                          }`}
                        >
                          {isDone && <ICON_MAP.CheckIcon className="w-3 h-3 stroke-[2.5]" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[13px] font-semibold truncate group-hover:underline ${
                                isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {task.title}
                            </span>
                            <TaskLivePresenceBadge taskId={task.id} compact={true} />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] truncate">
                            <span className="truncate">{getProjectName(task.projectId)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{task.status.replace('_', ' ')}</span>
                            {task.story_points ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">{task.story_points} pts</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <StatusDot
                          tone={getPriorityTone(task.priority)}
                          label={task.priority}
                          className="hidden sm:inline-flex text-[11px] font-medium capitalize w-20"
                        />

                        <span
                          className={`text-[11px] font-mono tabular-nums w-20 text-right ${
                            isTaskOverdue
                              ? 'text-rose-600 dark:text-rose-400 font-bold'
                              : isTaskDueToday
                              ? 'text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {formatDueDate(task.dueDate)}
                        </span>

                        <span className="text-[11px] font-semibold text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors hidden md:inline">
                          Open →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </HairlineCard>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentDisplayTasks.map(task => {
            const isDone = task.status === TaskStatus.DONE;
            const isTaskOverdue =
              task.dueDate &&
              isBefore(startOfDay(parseISO(task.dueDate)), startOfDay(new Date())) &&
              !isDone;
            const isTaskDueToday = task.dueDate && isToday(parseISO(task.dueDate)) && !isDone;

            return (
              <div
                key={task.id}
                onClick={() => openViewTaskModal(task.id, true)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openViewTaskModal(task.id, true);
                  }
                }}
                className="editorial-surface p-4 text-left hover:border-[var(--border-strong)] transition-all duration-150 flex flex-col justify-between cursor-pointer group"
              >
                <div className="w-full">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={e => handleToggleDone(e, task)}
                        aria-label={isDone ? 'Reopen task' : 'Complete task'}
                        className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isDone
                            ? 'bg-[var(--accent-lime)] border-[var(--accent-ink)]/20 text-[var(--accent-ink)]'
                            : 'border-[var(--border-strong)] hover:border-[var(--text-primary)] bg-[var(--bg-surface)]'
                        }`}
                      >
                        {isDone && <ICON_MAP.CheckIcon className="w-2.5 h-2.5 stroke-[2.5]" />}
                      </button>
                      <span className="text-[11px] font-medium text-[var(--text-muted)] truncate max-w-[140px]">
                        {getProjectName(task.projectId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <TaskLivePresenceBadge taskId={task.id} compact={true} />
                      <StatusDot
                        tone={getPriorityTone(task.priority)}
                        label={task.priority}
                        className="text-[11px] font-medium capitalize"
                      />
                    </div>
                  </div>

                  <h3
                    className={`text-sm font-bold line-clamp-2 leading-snug mb-1.5 group-hover:underline ${
                      isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="w-full pt-3 mt-1 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <ClockIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    {task.dueDate ? (
                      <span
                        className={`text-[11px] font-mono tabular-nums ${
                          isTaskOverdue
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : isTaskDueToday
                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)]">No due date</span>
                    )}
                  </div>

                  <StatusDot
                    tone={getStatusTone(task.status)}
                    label={task.status.replace('_', ' ')}
                    className="text-[11px] font-medium capitalize"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
