import React, { useState, useMemo, useRef } from 'react';
import { Task, TaskStatus, TaskPriority, User } from '../../types';
import { ICON_MAP } from '../../constants';
import { useAppStore } from '../../hooks/useAppStore';
import { format, addDays, differenceInDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { processTaskAutomationRules } from '../../services/automationEngine';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface GanttTimelineViewProps {
  tasks: Task[];
  users: User[];
  darkMode: boolean;
  onTaskClick: (taskId: string) => void;
}

export const GanttTimelineView: React.FC<GanttTimelineViewProps> = ({
  tasks,
  users,
  darkMode,
  onTaskClick,
}) => {
  const { updateTask, addToast, projects, openCreateTaskModal } = useAppStore();

  const [viewScale, setViewScale] = useState<'days' | 'weeks' | 'months'>('days');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hierarchyMode, setHierarchyMode] = useState<'tree' | 'flat'>('tree');
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true);
  const [showStatsOverview, setShowStatsOverview] = useState<boolean>(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [hoveredTask, setHoveredTask] = useState<Task | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const dayColWidth = viewScale === 'months' ? 140 : viewScale === 'weeks' ? 110 : 70;

  const toggleExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

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

    await processTaskAutomationRules({
      task: { ...task, status: newStatus },
      previousStatus,
      users,
      updateTask,
      addToast
    });
  };

  const formatStatusText = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IN_PROGRESS:
        return 'In Progress';
      case TaskStatus.REVIEW:
        return 'Need Review';
      case TaskStatus.DONE:
        return 'Completed';
      default:
        return 'To Do';
    }
  };

  // Group into parent tasks and subtasks map with search and filters
  const { parentTasks, subtasksMap, allFlatFiltered } = useMemo(() => {
    const parents: Task[] = [];
    const subMap: Record<string, Task[]> = {};
    const flat: Task[] = [];

    tasks.forEach((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return;
      }

      if (filterStatus !== 'all' && t.status !== filterStatus) return;
      if (filterAssignee !== 'all') {
        if (filterAssignee === 'unassigned' && t.assignee_id) return;
        if (filterAssignee !== 'unassigned' && t.assignee_id !== filterAssignee) return;
      }

      flat.push(t);
      if (t.parent_task_id) {
        if (!subMap[t.parent_task_id]) subMap[t.parent_task_id] = [];
        subMap[t.parent_task_id].push(t);
      } else {
        parents.push(t);
      }
    });

    return { parentTasks: parents, subtasksMap: subMap, allFlatFiltered: flat };
  }, [tasks, filterStatus, filterAssignee, searchQuery]);

  // Compute stats for charts matching Image 2
  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === TaskStatus.TODO).length;
    const inProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const review = tasks.filter((t) => t.status === TaskStatus.REVIEW).length;
    const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    const donutData = [
      { name: 'In Progress', value: inProgress, color: '#3b82f6' },
      { name: 'Completed', value: done, color: '#10b981' },
      { name: 'Need Review', value: review, color: '#f59e0b' },
      { name: 'To Do / Backlog', value: todo, color: '#ef4444' },
    ].filter((d) => d.value > 0);

    const barData = [
      { name: 'In Progress', count: inProgress, fill: '#3b82f6' },
      { name: 'Completed', count: done, fill: '#10b981' },
      { name: 'Need Review', count: review, fill: '#f59e0b' },
      { name: 'Backlog', count: todo, fill: '#ef4444' },
    ];

    return { total, todo, inProgress, review, done, completionRate, donutData, barData };
  }, [tasks]);

  // Determine timeline date span
  const { startDate, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    let minDate = today;
    let maxDate = addDays(today, 14);

    allFlatFiltered.forEach((task) => {
      const created = task.created_at ? startOfDay(new Date(task.created_at)) : today;
      const due = task.due_date ? startOfDay(new Date(task.due_date)) : addDays(created, 5);

      if (isBefore(created, minDate)) minDate = created;
      if (isAfter(due, maxDate)) maxDate = due;
    });

    // Add padding
    minDate = addDays(minDate, -2);
    maxDate = addDays(maxDate, 5);

    const stepMin = viewScale === 'months' ? 60 : viewScale === 'weeks' ? 28 : 14;
    const diff = Math.max(stepMin, differenceInDays(maxDate, minDate) + 1);
    return { startDate: minDate, endDate: maxDate, totalDays: diff };
  }, [allFlatFiltered, viewScale]);

  // Header days generator
  const daysHeader = useMemo(() => {
    const days = [];
    const step = viewScale === 'months' ? 14 : viewScale === 'weeks' ? 7 : 1;
    for (let i = 0; i < totalDays; i += step) {
      days.push(addDays(startDate, i));
    }
    return days;
  }, [startDate, totalDays, viewScale]);

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/20';
      case TaskStatus.REVIEW:
        return 'bg-amber-500 border-amber-600 text-white shadow-amber-500/20';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-600 border-blue-700 text-white shadow-blue-500/20';
      default:
        return 'bg-rose-500 border-rose-600 text-white shadow-rose-500/20';
    }
  };

  const getStatusBadgeStyle = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case TaskStatus.REVIEW:
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      default:
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30';
      case TaskPriority.HIGH:
        return 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case TaskPriority.MEDIUM:
        return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

  const scrollToToday = () => {
    if (scrollContainerRef.current) {
      const todayIndex = daysHeader.findIndex(
        (d) => format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      );
      if (todayIndex !== -1) {
        const targetLeft = todayIndex * dayColWidth - 150;
        scrollContainerRef.current.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
      }
    }
  };

  const renderTimelineRow = (task: Task, isSubtask = false) => {
    const created = task.created_at ? startOfDay(new Date(task.created_at)) : startDate;
    const due = task.due_date ? startOfDay(new Date(task.due_date)) : addDays(created, 4);

    const startOffsetDays = Math.max(0, differenceInDays(created, startDate));
    const durationDays = Math.max(1, differenceInDays(due, created) + 1);

    const leftPx = startOffsetDays * dayColWidth;
    const widthPx = Math.max(dayColWidth * 0.8, durationDays * dayColWidth);
    const trackWidthPx = daysHeader.length * dayColWidth;

    const assignee = users.find((u) => u.id === task.assignee_id);
    const subList = subtasksMap[task.id] || [];
    const hasSubtasks = subList.length > 0;
    const isExpanded = !!expandedTaskIds[task.id];

    const isShortBar = widthPx < 90;

    return (
      <React.Fragment key={task.id}>
        <div
          onClick={() => onTaskClick(task.id)}
          onMouseEnter={() => setHoveredTask(task)}
          onMouseLeave={() => setHoveredTask(null)}
          className={`flex items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group ${
            isSubtask ? (darkMode ? 'bg-slate-950/40' : 'bg-slate-50/50') : ''
          }`}
        >
          {/* Left Task Metadata Column (Sticky Left) */}
          {showLeftSidebar && (
            <div className={`w-[200px] sm:w-[240px] md:w-[280px] min-w-[200px] sm:min-w-[240px] md:min-w-[280px] p-2 sm:p-2.5 flex items-center justify-between gap-1.5 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 sticky left-0 z-30 shadow-xs ${
              darkMode ? 'bg-slate-900' : 'bg-white'
            }`}>
              <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                {!isSubtask ? (
                  <button
                    onClick={(e) => toggleExpand(task.id, e)}
                    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-transform ${
                      hasSubtasks ? 'visible' : 'invisible'
                    }`}
                  >
                    <ICON_MAP.ChevronDownIcon
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isExpanded ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>
                ) : (
                  <span className="text-slate-400 text-xs font-mono ml-3">└─</span>
                )}

                {/* Task Title */}
                <span className={`text-xs font-semibold truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'} group-hover:text-accent`}>
                  {task.title}
                </span>

                {!isSubtask && hasSubtasks && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {subList.length}
                  </span>
                )}
              </div>

              {/* Status Move Selector right in Left Bar */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <select
                  value={task.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus, e)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-all cursor-pointer ${getStatusBadgeStyle(
                    task.status
                  )}`}
                >
                  <option value={TaskStatus.TODO}>To Do</option>
                  <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                  <option value={TaskStatus.REVIEW}>Need Review</option>
                  <option value={TaskStatus.DONE}>Completed</option>
                </select>
              </div>
            </div>
          )}

          {/* Timeline Bar Track */}
          <div className="relative h-12 flex items-center px-1 flex-shrink-0" style={{ width: `${trackWidthPx}px` }}>
            {/* Grid Line Backdrops */}
            <div className="absolute inset-0 flex pointer-events-none">
              {daysHeader.map((d, idx) => {
                const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div
                    key={idx}
                    style={{ width: `${dayColWidth}px`, minWidth: `${dayColWidth}px` }}
                    className={`border-r ${darkMode ? 'border-slate-800/40' : 'border-slate-100'} ${
                      isToday ? 'bg-accent/10 border-accent/30' : ''
                    }`}
                  />
                );
              })}
            </div>

            {/* Timeline Bar Container */}
            <div
              style={{
                left: `${leftPx}px`,
                width: `${widthPx}px`,
              }}
              className={`absolute h-8 rounded-xl border text-xs font-bold flex items-center justify-between px-2.5 shadow-xs transition-all hover:shadow-md hover:scale-[1.01] ${
                isSubtask ? 'opacity-90 border-dashed' : ''
              } ${getStatusColor(task.status)}`}
            >
              {/* Task Title preview inside bar */}
              <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0 pr-1">
                <span className="truncate text-xs font-extrabold text-white drop-shadow-xs">
                  {task.title}
                </span>
              </div>

              {/* Quick Status Dropdown inside bar */}
              <select
                value={task.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus, e)}
                className="text-[9px] font-black bg-black/25 text-white rounded px-1.5 py-0.5 border border-white/40 cursor-pointer hover:bg-black/50 focus:outline-hidden flex-shrink-0"
                title="Change status"
              >
                <option value={TaskStatus.TODO} className="text-slate-900 bg-white">To Do</option>
                <option value={TaskStatus.IN_PROGRESS} className="text-slate-900 bg-white">In Progress</option>
                <option value={TaskStatus.REVIEW} className="text-slate-900 bg-white">Need Review</option>
                <option value={TaskStatus.DONE} className="text-slate-900 bg-white">Completed</option>
              </select>
            </div>

            {/* External Task Title Preview right after the bar */}
            {isShortBar && (
              <div
                style={{
                  left: `${leftPx + widthPx + 8}px`,
                }}
                className="absolute flex items-center gap-1.5 text-xs font-bold pointer-events-none z-10 truncate"
              >
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold shadow-2xs ${
                  darkMode ? 'bg-slate-800/90 text-white border border-slate-700' : 'bg-white/95 text-slate-800 border border-slate-200'
                }`}>
                  {task.title}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Render nested subtasks if expanded */}
        {!isSubtask && hierarchyMode === 'tree' && isExpanded && hasSubtasks && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
            {subList.map((st) => renderTimelineRow(st, true))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className={`flex-1 flex flex-col min-h-0 h-full rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm overflow-y-auto md:overflow-hidden`}>
      {/* Top Header Bar */}
      <div className={`p-3.5 sm:p-4 md:p-5 border-b flex flex-wrap items-center justify-between gap-3 flex-shrink-0 ${darkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/60'}`}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Project Schedule & Gantt Timeline
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-bold">
              {allFlatFiltered.length} Scheduled
            </span>
          </div>
          <p className={`text-xs mt-0.5 hidden sm:block ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Track project milestones, task durations, status progression, and team dependencies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStatsOverview((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              showStatsOverview
                ? 'bg-accent/10 border-accent/30 text-accent'
                : darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            {showStatsOverview ? 'Hide Dashboard' : 'Analytics Dashboard'}
          </button>
          <button
            onClick={() => openCreateTaskModal()}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-accent hover:bg-accent-hover text-white shadow-xs transition-all flex items-center gap-1"
          >
            <ICON_MAP.PlusIcon className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Analytics & Breakdown Cards */}
      {showStatsOverview && (
        <div className={`p-3 sm:p-4 border-b grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/30'}`}>
          {/* Donut Category / Status Progress Chart */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Category Breakdown
              </h3>
              <span className="text-xs font-bold text-accent">{stats.completionRate}% Done</span>
            </div>

            <div className="flex items-center gap-3 h-32">
              <div className="w-24 h-24 relative flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={22}
                      outerRadius={36}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stats.donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-black text-slate-900 dark:text-white">{stats.total}</span>
                  <span className="text-[8px] font-semibold text-slate-400 uppercase">Tasks</span>
                </div>
              </div>

              <div className="flex-1 space-y-1 text-xs">
                {stats.donutData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] font-semibold">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-600 dark:text-slate-300 truncate">{d.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white ml-1">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status Column Bar Chart */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Status Distribution
              </h3>
              <span className="text-[10px] text-slate-400">Live Metrics</span>
            </div>

            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.barData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Schedule Health Card */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Timeline Bounds
                </h3>
                <span className="text-xs font-bold text-emerald-500">Active</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Execution range: <strong className="text-slate-800 dark:text-slate-200">{format(startDate, 'MMM d, yyyy')}</strong> to <strong className="text-slate-800 dark:text-slate-200">{format(addDays(startDate, totalDays), 'MMM d, yyyy')}</strong>.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 mt-2">
              <ICON_MAP.CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block leading-tight">
                  Schedule Healthy
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {stats.done} of {stats.total} tasks completed on schedule.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className={`mx-4 mt-4 mb-2 p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 transition-all ${
        darkMode ? 'border-slate-800/80 bg-slate-900/60 shadow-inner' : 'border-slate-200/90 bg-slate-100/70 shadow-sm'
      }`}>
        {/* Search Input - Non-overlapping Icon & Explicit Padding Fix */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <ICON_MAP.MagnifyingGlassIcon className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            placeholder="Search timeline tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
            className={`w-full py-1.5 rounded-xl border text-xs font-medium outline-hidden transition-all ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-accent' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-accent'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <ICON_MAP.XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Controls & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scroll To Today Button */}
          <button
            onClick={scrollToToday}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all flex items-center gap-1"
            title="Scroll Gantt view to Today"
          >
            <ICON_MAP.ClockIcon className="w-3.5 h-3.5" />
            Today
          </button>

          {/* Left Sidebar Toggle */}
          <button
            onClick={() => setShowLeftSidebar((prev) => !prev)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
              showLeftSidebar
                ? 'bg-accent/10 border-accent/30 text-accent'
                : darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-400'
                : 'bg-white border-slate-300 text-slate-600'
            }`}
            title="Toggle Task List Sidebar"
          >
            {showLeftSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
          </button>

          {/* Scale Zoom Toggle */}
          <div className={`flex rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-100'}`}>
            <button
              onClick={() => setViewScale('days')}
              className={`px-3 py-1 text-xs font-bold transition-colors ${viewScale === 'days' ? 'bg-accent text-white' : darkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              Days
            </button>
            <button
              onClick={() => setViewScale('weeks')}
              className={`px-3 py-1 text-xs font-bold transition-colors ${viewScale === 'weeks' ? 'bg-accent text-white' : darkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              Weeks
            </button>
            <button
              onClick={() => setViewScale('months')}
              className={`px-3 py-1 text-xs font-bold transition-colors ${viewScale === 'months' ? 'bg-accent text-white' : darkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              Months
            </button>
          </div>

          {/* Hierarchy Mode */}
          <div className={`flex rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-100'}`}>
            <button
              onClick={() => setHierarchyMode('tree')}
              className={`px-2.5 py-1 text-xs font-bold transition-colors ${hierarchyMode === 'tree' ? 'bg-accent text-white' : darkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              Tree
            </button>
            <button
              onClick={() => setHierarchyMode('flat')}
              className={`px-2.5 py-1 text-xs font-bold transition-colors ${hierarchyMode === 'flat' ? 'bg-accent text-white' : darkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              Flat
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`text-xs rounded-xl px-3 py-1.5 border font-semibold ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
          >
            <option value="all">All Statuses</option>
            <option value={TaskStatus.TODO}>To Do</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.REVIEW}>Need Review</option>
            <option value={TaskStatus.DONE}>Completed</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className={`text-xs rounded-xl px-3 py-1.5 border font-semibold ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline Chart Grid Container with Explicit Horizontal Scrollbar */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-[350px] sm:min-h-[400px] overflow-x-auto overflow-y-auto scrollbar-thin relative border-t border-slate-200 dark:border-slate-800"
      >
        {allFlatFiltered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <ICON_MAP.ClockIcon className="w-12 h-12 text-slate-400 mb-3 opacity-50" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No Tasks Match Filters</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">Try clearing your search query or status filters to view timeline tasks.</p>
          </div>
        ) : (
          <div style={{ minWidth: `${(showLeftSidebar ? 280 : 0) + daysHeader.length * dayColWidth}px` }}>
            {/* Header Row (Sticky Top & Left Corner) */}
            <div className={`flex border-b sticky top-0 z-40 shadow-xs ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              {showLeftSidebar && (
                <div className={`w-[200px] sm:w-[240px] md:w-[280px] min-w-[200px] sm:min-w-[240px] md:min-w-[280px] p-2.5 text-xs font-bold uppercase tracking-wider border-r border-slate-200 dark:border-slate-800 flex-shrink-0 sticky left-0 z-50 ${
                  darkMode ? 'bg-slate-950' : 'bg-slate-100'
                }`}>
                  Task Title
                </div>
              )}
              <div className="flex flex-shrink-0" style={{ width: `${daysHeader.length * dayColWidth}px` }}>
                {daysHeader.map((d, index) => {
                  const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <div
                      key={index}
                      style={{ width: `${dayColWidth}px`, minWidth: `${dayColWidth}px` }}
                      className={`py-2 px-1 text-center border-r text-[10px] font-semibold transition-colors flex-shrink-0 ${
                        darkMode ? 'border-slate-800/60' : 'border-slate-200/80'
                      } ${isToday ? 'bg-accent/20 text-accent font-black' : ''}`}
                    >
                      <div>{format(d, 'EEE')}</div>
                      <div className="font-extrabold text-xs">{format(d, 'd')}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task Rows */}
            <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {hierarchyMode === 'tree'
                ? parentTasks.map((t) => renderTimelineRow(t))
                : allFlatFiltered.map((t) => renderTimelineRow(t))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Floating Task Preview Tooltip Card on Hover */}
      {hoveredTask && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl border shadow-xl max-w-sm backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 ${
          darkMode ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${getStatusBadgeStyle(hoveredTask.status)}`}>
              {formatStatusText(hoveredTask.status)}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPriorityBadge(hoveredTask.priority)}`}>
              {hoveredTask.priority.toUpperCase()} PRIORITY
            </span>
          </div>

          <h4 className="text-sm font-extrabold mb-1">{hoveredTask.title}</h4>
          {hoveredTask.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{hoveredTask.description}</p>
          )}

          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span>
              Dates: <strong className="text-slate-700 dark:text-slate-200">{hoveredTask.created_at ? format(new Date(hoveredTask.created_at), 'MMM d') : 'Start'} - {hoveredTask.due_date ? format(new Date(hoveredTask.due_date), 'MMM d') : 'Due'}</strong>
            </span>
            <span>Click row to open details</span>
          </div>
        </div>
      )}
    </div>
  );
};
