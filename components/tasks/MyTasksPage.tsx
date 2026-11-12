import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { isBefore, isToday, startOfDay, parseISO } from 'date-fns';
import { generateTaskSummary } from '../../services/aiService';
import { TaskLivePresenceBadge } from '../shared/TaskLivePresenceBadge';
import { PageHeader, InlineKpiStrip, SegmentedTabs, HairlineCard, StatusDot } from '../shared/EditorialUI';
import { RadialProgressRing } from '../charts/EditorialCharts';
import { Button } from '../shared/Button';

export const MyTasksPage: React.FC = () => {
  const { myTasks, projects, openViewTaskModal } = useAppStore();
  const [summary, setSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'dueToday' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const ClipboardListIcon = ICON_MAP.ClipboardListIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const SparklesIcon = ICON_MAP.SparklesIcon;
  const ClockIcon = ICON_MAP.ClockIcon;

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const result = await generateTaskSummary(myTasks);
      setSummary(result);
    } catch (e) {
      setSummary('Could not generate task summary right now. Please check your tasks directly below.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'General Workspace';
  };

  const { overdue, dueToday, upcoming, completed } = useMemo(() => {
    const today = startOfDay(new Date());

    const categorized = {
      overdue: [] as Task[],
      dueToday: [] as Task[],
      upcoming: [] as Task[],
      completed: [] as Task[],
    };

    myTasks.forEach(task => {
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
      tasksToSort.sort((a, b) => {
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
  }, [myTasks]);

  const totalTasks = myTasks.length;
  const completedCount = completed.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const criticalCount = myTasks.filter(t => t.priority === TaskPriority.CRITICAL && t.status !== TaskStatus.DONE).length;

  const currentDisplayTasks = useMemo(() => {
    let list: Task[] = [];
    if (activeFilterTab === 'dueToday') list = dueToday;
    else if (activeFilterTab === 'overdue') list = overdue;
    else if (activeFilterTab === 'upcoming') list = upcoming;
    else if (activeFilterTab === 'completed') list = completed;
    else list = [...overdue, ...dueToday, ...upcoming, ...completed];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeFilterTab, overdue, dueToday, upcoming, completed, searchQuery]);

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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full text-[var(--text-primary)] space-y-5 animate-fadeIn">
      {/* 1. Editorial PageHeader */}
      <PageHeader
        eyebrow="Personal Focus"
        title="My Assigned Tasks"
        subtitle="Stay focused on your highest priority deliverables, upcoming deadlines, and cross-project commitments."
        actions={
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
      />

      {/* 2. Inline KPI Strip */}
      <InlineKpiStrip
        items={[
          {
            id: 'due_today',
            label: 'Due Today',
            value: dueToday.length,
            sublabel: dueToday.length > 0 ? 'Focus required' : 'Clear schedule',
            tone: dueToday.length > 0 ? 'warning' : 'success',
            onClick: () => setActiveFilterTab('dueToday'),
          },
          {
            id: 'overdue',
            label: 'Overdue',
            value: overdue.length,
            sublabel: overdue.length > 0 ? 'Needs reschedule' : 'All on track',
            tone: overdue.length > 0 ? 'danger' : 'success',
            onClick: () => setActiveFilterTab('overdue'),
          },
          {
            id: 'completion',
            label: 'Completion Rate',
            value: `${completionRate}%`,
            sublabel: `${completedCount}/${totalTasks} finished`,
            visual: (
              <RadialProgressRing
                value={completionRate}
                size={40}
                strokeWidth={4}
                tone={completionRate >= 70 ? 'lime' : 'charcoal'}
                showLabel={false}
              />
            ),
            onClick: () => setActiveFilterTab('completed'),
          },
          {
            id: 'critical',
            label: 'Critical Attention',
            value: criticalCount,
            sublabel: `${upcoming.length} upcoming`,
            tone: criticalCount > 0 ? 'danger' : 'lime',
            onClick: () => setActiveFilterTab('all'),
          },
        ]}
      />

      {/* AI Summary Banner if generated */}
      {summary && (
        <HairlineCard className="border-l-4 border-l-[var(--accent-lime)] flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-full bg-[var(--bg-sage)] text-[var(--text-primary)] flex items-center justify-center shrink-0 mt-0.5">
            <SparklesIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              AI Task Briefing & Prioritization
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

      {/* 3. Filter Tabs & Editorial Search Bar */}
      <HairlineCard padding="sm" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SegmentedTabs
          value={activeFilterTab}
          onChange={setActiveFilterTab}
          size="sm"
          options={[
            { id: 'all', label: 'All', count: totalTasks },
            { id: 'dueToday', label: 'Due Today', count: dueToday.length },
            { id: 'overdue', label: 'Overdue', count: overdue.length },
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'completed', label: 'Done', count: completed.length },
          ]}
        />

        <div className="relative w-full sm:w-64 flex items-center">
          <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search my tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full search-input !pl-10 !pr-8 !py-1.5 text-xs rounded-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ICON_MAP.XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </HairlineCard>

      {/* 4. Task Cards Grid (Matte Hairline, Zero-Pill Metadata) */}
      {currentDisplayTasks.length === 0 ? (
        <HairlineCard className="text-center py-14 border-dashed">
          <ClipboardListIcon className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-60" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {searchQuery ? 'No tasks matching your search' : 'No tasks in this category'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            {activeFilterTab === 'overdue'
              ? 'Great job! You have zero overdue items.'
              : 'Check other tabs or collaborate on project boards to pick up work.'}
          </p>
        </HairlineCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentDisplayTasks.map(task => {
            const isTaskOverdue =
              task.dueDate &&
              isBefore(startOfDay(parseISO(task.dueDate)), startOfDay(new Date())) &&
              task.status !== TaskStatus.DONE;
            const isTaskDueToday =
              task.dueDate && isToday(parseISO(task.dueDate)) && task.status !== TaskStatus.DONE;

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => openViewTaskModal(task.id, true)}
                className="editorial-surface p-4 text-left hover:border-[var(--border-strong)] transition-all duration-150 flex flex-col justify-between cursor-pointer group"
              >
                <div className="w-full">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-medium text-[var(--text-muted)] truncate max-w-[160px]">
                      {getProjectName(task.projectId)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <TaskLivePresenceBadge taskId={task.id} compact={true} />
                      <StatusDot
                        tone={getPriorityTone(task.priority)}
                        label={task.priority}
                        className="text-[11px] font-medium capitalize"
                      />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-snug mb-1.5 group-hover:underline">
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

