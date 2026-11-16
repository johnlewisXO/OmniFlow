import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { PageHeader, SegmentedTabs, StatusDot } from '../shared/EditorialUI';
import { Button } from '../shared/Button';

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
  } = useAppStore();

  const [zoomScale, setZoomScale] = useState<ZoomScale>('day');
  const [groupBy, setGroupBy] = useState<GroupByMode>('project');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [showCriticalPathOnly, setShowCriticalPathOnly] = useState(false);
  const [showDependencyArrows, setShowDependencyArrows] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [linkingFromTaskId, setLinkingFromTaskId] = useState<string | null>(null);

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

  const [quickTitle, setQuickTitle] = useState('');
  const [quickIsMilestone, setQuickIsMilestone] = useState(false);
  const [quickDurationDays] = useState(5);

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

  const dayPixelWidth = useMemo(() => {
    if (zoomScale === 'day') return 44;
    if (zoomScale === 'week') return 22;
    return 10;
  }, [zoomScale]);

  const totalTimelineDays = zoomScale === 'month' ? 120 : 60;
  const timelineOriginDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return new Date(now.getTime() - 10 * DAY_MS);
  }, []);

  const todayOffsetDays = 10;

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

    const dependedOnIds = new Set<string>();
    rawList.forEach(item => {
      item.blockedByIds.forEach(id => dependedOnIds.add(id));
    });

    return rawList
      .map(item => {
        const isCrit =
          item.blockedByIds.length > 0 ||
          dependedOnIds.has(item.task.id) ||
          item.task.priority === TaskPriority.CRITICAL ||
          item.task.priority === TaskPriority.HIGH;
        return { ...item, isCriticalPath: isCrit };
      })
      .filter(item => (!showCriticalPathOnly ? true : item.isCriticalPath));
  }, [tasks, selectedProjectId, searchQuery, timelineOverrides, timelineOriginDate, totalTimelineDays, showCriticalPathOnly]);

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
          badge: `${items.length}`,
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
          label: sp ? `${sp.name} · ${sp.status}` : 'Backlog / Unscheduled',
          badge: `${items.length}`,
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

  const rowGeometryMap = useMemo(() => {
    const map = new Map<
      string,
      { rowIndex: number; startOffset: number; duration: number; isCritical: boolean }
    >();
    let currentRow = 0;
    groupedSwimlanes.forEach(group => {
      currentRow += 1;
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
          updateTask(targetTask.id, {
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
        priority: quickIsMilestone ? TaskPriority.CRITICAL : TaskPriority.HIGH,
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
    <div className="flex flex-col h-[calc(100vh-5.5rem)] text-[var(--text-primary)] overflow-hidden select-none p-4 sm:p-5 space-y-4">
      <PageHeader
        eyebrow="Delivery Roadmap · Critical Path Engine"
        title="Gantt Timeline & Dependencies"
        subtitle={`${computedTasks.length} scheduled deliverables across ${groupedSwimlanes.length} swimlanes · Drag bars to reschedule or link dependencies`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex items-center">
              <ICON_MAP.SearchIcon className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter roadmap..."
                className="search-input !pl-9 !pr-3 !py-1.5 text-xs w-44"
              />
            </div>

            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium"
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
              className="px-2.5 py-1.5 text-xs font-medium"
            >
              <option value="project">Group: Project</option>
              <option value="sprint">Group: Sprint</option>
              <option value="status">Group: Status</option>
              <option value="priority">Group: Priority</option>
            </select>

            <button
              type="button"
              onClick={() => setShowCriticalPathOnly(v => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showCriticalPathOnly
                  ? 'bg-rose-600/10 text-rose-700 dark:text-rose-300 border-rose-500/40'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:bg-[var(--bg-sage)]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full bg-rose-600 ${showCriticalPathOnly ? 'animate-pulse' : ''}`} />
              <span>Critical Path</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDependencyArrows(v => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                showDependencyArrows
                  ? 'bg-[var(--bg-sage)] text-[var(--text-primary)] border-[var(--border-strong)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-hairline)]'
              }`}
            >
              Dependencies
            </button>

            <SegmentedTabs
              size="sm"
              value={zoomScale}
              onChange={setZoomScale}
              options={[
                { id: 'day', label: 'Day' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
              ]}
            />

            <Button variant="primary" size="sm" onClick={scrollToToday}>
              Today
            </Button>
          </div>
        }
      />

      {/* Main Split Editorial Gantt Surface */}
      <div className="flex-1 min-h-0 editorial-surface flex overflow-hidden relative">
        {/* Left Sticky Hierarchy Column */}
        <div className="w-80 md:w-96 border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col shrink-0 z-20">
          <div className="h-12 px-4 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Deliverable Hierarchy</span>
            <span>Duration · Links</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)] scrollbar-thin">
            {groupedSwimlanes.map(group => (
              <React.Fragment key={group.id}>
                <div
                  style={{ height: ROW_HEIGHT }}
                  className="px-4 bg-[var(--bg-sage)]/55 flex items-center justify-between text-xs font-bold text-[var(--text-primary)]"
                >
                  <span className="truncate">{group.label}</span>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                    {group.badge}
                  </span>
                </div>

                {group.items.map(item => {
                  const assignee = users.find(u => u.id === item.task.assignee_id);
                  const isSourceForLink = linkingFromTaskId === item.task.id;
                  return (
                    <div
                      key={item.task.id}
                      style={{ height: ROW_HEIGHT }}
                      className={`px-4 flex items-center justify-between gap-2 hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                        isSourceForLink ? 'bg-[var(--accent-lime)]/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(item.task.id, item.isMilestone)}
                          title={item.isMilestone ? 'Milestone Diamond (Click to toggle)' : 'Task Bar (Click to make Milestone)'}
                          className={`w-4 h-4 flex items-center justify-center rounded transition cursor-pointer ${
                            item.isMilestone
                              ? 'text-[#6F8254] dark:text-[var(--accent-lime)] scale-110'
                              : 'text-[var(--text-disabled)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          ◆
                        </button>
                        <button
                          type="button"
                          onClick={() => openViewTaskModal(item.task)}
                          className="text-xs font-medium text-[var(--text-primary)] hover:underline truncate text-left cursor-pointer"
                        >
                          {item.task.title}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.isCriticalPath && (
                          <StatusDot tone="danger" label="Crit" className="text-[10px] font-semibold" />
                        )}
                        <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                          {item.isMilestone ? 'Milestone' : `${item.durationDays}d`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleLinkDependency(item.task.id)}
                          title="Link Dependency (Blocks / Blocked By)"
                          className={`p-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            isSourceForLink
                              ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)]'
                          }`}
                        >
                          ⛓
                        </button>
                        {assignee && <Avatar user={assignee} size="xs" disableHoverCard />}
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
            className="p-2.5 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex items-center gap-1.5"
          >
            <input
              type="text"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="+ Add task or milestone..."
              className="flex-1 px-3 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => setQuickIsMilestone(v => !v)}
              title="Toggle Milestone Diamond"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                quickIsMilestone
                  ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] border-[var(--border-strong)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-hairline)]'
              }`}
            >
              ◆
            </button>
            <Button type="submit" variant="lime" size="sm">
              Add
            </Button>
          </form>
        </div>

        {/* Right Interactive Horizontal Gantt Canvas */}
        <div ref={timelineScrollRef} className="flex-1 overflow-auto relative bg-[var(--bg-canvas)]/55 scrollbar-thin">
          <div
            style={{
              width: totalTimelineDays * dayPixelWidth,
              minHeight: Math.max(480, (rowGeometryMap.totalRows + 2) * ROW_HEIGHT),
            }}
            className="relative"
          >
            {/* Sticky Date Scale Header */}
            <div className="sticky top-0 z-10 h-12 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] flex">
              {timelineDaysArray.map(day => {
                const showLabel =
                  zoomScale === 'day' ||
                  (zoomScale === 'week' && day.date.getDay() === 1) ||
                  (zoomScale === 'month' && day.date.getDate() === 1);
                return (
                  <div
                    key={day.index}
                    style={{ width: dayPixelWidth }}
                    className={`h-full border-r border-[var(--border-hairline)] flex flex-col items-center justify-center shrink-0 ${
                      day.isToday
                        ? 'bg-[var(--accent-lime)]/35 text-[var(--text-primary)] font-bold'
                        : day.isWeekend
                        ? 'bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]'
                        : 'text-[var(--text-secondary)]'
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

            {/* Vertical Grid Columns */}
            <div className="absolute inset-0 top-12 pointer-events-none flex">
              {timelineDaysArray.map(day => (
                <div
                  key={day.index}
                  style={{ width: dayPixelWidth }}
                  className={`h-full border-r border-[var(--border-hairline)]/60 shrink-0 ${
                    day.isWeekend ? 'bg-[var(--bg-sage)]/25' : ''
                  }`}
                />
              ))}
            </div>

            {/* Live Today Vertical Marker */}
            <div
              style={{ left: todayOffsetDays * dayPixelWidth + dayPixelWidth / 2 }}
              className="absolute top-12 bottom-0 w-0.5 bg-[var(--text-primary)] z-10 pointer-events-none"
            >
              <div className="px-2 py-0.5 rounded-md bg-[var(--accent-lime)] text-[var(--accent-ink)] text-[9px] font-bold uppercase tracking-wider -translate-x-1/2 whitespace-nowrap border border-[var(--border-strong)]">
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
                    <path d="M0,1 L7,4 L0,7 Z" fill="#6F8254" />
                  </marker>
                  <marker
                    id="gantt-arrow-critical"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,1 L7,4 L0,7 Z" fill="#BE123C" />
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
                        stroke={isCrit ? '#BE123C' : '#6F8254'}
                        strokeWidth={isCrit ? 2 : 1.5}
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
                  <div
                    style={{ height: ROW_HEIGHT }}
                    className="border-b border-[var(--border-hairline)] bg-[var(--bg-sage)]/35"
                  />

                  {group.items.map(item => {
                    const isDraggingThis = dragState?.taskId === item.task.id;
                    const startOffset = isDraggingThis
                      ? dragState.currentStartOffset
                      : item.startOffsetDays;
                    const duration = isDraggingThis ? dragState.currentDuration : item.durationDays;

                    const leftPx = startOffset * dayPixelWidth;
                    const widthPx = Math.max(dayPixelWidth, duration * dayPixelWidth);

                    const barClasses =
                      item.task.status === TaskStatus.DONE
                        ? 'bg-[#1D7A46] text-white border-[#155E35]'
                        : item.isCriticalPath
                        ? 'bg-[#BE123C] text-white border-[#9F1239]'
                        : item.task.status === TaskStatus.IN_PROGRESS
                        ? 'bg-[#6F8254] text-white border-[#5A6B43]'
                        : 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] border-transparent';

                    return (
                      <div
                        key={item.task.id}
                        style={{ height: ROW_HEIGHT }}
                        className="relative border-b border-[var(--border-hairline)]/70 flex items-center"
                      >
                        {item.isMilestone ? (
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
                            <div className="w-5 h-5 rotate-45 rounded-[3px] bg-[var(--accent-lime)] border border-[var(--accent-ink)] flex items-center justify-center shadow-xs">
                              <span className="-rotate-45 text-[9px] font-black text-[var(--accent-ink)]">◆</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-hairline)] whitespace-nowrap">
                              {item.task.title}
                            </span>
                          </div>
                        ) : (
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
                            className={`absolute h-7 rounded-lg ${barClasses} border flex items-center justify-between px-2.5 cursor-grab active:cursor-grabbing group transition-opacity hover:opacity-95`}
                          >
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

                            <span className="text-[11px] font-semibold truncate">
                              {item.task.title}
                            </span>
                            <span className="text-[10px] font-mono opacity-85 ml-2 shrink-0 tabular-nums">
                              {duration}d
                            </span>

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
                              className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/35 rounded-r-lg"
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
