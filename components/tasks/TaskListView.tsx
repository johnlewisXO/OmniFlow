import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority, User } from '../../types';
import { ICON_MAP } from '../../constants';
import { useAppStore } from '../../hooks/useAppStore';
import { format, isBefore, startOfDay } from 'date-fns';
import { processTaskAutomationRules } from '../../services/automationEngine';

interface TaskListViewProps {
  tasks: Task[];
  users: User[];
  darkMode: boolean;
  onTaskClick: (taskId: string) => void;
  onQuickCreateTask?: (status: TaskStatus) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  users,
  darkMode,
  onTaskClick,
}) => {
  const { 
    updateTask,
    openModal,
    deleteTask,
    addToast
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'status' | 'none'>('status');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeDragOverSection, setActiveDragOverSection] = useState<TaskStatus | null>(null);

  const toggleExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Separate parent tasks and subtasks
  const { parentTasks, subtasksMap } = useMemo(() => {
    const parents: Task[] = [];
    const subMap: Record<string, Task[]> = {};

    tasks.forEach((t) => {
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

  // Filter tasks based on search & criteria
  const filteredParents = useMemo(() => {
    return parentTasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        const subMatches = (subtasksMap[t.id] || []).some((st) =>
          st.title.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesDesc && !subMatches) return false;
      }

      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;

      return true;
    });
  }, [parentTasks, subtasksMap, searchQuery, filterStatus, filterPriority]);

  const handleStatusChange = async (task: Task, newStatus: TaskStatus, e?: React.ChangeEvent<HTMLSelectElement>) => {
    if (e) e.stopPropagation();
    if (task.status === newStatus) return;

    const previousStatus = task.status;
    updateTask(task.id, { status: newStatus });
    addToast(
      'Task Status Updated', 
      `Moved "${task.title}" to ${formatStatusText(newStatus)}`, 
      'success'
    );

    // Run Automation Triggers Engine
    await processTaskAutomationRules({
      task: { ...task, status: newStatus },
      previousStatus,
      users,
      updateTask,
      addToast
    });
  };

  const handleStatusToggle = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
    handleStatusChange(task, nextStatus);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
    (window as any)._draggedTaskId = task.id;
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setActiveDragOverSection(null);
    delete (window as any)._draggedTaskId;
  };

  const handleDragOverSection = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (activeDragOverSection !== status) {
      setActiveDragOverSection(status);
    }
  };

  const handleDropOnSection = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('taskId') || (window as any)._draggedTaskId || draggedTaskId;
    setActiveDragOverSection(null);
    setDraggedTaskId(null);
    delete (window as any)._draggedTaskId;

    if (!taskId) return;
    const taskToMove = tasks.find((t) => t.id === taskId);
    if (taskToMove && taskToMove.status !== targetStatus) {
      handleStatusChange(taskToMove, targetStatus);
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

  const renderTaskRow = (task: Task, sectionStatus: TaskStatus, isSubtask = false) => {
    const assignee = users.find((u) => u.id === task.assignee_id);
    const subList = subtasksMap[task.id] || [];
    const hasSubtasks = subList.length > 0;
    const isExpanded = !!expandedTaskIds[task.id];
    const isDone = task.status === TaskStatus.DONE;
    const isBeingDragged = draggedTaskId === task.id;

    const isOverdue =
      task.due_date &&
      !isDone &&
      isBefore(startOfDay(new Date(task.due_date)), startOfDay(new Date()));

    const GripIcon = ICON_MAP.GripVerticalIcon || ICON_MAP.Bars3Icon;

    return (
      <React.Fragment key={task.id}>
        <div
          draggable={true}
          onDragStart={(e) => handleDragStart(e, task)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOverSection(e, sectionStatus)}
          onDrop={(e) => handleDropOnSection(e, sectionStatus)}
          onClick={() => onTaskClick(task.id)}
          className={`group flex flex-col md:flex-row md:items-center justify-between p-3.5 border-b gap-3 transition-all cursor-grab active:cursor-grabbing select-none ${
            darkMode
              ? 'border-slate-800/80 hover:bg-slate-800/50'
              : 'border-slate-200/80 hover:bg-slate-50'
          } ${isSubtask ? (darkMode ? 'bg-slate-950/40 pl-8 md:pl-10' : 'bg-slate-50/70 pl-8 md:pl-10') : ''} ${
            isBeingDragged ? 'opacity-40 bg-accent/10 border-dashed border-accent' : ''
          }`}
        >
          {/* Main Title & Checkbox Area */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Drag Handle Icon */}
            <div className="text-slate-400 group-hover:text-accent transition-colors flex-shrink-0 cursor-grab" title="Drag to move between sections">
              <GripIcon className="w-4 h-4 opacity-70 group-hover:opacity-100" />
            </div>

            {/* Expand Chevron for subtasks */}
            {!isSubtask && (
              <button
                onClick={(e) => toggleExpand(task.id, e)}
                className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-transform ${
                  hasSubtasks ? 'visible' : 'invisible'
                }`}
                title="Toggle Subtasks"
              >
                <ICON_MAP.ChevronDownIcon
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    isExpanded ? 'transform rotate-180' : ''
                  }`}
                />
              </button>
            )}

            {/* Done Checkbox Toggle */}
            <button
              onClick={(e) => handleStatusToggle(task, e)}
              className={`w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${
                isDone
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                  : darkMode
                  ? 'border-slate-600 hover:border-accent'
                  : 'border-slate-300 hover:border-accent'
              }`}
              title={isDone ? "Mark as To Do" : "Mark as Done"}
            >
              {isDone && <ICON_MAP.CheckIcon className="w-3 h-3 stroke-[3]" />}
            </button>

            {/* Task Title & Subtask Indicator */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold truncate ${
                    isDone
                      ? 'line-through text-slate-400 dark:text-slate-500'
                      : darkMode
                      ? 'text-slate-100 group-hover:text-accent'
                      : 'text-slate-900 group-hover:text-accent'
                  }`}
                >
                  {task.title}
                </span>

                {!isSubtask && hasSubtasks && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {subList.filter((s) => s.status === TaskStatus.DONE).length}/{subList.length} subtasks
                  </span>
                )}
              </div>

              {task.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Controls / Metadata (Status Dropdown, Priority, Assignee, Actions) */}
          <div className="flex items-center justify-between md:justify-end gap-3 flex-wrap md:flex-nowrap pt-1 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/50">
            {/* Interactive Section / Status Selector Dropdown */}
            <div className="flex items-center gap-1 min-w-[125px]">
              <span className="text-[11px] text-slate-400 md:hidden font-medium">Status:</span>
              <select
                value={task.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus, e)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-accent outline-hidden ${getStatusBadgeStyle(
                  task.status
                )}`}
              >
                <option value={TaskStatus.TODO}>To Do</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.REVIEW}>Review</option>
                <option value={TaskStatus.DONE}>Done</option>
              </select>
            </div>

            {/* Priority Badge */}
            <div className="hidden sm:block">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${getPriorityBadge(
                  task.priority
                )}`}
              >
                {task.priority}
              </span>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-1.5 min-w-[110px]">
              {assignee ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-accent/20 text-accent font-semibold flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
                    {assignee.avatar_url ? (
                      <img src={assignee.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (assignee.full_name || assignee.email).charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                    {assignee.full_name || assignee.email.split('@')[0]}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400 italic">Unassigned</span>
              )}
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-1 text-xs min-w-[90px]">
              {task.due_date ? (
                <span
                  className={`flex items-center gap-1 font-medium ${
                    isOverdue
                      ? 'text-red-600 dark:text-red-400 font-bold'
                      : darkMode
                      ? 'text-slate-400'
                      : 'text-slate-600'
                  }`}
                >
                  <ICON_MAP.ClockIcon className="w-3.5 h-3.5" />
                  {format(new Date(task.due_date), 'MMM d')}
                </span>
              ) : (
                <span className="text-slate-400 text-[11px]">-</span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete task "${task.title}"?`)) {
                    deleteTask(task.id);
                    addToast('Task Deleted', `Deleted "${task.title}"`, 'error');
                  }
                }}
                className="opacity-70 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-all"
                title="Delete Task"
              >
                <ICON_MAP.TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Nested Subtasks */}
        {!isSubtask && isExpanded && hasSubtasks && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/40 border-l-2 border-accent/40 ml-4 md:ml-6">
            {subList.map((st) => renderTaskRow(st, sectionStatus, true))}
          </div>
        )}
      </React.Fragment>
    );
  };

  const renderGroupedTasks = (status: TaskStatus, title: string, color: string) => {
    const group = filteredParents.filter((t) => t.status === status);
    const isDragOver = activeDragOverSection === status;

    return (
      <div 
        key={status} 
        onDragOver={(e) => handleDragOverSection(e, status)}
        onDrop={(e) => handleDropOnSection(e, status)}
        className="mb-6 transition-all"
      >
        <div className={`flex items-center justify-between mb-2 px-4 py-2.5 rounded-xl transition-all ${
          isDragOver
            ? 'bg-accent/20 border-2 border-dashed border-accent text-accent scale-[1.01]'
            : 'bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full ${color} shadow-xs`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {title}
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {group.length}
            </span>
            {isDragOver && (
              <span className="text-xs font-extrabold text-accent animate-pulse ml-2">
                Drop task here to move to {title}
              </span>
            )}
          </div>

          <button
            onClick={() => openCreateTaskModal(status)}
            className="text-xs font-semibold text-accent hover:text-accent-dark flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-accent/10 transition-colors"
          >
            <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>

        <div className={`rounded-xl border shadow-sm overflow-hidden transition-all ${
          isDragOver
            ? 'border-2 border-dashed border-accent bg-accent/5 ring-4 ring-accent/20'
            : darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}>
          {group.length === 0 ? (
            <div className={`p-8 text-center text-xs italic transition-colors ${
              isDragOver ? 'text-accent font-bold' : 'text-slate-400'
            }`}>
              {isDragOver ? `Release to place task into ${title}` : `No tasks in ${title.toLowerCase()}`}
            </div>
          ) : (
            group.map((t) => renderTaskRow(t, status))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex-1 flex flex-col min-h-0 h-full rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm overflow-y-auto md:overflow-hidden`}>
      {/* Overview Progress Header */}
      <div className={`p-3 sm:p-4 border-b space-y-2.5 sm:space-y-3 flex-shrink-0 ${darkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/80'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <ICON_MAP.ClipboardListIcon className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Task List Overview</h2>
            <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full bg-accent/10 text-accent">
              {stats.total} Tasks ({stats.pctDone}% Complete)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
            <span className="text-slate-500 font-medium">Sections:</span>
            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">To Do: {stats.todo}</span>
            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">In Progress: {stats.inProgress}</span>
            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold">Review: {stats.review}</span>
            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">Done: {stats.done}</span>
          </div>
        </div>

        {/* Overall Completion Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
          <div style={{ width: `${(stats.done / Math.max(1, stats.total)) * 100}%` }} className="bg-emerald-500 h-full transition-all" title="Done" />
          <div style={{ width: `${(stats.review / Math.max(1, stats.total)) * 100}%` }} className="bg-purple-500 h-full transition-all" title="Review" />
          <div style={{ width: `${(stats.inProgress / Math.max(1, stats.total)) * 100}%` }} className="bg-blue-500 h-full transition-all" title="In Progress" />
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className={`mx-2 sm:mx-4 mt-3 sm:mt-4 mb-2 p-2.5 sm:p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0 transition-all ${
        darkMode ? 'border-slate-800/80 bg-slate-900/60 shadow-inner' : 'border-slate-200/90 bg-slate-100/70 shadow-sm'
      }`}>
        {/* Search Bar - Non-overlapping Icon & Padding Fix */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <ICON_MAP.MagnifyingGlassIcon className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            placeholder="Search tasks, descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
            className={`w-full py-1.5 sm:py-2 rounded-lg border text-xs font-medium outline-hidden transition-all ${
              darkMode 
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-accent' 
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-accent'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Clear Search"
            >
              <ICON_MAP.XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters & Layout */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`text-xs rounded-lg px-2.5 py-1.5 border font-semibold ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
          >
            <option value="all">All Statuses</option>
            <option value={TaskStatus.TODO}>To Do</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.REVIEW}>Review</option>
            <option value={TaskStatus.DONE}>Done</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className={`text-xs rounded-lg px-2.5 py-1.5 border font-semibold ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
          >
            <option value="all">All Priorities</option>
            <option value={TaskPriority.LOW}>Low Priority</option>
            <option value={TaskPriority.MEDIUM}>Medium Priority</option>
            <option value={TaskPriority.HIGH}>High Priority</option>
            <option value={TaskPriority.CRITICAL}>Critical Priority</option>
          </select>

          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <span className="hidden sm:inline">View:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className={`text-xs rounded-lg px-2 py-1.5 border font-semibold ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
            >
              <option value="status">Grouped</option>
              <option value="none">Flat Table</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main List Body */}
      <div className="flex-1 min-h-[300px] overflow-y-auto p-2 sm:p-4 scrollbar-thin">
        {groupBy === 'status' ? (
          <>
            {renderGroupedTasks(TaskStatus.TODO, 'To Do', 'bg-slate-400')}
            {renderGroupedTasks(TaskStatus.IN_PROGRESS, 'In Progress', 'bg-blue-500')}
            {renderGroupedTasks(TaskStatus.REVIEW, 'Review', 'bg-purple-500')}
            {renderGroupedTasks(TaskStatus.DONE, 'Done', 'bg-emerald-500')}
          </>
        ) : (
          <div className={`rounded-xl border shadow-sm overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {filteredParents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No matching tasks found.</div>
            ) : (
              filteredParents.map((t) => renderTaskRow(t, t.status))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
