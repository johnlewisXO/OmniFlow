import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { TaskStatus, UserRole, TaskPriority } from '../../types';
import { useAppStore } from '../../hooks/useAppStore';
import { TASK_STATUS_COLUMNS, ICON_MAP } from '../../constants';
import { GanttTimelineView } from './GanttTimelineView';
import { TaskListView } from './TaskListView';
import { AutomatedTriggersModal } from './AutomatedTriggersModal';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';
import soundService from '../../services/soundService';
import { SegmentedTabs, HairlineCard, FluidCollapse, AnimatedViewStage, FloatingGlassDock } from '../shared/EditorialUI';
import { LiquidMetricProgress } from '../charts/EditorialCharts';

type SwimlaneType = 'none' | 'assignee' | 'priority';

export const KanbanBoard: React.FC = () => {
  const {
    activeProject,
    darkMode,
    isLoadingTasks,
    tasksError,
    isLoadingProjects,
    tasks,
    users,
    currentUser,
    openViewTaskModal,
    sprints,
    presences,
    updateTask,
    bulkUpdateTasks,
    bulkDeleteTasks,
    lastUndoAction,
    triggerUndo,
    addToast,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'gantt'>('kanban');
  const [isAutomationsOpen, setIsAutomationsOpen] = useState(false);
  const [isWipModalOpen, setIsWipModalOpen] = useState(false);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<string>('todo');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [tabletLayoutMode, setTabletLayoutMode] = useState<'grid' | 'snap'>(() => {
    try {
      const saved = localStorage.getItem('omni_kanban_tablet_layout');
      return saved === 'snap' ? 'snap' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleTabletLayoutChange = (mode: 'grid' | 'snap') => {
    setTabletLayoutMode(mode);
    try {
      localStorage.setItem('omni_kanban_tablet_layout', mode);
    } catch {}
  };

  // Quick Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterSprint, setFilterSprint] = useState<string>('all');
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneType>('none');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const handleToggleSelectTask = useCallback((taskId: string) => {
    soundService.play('click_soft');
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  }, []);

  const clearSelectedTasks = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  // WIP Limits
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(`wip_limits_${activeProject?.id}`);
      return stored ? JSON.parse(stored) : { in_progress: 5, in_review: 3 };
    } catch {
      return { in_progress: 5, in_review: 3 };
    }
  });

  const handleUpdateWipLimit = (status: string, limit: number) => {
    const updated = { ...wipLimits, [status]: limit };
    setWipLimits(updated);
    if (activeProject) {
      localStorage.setItem(`wip_limits_${activeProject.id}`, JSON.stringify(updated));
    }
  };

  const activeCollabs = useMemo(() => {
    const map = new Map<string, (typeof presences)[number]>();
    presences.forEach(p => {
      if (!p?.userId || p.userId === currentUser?.id) return;
      if (currentUser?.organization_id && p.organizationId && p.organizationId !== currentUser.organization_id) {
        return;
      }
      map.set(p.userId, p);
    });
    return Array.from(map.values());
  }, [presences, currentUser]);

  const toggleSwimlane = (id: string) => {
    setCollapsedSwimlanes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hasActiveFilters =
    searchQuery !== '' || filterMyTasks || filterPriority !== 'all' || filterUnassigned || filterSprint !== 'all';
  const activeFilterCount =
    (filterMyTasks ? 1 : 0) +
    (filterUnassigned ? 1 : 0) +
    (filterPriority !== 'all' ? 1 : 0) +
    (filterSprint !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterMyTasks(false);
    setFilterPriority('all');
    setFilterUnassigned(false);
    setFilterSprint('all');
  };

  const FolderIcon = ICON_MAP.FolderIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;

  const rawProjectTasks = useMemo(() => {
    return activeProject ? tasks.filter(t => t.projectId === activeProject.id) : [];
  }, [tasks, activeProject]);

  const filteredProjectTasks = useMemo(() => {
    return rawProjectTasks.filter(task => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesTag = task.tags?.some(tag => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTag) return false;
      }
      if (filterMyTasks && currentUser && task.assignee_id !== currentUser.id) return false;
      if (filterUnassigned && task.assignee_id) return false;
      if (filterPriority !== 'all' && (task.priority || '').toLowerCase() !== filterPriority.toLowerCase()) return false;

      if (filterSprint !== 'all') {
        if (filterSprint === 'active') {
          const activeSp = sprints.find(s => s.projectId === activeProject?.id && s.status === 'active');
          if (!activeSp || task.sprintId !== activeSp.id) return false;
        } else if (filterSprint === 'backlog') {
          if (task.sprintId) return false;
        } else if (task.sprintId !== filterSprint) {
          return false;
        }
      }

      return true;
    });
  }, [rawProjectTasks, searchQuery, filterMyTasks, currentUser, filterUnassigned, filterPriority, filterSprint, sprints, activeProject]);

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (lastUndoAction) {
          e.preventDefault();
          triggerUndo();
        }
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (selectedTaskIds.length > 0) {
          e.preventDefault();
          clearSelectedTasks();
        } else if (focusedTaskId) {
          setFocusedTaskId(null);
        }
        return;
      }

      if (filteredProjectTasks.length === 0) return;

      if (e.key.toLowerCase() === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = focusedTaskId ? filteredProjectTasks.findIndex(t => t.id === focusedTaskId) : -1;
        const nextIdx = (idx + 1) % filteredProjectTasks.length;
        setFocusedTaskId(filteredProjectTasks[nextIdx].id);
        return;
      }

      if (e.key.toLowerCase() === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = focusedTaskId ? filteredProjectTasks.findIndex(t => t.id === focusedTaskId) : 0;
        const prevIdx = (idx - 1 + filteredProjectTasks.length) % filteredProjectTasks.length;
        setFocusedTaskId(filteredProjectTasks[prevIdx].id);
        return;
      }

      const activeTask = focusedTaskId ? filteredProjectTasks.find(t => t.id === focusedTaskId) : null;
      if (!activeTask) return;

      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleToggleSelectTask(activeTask.id);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        openViewTaskModal(activeTask.id);
        return;
      }

      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        const order = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.DONE];
        const nextStatus = order[(order.indexOf(activeTask.status) + 1) % order.length];
        updateTask(activeTask.id, { status: nextStatus });
        addToast('Status Cycled (S)', `"${activeTask.title}" moved to ${nextStatus.replace(/_/g, ' ')}.`, 'info');
        return;
      }

      if (e.key.toLowerCase() === 'm' && currentUser) {
        e.preventDefault();
        updateTask(activeTask.id, { assignee_id: currentUser.id });
        addToast('Assigned to You (M)', `"${activeTask.title}" assigned to ${currentUser.full_name || currentUser.email}.`, 'success');
        return;
      }

      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const prioMap: Record<string, TaskPriority> = {
          '1': TaskPriority.CRITICAL,
          '2': TaskPriority.HIGH,
          '3': TaskPriority.MEDIUM,
          '4': TaskPriority.LOW,
        };
        const newPriority = prioMap[e.key];
        if (newPriority) {
          updateTask(activeTask.id, { priority: newPriority });
          addToast(`Priority Set (${e.key})`, `"${activeTask.title}" priority set to ${newPriority}.`, 'info');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    filteredProjectTasks,
    focusedTaskId,
    selectedTaskIds.length,
    lastUndoAction,
    triggerUndo,
    clearSelectedTasks,
    handleToggleSelectTask,
    openViewTaskModal,
    updateTask,
    currentUser,
    addToast,
  ]);

  const stats = useMemo(() => {
    const total = rawProjectTasks.length;
    const done = rawProjectTasks.filter(t => t.status === TaskStatus.DONE).length;
    const totalStoryPoints = rawProjectTasks.reduce((acc, t) => acc + (t.story_points || 1), 0);
    const completedStoryPoints = rawProjectTasks
      .filter(t => t.status === TaskStatus.DONE)
      .reduce((acc, t) => acc + (t.story_points || 1), 0);
    const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, totalStoryPoints, completedStoryPoints, progressPercent };
  }, [rawProjectTasks]);

  const swimlanes = useMemo(() => {
    if (swimlaneMode === 'assignee') {
      const assigneeIds = Array.from(new Set(rawProjectTasks.map(t => t.assignee_id || 'unassigned')));
      return assigneeIds.map(id => {
        if (id === 'unassigned') {
          return {
            id: 'unassigned',
            title: 'Unassigned',
            avatar: null,
            tasks: filteredProjectTasks.filter(t => !t.assignee_id),
          };
        }
        const user = users.find(u => u.id === id);
        return {
          id,
          title: user?.full_name || user?.email || 'Unknown Member',
          avatar: user?.avatar_url,
          tasks: filteredProjectTasks.filter(t => t.assignee_id === id),
        };
      });
    }

    if (swimlaneMode === 'priority') {
      const priorities: TaskPriority[] = [
        TaskPriority.CRITICAL,
        TaskPriority.HIGH,
        TaskPriority.MEDIUM,
        TaskPriority.LOW,
      ];
      return priorities.map(p => ({
        id: p,
        title: `${p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()} Priority`,
        avatar: null,
        priority: p,
        tasks: filteredProjectTasks.filter(t => t.priority === p),
      }));
    }

    return [];
  }, [swimlaneMode, rawProjectTasks, filteredProjectTasks, users]);

  if (isLoadingProjects && !activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <SpinnerIcon className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)] animate-spin" />
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Loading project...</h2>
        </div>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <HairlineCard padding="lg" className="text-center max-w-sm">
          <FolderIcon className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">No Project Selected</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Select a project from the navigation rail to view its board and sprint backlog.
          </p>
        </HairlineCard>
      </div>
    );
  }

  if (activeProject && isLoadingTasks) {
    return (
      <div className="flex-1 flex gap-4 p-4 sm:p-6 overflow-x-auto">
        {[1, 2, 3, 4].map(col => (
          <div
            key={col}
            className="flex-shrink-0 w-72 md:w-80 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] p-4 space-y-3 animate-pulse"
          >
            <div className="h-5 w-24 rounded bg-[var(--bg-sage)]" />
            {[1, 2, 3].map(task => (
              <div key={task} className="h-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (activeProject && tasksError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <HairlineCard padding="lg" className="text-center border-rose-500/30 max-w-md">
          <ExclamationIcon className="w-10 h-10 mx-auto mb-2 text-rose-500" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Error Loading Tasks</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{tasksError}</p>
        </HairlineCard>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-5 md:p-6 space-y-4">
      {/* Top Toolbar: Project Title + View Tabs + Compact Velocity & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <div className="min-w-0 mr-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Project Board</p>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] truncate">
              {activeProject.name}
            </h1>
          </div>

          <SegmentedTabs
            size="sm"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { id: 'kanban', label: 'Board', icon: <ICON_MAP.Squares2X2Icon className="w-3.5 h-3.5" /> },
              { id: 'list', label: 'List', icon: <ICON_MAP.ClipboardListIcon className="w-3.5 h-3.5" /> },
              { id: 'gantt', label: 'Timeline', icon: <ICON_MAP.ClockIcon className="w-3.5 h-3.5" /> },
            ]}
          />

          {viewMode === 'kanban' && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs">
              <ICON_MAP.AdjustmentsHorizontalIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                value={swimlaneMode}
                onChange={e => setSwimlaneMode(e.target.value as SwimlaneType)}
                className="!w-auto !p-0 !border-0 !bg-transparent !shadow-none outline-none cursor-pointer font-medium text-xs text-[var(--text-primary)]"
              >
                <option value="none">Standard</option>
                <option value="assignee">By Teammate</option>
                <option value="priority">By Priority</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeCollabs.length > 0 && (
            <div className="hidden md:flex items-center -space-x-1.5">
              {activeCollabs.slice(0, 4).map(collab => (
                <div
                  key={collab.userId}
                  title={`${collab.userName} · Online`}
                  className="relative w-6 h-6 rounded-full ring-2 ring-[var(--bg-canvas)] overflow-hidden flex items-center justify-center text-[9px] font-bold bg-[var(--accent-cta)] text-[var(--accent-cta-ink)]"
                >
                  {collab.userAvatar ? (
                    <img src={collab.userAvatar} alt={collab.userName} className="w-full h-full object-cover" />
                  ) : (
                    collab.userName.charAt(0).toUpperCase()
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Velocity & Completion Compact Gauge */}
          <div
            title={`${stats.done} of ${stats.total} tasks completed · ${stats.completedStoryPoints}/${stats.totalStoryPoints} points`}
            className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs"
          >
            <LiquidMetricProgress value={stats.progressPercent} tone="lime" compact className="!w-14" />
            <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)]">
              {stats.progressPercent}%
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="font-mono tabular-nums text-[var(--text-secondary)]">
              {stats.completedStoryPoints}/{stats.totalStoryPoints} pts
            </span>
          </div>

          {viewMode === 'kanban' && swimlaneMode === 'none' && (
            <div className="hidden md:flex xl:hidden items-center p-0.5 rounded-full bg-[var(--bg-sage)] border border-[var(--border-hairline)] text-[11px]">
              <button
                type="button"
                onClick={() => handleTabletLayoutChange('grid')}
                title="2×2 Grid Layout"
                className={`p-1.5 rounded-full cursor-pointer ${
                  tabletLayoutMode === 'grid'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <ICON_MAP.Squares2X2Icon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleTabletLayoutChange('snap')}
                title="Horizontal Columns"
                className={`p-1.5 rounded-full cursor-pointer ${
                  tabletLayoutMode === 'snap'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <ICON_MAP.ViewColumnsIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {viewMode === 'kanban' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsWipModalOpen(true)}
              title="Configure Column WIP Limits"
            >
              <ICON_MAP.AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WIP</span>
            </Button>
          )}

          {(currentUser?.role === UserRole.OWNER ||
            currentUser?.role === UserRole.ADMIN ||
            currentUser?.role === UserRole.PROJECT_MANAGER) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAutomationsOpen(true)}
              title="Workflow Automations & Rules"
            >
              <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rules</span>
            </Button>
          )}
        </div>
      </div>

      {/* Unified Filter Bar */}
      <div className="editorial-surface px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
          <div className="relative flex-1 min-w-[180px] lg:max-w-xs flex items-center">
            <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full search-input !pl-9 !pr-7 !py-1.5 !rounded-full text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(prev => !prev)}
            className={`lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold border cursor-pointer ${
              isFilterDrawerOpen || activeFilterCount > 0
                ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] border-transparent'
                : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
            }`}
          >
            <ICON_MAP.FilterIcon className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && <span className="font-mono text-[10px]">{activeFilterCount}</span>}
          </button>

          <div
            className={`${
              isFilterDrawerOpen
                ? 'flex w-full pt-2 mt-1 border-t border-[var(--border-hairline)]'
                : 'hidden'
            } lg:flex lg:w-auto lg:pt-0 lg:mt-0 lg:border-t-0 items-center gap-1.5 flex-wrap flex-1`}
          >
            <button
              type="button"
              onClick={() => setFilterMyTasks(!filterMyTasks)}
              className={`px-3 py-1 rounded-full font-medium border transition-colors cursor-pointer ${
                filterMyTasks
                  ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] border-transparent'
                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Assigned to me
            </button>

            <button
              type="button"
              onClick={() => setFilterUnassigned(!filterUnassigned)}
              className={`px-3 py-1 rounded-full font-medium border transition-colors cursor-pointer ${
                filterUnassigned
                  ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] border-transparent'
                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Unassigned
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)]">
              <span className="text-[var(--text-muted)]">Priority:</span>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value as any)}
                className="!w-auto !p-0 !border-0 !bg-transparent !shadow-none outline-none cursor-pointer font-medium text-xs text-[var(--text-primary)]"
              >
                <option value="all">All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)]">
              <span className="text-[var(--text-muted)]">Sprint:</span>
              <select
                value={filterSprint}
                onChange={e => setFilterSprint(e.target.value)}
                className="!w-auto !p-0 !border-0 !bg-transparent !shadow-none outline-none cursor-pointer font-medium text-xs text-[var(--text-primary)]"
              >
                <option value="all">All Tasks</option>
                <option value="active">Active Sprint</option>
                <option value="backlog">Product Backlog</option>
                {sprints
                  .filter(s => s.projectId === activeProject?.id)
                  .map(sp => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {lastUndoAction && (
                <Button variant="lime" size="sm" onClick={() => triggerUndo()}>
                  ↩ Undo ({lastUndoAction.label})
                </Button>
              )}
              {hasActiveFilters && (
                <>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                    {filteredProjectTasks.length}/{rawProjectTasks.length}
                  </span>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>
      </div>

      {/* Main Content with Animated View Mode Transition */}
      <AnimatedViewStage viewKey={`${viewMode}-${swimlaneMode}`} className="flex-1 flex flex-col min-h-0">
        {viewMode === 'kanban' ? (
          swimlaneMode === 'none' ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mobile Lane Switcher */}
              <div className="md:hidden mb-3">
                <SegmentedTabs
                  size="sm"
                  value={mobileActiveColumn}
                  onChange={setMobileActiveColumn}
                  options={TASK_STATUS_COLUMNS.map(col => ({
                    id: col.id,
                    label: col.title,
                    count: (hasActiveFilters ? filteredProjectTasks : rawProjectTasks).filter(t => t.status === col.id).length,
                  }))}
                />
              </div>

              <div className="md:hidden flex-1 flex flex-col pb-4">
                {TASK_STATUS_COLUMNS.filter(col => col.id === mobileActiveColumn).map(column => (
                  <div key={column.id} className="w-full flex-1 flex flex-col [&>div]:!w-full">
                    <KanbanColumn
                      status={column.id as TaskStatus}
                      title={column.title}
                      colorClass={column.color}
                      tasksOverride={hasActiveFilters ? filteredProjectTasks : undefined}
                      wipLimit={wipLimits[column.id]}
                      layoutMode="grid"
                      selectedTaskIds={selectedTaskIds}
                      focusedTaskId={focusedTaskId}
                      onToggleSelectTask={handleToggleSelectTask}
                    />
                  </div>
                ))}
              </div>

              <div
                className={
                  tabletLayoutMode === 'grid'
                    ? 'hidden md:grid md:grid-cols-2 md:gap-4 xl:flex xl:items-start xl:gap-4 xl:overflow-x-auto pb-4 scrollbar-thin'
                    : 'hidden md:flex flex-1 items-start space-x-3 md:space-x-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-thin'
                }
              >
                {TASK_STATUS_COLUMNS.map(column => (
                  <KanbanColumn
                    key={column.id}
                    status={column.id as TaskStatus}
                    title={column.title}
                    colorClass={column.color}
                    tasksOverride={hasActiveFilters ? filteredProjectTasks : undefined}
                    wipLimit={wipLimits[column.id]}
                    layoutMode={tabletLayoutMode}
                    selectedTaskIds={selectedTaskIds}
                    focusedTaskId={focusedTaskId}
                    onToggleSelectTask={handleToggleSelectTask}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 pb-4">
              {swimlanes.map(swimlane => {
                const isCollapsed = Boolean(collapsedSwimlanes[swimlane.id]);
                return (
                  <HairlineCard key={swimlane.id} padding="none" className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSwimlane(swimlane.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <ICON_MAP.ChevronDownIcon
                          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${
                            isCollapsed ? '-rotate-90' : ''
                          }`}
                        />
                        {swimlane.avatar ? (
                          <img src={swimlane.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-[var(--bg-sage)] text-[var(--text-primary)] flex items-center justify-center text-[10px] font-bold">
                            {swimlane.title.charAt(0)}
                          </span>
                        )}
                        <h3 className="font-bold text-xs sm:text-sm text-[var(--text-primary)]">{swimlane.title}</h3>
                        <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                          {swimlane.tasks.length} tasks
                        </span>
                      </div>
                    </button>

                    <FluidCollapse isOpen={!isCollapsed}>
                      <div className="p-3 pt-0 flex gap-3 overflow-x-auto scrollbar-thin">
                        {TASK_STATUS_COLUMNS.map(column => (
                          <KanbanColumn
                            key={`${swimlane.id}-${column.id}`}
                            status={column.id as TaskStatus}
                            title={column.title}
                            colorClass={column.color}
                            tasksOverride={swimlane.tasks}
                            wipLimit={wipLimits[column.id]}
                            selectedTaskIds={selectedTaskIds}
                            focusedTaskId={focusedTaskId}
                            onToggleSelectTask={handleToggleSelectTask}
                          />
                        ))}
                      </div>
                    </FluidCollapse>
                  </HairlineCard>
                );
              })}
            </div>
          )
        ) : viewMode === 'list' ? (
          <TaskListView
            tasks={filteredProjectTasks}
            users={users}
            darkMode={darkMode}
            onTaskClick={openViewTaskModal}
            selectedTaskIds={selectedTaskIds}
            focusedTaskId={focusedTaskId}
            onToggleSelectTask={handleToggleSelectTask}
          />
        ) : (
          <GanttTimelineView
            tasks={filteredProjectTasks}
            users={users}
            darkMode={darkMode}
            onTaskClick={openViewTaskModal}
          />
        )}
      </AnimatedViewStage>

      {/* Multi-Select Floating Liquid Glass Bulk Action Dock */}
      <FloatingGlassDock
        isVisible={selectedTaskIds.length > 0}
        className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[94vw]"
      >
        <div className="editorial-popover flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-2.5 rounded-full shadow-2xl">
          <div className="flex items-center gap-2 pr-2 border-r border-[var(--border-hairline)]">
            <span className="px-2 py-0.5 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)] font-mono font-bold text-xs tabular-nums">
              {selectedTaskIds.length}
            </span>
            <span className="text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">Selected</span>
          </div>

          <select
            defaultValue=""
            onChange={async e => {
              const val = e.target.value as TaskStatus;
              if (!val) return;
              e.target.value = '';
              await bulkUpdateTasks(selectedTaskIds, { status: val });
              clearSelectedTasks();
            }}
            className="px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer"
          >
            <option value="" disabled>
              Status...
            </option>
            <option value={TaskStatus.TODO}>To Do</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.REVIEW}>In Review</option>
            <option value={TaskStatus.DONE}>Done</option>
          </select>

          <select
            defaultValue=""
            onChange={async e => {
              const val = e.target.value as TaskPriority;
              if (!val) return;
              e.target.value = '';
              await bulkUpdateTasks(selectedTaskIds, { priority: val });
              clearSelectedTasks();
            }}
            className="px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer"
          >
            <option value="" disabled>
              Priority...
            </option>
            <option value={TaskPriority.CRITICAL}>Critical</option>
            <option value={TaskPriority.HIGH}>High</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.LOW}>Low</option>
          </select>

          <select
            defaultValue=""
            onChange={async e => {
              const val = e.target.value;
              if (!val) return;
              e.target.value = '';
              const assigneeVal = val === 'unassigned' ? undefined : val;
              await bulkUpdateTasks(selectedTaskIds, { assignee_id: assigneeVal });
              clearSelectedTasks();
            }}
            className="px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer"
          >
            <option value="" disabled>
              Assign...
            </option>
            <option value="unassigned">Unassigned</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </select>

          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              await bulkDeleteTasks(selectedTaskIds);
              clearSelectedTasks();
            }}
          >
            Delete ({selectedTaskIds.length})
          </Button>

          <button
            type="button"
            onClick={clearSelectedTasks}
            className="px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            Esc
          </button>
        </div>
      </FloatingGlassDock>

      <AutomatedTriggersModal
        isOpen={isAutomationsOpen}
        onClose={() => setIsAutomationsOpen(false)}
        users={users}
        darkMode={darkMode}
      />

      <Modal
        isOpen={isWipModalOpen}
        onClose={() => setIsWipModalOpen(false)}
        title="Configure WIP Limits"
        size="sm"
      >
        <p className="text-xs text-[var(--text-secondary)] mb-5">
          Set maximum task thresholds per column to prevent bottlenecks.
        </p>

        <div className="space-y-3.5">
          {TASK_STATUS_COLUMNS.map(col => (
            <div key={col.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <span className="text-xs font-semibold text-[var(--text-primary)]">{col.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={wipLimits[col.id] || 0}
                  onChange={e => handleUpdateWipLimit(col.id, parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-1 rounded-xl border text-xs font-mono font-semibold text-center"
                />
                <span className="text-xs text-[var(--text-muted)]">max</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setIsWipModalOpen(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
};
