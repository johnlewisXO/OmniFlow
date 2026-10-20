import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';

type ZoomScale = 'day' | 'week' | 'month';
type GroupByMode = 'project' | 'sprint' | 'status' | 'priority';

interface ComputedTimelineTask {
  task: Task;
  startOffsetDays: number;
  durationDays: number;
  startDateObj: Date;
  endDateObj: Date;
  isMilestone: boolean;
  isCriticalPath: boolean;
  blockedByIds: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const GanttRoadmapPage: React.FC = () => {
  const {
    tasks,
    projects,
    sprints,
    users,
    activeProject,
    updateTask,
    createTask,
    openViewTaskModal,
    addToast,
    setActiveView,
  } = useAppStore();

  const [zoomScale, setZoomScale] = useState<ZoomScale>('day');
  const [groupBy, setGroupBy] = useState<GroupByMode>('project');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [showCriticalPathOnly, setShowCriticalPathOnly] = useState(false);
  const [showDependencyArrows, setShowDependencyArrows] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dependency linking mode
  const [linkingFromTaskId, setLinkingFromTaskId] = useState<string | null>(null);

  // Local date/dependency overrides persisted in localStorage so Gantt drags & dependency links are instant and durable
  const [timelineOverrides, setTimelineOverrides] = useState<
    Record<string, { startDate?: string; dueDate?: string; isMilestone?: boolean; blockedBy?: string[] }>
  >(() => {
    try {
      const raw = localStorage.getItem('omni_gantt_overrides_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('omni_gantt_overrides_v1', JSON.stringify(timelineOverrides));
    } catch {}
  }, [timelineOverrides]);

  // Quick Milestone / Roadmap Item Modal
  const [quickTitle, setQuickTitle] = useState('');
  const [quickIsMilestone, setQuickIsMilestone] = useState(false);
  const [quickDurationDays, setQuickDurationDays] = useState(5);

  // Dragging bar state
  const [dragState, setDragState] = useState<{
    taskId: string;
    mode: 'move' | 'resize-right' | 'resize-left';
    initialClientX: number;
    origStartOffset: number;
    origDuration: number;
    currentStartOffset: number;
    currentDuration: number;
  } | null>(null);

  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Column width per day based on zoomScale
  const dayPixelWidth = useMemo(() => {
    if (zoomScale === 'day') return 44;
    if (zoomScale === 'week') return 22;
    return 10;
  }, [zoomScale]);

  // Base timeline anchor: 10 days before today, spanning 60 days
  const totalTimelineDays = zoomScale === 'month' ? 120 : 60;
  const timelineOriginDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return new Date(now.getTime() - 10 * DAY_MS);
  }, []);

  const todayOffsetDays = 10;

  // Deterministic default schedule for tasks missing startDate/dueDate
  const computedTasks = useMemo<ComputedTimelineTask[]>(() => {
    const filtered = tasks.filter(t => {
      if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });

    // Build dependency map first
    const rawList = filtered.map((t, idx) => {
      const ov = timelineOverrides[t.id] || {};
      const dueStr = ov.dueDate || t.dueDate || t.due_date;
      const startStr = ov.startDate || t.startDate;

      let startOffset = 6 + (idx * 3) % 28;
      let duration = Math.max(2, (t.story_points || 3) + (idx % 4));

      if (dueStr) {
        const dueDateMs = new Date(dueStr).setHours(0, 0, 0, 0);
        const endOffset = Math.round((dueDateMs - timelineOriginDate.getTime()) / DAY_MS);
        if (startStr) {
          const startDateMs = new Date(startStr).setHours(0, 0, 0, 0);
          startOffset = Math.round((startDateMs - timelineOriginDate.getTime()) / DAY_MS);
          duration = Math.max(1, endOffset - startOffset);
        } else {
          startOffset = endOffset - duration;
        }
      } else if (startStr) {
        const startDateMs = new Date(startStr).setHours(0, 0, 0, 0);
        startOffset = Math.round((startDateMs - timelineOriginDate.getTime()) / DAY_MS);
      }

      const isMilestone = ov.isMilestone ?? t.isMilestone ?? false;
      if (isMilestone) duration = 1;

      // Default realistic dependency links if none set yet for first few tasks
      let blockedByIds = ov.blockedBy ?? t.blockedBy ?? [];
      if (blockedByIds.length === 0 && idx > 0 && idx % 3 === 0 && filtered[idx - 1]) {
        blockedByIds = [filtered[idx - 1].id];
      }

      return {
        task: t,
        startOffsetDays: Math.max(0, Math.min(totalTimelineDays - 3, startOffset)),
        durationDays: duration,
        startDateObj: new Date(timelineOriginDate.getTime() + startOffset * DAY_MS),
        endDateObj: new Date(timelineOriginDate.getTime() + (startOffset + duration) * DAY_MS),
        isMilestone,
        blockedByIds,
        isCriticalPath: false,
      };
    });

    // Mark tasks involved in dependencies or high/urgent priority as critical path
    const dependedOnIds = new Set<string>();
    rawList.forEach(item => {
      item.blockedByIds.forEach(id => dependedOnIds.add(id));
    });

    return rawList.map(item => {
      const isCrit =
        item.blockedByIds.length > 0 ||
        dependedOnIds.has(item.task.id) ||
        item.task.priority === TaskPriority.URGENT ||
        item.task.priority === TaskPriority.HIGH;
      return { ...item, isCriticalPath: isCrit };
    }).filter(item => (!showCriticalPathOnly ? true : item.isCriticalPath));
  }, [tasks, selectedProjectId, searchQuery, timelineOverrides, timelineOriginDate, totalTimelineDays, showCriticalPathOnly]);

  // Group tasks for swimlanes
  const groupedSwimlanes = useMemo(() => {
    const groups: { id: string; label: string; badge?: string; items: ComputedTimelineTask[] }[] = [];
    if (groupBy === 'project') {
      const map = new Map<string, ComputedTimelineTask[]>();
      computedTasks.forEach(ct => {
        const pid = ct.task.projectId || 'unassigned';
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(ct);
      });
      map.forEach((items, pid) => {
        const proj = projects.find(p => p.id === pid);
        groups.push({
          id: pid,
          label: proj?.name || 'General Workspace',
          badge: `${items.length} items`,
          items,
        });
      });
    } else if (groupBy === 'sprint') {
      const map = new Map<string, ComputedTimelineTask[]>();
      computedTasks.forEach(ct => {
        const sid = ct.task.sprintId || 'backlog';
        if (!map.has(sid)) map.set(sid, []);
        map.get(sid)!.push(ct);
      });
      map.forEach((items, sid) => {
        const sp = sprints.find(s => s.id === sid);
        groups.push({
          id: sid,
          label: sp ? `${sp.name} (${sp.status})` : 'Backlog / Unscheduled',
          badge: `${items.length} items`,
          items,
        });
      });
    } else if (groupBy === 'status') {
      Object.values(TaskStatus).forEach(st => {
        const items = computedTasks.filter(ct => ct.task.status === st);
        if (items.length > 0) {
          groups.push({ id: st, label: st, badge: `${items.length}`, items });
        }
      });
    } else {
      Object.values(TaskPriority).forEach(pr => {
        const items = computedTasks.filter(ct => ct.task.priority === pr);
        if (items.length > 0) {
          groups.push({ id: pr, label: `${pr} Priority`, badge: `${items.length}`, items });
        }
      });
    }
    return groups;
  }, [computedTasks, groupBy, projects, sprints]);

  // Flat ordered row index map for SVG dependency lines
  const rowGeometryMap = useMemo(() => {
    const map = new Map<
      string,
      { rowIndex: number; startOffset: number; duration: number; isCritical: boolean }
    >();
    let currentRow = 0;
    groupedSwimlanes.forEach(group => {
      currentRow += 1; // Swimlane header row
      group.items.forEach(item => {
        const activeStart =
          dragState?.taskId === item.task.id ? dragState.currentStartOffset : item.startOffsetDays;
        const activeDur =
          dragState?.taskId === item.task.id ? dragState.currentDuration : item.durationDays;
        map.set(item.task.id, {
          rowIndex: currentRow,
          startOffset: activeStart,
          duration: activeDur,
          isCritical: item.isCriticalPath,
        });
        currentRow += 1;
      });
    });
    return { map, totalRows: currentRow };
  }, [groupedSwimlanes, dragState]);

  // Mouse move / up handlers for bar dragging & resizing
  useEffect(() => {
    if (!dragState) return;

    const onMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - dragState.initialClientX;
      const deltaDays = Math.round(deltaPx / dayPixelWidth);

      if (dragState.mode === 'move') {
        const nextStart = Math.max(0, Math.min(totalTimelineDays - 2, dragState.origStartOffset + deltaDays));
        setDragState(prev => (prev ? { ...prev, currentStartOffset: nextStart } : null));
      } else if (dragState.mode === 'resize-right') {
        const nextDur = Math.max(1, Math.min(45, dragState.origDuration + deltaDays));
        setDragState(prev => (prev ? { ...prev, currentDuration: nextDur } : null));
      } else if (dragState.mode === 'resize-left') {
        const nextStart = Math.max(
          0,
          Math.min(dragState.origStartOffset + dragState.origDuration - 1, dragState.origStartOffset + deltaDays)
        );
        const nextDur = Math.max(1, dragState.origDuration - (nextStart - dragState.origStartOffset));
        setDragState(prev =>
          prev ? { ...prev, currentStartOffset: nextStart, currentDuration: nextDur } : null
        );
      }
    };

    const onMouseUp = () => {
      if (dragState) {
        const newStartObj = new Date(timelineOriginDate.getTime() + dragState.currentStartOffset * DAY_MS);
        const newEndObj = new Date(
          timelineOriginDate.getTime() + (dragState.currentStartOffset + dragState.currentDuration) * DAY_MS
        );
        const startIso = newStartObj.toISOString().split('T')[0];
        const dueIso = newEndObj.toISOString().split('T')[0];

        setTimelineOverrides(prev => ({
          ...prev,
          [dragState.taskId]: {
            ...(prev[dragState.taskId] || {}),
            startDate: startIso,
            dueDate: dueIso,
          },
        }));

        const targetTask = tasks.find(t => t.id === dragState.taskId);
        if (targetTask) {
          updateTask({
            ...targetTask,
            startDate: startIso,
            dueDate: dueIso,
            due_date: dueIso,
          }).catch(() => {});
        }
        addToast('Timeline Updated', `Rescheduled to ${startIso} → ${dueIso}`, 'success');
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, dayPixelWidth, totalTimelineDays, timelineOriginDate, tasks, updateTask, addToast]);

  const handleLinkDependency = (targetTaskId: string) => {
    if (!linkingFromTaskId) {
      setLinkingFromTaskId(targetTaskId);
      addToast('Select Dependent Task', 'Click another task bar to create a blocks → blocked-by link', 'info');
      return;
    }
    if (linkingFromTaskId === targetTaskId) {
      setLinkingFromTaskId(null);
      return;
    }

    const existing = timelineOverrides[targetTaskId]?.blockedBy || [];
    const nextBlockedBy = existing.includes(linkingFromTaskId)
      ? existing.filter(id => id !== linkingFromTaskId)
      : [...existing, linkingFromTaskId];

    setTimelineOverrides(prev => ({
      ...prev,
      [targetTaskId]: {
        ...(prev[targetTaskId] || {}),
        blockedBy: nextBlockedBy,
      },
    }));
    setLinkingFromTaskId(null);
    addToast('Dependency Linked', 'Updated critical path dependency link on roadmap', 'success');
  };

  const handleToggleMilestone = (taskId: string, currentVal: boolean) => {
    setTimelineOverrides(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        isMilestone: !currentVal,
      },
    }));
    addToast(
      !currentVal ? 'Converted to Milestone' : 'Converted to Task Bar',
      !currentVal ? 'Displayed as a diamond milestone on the timeline' : 'Restored standard duration bar',
      'info'
    );
  };

  const handleQuickCreateRoadmapItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    const targetProjectId =
      selectedProjectId !== 'all'
        ? selectedProjectId
        : activeProject?.id || projects[0]?.id || 'default-project';

    const startObj = new Date(timelineOriginDate.getTime() + todayOffsetDays * DAY_MS);
    const endObj = new Date(
      timelineOriginDate.getTime() + (todayOffsetDays + (quickIsMilestone ? 1 : quickDurationDays)) * DAY_MS
    );

    try {
      await createTask({
        title: quickTitle.trim(),
        description: quickIsMilestone ? 'Strategic Roadmap Milestone' : 'Scheduled from Gantt Roadmap',
        priority: quickIsMilestone ? TaskPriority.URGENT : TaskPriority.HIGH,
        status: TaskStatus.TODO,
        projectId: targetProjectId,
        dueDate: endObj.toISOString().split('T')[0],
        startDate: startObj.toISOString().split('T')[0],
        isMilestone: quickIsMilestone,
      });
      setQuickTitle('');
      addToast(
        quickIsMilestone ? 'Milestone Added' : 'Roadmap Task Scheduled',
        `"${quickTitle.trim()}" added to the timeline`,
        'success'
      );
    } catch {
      addToast('Error', 'Could not create roadmap item', 'error');
    }
  };

  const scrollToToday = () => {
    if (!timelineScrollRef.current) return;
    const targetX = Math.max(0, todayOffsetDays * dayPixelWidth - 240);
    timelineScrollRef.current.scrollTo({ left: targetX, behavior: 'smooth' });
  };

  const timelineDaysArray = useMemo(() => {
    return Array.from({ length: totalTimelineDays }, (_, i) => {
      const date = new Date(timelineOriginDate.getTime() + i * DAY_MS);
      const isToday = i === todayOffsetDays;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      return { index: i, date, isToday, isWeekend };
    });
  }, [totalTimelineDays, timelineOriginDate, todayOffsetDays]);

  const ROW_HEIGHT = 44;

  return (
    <div className="flex flex-col h-[calc(100vh-3.75rem)] bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 overflow-hidden select-none">
      {/* Compact Top Control Bar */}
      <div className="h-12 px-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <ICON_MAP.CalendarIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Gantt Timeline & Dependency Roadmap
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Critical Path Engine
              </span>
            </div>
          </div>
        </div>

        {/* Center Filters & Zoom Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center">
            <ICON_MAP.SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter roadmap..."
              className="search-input !pl-10 !pr-4 !py-1 text-xs rounded-[20px] bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-48"
            />
          </div>

          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as GroupByMode)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <option value="project">Swimlane: Project</option>
            <option value="sprint">Swimlane: Sprint</option>
            <option value="status">Swimlane: Status</option>
            <option value="priority">Swimlane: Priority</option>
          </select>

          <button
            onClick={() => setShowCriticalPathOnly(v => !v)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              showCriticalPathOnly
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showCriticalPathOnly ? 'bg-rose-500 animate-ping' : 'bg-rose-500'}`} />
            Critical Path
          </button>

          <button
            onClick={() => setShowDependencyArrows(v => !v)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              showDependencyArrows
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
          >
            Dependencies
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['day', 'week', 'month'] as ZoomScale[]).map(scale => (
              <button
                key={scale}
                onClick={() => setZoomScale(scale)}
                className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase rounded-md transition-all ${
                  zoomScale === scale
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {scale}
              </button>
            ))}
          </div>

          <button
            onClick={scrollToToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition"
          >
            Today
          </button>
        </div>
      </div>

      {/* Main Split Gantt Canvas (Left Hierarchy + Right Interactive Timeline) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sticky Task & Swimlane Hierarchy Column */}
        <div className="w-80 md:w-96 border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/95 flex flex-col shrink-0 z-20">
          {/* Header Row matching Timeline Header height */}
          <div className="h-12 px-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Task / Milestone Hierarchy</span>
            <span>Duration & Links</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {groupedSwimlanes.map(group => (
              <React.Fragment key={group.id}>
                {/* Swimlane Header */}
                <div
                  style={{ height: ROW_HEIGHT }}
                  className="px-3 bg-slate-100/80 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  <span className="truncate">{group.label}</span>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-white dark:bg-slate-900 text-slate-500 border border-slate-200/70 dark:border-slate-700">
                    {group.badge}
                  </span>
                </div>

                {/* Swimlane Task Rows */}
                {group.items.map(item => {
                  const assignee = users.find(u => u.id === item.task.assignee_id);
                  const isSourceForLink = linkingFromTaskId === item.task.id;
                  return (
                    <div
                      key={item.task.id}
                      style={{ height: ROW_HEIGHT }}
                      className={`px-3 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isSourceForLink ? 'bg-indigo-50/80 dark:bg-indigo-950/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          onClick={() => handleToggleMilestone(item.task.id, item.isMilestone)}
                          title={item.isMilestone ? 'Milestone Diamond (Click to toggle)' : 'Task Bar (Click to make Milestone)'}
                          className={`w-4 h-4 flex items-center justify-center rounded transition ${
                            item.isMilestone
                              ? 'text-amber-500 scale-110'
                              : 'text-slate-300 hover:text-amber-500 dark:text-slate-600'
                          }`}
                        >
                          ◆
                        </button>
                        <button
                          onClick={() => openViewTaskModal(item.task)}
                          className="text-xs font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate text-left"
                        >
                          {item.task.title}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.isCriticalPath && (
                          <span
                            title="On Critical Path"
                            className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          >
                            Crit
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                          {item.isMilestone ? 'Milestone' : `${item.durationDays}d`}
                        </span>
                        <button
                          onClick={() => handleLinkDependency(item.task.id)}
                          title="Link Dependency (Blocks / Blocked By)"
                          className={`p-1 rounded text-[10px] font-bold transition ${
                            isSourceForLink
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          ⛓
                        </button>
                        {assignee && <Avatar user={assignee} className="w-5 h-5" />}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Quick Add Milestone / Scheduled Task Footer */}
          <form
            onSubmit={handleQuickCreateRoadmapItem}
            className="p-2.5 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="+ Add task or milestone..."
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              type="button"
              onClick={() => setQuickIsMilestone(v => !v)}
              title="Toggle Milestone Diamond"
              className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition ${
                quickIsMilestone
                  ? 'bg-amber-500/15 text-amber-600 border-amber-500/40'
                  : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              ◆
            </button>
            <button
              type="submit"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              Add
            </button>
          </form>
        </div>

        {/* Right Interactive Horizontal Gantt Canvas */}
        <div ref={timelineScrollRef} className="flex-1 overflow-auto relative bg-slate-50/60 dark:bg-[#0B0F17]">
          <div
            style={{
              width: totalTimelineDays * dayPixelWidth,
              minHeight: Math.max(480, (rowGeometryMap.totalRows + 2) * ROW_HEIGHT),
            }}
            className="relative"
          >
            {/* Sticky Date Scale Header */}
            <div className="sticky top-0 z-10 h-12 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex">
              {timelineDaysArray.map(day => {
                const showLabel =
                  zoomScale === 'day' ||
                  (zoomScale === 'week' && day.date.getDay() === 1) ||
                  (zoomScale === 'month' && day.date.getDate() === 1);
                return (
                  <div
                    key={day.index}
                    style={{ width: dayPixelWidth }}
                    className={`h-full border-r border-slate-200/50 dark:border-slate-800/60 flex flex-col items-center justify-center shrink-0 ${
                      day.isToday
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                        : day.isWeekend
                        ? 'bg-slate-100/60 dark:bg-slate-800/30 text-slate-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {showLabel && (
                      <>
                        <span className="text-[9px] uppercase tracking-wider opacity-75">
                          {day.date.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums">
                          {day.date.getDate()}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Vertical Grid Columns & Red "TODAY" Marker Line */}
            <div className="absolute inset-0 top-12 pointer-events-none flex">
              {timelineDaysArray.map(day => (
                <div
                  key={day.index}
                  style={{ width: dayPixelWidth }}
                  className={`h-full border-r border-slate-200/40 dark:border-slate-800/40 shrink-0 ${
                    day.isWeekend ? 'bg-slate-200/20 dark:bg-slate-900/30' : ''
                  }`}
                />
              ))}
            </div>

            {/* Live Today Vertical Line */}
            <div
              style={{ left: todayOffsetDays * dayPixelWidth + dayPixelWidth / 2 }}
              className="absolute top-12 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.6)]"
            >
              <div className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-bold uppercase tracking-wider -translate-x-1/2 whitespace-nowrap shadow-xs">
                Today
              </div>
            </div>

            {/* SVG Dependency Bezier Curves Overlay */}
            {showDependencyArrows && (
              <svg
                className="absolute inset-0 top-12 pointer-events-none z-10"
                width={totalTimelineDays * dayPixelWidth}
                height={Math.max(480, (rowGeometryMap.totalRows + 2) * ROW_HEIGHT)}
              >
                <defs>
                  <marker
                    id="gantt-arrow-normal"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,1 L7,4 L0,7 Z" fill="#6366f1" />
                  </marker>
                  <marker
                    id="gantt-arrow-critical"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,1 L7,4 L0,7 Z" fill="#f43f5e" />
                  </marker>
                </defs>
                {computedTasks.map(targetItem => {
                  const targetGeo = rowGeometryMap.map.get(targetItem.task.id);
                  if (!targetGeo) return null;
                  return targetItem.blockedByIds.map(sourceId => {
                    const sourceGeo = rowGeometryMap.map.get(sourceId);
                    if (!sourceGeo) return null;

                    const x1 = (sourceGeo.startOffset + sourceGeo.duration) * dayPixelWidth;
                    const y1 = sourceGeo.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const x2 = targetGeo.startOffset * dayPixelWidth;
                    const y2 = targetGeo.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

                    const ctrlOffset = Math.max(28, Math.abs(x2 - x1) * 0.45);
                    const d = `M ${x1} ${y1} C ${x1 + ctrlOffset} ${y1}, ${x2 - ctrlOffset} ${y2}, ${x2} ${y2}`;
                    const isCrit = sourceGeo.isCritical && targetGeo.isCritical;

                    return (
                      <path
                        key={`${sourceId}->${targetItem.task.id}`}
                        d={d}
                        fill="none"
                        stroke={isCrit ? '#f43f5e' : '#6366f1'}
                        strokeWidth={isCrit ? 2.2 : 1.6}
                        strokeDasharray={isCrit ? undefined : '4 3'}
                        markerEnd={isCrit ? 'url(#gantt-arrow-critical)' : 'url(#gantt-arrow-normal)'}
                        opacity={0.85}
                      />
                    );
                  });
                })}
              </svg>
            )}

            {/* Swimlanes & Interactive Task Bars */}
            <div className="relative z-10">
              {groupedSwimlanes.map(group => (
                <React.Fragment key={group.id}>
                  {/* Swimlane Spacer Row */}
                  <div
                    style={{ height: ROW_HEIGHT }}
                    className="border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-100/40 dark:bg-slate-800/20"
                  />

                  {/* Task Bar Rows */}
                  {group.items.map(item => {
                    const isDraggingThis = dragState?.taskId === item.task.id;
                    const startOffset = isDraggingThis
                      ? dragState.currentStartOffset
                      : item.startOffsetDays;
                    const duration = isDraggingThis ? dragState.currentDuration : item.durationDays;

                    const leftPx = startOffset * dayPixelWidth;
                    const widthPx = Math.max(dayPixelWidth, duration * dayPixelWidth);

                    const barColor =
                      item.task.status === TaskStatus.DONE
                        ? 'from-emerald-500 to-teal-600 border-emerald-400/50'
                        : item.isCriticalPath
                        ? 'from-rose-500 to-amber-500 border-rose-400/60 shadow-[0_0_14px_rgba(244,63,94,0.28)]'
                        : item.task.status === TaskStatus.IN_PROGRESS
                        ? 'from-indigo-500 to-violet-600 border-indigo-400/50'
                        : 'from-slate-600 to-slate-700 border-slate-500/40';

                    return (
                      <div
                        key={item.task.id}
                        style={{ height: ROW_HEIGHT }}
                        className="relative border-b border-slate-200/40 dark:border-slate-800/40 flex items-center"
                      >
                        {item.isMilestone ? (
                          /* Milestone Diamond Node */
                          <div
                            style={{ left: leftPx }}
                            onMouseDown={e => {
                              e.stopPropagation();
                              setDragState({
                                taskId: item.task.id,
                                mode: 'move',
                                initialClientX: e.clientX,
                                origStartOffset: item.startOffsetDays,
                                origDuration: 1,
                                currentStartOffset: item.startOffsetDays,
                                currentDuration: 1,
                              });
                            }}
                            onDoubleClick={() => openViewTaskModal(item.task)}
                            className="absolute flex items-center gap-2 cursor-grab active:cursor-grabbing group"
                          >
                            <div className="w-6 h-6 rotate-45 rounded-xs bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white dark:border-slate-900 shadow-md flex items-center justify-center">
                              <span className="-rotate-45 text-[9px] font-black text-white">★</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap shadow-xs">
                              {item.task.title}
                            </span>
                          </div>
                        ) : (
                          /* Interactive Resizable Gantt Bar */
                          <div
                            style={{ left: leftPx, width: widthPx }}
                            onMouseDown={e => {
                              e.stopPropagation();
                              setDragState({
                                taskId: item.task.id,
                                mode: 'move',
                                initialClientX: e.clientX,
                                origStartOffset: item.startOffsetDays,
                                origDuration: item.durationDays,
                                currentStartOffset: item.startOffsetDays,
                                currentDuration: item.durationDays,
                              });
                            }}
                            onDoubleClick={() => openViewTaskModal(item.task)}
                            className={`absolute h-7 rounded-lg bg-gradient-to-r ${barColor} border text-white flex items-center justify-between px-2.5 cursor-grab active:cursor-grabbing group transition-shadow hover:brightness-105`}
                          >
                            {/* Left Resize Handle */}
                            <div
                              onMouseDown={e => {
                                e.stopPropagation();
                                setDragState({
                                  taskId: item.task.id,
                                  mode: 'resize-left',
                                  initialClientX: e.clientX,
                                  origStartOffset: item.startOffsetDays,
                                  origDuration: item.durationDays,
                                  currentStartOffset: item.startOffsetDays,
                                  currentDuration: item.durationDays,
                                });
                              }}
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-l-lg"
                            />

                            <span className="text-[11px] font-semibold truncate drop-shadow-xs">
                              {item.task.title}
                            </span>
                            <span className="text-[10px] font-mono opacity-85 ml-2 shrink-0 tabular-nums">
                              {duration}d
                            </span>

                            {/* Right Resize Handle */}
                            <div
                              onMouseDown={e => {
                                e.stopPropagation();
                                setDragState({
                                  taskId: item.task.id,
                                  mode: 'resize-right',
                                  initialClientX: e.clientX,
                                  origStartOffset: item.startOffsetDays,
                                  origDuration: item.durationDays,
                                  currentStartOffset: item.startOffsetDays,
                                  currentDuration: item.durationDays,
                                });
                              }}
                              className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-r-lg"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttRoadmapPage;
