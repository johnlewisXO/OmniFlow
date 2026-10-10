import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { TaskStatus, TaskPriority, Task, UserRole, normalizeUserRole } from '../../types';
import { ICON_MAP } from '../../constants';
import supabaseService from '../../services/supabaseService';
import collabService from '../../services/collabService';
import soundService from '../../services/soundService';

export type BentoWidgetId =
  | 'task_overview'
  | 'project_status'
  | 'calendar_schedule'
  | 'meet_schedule'
  | 'team_chat'
  | 'focus_timer_notes';

interface TasklyBentoWorkspaceHubProps {
  roleBadgeLabel?: string;
  customSubtitle?: string;
}

interface QuickChatMsg {
  id: string;
  senderName: string;
  senderInitials: string;
  content: string;
  timestamp: string;
  isMe?: boolean;
}

const DEFAULT_WIDGET_ORDER: BentoWidgetId[] = [
  'task_overview',
  'project_status',
  'calendar_schedule',
  'meet_schedule',
  'team_chat',
  'focus_timer_notes',
];

const WIDGET_LABELS: Record<BentoWidgetId, { title: string; colSpanClass: string }> = {
  task_overview: { title: 'Task Overview', colSpanClass: 'xl:col-span-5 lg:col-span-7' },
  project_status: { title: 'Project Status Rings', colSpanClass: 'xl:col-span-3 lg:col-span-5' },
  calendar_schedule: { title: 'Calendar & Schedule', colSpanClass: 'xl:col-span-4 lg:col-span-12' },
  meet_schedule: { title: 'Meet Schedule Studio', colSpanClass: 'xl:col-span-4 md:col-span-6' },
  team_chat: { title: 'Inline Team Chat', colSpanClass: 'xl:col-span-4 md:col-span-6' },
  focus_timer_notes: { title: 'Focus Timer & Sticky Notes', colSpanClass: 'xl:col-span-4 md:col-span-12' },
};

export const TasklyBentoWorkspaceHub: React.FC<TasklyBentoWorkspaceHubProps> = ({
  roleBadgeLabel,
  customSubtitle,
}) => {
  const {
    currentUser,
    projects,
    tasks,
    myTasks,
    users,
    darkMode,
    activeProject,
    setActiveProject,
    setActiveView,
    openViewTaskModal,
    openCreateProjectModal,
    openModal,
    addToast,
    highlightedTaskId,
  } = useAppStore();

  const normalizedRole = normalizeUserRole(currentUser?.role);

  // Task Status Filter Pill State + Role-relevant My Tasks toggle
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(() => normalizedRole === UserRole.MEMBER);
  const [selectedGaugeProjectId, setSelectedGaugeProjectId] = useState<string>('all');

  // Customizable Drag-and-Drop Bento Layout State
  const layoutStorageKey = `omni_bento_layout_v2_${currentUser?.id || 'guest'}_${normalizedRole}`;
  const hiddenStorageKey = `omni_bento_hidden_v2_${currentUser?.id || 'guest'}_${normalizedRole}`;

  const [widgetOrder, setWidgetOrder] = useState<BentoWidgetId[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(layoutStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as BentoWidgetId[];
          if (Array.isArray(parsed) && parsed.length === DEFAULT_WIDGET_ORDER.length) {
            return parsed;
          }
        }
      } catch {}
    }
    return DEFAULT_WIDGET_ORDER;
  });

  const [hiddenWidgets, setHiddenWidgets] = useState<BentoWidgetId[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(hiddenStorageKey);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  });

  const [isCustomizingLayout, setIsCustomizingLayout] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<BentoWidgetId | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<BentoWidgetId | null>(null);
  const [recentlyUpdatedWidget, setRecentlyUpdatedWidget] = useState<BentoWidgetId | null>(null);

  const pulseWidget = (id: BentoWidgetId) => {
    setRecentlyUpdatedWidget(id);
    setTimeout(() => {
      setRecentlyUpdatedWidget(prev => (prev === id ? null : prev));
    }, 1600);
  };

  const saveWidgetOrder = (nextOrder: BentoWidgetId[], targetPulseId?: BentoWidgetId) => {
    setWidgetOrder(nextOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem(layoutStorageKey, JSON.stringify(nextOrder));
      window.dispatchEvent(
        new CustomEvent('omni_state_updated', {
          detail: { label: 'Dashboard Layout Saved', entityType: 'system' },
        })
      );
    }
    soundService.play('drag_drop');
    if (targetPulseId) pulseWidget(targetPulseId);
  };

  const toggleWidgetVisibility = (id: BentoWidgetId) => {
    const next = hiddenWidgets.includes(id)
      ? hiddenWidgets.filter(w => w !== id)
      : [...hiddenWidgets, id];
    setHiddenWidgets(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(hiddenStorageKey, JSON.stringify(next));
    }
    soundService.play('click_soft');
    pulseWidget(id);
  };

  const handleResetLayout = () => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    setHiddenWidgets([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(layoutStorageKey);
      localStorage.removeItem(hiddenStorageKey);
    }
    soundService.play('state_updated');
    addToast('Dashboard Layout Reset', 'Restored default Taskly 32px Bento arrangement.', 'info');
  };

  const handleMoveWidgetStep = (id: BentoWidgetId, dir: -1 | 1) => {
    const idx = widgetOrder.indexOf(id);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= widgetOrder.length) return;
    const next = [...widgetOrder];
    const [removed] = next.splice(idx, 1);
    next.splice(targetIdx, 0, removed);
    saveWidgetOrder(next, id);
  };

  const handleWidgetDragStart = (e: React.DragEvent, id: BentoWidgetId) => {
    soundService.play('drag_pickup');
    e.dataTransfer.setData('text/bento-widget', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedWidgetId(id);
  };

  const handleWidgetDragOver = (e: React.DragEvent, targetId: BentoWidgetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverWidgetId !== targetId) {
      setDragOverWidgetId(targetId);
    }
  };

  const handleWidgetDrop = (e: React.DragEvent, targetId: BentoWidgetId) => {
    e.preventDefault();
    const sourceId = (e.dataTransfer.getData('text/bento-widget') as BentoWidgetId) || draggedWidgetId;
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);

    if (!sourceId || sourceId === targetId) return;
    const fromIdx = widgetOrder.indexOf(sourceId);
    const toIdx = widgetOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = [...widgetOrder];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    saveWidgetOrder(next, sourceId);
  };

  // Interactive Focus Timer (20:00 default from reference image)
  const [timerSeconds, setTimerSeconds] = useState<number>(20 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Sticky Notes State (persisted per user)
  const notesStorageKey = `omni_bento_sticky_note_${currentUser?.id || 'guest'}`;
  const [stickyNote, setStickyNote] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem(notesStorageKey) ||
        '• Finalize Q4 sprint velocity targets\n• Review 32px bento glass tokens with design\n• Verify Edge Function SLA webhooks'
      );
    }
    return '';
  });
  const [noteSavedPulse, setNoteSavedPulse] = useState(false);

  // Live Meet Preview State
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  // Inline Team Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<QuickChatMsg[]>([
    {
      id: 'm1',
      senderName: 'Sophia',
      senderInitials: 'SO',
      content: 'Hi team! Let’s wrap up the Sprint 14 deliverables before the 2:00 PM standup.',
      timestamp: '09:30 am',
    },
    {
      id: 'm2',
      senderName: 'Riko',
      senderInitials: 'RK',
      content: 'Concentric progress charts and slide-over task inspector are live on staging!',
      timestamp: '09:34 am',
    },
  ]);

  // Mini Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDate());

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          soundService.play('timer_complete', true);
          addToast('Focus Session Complete', '20-minute deep work sprint finished!', 'success');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, addToast]);

  const handleSaveStickyNote = (val: string) => {
    setStickyNote(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(notesStorageKey, val);
    }
    setNoteSavedPulse(true);
    setTimeout(() => setNoteSavedPulse(false), 1200);
  };

  // Combine tasks for the workspace
  const allWorkspaceTasks = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach(t => map.set(t.id, t));
    myTasks.forEach(t => map.set(t.id, t));
    return Array.from(map.values());
  }, [tasks, myTasks]);

  const scopedTasksForOverview = useMemo(() => {
    if (onlyMyTasks && currentUser) {
      const mine = allWorkspaceTasks.filter(t => t.assignee_id === currentUser.id);
      return mine.length > 0 ? mine : allWorkspaceTasks;
    }
    return allWorkspaceTasks;
  }, [allWorkspaceTasks, onlyMyTasks, currentUser]);

  const gaugeTasks = useMemo(() => {
    if (selectedGaugeProjectId === 'all') return allWorkspaceTasks;
    return allWorkspaceTasks.filter(t => t.projectId === selectedGaugeProjectId);
  }, [allWorkspaceTasks, selectedGaugeProjectId]);

  // Concentric 3-Ring Completion Metrics
  const ringMetrics = useMemo(() => {
    const total = Math.max(1, gaugeTasks.length);
    const doneCount = gaugeTasks.filter(t => t.status === TaskStatus.DONE).length;
    const inProgressCount = gaugeTasks.filter(
      t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.REVIEW
    ).length;
    const todoCount = gaugeTasks.filter(t => t.status === TaskStatus.TODO).length;

    const donePct = gaugeTasks.length > 0 ? Math.round((doneCount / total) * 100) : 68;
    const inProgressPct = gaugeTasks.length > 0 ? Math.round((inProgressCount / total) * 100) : 22;
    const todoPct = gaugeTasks.length > 0 ? Math.round((todoCount / total) * 100) : 10;

    return {
      total: gaugeTasks.length,
      doneCount,
      inProgressCount,
      todoCount,
      donePct,
      inProgressPct,
      todoPct,
    };
  }, [gaugeTasks]);

  // Filtered Tasks for the Task Overview Bento
  const filteredTasks = useMemo(() => {
    const list =
      statusFilter === 'all'
        ? scopedTasksForOverview
        : scopedTasksForOverview.filter(t => t.status === statusFilter);
    return list.slice(0, 6);
  }, [scopedTasksForOverview, statusFilter]);

  const statusCounts = useMemo(() => {
    return {
      all: scopedTasksForOverview.length,
      [TaskStatus.TODO]: scopedTasksForOverview.filter(t => t.status === TaskStatus.TODO).length,
      [TaskStatus.IN_PROGRESS]: scopedTasksForOverview.filter(
        t => t.status === TaskStatus.IN_PROGRESS
      ).length,
      [TaskStatus.REVIEW]: scopedTasksForOverview.filter(t => t.status === TaskStatus.REVIEW).length,
      [TaskStatus.DONE]: scopedTasksForOverview.filter(t => t.status === TaskStatus.DONE).length,
    };
  }, [scopedTasksForOverview]);

  // Role-Tailored Prominent KPI Capsules
  const roleKpiCapsules = useMemo(() => {
    const inFlightCount =
      statusCounts[TaskStatus.IN_PROGRESS] +
      statusCounts[TaskStatus.REVIEW] +
      statusCounts[TaskStatus.TODO];

    if (normalizedRole === UserRole.MEMBER) {
      const myAssignedCount = allWorkspaceTasks.filter(t => t.assignee_id === currentUser?.id).length;
      return [
        {
          label: 'My Assigned Tasks',
          value: myAssignedCount || allWorkspaceTasks.length,
          sub: 'Click to inspect queue',
          icon: ICON_MAP.ClipboardListIcon,
          badgeBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
          onClick: () => setActiveView('my_tasks_view'),
        },
        {
          label: 'In-Progress Work',
          value: statusCounts[TaskStatus.IN_PROGRESS],
          sub: `${statusCounts[TaskStatus.REVIEW]} Under Review`,
          icon: ICON_MAP.RocketLaunchIcon,
          badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
          onClick: () => setActiveView('kanban'),
        },
        {
          label: 'Sprint Completion',
          value: `${ringMetrics.donePct}%`,
          sub: `${statusCounts[TaskStatus.DONE]} Completed`,
          icon: ICON_MAP.CheckIcon,
          badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
          onClick: () => setActiveView('reports_view'),
        },
        {
          label: 'Active Projects',
          value: projects.length,
          sub: 'Live Sprint Boards',
          icon: ICON_MAP.FolderIcon,
          badgeBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
          onClick: () => setActiveView('projects_overview'),
        },
      ];
    }

    if (normalizedRole === UserRole.CLIENT_VIEWER) {
      return [
        {
          label: 'Shared Projects',
          value: projects.length,
          sub: 'Stakeholder Portal',
          icon: ICON_MAP.FolderIcon,
          badgeBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
          onClick: () => setActiveView('projects_overview'),
        },
        {
          label: 'Overall Delivery',
          value: `${ringMetrics.donePct}%`,
          sub: 'Concentric Velocity',
          icon: ICON_MAP.CheckIcon,
          badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
          onClick: () => setActiveView('reports_view'),
        },
        {
          label: 'In Review / QA',
          value: statusCounts[TaskStatus.REVIEW],
          sub: `${inFlightCount} Active Items`,
          icon: ICON_MAP.ClipboardListIcon,
          badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
          onClick: () => setActiveView('kanban'),
        },
        {
          label: 'Upcoming Milestones',
          value: Math.max(2, projects.length * 2),
          sub: 'Release Calendar',
          icon: ICON_MAP.CalendarIcon,
          badgeBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
          onClick: () => setActiveView('calendar_view'),
        },
      ];
    }

    return [
      {
        label: normalizedRole === UserRole.OWNER ? 'Portfolio Projects' : 'Active Projects',
        value: projects.length,
        sub: 'Live Workspaces',
        icon: ICON_MAP.FolderIcon,
        badgeBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
        onClick: () => setActiveView('projects_overview'),
      },
      {
        label: 'In-Flight Tasks',
        value: inFlightCount,
        sub: `${statusCounts[TaskStatus.IN_PROGRESS]} In Progress`,
        icon: ICON_MAP.ClipboardListIcon,
        badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
        onClick: () => setActiveView('my_tasks_view'),
      },
      {
        label: 'Delivery Velocity',
        value: `${ringMetrics.donePct}%`,
        sub: `${statusCounts[TaskStatus.DONE]} Tasks Done`,
        icon: ICON_MAP.CheckIcon,
        badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
        onClick: () => setActiveView('reports_view'),
      },
      {
        label: 'Team & RBAC Seats',
        value: Math.max(1, users.length),
        sub: roleBadgeLabel || 'Active Collaborators',
        icon: ICON_MAP.UsersIcon,
        badgeBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
        onClick: () => setActiveView('team_management'),
      },
    ];
  }, [
    normalizedRole,
    statusCounts,
    allWorkspaceTasks,
    currentUser?.id,
    ringMetrics.donePct,
    projects.length,
    users.length,
    roleBadgeLabel,
    setActiveView,
  ]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSendQuickChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !currentUser) return;

    const senderName = currentUser.full_name || currentUser.email.split('@')[0];
    const initials = senderName
      .split(' ')
      .map(p => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const newMsg: QuickChatMsg = {
      id: `msg-${Date.now()}`,
      senderName,
      senderInitials: initials || 'ME',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };

    setChatMessages(prev => [...prev.slice(-6), newMsg]);
    setChatInput('');
    soundService.play('chat_message');
    pulseWidget('team_chat');

    try {
      await supabaseService.sendTeamChatMessage({
        organization_id: currentUser.organization_id || 'org-default',
        channel_id: 'general',
        sender_id: currentUser.id,
        sender_name: senderName,
        sender_avatar: currentUser.avatar_url,
        content: trimmed,
      });
    } catch {
      // Fallback local broadcast
    }
    collabService.broadcastChatMessage({
      id: newMsg.id,
      sender_id: currentUser.id,
      sender_name: senderName,
      content: trimmed,
      created_at: new Date().toISOString(),
    });
  };

  const handleStartInstantMeet = () => {
    soundService.play('state_updated');
    window.dispatchEvent(
      new CustomEvent('omni_start_video_call', {
        detail: {
          channelName: activeProject ? `${activeProject.name} Sync` : 'Design & Sprint Standup',
          callType: 'video',
        },
      })
    );
  };

  const handleQuickAddTask = () => {
    soundService.play('click_soft');
    if (!activeProject && projects.length > 0) {
      setActiveProject(projects[0].id);
      setTimeout(() => openModal(), 60);
      return;
    }
    if (!activeProject) {
      openCreateProjectModal();
      return;
    }
    openModal();
  };

  // Calendar Grid Helpers
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const adjustedStartOffset = (firstDayOfWeek + 6) % 7;

  const scheduleItems = useMemo(() => {
    const dynamicTasksWithDue = allWorkspaceTasks
      .filter(t => t.dueDate || t.due_date)
      .slice(0, 2)
      .map((t, idx) => ({
        id: t.id,
        time: idx === 0 ? '11:00' : '15:30',
        title: t.title,
        subtitle: projects.find(p => p.id === t.projectId)?.name || 'Sprint Deliverable',
        tag: t.priority || 'High',
        color:
          idx === 0
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30'
            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
        taskId: t.id,
      }));

    return [
      {
        id: 'standup-call',
        time: '09:30',
        title: 'Daily Sprint & Design Sync',
        subtitle: '1080p HD Video Studio · 6 Members',
        tag: 'Meet',
        color: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
        isMeet: true,
      },
      ...dynamicTasksWithDue,
      {
        id: 'arch-review',
        time: '16:30',
        title: 'Edge Function SLA & Velocity Review',
        subtitle: 'Executive & PM Checkpoint',
        tag: 'Review',
        color: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
        isMeet: false,
      },
    ];
  }, [allWorkspaceTasks, projects]);

  // SVG Ring Math
  const rOuter = 68;
  const rMid = 50;
  const rInner = 32;
  const cOuter = 2 * Math.PI * rOuter;
  const cMid = 2 * Math.PI * rMid;
  const cInner = 2 * Math.PI * rInner;

  const GripIcon = ICON_MAP.GripVerticalIcon || ICON_MAP.Bars3Icon;

  const renderWidgetDragControls = (id: BentoWidgetId) => {
    const idx = widgetOrder.indexOf(id);
    return (
      <div className="flex items-center gap-1">
        {isCustomizingLayout && (
          <div className="flex items-center gap-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-1.5 py-0.5">
            <button
              type="button"
              disabled={idx <= 0}
              onClick={() => handleMoveWidgetStep(id, -1)}
              className="text-[11px] font-bold text-indigo-500 px-1 disabled:opacity-30 cursor-pointer"
              title="Move widget earlier"
            >
              ←
            </button>
            <button
              type="button"
              disabled={idx >= widgetOrder.length - 1}
              onClick={() => handleMoveWidgetStep(id, 1)}
              className="text-[11px] font-bold text-indigo-500 px-1 disabled:opacity-30 cursor-pointer"
              title="Move widget later"
            >
              →
            </button>
          </div>
        )}
        <div
          className={`p-1.5 rounded-full cursor-grab active:cursor-grabbing transition-colors ${
            isCustomizingLayout
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-200/50 dark:hover:bg-slate-800'
          }`}
          title="Drag to rearrange this dashboard widget"
        >
          <GripIcon className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  };

  const renderBentoWidget = (widgetId: BentoWidgetId) => {
    if (hiddenWidgets.includes(widgetId)) return null;

    const isDragged = draggedWidgetId === widgetId;
    const isDropTarget = dragOverWidgetId === widgetId && draggedWidgetId !== widgetId;
    const isRecentlyPulsed = recentlyUpdatedWidget === widgetId;
    const colSpan = WIDGET_LABELS[widgetId].colSpanClass;

    const wrapperProps = {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleWidgetDragStart(e, widgetId),
      onDragOver: (e: React.DragEvent) => handleWidgetDragOver(e, widgetId),
      onDrop: (e: React.DragEvent) => handleWidgetDrop(e, widgetId),
      onDragEnd: () => {
        setDraggedWidgetId(null);
        setDragOverWidgetId(null);
      },
    };

    const dragStateClasses = `${
      isDragged ? 'opacity-45 scale-[0.98]' : ''
    } ${
      isDropTarget
        ? 'ring-2 ring-indigo-500 !border-indigo-500 bg-indigo-500/5 scale-[1.01]'
        : ''
    } ${
      isCustomizingLayout ? 'ring-1 ring-dashed ring-indigo-500/50' : ''
    } ${isRecentlyPulsed ? 'animate-state-updated' : ''}`;

    switch (widgetId) {
      case 'task_overview':
        return (
          <div
            key={widgetId}
            {...wrapperProps}
            className={`${colSpan} p-5 sm:p-6 rounded-[32px] border flex flex-col justify-between space-y-4 transition-all ${
              darkMode
                ? 'bg-slate-900/75 border-white/10'
                : 'bg-white/88 border-white shadow-sm'
            } ${dragStateClasses}`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {renderWidgetDragControls(widgetId)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-lg font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        Task Overview
                      </h2>
                      {isRecentlyPulsed && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 animate-state-badge">
                          ✓ Layout Saved
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {customSubtitle || 'Click any task card to open the Slide-Over Inspector'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      setOnlyMyTasks(prev => !prev);
                      pulseWidget('task_overview');
                    }}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer hidden sm:inline-flex items-center gap-1 ${
                      onlyMyTasks
                        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/40'
                        : darkMode
                        ? 'bg-slate-800/80 text-slate-400 border-white/10'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>{onlyMyTasks ? 'My Tasks' : 'All Tasks'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickAddTask}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer transition-all whitespace-nowrap"
                  >
                    <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                    <span>New Task</span>
                  </button>
                </div>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                {(
                  [
                    { id: 'all', label: 'All', count: statusCounts.all },
                    { id: TaskStatus.TODO, label: 'To Do', count: statusCounts[TaskStatus.TODO] },
                    { id: TaskStatus.IN_PROGRESS, label: 'In Progress', count: statusCounts[TaskStatus.IN_PROGRESS] },
                    { id: TaskStatus.REVIEW, label: 'Under Review', count: statusCounts[TaskStatus.REVIEW] },
                    { id: TaskStatus.DONE, label: 'Completed', count: statusCounts[TaskStatus.DONE] },
                  ] as const
                ).map(pill => {
                  const active = statusFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => {
                        soundService.play('click_soft');
                        setStatusFilter(pill.id);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? darkMode
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-900 text-white shadow-sm'
                          : darkMode
                          ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                          : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80'
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                          active
                            ? 'bg-white/20 text-white'
                            : darkMode
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-white text-slate-700'
                        }`}
                      >
                        {pill.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Super-Rounded 24px Task Cards List */}
            {filteredTasks.length === 0 ? (
              <div
                className={`p-8 rounded-[24px] border border-dashed text-center space-y-2 ${
                  darkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <p className={`text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  No tasks in this stage yet
                </p>
                <p className="text-[11px] text-slate-400">
                  Create a task or switch status pills above to inspect deliverables.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto scrollbar-thin pr-1">
                {filteredTasks.map(task => {
                  const proj = projects.find(p => p.id === task.projectId);
                  const assignee = users.find(u => u.id === task.assignee_id);
                  const checklist = task.checklist || [];
                  const doneChecks = checklist.filter(c => c.completed).length;
                  const isTaskHighlighted = highlightedTaskId === task.id;
                  const progressPct =
                    checklist.length > 0
                      ? Math.round((doneChecks / checklist.length) * 100)
                      : task.status === TaskStatus.DONE
                      ? 100
                      : task.status === TaskStatus.REVIEW
                      ? 75
                      : task.status === TaskStatus.IN_PROGRESS
                      ? 45
                      : 15;

                  const priorityBadge =
                    task.priority === TaskPriority.CRITICAL
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                      : task.priority === TaskPriority.HIGH
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                      : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300';

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        soundService.play('click_soft');
                        openViewTaskModal(task, true);
                      }}
                      className={`group p-4 rounded-[24px] border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        isTaskHighlighted ? 'animate-state-updated' : ''
                      } ${
                        darkMode
                          ? 'bg-slate-800/65 hover:bg-slate-800 border-white/[0.08] hover:border-indigo-500/40'
                          : 'bg-slate-50/90 hover:bg-white border-slate-200/70 hover:border-indigo-300 shadow-2xs hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${priorityBadge}`}>
                              {task.priority || 'Medium'}
                            </span>
                            {isTaskHighlighted && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-500">
                                ✓ Updated
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[110px]">
                            {proj?.name || 'Workspace'}
                          </span>
                        </div>
                        <h3
                          className={`text-xs sm:text-sm font-bold line-clamp-2 group-hover:text-indigo-500 transition-colors ${
                            darkMode ? 'text-slate-100' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </h3>
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>Progress</span>
                          <span className="tabular-nums font-bold">{progressPct}%</span>
                        </div>
                        <div
                          className={`w-full h-1.5 rounded-full overflow-hidden ${
                            darkMode ? 'bg-slate-700' : 'bg-slate-200'
                          }`}
                        >
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                              {(assignee?.full_name || assignee?.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate max-w-[90px]">
                              {assignee?.full_name?.split(' ')[0] || 'Assigned'}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-indigo-500 group-hover:translate-x-0.5 transition-transform">
                            Inspect →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'project_status':
        return (
          <div
            key={widgetId}
            {...wrapperProps}
            className={`${colSpan} p-5 sm:p-6 rounded-[32px] border flex flex-col justify-between space-y-4 transition-all ${
              darkMode
                ? 'bg-slate-900/75 border-white/10'
                : 'bg-white/88 border-white shadow-sm'
            } ${dragStateClasses}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {renderWidgetDragControls(widgetId)}
                <div className="min-w-0">
                  <h2 className={`text-base sm:text-lg font-bold tracking-tight truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    Project Status
                  </h2>
                  <p className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Concentric multi-ring velocity
                  </p>
                </div>
              </div>

              <select
                value={selectedGaugeProjectId}
                onChange={e => {
                  soundService.play('click_soft');
                  setSelectedGaugeProjectId(e.target.value);
                  pulseWidget('project_status');
                }}
                className="!w-auto !py-1.5 !px-3 !rounded-full text-xs font-semibold cursor-pointer max-w-[130px]"
              >
                <option value="all">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3-Ring Concentric SVG Gauge */}
            <div className="flex items-center justify-center py-2 relative">
              <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={rOuter}
                  fill="none"
                  stroke={darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)'}
                  strokeWidth="10"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={rMid}
                  fill="none"
                  stroke={darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)'}
                  strokeWidth="10"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={rInner}
                  fill="none"
                  stroke={darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)'}
                  strokeWidth="10"
                />

                {/* Outer Ring: Completed % (Electric Violet #8B5CF6) */}
                <circle
                  cx="80"
                  cy="80"
                  r={rOuter}
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={cOuter}
                  strokeDashoffset={cOuter - (cOuter * ringMetrics.donePct) / 100}
                  className="transition-all duration-700 ease-out"
                />

                {/* Middle Ring: In Progress % (Coral #F97316) */}
                <circle
                  cx="80"
                  cy="80"
                  r={rMid}
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={cMid}
                  strokeDashoffset={cMid - (cMid * ringMetrics.inProgressPct) / 100}
                  className="transition-all duration-700 ease-out"
                />

                {/* Inner Ring: Backlog / To Do % (Sky Blue #38BDF8) */}
                <circle
                  cx="80"
                  cy="80"
                  r={rInner}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={cInner}
                  strokeDashoffset={cInner - (cInner * ringMetrics.todoPct) / 100}
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span
                  className={`font-mono tabular-nums text-xl font-extrabold ${
                    darkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {ringMetrics.donePct}%
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Done
                </span>
              </div>
            </div>

            {/* Ring Legend Pills */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: 'Project Done', pct: `${ringMetrics.donePct}%`, dot: 'bg-[#8B5CF6]' },
                { label: 'In Progress', pct: `${ringMetrics.inProgressPct}%`, dot: 'bg-[#F97316]' },
                { label: 'Remaining', pct: `${ringMetrics.todoPct}%`, dot: 'bg-[#38BDF8]' },
              ].map((leg, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-2xl border text-center ${
                    darkMode ? 'bg-slate-800/60 border-white/[0.06]' : 'bg-slate-50/90 border-slate-200/60'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${leg.dot}`} />
                    <span className="truncate">{leg.label}</span>
                  </div>
                  <div
                    className={`font-mono tabular-nums text-sm font-bold mt-0.5 ${
                      darkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {leg.pct}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'calendar_schedule':
        return (
          <div
            key={widgetId}
            {...wrapperProps}
            className={`${colSpan} p-5 sm:p-6 rounded-[32px] border space-y-5 transition-all ${
              darkMode
                ? 'bg-slate-900/75 border-white/10'
                : 'bg-white/88 border-white shadow-sm'
            } ${dragStateClasses}`}
          >
            {/* Mini Month Calendar */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {renderWidgetDragControls(widgetId)}
                  <div>
                    <h2 className={`text-base sm:text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {monthName} {year}
                    </h2>
                    <p className="text-xs text-slate-400">Sprint &amp; Meeting Schedule</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      setCalendarDate(new Date(year, month - 1, 1));
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${
                      darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      const now = new Date();
                      setCalendarDate(now);
                      setSelectedDay(now.getDate());
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                      darkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      setCalendarDate(new Date(year, month + 1, 1));
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${
                      darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Weekday Header */}
              <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                  <div key={d} className="py-0.5">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: adjustedStartOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-7" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const isSelected = dayNum === selectedDay;
                  const isTodayNum =
                    dayNum === new Date().getDate() &&
                    month === new Date().getMonth() &&
                    year === new Date().getFullYear();
                  const hasMilestone = dayNum % 5 === 0 || isTodayNum;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => {
                        soundService.play('click_soft');
                        setSelectedDay(dayNum);
                      }}
                      className={`h-7 w-7 mx-auto rounded-full text-xs font-mono tabular-nums font-semibold flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : isTodayNum
                          ? darkMode
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : darkMode
                          ? 'text-slate-300 hover:bg-slate-800'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{dayNum}</span>
                      {hasMilestone && !isSelected && (
                        <span className="w-1 h-1 rounded-full bg-indigo-500 absolute bottom-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Today's Schedule Timeline */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  Schedule · {monthName.slice(0, 3)} {selectedDay}
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveView('calendar_view')}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer"
                >
                  Full Calendar →
                </button>
              </div>

              <div className="space-y-2">
                {scheduleItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if ('isMeet' in item && item.isMeet) {
                        handleStartInstantMeet();
                      } else if ('taskId' in item && item.taskId) {
                        openViewTaskModal(item.taskId, true);
                      } else {
                        setActiveView('calendar_view');
                      }
                    }}
                    className={`p-3 rounded-[22px] border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      darkMode
                        ? 'bg-slate-800/60 hover:bg-slate-800 border-white/[0.07]'
                        : 'bg-slate-50/90 hover:bg-white border-slate-200/70 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono tabular-nums text-xs font-bold text-indigo-500 shrink-0">
                        {item.time}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold truncate ${
                            darkMode ? 'text-slate-100' : 'text-slate-900'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${item.color}`}
                    >
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'meet_schedule':
        return (
          <div
            key={widgetId}
            {...wrapperProps}
            className={`${colSpan} p-5 rounded-[32px] border flex flex-col justify-between space-y-4 transition-all ${
              darkMode
                ? 'bg-slate-900/75 border-white/10'
                : 'bg-white/88 border-white shadow-sm'
            } ${dragStateClasses}`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderWidgetDragControls(widgetId)}
                  <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                    <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      Meet Schedule
                    </h3>
                    <p className="text-[11px] text-slate-400">09:30 am — 10:30 am</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                  1080p HD
                </span>
              </div>

              {/* Camera / Studio Stage Preview */}
              <div className="relative h-32 rounded-[24px] overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 border border-white/10 flex items-center justify-center">
                {camOff ? (
                  <div className="text-center space-y-1">
                    <div className="w-11 h-11 rounded-full bg-indigo-600/30 border border-indigo-400/40 text-white font-bold text-sm flex items-center justify-center mx-auto">
                      {(currentUser?.full_name || currentUser?.email || 'OF').slice(0, 2).toUpperCase()}
                    </div>
                    <p className="text-[10px] text-slate-300">Camera Preview Paused</p>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.35),transparent_65%)]" />
                    <div className="relative z-10 flex flex-col items-center gap-1.5">
                      <div className="flex -space-x-2">
                        {(users.length > 0 ? users.slice(0, 3) : [{ id: '1', full_name: 'Sophia', email: 's@o.io' }]).map(
                          (u, i) => (
                            <div
                              key={u.id || i}
                              className="w-9 h-9 rounded-full ring-2 ring-slate-900 bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold flex items-center justify-center"
                            >
                              {(u.full_name || u.email || 'T').charAt(0).toUpperCase()}
                            </div>
                          )
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-white">
                        {activeProject ? `${activeProject.name} Standup` : 'Product & Design Standup'}
                      </span>
                    </div>
                  </>
                )}

                {/* Floating Mic / Cam Pill Controls */}
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      setMicMuted(prev => !prev);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md transition-colors cursor-pointer ${
                      micMuted ? 'bg-rose-500/90 text-white' : 'bg-black/55 text-white hover:bg-black/75'
                    }`}
                  >
                    {micMuted ? 'Mic Off' : 'Mic On'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      setCamOff(prev => !prev);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md transition-colors cursor-pointer ${
                      camOff ? 'bg-amber-500/90 text-white' : 'bg-black/55 text-white hover:bg-black/75'
                    }`}
                  >
                    {camOff ? 'Cam Off' : 'Cam HD'}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartInstantMeet}
              className="w-full py-2.5 px-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
              <span>Join Meet Studio</span>
            </button>
          </div>
        );

      case 'team_chat':
        return (
          <div
            key={widgetId}
            {...wrapperProps}
            className={`${colSpan} p-5 rounded-[32px] border flex flex-col justify-between space-y-3 transition-all ${
              darkMode
                ? 'bg-slate-900/75 border-white/10'
                : 'bg-white/88 border-white shadow-sm'
            } ${dragStateClasses}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {renderWidgetDragControls(widgetId)}
                <div>
                  <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    Team Chat
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {Math.max(1, users.length)} members in #general
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('team_chat_view')}
                className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer"
              >
                Full Chat →
              </button>
            </div>

            <div className="space-y-2.5 max-h-36 overflow-y-auto scrollbar-thin pr-1">
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-[20px] text-xs space-y-1 ${
                    msg.isMe
                      ? 'bg-indigo-600 text-white ml-4'
                      : darkMode
                      ? 'bg-slate-800/80 text-slate-200 mr-4'
                      : 'bg-slate-100/90 text-slate-800 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] opacity-80">
                    <span className="font-bold">{msg.senderName}</span>
                    <span className="font-mono">{msg.timestamp}</span>
                  </div>
                  <p className="leading-snug">{msg.content}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendQuickChat} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Message team..."
                className="!rounded-full !py-2 !px-3.5 text-xs flex-1"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              >
                Send
              </button>
            </form>
          </div>
        );

      case 'focus_timer_notes':
        return (
          <div
            key={widgetId}
            {...wrapperProps}
            className={`${colSpan} flex flex-col gap-4 transition-all ${dragStateClasses}`}
          >
            {/* Pastel Lavender Focus Timer Card */}
            <div
              className={`p-4 sm:p-5 rounded-[32px] border flex flex-col justify-between space-y-3 ${
                darkMode
                  ? 'bg-gradient-to-br from-indigo-950/80 via-violet-950/60 to-slate-900 border-indigo-500/30'
                  : 'bg-gradient-to-br from-[#EDE9FE] via-[#F3E8FF] to-[#E0E7FF] border-white shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderWidgetDragControls(widgetId)}
                  <span
                    className={`text-xs font-bold ${
                      darkMode ? 'text-indigo-200' : 'text-indigo-950'
                    }`}
                  >
                    Task Focus Timer
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundService.play('click_soft');
                    setIsTimerRunning(false);
                    setTimerSeconds(20 * 60);
                  }}
                  className={`text-[11px] font-semibold cursor-pointer ${
                    darkMode ? 'text-indigo-300 hover:text-white' : 'text-indigo-700 hover:text-indigo-950'
                  }`}
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div
                  className={`font-mono tabular-nums text-3xl font-extrabold tracking-tight ${
                    darkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {formatTimer(timerSeconds)}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('state_updated');
                      setIsTimerRunning(prev => !prev);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      isTimerRunning
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-900 dark:bg-indigo-500 text-white shadow-sm'
                    }`}
                  >
                    {isTimerRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      setTimerSeconds(prev => prev + 5 * 60);
                    }}
                    className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer ${
                      darkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-white/80 text-slate-800 hover:bg-white'
                    }`}
                  >
                    +5m
                  </button>
                </div>
              </div>
            </div>

            {/* Pastel Rose Quick Sticky Notes Card */}
            <div
              className={`p-4 sm:p-5 rounded-[32px] border flex-1 flex flex-col justify-between space-y-2 ${
                darkMode
                  ? 'bg-gradient-to-br from-rose-950/50 via-purple-950/40 to-slate-900 border-rose-500/25'
                  : 'bg-gradient-to-br from-[#FCE7F3] via-[#F5D0FE]/60 to-[#EDE9FE] border-white shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    darkMode ? 'text-rose-200' : 'text-slate-900'
                  }`}
                >
                  Sticky Notes
                </span>
                <span
                  className={`text-[10px] font-mono transition-colors ${
                    noteSavedPulse ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'opacity-70'
                  }`}
                >
                  {noteSavedPulse ? '✓ Saved' : 'Auto-saved'}
                </span>
              </div>
              <textarea
                value={stickyNote}
                onChange={e => handleSaveStickyNote(e.target.value)}
                rows={3}
                className="!bg-white/55 dark:!bg-slate-950/40 !border-white/50 dark:!border-white/10 !rounded-2xl !text-xs !p-2.5 resize-none"
                placeholder="Jot down sprint reminders..."
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Role-Prominent Pill KPI Capsules + Customize Dashboard Layout Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="font-semibold">
            Live Workspace Overview · Drag any card handle to customize your layout
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCustomizingLayout && (
            <button
              type="button"
              onClick={handleResetLayout}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Reset Default
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              soundService.play('click_soft');
              setIsCustomizingLayout(prev => !prev);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              isCustomizingLayout
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : darkMode
                ? 'bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800'
                : 'bg-white/90 border-slate-200/80 text-slate-700 hover:bg-white shadow-2xs'
            }`}
          >
            <ICON_MAP.Squares2X2Icon className="w-3.5 h-3.5" />
            <span>{isCustomizingLayout ? 'Done Customizing' : 'Customize Dashboard'}</span>
          </button>
        </div>
      </div>

      {/* Customize Mode Drawer: Show/Hide Widgets & Quick Reorder */}
      {isCustomizingLayout && (
        <div
          className={`p-4 rounded-[28px] border animate-fadeIn flex flex-wrap items-center justify-between gap-3 ${
            darkMode
              ? 'bg-indigo-950/30 border-indigo-500/30 text-slate-200'
              : 'bg-indigo-50/80 border-indigo-200 text-slate-800'
          }`}
        >
          <div className="text-xs space-y-0.5">
            <div className="font-bold text-indigo-600 dark:text-indigo-300">
              Interactive Bento Customization Mode Active
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              Drag any widget card to swap positions, use ← / → arrows, or toggle visibility below:
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DEFAULT_WIDGET_ORDER.map(wId => {
              const isVisible = !hiddenWidgets.includes(wId);
              return (
                <button
                  key={wId}
                  type="button"
                  onClick={() => toggleWidgetVisibility(wId)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    isVisible
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : darkMode
                      ? 'bg-slate-900/80 text-slate-400 border-slate-700'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {isVisible ? '✓ ' : '+ '}
                  {WIDGET_LABELS[wId].title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. Top Pill-Shaped KPI Capsules Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {roleKpiCapsules.map((capsule, idx) => {
          const IconComp = capsule.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                soundService.play('click_soft');
                capsule.onClick();
              }}
              className={`group w-full text-left px-5 py-3.5 rounded-full border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                darkMode
                  ? 'bg-slate-900/75 hover:bg-slate-800/90 border-white/10 shadow-lg shadow-black/20'
                  : 'bg-white/90 hover:bg-white border-white shadow-sm hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${capsule.badgeBg}`}
                >
                  <IconComp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {capsule.label}
                  </p>
                  <p className={`text-[11px] font-semibold truncate mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {capsule.sub}
                  </p>
                </div>
              </div>
              <div
                className={`font-mono tabular-nums text-2xl sm:text-3xl font-extrabold pr-1 ${
                  darkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {capsule.value}
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Drag-and-Drop 12-Column Taskly & Soft Glass 32px Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 xl:grid-cols-12 gap-5 items-stretch">
        {widgetOrder.map(widgetId => renderBentoWidget(widgetId))}
      </div>
    </div>
  );
};
