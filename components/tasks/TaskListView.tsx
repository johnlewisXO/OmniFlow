import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority, User } from '../../types';
import { ICON_MAP } from '../../constants';
import { useAppStore } from '../../hooks/useAppStore';
import { format, isBefore, startOfDay } from 'date-fns';
import { processTaskAutomationRules } from '../../services/automationEngine';
import { TaskLivePresenceBadge } from '../shared/TaskLivePresenceBadge';
import { collabService } from '../../services/collabService';
import soundService from '../../services/soundService';

interface TaskListViewProps {
  tasks: Task[];
  users: User[];
  darkMode: boolean;
  onTaskClick: (taskId: string) => void;
  onQuickCreateTask?: (status: TaskStatus) => void;
  selectedTaskIds?: string[];
  focusedTaskId?: string | null;
  onToggleSelectTask?: (taskId: string, shiftKey?: boolean) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  users,
  darkMode,
  onTaskClick,
  selectedTaskIds = [],
  focusedTaskId = null,
  onToggleSelectTask,
}) => {
  const {
    updateTask,
    moveTask,
    openModal,
    deleteTask,
    addToast,
    presences,
    currentUser,
    highlightedTaskId,
    startTaskTimer,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'status' | 'none'>('status');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Intra-section & Cross-section Drag-and-Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeDragOverSection, setActiveDragOverSection] = useState<TaskStatus | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverPlacement, setDragOverPlacement] = useState<'before' | 'after'>('after');
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);

  const triggerVisualPulse = (taskId: string) => {
    setRecentlyMovedId(taskId);
    setTimeout(() => {
      setRecentlyMovedId(prev => (prev === taskId ? null : prev));
    }, 1800);
  };

  const toggleExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTaskIds(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Separate parent tasks and subtasks, sorted by position so intra-section order is preserved
  const { parentTasks, subtasksMap } = useMemo(() => {
    const parents: Task[] = [];
    const subMap: Record<string, Task[]> = {};

    const sortedAll = [...tasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    sortedAll.forEach(t => {
      if (t.parent_task_id) {
        if (!subMap[t.parent_task_id]) {
          subMap[t.parent_task_id] = [];
        }
        subMap[t.parent_task_id].push(t);
      } else {
        parents.push(t);
      }
    });

    return { parentTasks: parents, subtasksMap: subMap };
  }, [tasks]);

  // Statistics calculation for overview bar
  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === TaskStatus.TODO).length;
    const inProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const review = tasks.filter(t => t.status === TaskStatus.REVIEW).length;
    const done = tasks.filter(t => t.status === TaskStatus.DONE).length;
    const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, todo, inProgress, review, done, pctDone };
  }, [tasks]);

  // Filter tasks based on search & criteria while keeping position sort
  const filteredParents = useMemo(() => {
    return parentTasks
      .filter(t => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = t.title.toLowerCase().includes(q);
          const matchesDesc = (t.description || '').toLowerCase().includes(q);
          const subMatches = (subtasksMap[t.id] || []).some(st =>
            st.title.toLowerCase().includes(q)
          );
          if (!matchesTitle && !matchesDesc && !subMatches) return false;
        }

        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;

        return true;
      })
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [parentTasks, subtasksMap, searchQuery, filterStatus, filterPriority]);

  const handleStatusChange = async (
    task: Task,
    newStatus: TaskStatus,
    e?: React.ChangeEvent<HTMLSelectElement>
  ) => {
    if (e) e.stopPropagation();
    if (task.status === newStatus) return;

    const previousStatus = task.status;
    triggerVisualPulse(task.id);
    updateTask(task.id, { status: newStatus });
    addToast(
      'Task Status Updated',
      `Moved "${task.title}" to ${formatStatusText(newStatus)}`,
      'success',
      { entity_type: 'task', entity_id: task.id }
    );

    await processTaskAutomationRules({
      task: { ...task, status: newStatus },
      previousStatus,
      users,
      updateTask,
      addToast,
    });
  };

  const handleStatusToggle = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
    handleStatusChange(task, nextStatus);
  };

  // Step-by-step reorder helper (also works for touch / mobile buttons)
  const handleStepReorder = (task: Task, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const sectionList = filteredParents
      .filter(t => t.status === task.status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const currentIndex = sectionList.findIndex(t => t.id === task.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sectionList.length) return;

    triggerVisualPulse(task.id);
    moveTask(task.id, task.status, currentIndex, task.status, targetIndex);
  };

  // Drag and drop handlers supporting BOTH intra-section reordering and cross-section moves
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    soundService.play('drag_pickup');
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
    (window as unknown as Record<string, string>)._draggedTaskId = task.id;
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setActiveDragOverSection(null);
    setDragOverTaskId(null);
    delete (window as unknown as Record<string, string>)._draggedTaskId;
  };

  const handleDragOverTaskRow = (
    e: React.DragEvent<HTMLDivElement>,
    targetTask: Task,
    sectionStatus: TaskStatus
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (activeDragOverSection !== sectionStatus) {
      setActiveDragOverSection(sectionStatus);
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const placement: 'before' | 'after' = e.clientY < midY ? 'before' : 'after';

    if (dragOverTaskId !== targetTask.id || dragOverPlacement !== placement) {
      setDragOverTaskId(targetTask.id);
      setDragOverPlacement(placement);
    }
  };

  const handleDropOnTaskRow = async (
    e: React.DragEvent<HTMLDivElement>,
    targetTask: Task,
    targetStatus: TaskStatus
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const taskId =
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('taskId') ||
      (window as unknown as Record<string, string>)._draggedTaskId ||
      draggedTaskId;

    const placement = dragOverPlacement;

    setActiveDragOverSection(null);
    setDragOverTaskId(null);
    setDraggedTaskId(null);
    delete (window as unknown as Record<string, string>)._draggedTaskId;

    if (!taskId || taskId === targetTask.id) return;

    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove) return;

    const sourceList = filteredParents
      .filter(t => t.status === taskToMove.status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const originalIndex = Math.max(0, sourceList.findIndex(t => t.id === taskToMove.id));

    const targetListWithoutDragged = filteredParents
      .filter(t => t.status === targetStatus && t.id !== taskToMove.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const targetIdxInFiltered = targetListWithoutDragged.findIndex(t => t.id === targetTask.id);
    const newVisualIndex =
      targetIdxInFiltered === -1
        ? targetListWithoutDragged.length
        : placement === 'before'
        ? targetIdxInFiltered
        : targetIdxInFiltered + 1;

    const previousStatus = taskToMove.status;
    triggerVisualPulse(taskToMove.id);
    await moveTask(taskToMove.id, previousStatus, originalIndex, targetStatus, newVisualIndex);

    if (previousStatus !== targetStatus) {
      addToast(
        'Task Moved',
        `Moved "${taskToMove.title}" to ${formatStatusText(targetStatus)}`,
        'success',
        { entity_type: 'task', entity_id: taskToMove.id }
      );
      await processTaskAutomationRules({
        task: { ...taskToMove, status: targetStatus },
        previousStatus,
        users,
        updateTask,
        addToast,
      });
    }
  };

  const handleDragOverSection = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (activeDragOverSection !== status) {
      setActiveDragOverSection(status);
    }
  };

  const handleDropOnSection = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId =
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('taskId') ||
      (window as unknown as Record<string, string>)._draggedTaskId ||
      draggedTaskId;

    setActiveDragOverSection(null);
    setDragOverTaskId(null);
    setDraggedTaskId(null);
    delete (window as unknown as Record<string, string>)._draggedTaskId;

    if (!taskId) return;
    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove) return;

    const sourceList = filteredParents
      .filter(t => t.status === taskToMove.status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const originalIndex = Math.max(0, sourceList.findIndex(t => t.id === taskToMove.id));

    const targetList = filteredParents
      .filter(t => t.status === targetStatus && t.id !== taskToMove.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const previousStatus = taskToMove.status;
    triggerVisualPulse(taskToMove.id);
    await moveTask(taskToMove.id, previousStatus, originalIndex, targetStatus, targetList.length);

    if (previousStatus !== targetStatus) {
      addToast(
        'Task Status Updated',
        `Moved "${taskToMove.title}" to ${formatStatusText(targetStatus)}`,
        'success',
        { entity_type: 'task', entity_id: taskToMove.id }
      );
      await processTaskAutomationRules({
        task: { ...taskToMove, status: targetStatus },
        previousStatus,
        users,
        updateTask,
        addToast,
      });
    }
  };

  const getPriorityDot = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return 'bg-rose-500';
      case TaskPriority.HIGH:
        return 'bg-orange-500';
      case TaskPriority.MEDIUM:
        return 'bg-amber-500';
      default:
        return 'bg-slate-400';
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
      case TaskPriority.HIGH:
        return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case TaskPriority.MEDIUM:
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

  const getStatusBadgeStyle = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case TaskStatus.REVIEW:
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
    }
  };

  const formatStatusText = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IN_PROGRESS:
        return 'In Progress';
      case TaskStatus.REVIEW:
        return 'Review';
      case TaskStatus.DONE:
        return 'Done';
      default:
        return 'To Do';
    }
  };

  const renderTaskRow = (
    task: Task,
    sectionStatus: TaskStatus,
    indexInSection: number,
    totalInSection: number,
    isSubtask = false
  ) => {
    const assignee = users.find(u => u.id === task.assignee_id);
    const subList = subtasksMap[task.id] || [];
    const hasSubtasks = subList.length > 0;
    const isExpanded = !!expandedTaskIds[task.id];
    const isDone = task.status === TaskStatus.DONE;
    const isBeingDragged = draggedTaskId === task.id;
    const isDragTarget = dragOverTaskId === task.id && draggedTaskId !== task.id;
    const isRecentlyUpdated = highlightedTaskId === task.id || recentlyMovedId === task.id;

    const taskDueDate = task.due_date || task.dueDate;
    const isOverdue =
      taskDueDate &&
      !isDone &&
      isBefore(startOfDay(new Date(taskDueDate)), startOfDay(new Date()));

    const activeRowViewers = (presences || []).filter(
      p =>
        p.currentTaskId === task.id &&
        (!currentUser || p.userId !== currentUser.id) &&
        (!p.sessionId || p.sessionId !== collabService.sessionId)
    );
    const hasRowEditor = activeRowViewers.some(p => p.isEditing);
    const hasRowTyper = activeRowViewers.some(p => p.isTypingComment);
    const hasRowViewer = activeRowViewers.length > 0;
    const presenceRowClass = hasRowEditor
      ? 'ring-1 ring-inset ring-blue-500/40 bg-blue-500/5'
      : hasRowTyper
      ? 'ring-1 ring-inset ring-purple-500/40 bg-purple-500/5'
      : hasRowViewer
      ? 'ring-1 ring-inset ring-emerald-500/30 bg-emerald-500/5'
      : '';

    const GripIcon = ICON_MAP.GripVerticalIcon || ICON_MAP.Bars3Icon;

    return (
      <React.Fragment key={task.id}>
        <div
          draggable={true}
          onDragStart={e => handleDragStart(e, task)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOverTaskRow(e, task, sectionStatus)}
          onDrop={e => handleDropOnTaskRow(e, task, sectionStatus)}
          onClick={e => {
            if (e.shiftKey && onToggleSelectTask) {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelectTask(task.id, true);
              return;
            }
            onTaskClick(task.id);
          }}
          className={`group relative flex flex-row items-center justify-between py-2 px-2.5 sm:py-2.5 sm:px-3.5 border-b gap-2 sm:gap-3 transition-all cursor-grab active:cursor-grabbing select-none min-h-[44px] ${
            darkMode
              ? 'border-slate-800/80 hover:bg-slate-800/50'
              : 'border-slate-200/80 hover:bg-slate-50'
          } ${selectedTaskIds.includes(task.id) ? 'bg-accent/[0.08] ring-1 ring-inset ring-accent/50' : ''} ${
            focusedTaskId === task.id ? 'ring-1 ring-inset ring-indigo-400' : ''
          } ${isSubtask ? (darkMode ? 'bg-slate-950/40 pl-6 sm:pl-9' : 'bg-slate-50/70 pl-6 sm:pl-9') : ''} ${
            isBeingDragged ? 'opacity-35 bg-indigo-500/10 border-dashed border-indigo-500' : ''
          } ${
            isDragTarget && dragOverPlacement === 'before'
              ? 'border-t-2 !border-t-indigo-500 bg-indigo-500/5'
              : isDragTarget && dragOverPlacement === 'after'
              ? 'border-b-2 !border-b-indigo-500 bg-indigo-500/5'
              : ''
          } ${isRecentlyUpdated ? 'animate-state-updated' : ''} ${presenceRowClass}`}
        >
          {/* Left Side: Multi-Select Checkbox + Grip + Subtask Toggle + Done Checkbox + Slim Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            {onToggleSelectTask && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onToggleSelectTask(task.id, e.shiftKey);
                }}
                title="Select task for bulk action"
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                  selectedTaskIds.includes(task.id)
                    ? 'bg-accent border-accent text-white'
                    : 'border-slate-300 dark:border-slate-600 opacity-50 group-hover:opacity-100'
                }`}
              >
                {selectedTaskIds.includes(task.id) && <ICON_MAP.CheckIcon className="w-2.5 h-2.5 stroke-[3]" />}
              </button>
            )}
            {/* Drag Handle Icon */}
            <div
              className="text-slate-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 cursor-grab"
              title="Drag to reorder within section or move across sections"
            >
              <GripIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-70 group-hover:opacity-100" />
            </div>

            {/* Expand Chevron for subtasks (only rendered if task has subtasks on mobile to save horizontal space) */}
            {!isSubtask && hasSubtasks && (
              <button
                type="button"
                onClick={e => toggleExpand(task.id, e)}
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-transform flex-shrink-0"
                title="Toggle Subtasks"
              >
                <ICON_MAP.ChevronDownIcon
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isExpanded ? 'transform rotate-180' : ''
                  }`}
                />
              </button>
            )}

            {/* Done Checkbox Toggle */}
            <button
              type="button"
              onClick={e => handleStatusToggle(task, e)}
              className={`w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                isDone
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                  : darkMode
                  ? 'border-slate-600 hover:border-indigo-400'
                  : 'border-slate-300 hover:border-indigo-500'
              }`}
              title={isDone ? 'Mark as To Do' : 'Mark as Done'}
            >
              {isDone && <ICON_MAP.CheckIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
            </button>

            {/* Mobile Priority Dot */}
            <span
              className={`sm:hidden w-2 h-2 rounded-full flex-shrink-0 ${getPriorityDot(task.priority)}`}
              title={`Priority: ${task.priority}`}
            />

            {/* Task Title & Inline Compact Metadata */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span
                  className={`text-xs sm:text-sm font-semibold truncate ${
                    isDone
                      ? 'line-through text-slate-400 dark:text-slate-500'
                      : darkMode
                      ? 'text-slate-100 group-hover:text-indigo-400'
                      : 'text-slate-900 group-hover:text-indigo-600'
                  }`}
                >
                  {task.title}
                </span>

                {isRecentlyUpdated && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 flex-shrink-0 animate-state-badge">
                    ✓ Updated
                  </span>
                )}

                {!isSubtask && hasSubtasks && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {subList.filter(s => s.status === TaskStatus.DONE).length}/{subList.length}
                  </span>
                )}

                <TaskLivePresenceBadge taskId={task.id} />
              </div>

              {/* Description only shown on desktop >=640px to keep mobile list rows ultra-slim */}
              {task.description && (
                <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Side: Slim Inline Controls on Mobile & Desktop */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            {/* Intra-section Up/Down Reorder Buttons (great for mobile touch & precision ordering) */}
            {!isSubtask && totalInSection > 1 && (
              <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  disabled={indexInSection === 0}
                  onClick={e => handleStepReorder(task, 'up', e)}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-slate-400 hover:text-indigo-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-25 cursor-pointer"
                  title="Move up in section"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={indexInSection === totalInSection - 1}
                  onClick={e => handleStepReorder(task, 'down', e)}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-slate-400 hover:text-indigo-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-25 cursor-pointer"
                  title="Move down in section"
                >
                  ↓
                </button>
              </div>
            )}

            {/* Compact Status Selector Pill */}
            <select
              value={task.status}
              onClick={e => e.stopPropagation()}
              onChange={e => handleStatusChange(task, e.target.value as TaskStatus, e)}
              className={`!w-auto !py-0.5 !px-2 sm:!py-1 sm:!px-2.5 !rounded-full text-[10px] sm:text-xs font-semibold border transition-all cursor-pointer ${getStatusBadgeStyle(
                task.status
              )}`}
            >
              <option value={TaskStatus.TODO}>To Do</option>
              <option value={TaskStatus.IN_PROGRESS}>In Prog</option>
              <option value={TaskStatus.REVIEW}>Review</option>
              <option value={TaskStatus.DONE}>Done</option>
            </select>

            {/* Priority Pill (Desktop / Tablet) */}
            <div className="hidden md:block">
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getPriorityBadge(
                  task.priority
                )}`}
              >
                {task.priority}
              </span>
            </div>

            {/* Due Date (Compact on Mobile & Desktop) */}
            {taskDueDate && (
              <span
                className={`hidden xs:inline-flex items-center gap-1 text-[10px] sm:text-xs font-mono tabular-nums ${
                  isOverdue
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : darkMode
                    ? 'text-slate-400'
                    : 'text-slate-500'
                }`}
              >
                {format(new Date(taskDueDate), 'MMM d')}
              </span>
            )}

            {/* Compact Assignee Avatar */}
            <div
              className="flex items-center gap-1.5"
              title={assignee ? assignee.full_name || assignee.email : 'Unassigned'}
            >
              {assignee ? (
                <>
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold flex items-center justify-center text-[10px] overflow-hidden flex-shrink-0">
                    {assignee.avatar_url ? (
                      <img src={assignee.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (assignee.full_name || assignee.email).charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="hidden lg:inline text-xs text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                    {assignee.full_name || assignee.email.split('@')[0]}
                  </span>
                </>
              ) : (
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-dashed border-slate-400/60 flex items-center justify-center text-[9px] text-slate-400">
                  ?
                </span>
              )}
            </div>

            {/* Start Focus Timer Button */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                startTaskTimer(task);
              }}
              className="opacity-60 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-500 rounded-full transition-all cursor-pointer"
              title="Start Focus Timer"
            >
              <ICON_MAP.ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (window.confirm(`Delete task "${task.title}"?`)) {
                  deleteTask(task.id);
                  addToast('Task Deleted', `Deleted "${task.title}"`, 'error');
                }
              }}
              className="opacity-60 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-full transition-all cursor-pointer"
              title="Delete Task"
            >
              <ICON_MAP.TrashIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Nested Subtasks */}
        {!isSubtask && isExpanded && hasSubtasks && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/40 border-l-2 border-indigo-500/40 ml-3 sm:ml-6">
            {subList.map((st, idx) => renderTaskRow(st, sectionStatus, idx, subList.length, true))}
          </div>
        )}
      </React.Fragment>
    );
  };

  const renderGroupedTasks = (status: TaskStatus, title: string, color: string) => {
    const group = filteredParents
      .filter(t => t.status === status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const isDragOver = activeDragOverSection === status;

    return (
      <div
        key={status}
        onDragOver={e => handleDragOverSection(e, status)}
        onDrop={e => handleDropOnSection(e, status)}
        className="mb-4 sm:mb-6 transition-all"
      >
        <div
          className={`flex items-center justify-between mb-1.5 sm:mb-2 px-3 sm:px-4 py-2 rounded-2xl transition-all ${
            isDragOver
              ? 'bg-indigo-500/15 border-2 border-dashed border-indigo-500 text-indigo-500 scale-[1.005]'
              : 'bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${color} shadow-xs`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {title}
            </h3>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {group.length}
            </span>
            {isDragOver && (
              <span className="text-[11px] font-bold text-indigo-500 animate-pulse ml-1">
                Drop to reorder or move into {title}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => openModal()}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-indigo-500/10 transition-colors cursor-pointer"
          >
            <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>

        <div
          className={`rounded-[22px] border shadow-2xs overflow-hidden transition-all ${
            isDragOver
              ? 'border-2 border-dashed border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20'
              : darkMode
              ? 'bg-slate-900/90 border-slate-800'
              : 'bg-white border-slate-200/80'
          }`}
        >
          {group.length === 0 ? (
            <div
              className={`p-6 text-center text-xs italic transition-colors ${
                isDragOver ? 'text-indigo-500 font-bold' : 'text-slate-400'
              }`}
            >
              {isDragOver ? `Release to place task into ${title}` : `No tasks in ${title.toLowerCase()}`}
            </div>
          ) : (
            group.map((t, idx) => renderTaskRow(t, status, idx, group.length))
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex-1 flex flex-col rounded-[28px] border ${
        darkMode ? 'bg-slate-900/85 border-slate-800' : 'bg-white/95 border-slate-200'
      } shadow-xs`}
    >
      {/* Overview Progress Header */}
      <div
        className={`p-3 sm:p-4 border-b rounded-t-[28px] space-y-2 flex-shrink-0 ${
          darkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/80'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ICON_MAP.ClipboardListIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Task List Overview
            </h2>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              {stats.total} Tasks ({stats.pctDone}% Done)
            </span>
          </div>

          <div className="hidden sm:flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400">Drag rows to reorder inside any section or across sections</span>
          </div>
        </div>

        {/* Overall Completion Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden flex">
          <div
            style={{ width: `${(stats.done / Math.max(1, stats.total)) * 100}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title="Done"
          />
          <div
            style={{ width: `${(stats.review / Math.max(1, stats.total)) * 100}%` }}
            className="bg-purple-500 h-full transition-all duration-500"
            title="Review"
          />
          <div
            style={{ width: `${(stats.inProgress / Math.max(1, stats.total)) * 100}%` }}
            className="bg-blue-500 h-full transition-all duration-500"
            title="In Progress"
          />
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div
        className={`mx-2 sm:mx-4 mt-2.5 sm:mt-3.5 mb-1 p-2 sm:p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 flex-shrink-0 transition-all ${
          darkMode ? 'border-slate-800/80 bg-slate-900/60' : 'border-slate-200/90 bg-slate-100/70'
        }`}
      >
        <div className="relative flex-1 min-w-[150px] max-w-sm">
          <ICON_MAP.MagnifyingGlassIcon
            className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          />
          <input
            type="text"
            placeholder="Filter tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.25rem', paddingRight: '1.75rem' }}
            className="!py-1.5 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Clear Search"
            >
              <ICON_MAP.XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="!w-auto !py-1 !px-2.5 text-xs font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value={TaskStatus.TODO}>To Do</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.REVIEW}>Review</option>
            <option value={TaskStatus.DONE}>Done</option>
          </select>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="!w-auto !py-1 !px-2.5 text-xs font-semibold"
          >
            <option value="all">All Priorities</option>
            <option value={TaskPriority.LOW}>Low</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.HIGH}>High</option>
            <option value={TaskPriority.CRITICAL}>Critical</option>
          </select>

          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as 'status' | 'none')}
            className="!w-auto !py-1 !px-2.5 text-xs font-semibold"
          >
            <option value="status">Grouped</option>
            <option value="none">Flat List</option>
          </select>
        </div>
      </div>

      {/* Main List Body */}
      <div className="flex-1 min-h-[260px] p-2 sm:p-4">
        {groupBy === 'status' ? (
          <>
            {renderGroupedTasks(TaskStatus.TODO, 'To Do', 'bg-slate-400')}
            {renderGroupedTasks(TaskStatus.IN_PROGRESS, 'In Progress', 'bg-blue-500')}
            {renderGroupedTasks(TaskStatus.REVIEW, 'Review', 'bg-purple-500')}
            {renderGroupedTasks(TaskStatus.DONE, 'Done', 'bg-emerald-500')}
          </>
        ) : (
          <div
            className={`rounded-[22px] border shadow-2xs overflow-hidden ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {filteredParents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No matching tasks found.</div>
            ) : (
              filteredParents.map((t, idx) =>
                renderTaskRow(t, t.status, idx, filteredParents.length)
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
