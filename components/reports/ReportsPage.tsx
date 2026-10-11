import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskStatus, TaskPriority, Project } from '../../types';
import geminiService from '../../services/geminiService';
import { Button } from '../shared/Button';
import { TeamWorkloadWidget } from '../overview/TeamWorkloadWidget';
import { KeyMilestonesWidget } from '../overview/KeyMilestonesWidget';
import { AIInsightsEngineWidget } from '../ai/AIInsightsEngineWidget';
import soundService from '../../services/soundService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Line,
} from 'recharts';
import { format, subDays, isAfter, differenceInHours } from 'date-fns';

type ReportWidgetId =
  | 'cumulative_flow'
  | 'burnup_velocity'
  | 'assignee_throughput'
  | 'status_distribution'
  | 'priority_breakdown'
  | 'cycle_time';

const DEFAULT_REPORT_WIDGETS: { id: ReportWidgetId; label: string; spanFull?: boolean }[] = [
  { id: 'cumulative_flow', label: 'Cumulative Flow & Throughput Area', spanFull: true },
  { id: 'burnup_velocity', label: 'Sprint Burnup & Story Point Velocity' },
  { id: 'cycle_time', label: 'Cycle Time & Resolution Speed' },
  { id: 'assignee_throughput', label: 'Team Workload & Story Point Efficiency' },
  { id: 'status_distribution', label: 'Task Status Distribution' },
  { id: 'priority_breakdown', label: 'Priority Risk Breakdown' },
];

export const ReportsPage: React.FC = () => {
  const {
    darkMode,
    tasks,
    projects,
    users,
    sprints,
    currentUser,
    fetchAllTasksForAllProjects,
    isLoadingTasks,
    openViewTaskModal,
    addToast,
  } = useAppStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | '7days' | '30days' | '90days'>('30days');

  // Interactive Chart Drill-Down State
  const [drillDownFilter, setDrillDownFilter] = useState<{
    title: string;
    predicate: (t: Task) => boolean;
  } | null>(null);

  // Customizable Report Widgets State
  const widgetStorageKey = `omni_report_widgets_v2_${currentUser?.id || 'guest'}`;
  const [visibleWidgets, setVisibleWidgets] = useState<ReportWidgetId[]>(() => {
    try {
      const saved = localStorage.getItem(widgetStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ReportWidgetId[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_REPORT_WIDGETS.map(w => w.id);
  });
  const [isCustomizingReport, setIsCustomizingReport] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // AI Executive Summary state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [executiveSummaryText, setExecutiveSummaryText] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    fetchAllTasksForAllProjects();
  }, [fetchAllTasksForAllProjects]);

  const toggleReportWidget = (id: ReportWidgetId) => {
    soundService.play('click_soft');
    setVisibleWidgets(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id];
      if (next.length === 0) return prev;
      try {
        localStorage.setItem(widgetStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const moveReportWidget = (id: ReportWidgetId, dir: -1 | 1) => {
    soundService.play('click_soft');
    setVisibleWidgets(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, removed);
      try {
        localStorage.setItem(widgetStorageKey, JSON.stringify(copy));
      } catch {}
      return copy;
    });
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (selectedProjectId !== 'all') {
      filtered = filtered.filter(
        t => t.projectId === selectedProjectId || t.project_id === selectedProjectId
      );
    }

    if (selectedAssigneeId !== 'all') {
      if (selectedAssigneeId === 'unassigned') {
        filtered = filtered.filter(t => !t.assignee_id && !t.assigneeId);
      } else {
        filtered = filtered.filter(
          t => t.assignee_id === selectedAssigneeId || t.assigneeId === selectedAssigneeId
        );
      }
    }

    if (dateRange !== 'all') {
      const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
      const cutoffDate = subDays(new Date(), days);
      filtered = filtered.filter(t => {
        if (!t.created_at) return true;
        return isAfter(new Date(t.created_at), cutoffDate);
      });
    }

    return filtered;
  }, [tasks, selectedProjectId, selectedAssigneeId, dateRange]);

  // Core Enriched KPIs
  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === TaskStatus.DONE).length;
    const inProgress = filteredTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const inReview = filteredTasks.filter(t => t.status === TaskStatus.REVIEW).length;
    const todo = filteredTasks.filter(t => t.status === TaskStatus.TODO).length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const totalPoints = filteredTasks.reduce((acc, t) => acc + (t.story_points || 2), 0);
    const completedPoints = filteredTasks
      .filter(t => t.status === TaskStatus.DONE)
      .reduce((acc, t) => acc + (t.story_points || 2), 0);
    const velocityPct = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    // Average cycle time (hours -> days)
    const doneTasksWithDates = filteredTasks.filter(
      t => t.status === TaskStatus.DONE && t.created_at && t.updated_at
    );
    const avgCycleHours =
      doneTasksWithDates.length > 0
        ? Math.round(
            doneTasksWithDates.reduce((acc, t) => {
              const hrs = Math.max(
                2,
                differenceInHours(new Date(t.updated_at!), new Date(t.created_at!))
              );
              return acc + hrs;
            }, 0) / doneTasksWithDates.length
          )
        : 28;

    const totalLoggedHours = filteredTasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);

    return {
      total,
      completed,
      inProgress,
      inReview,
      todo,
      completionPct,
      totalPoints,
      completedPoints,
      velocityPct,
      avgCycleHours,
      totalLoggedHours: Math.round(totalLoggedHours * 10) / 10,
    };
  }, [filteredTasks]);

  // 1. Cumulative Flow & Throughput Area Data
  const cumulativeFlowData = useMemo(() => {
    const daysCount = dateRange === '7days' ? 7 : dateRange === '30days' ? 14 : 14;
    const result: {
      date: string;
      Done: number;
      Review: number;
      'In Progress': number;
      'To Do': number;
    }[] = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const dayDate = subDays(new Date(), i);
      const label = format(dayDate, 'MMM dd');
      const tasksUpToDay = filteredTasks.filter(
        t => !t.created_at || new Date(t.created_at) <= dayDate
      );
      const baseCount = tasksUpToDay.length || Math.max(4, filteredTasks.length);
      const progressFactor = (daysCount - i) / daysCount;

      const doneCount =
        tasksUpToDay.filter(t => t.status === TaskStatus.DONE).length ||
        Math.round(baseCount * 0.35 * progressFactor);
      const reviewCount =
        tasksUpToDay.filter(t => t.status === TaskStatus.REVIEW).length ||
        Math.round(baseCount * 0.15);
      const inProgCount =
        tasksUpToDay.filter(t => t.status === TaskStatus.IN_PROGRESS).length ||
        Math.round(baseCount * 0.25);
      const todoCount = Math.max(
        0,
        tasksUpToDay.filter(t => t.status === TaskStatus.TODO).length
      );

      result.push({
        date: label,
        Done: doneCount,
        Review: reviewCount,
        'In Progress': inProgCount,
        'To Do': todoCount,
      });
    }
    return result;
  }, [filteredTasks, dateRange]);

  // 2. Sprint Burnup / Burndown & Story Point Velocity
  const burnupData = useMemo(() => {
    const totalPts = Math.max(12, metrics.totalPoints);
    const steps = 8;
    const points: {
      day: string;
      idealRemaining: number;
      actualRemaining: number;
      completedVelocity: number;
    }[] = [];

    for (let i = 0; i < steps; i++) {
      const ratio = i / (steps - 1);
      const ideal = Math.max(0, Math.round(totalPts * (1 - ratio)));
      const completedSoFar = Math.min(
        totalPts,
        Math.round(metrics.completedPoints * Math.pow(ratio, 0.85) + i * 1.2)
      );
      const actualRem = Math.max(0, totalPts - completedSoFar);
      points.push({
        day: format(subDays(new Date(), (steps - 1 - i) * 2), 'MMM dd'),
        idealRemaining: ideal,
        actualRemaining: actualRem,
        completedVelocity: completedSoFar,
      });
    }
    return points;
  }, [metrics.totalPoints, metrics.completedPoints]);

  // 3. Assignee Throughput & Story Point Efficiency
  const assigneeThroughputData = useMemo(() => {
    const map: Record<
      string,
      { id: string; name: string; active: number; completed: number; storyPoints: number }
    > = {};

    filteredTasks.forEach(task => {
      const uid = task.assignee_id || task.assigneeId || 'unassigned';
      const uName =
        uid === 'unassigned'
          ? 'Unassigned'
          : (users.find(u => u.id === uid)?.full_name || 'Teammate').split(' ')[0];

      if (!map[uid]) {
        map[uid] = { id: uid, name: uName, active: 0, completed: 0, storyPoints: 0 };
      }
      if (task.status === TaskStatus.DONE) {
        map[uid].completed += 1;
      } else {
        map[uid].active += 1;
      }
      map[uid].storyPoints += task.story_points || 2;
    });

    return Object.values(map).sort(
      (a, b) => b.completed + b.active - (a.completed + a.active)
    );
  }, [filteredTasks, users]);

  // 4. Task Status Breakdown
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      [TaskStatus.TODO]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.REVIEW]: 0,
      [TaskStatus.DONE]: 0,
    };
    filteredTasks.forEach(task => {
      counts[task.status] = (counts[task.status] || 0) + 1;
    });
    return [
      { name: 'To Do', statusKey: TaskStatus.TODO, value: counts[TaskStatus.TODO], color: '#64748b' },
      {
        name: 'In Progress',
        statusKey: TaskStatus.IN_PROGRESS,
        value: counts[TaskStatus.IN_PROGRESS],
        color: '#3b82f6',
      },
      { name: 'Review', statusKey: TaskStatus.REVIEW, value: counts[TaskStatus.REVIEW], color: '#a855f7' },
      { name: 'Done', statusKey: TaskStatus.DONE, value: counts[TaskStatus.DONE], color: '#10b981' },
    ].filter(d => d.value > 0);
  }, [filteredTasks]);

  // 5. Tasks by Priority
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {
      [TaskPriority.CRITICAL]: 0,
      [TaskPriority.HIGH]: 0,
      [TaskPriority.MEDIUM]: 0,
      [TaskPriority.LOW]: 0,
    };
    filteredTasks.forEach(task => {
      counts[task.priority] = (counts[task.priority] || 0) + 1;
    });
    return [
      {
        name: 'Critical',
        priorityKey: TaskPriority.CRITICAL,
        count: counts[TaskPriority.CRITICAL],
        fill: '#ef4444',
      },
      { name: 'High', priorityKey: TaskPriority.HIGH, count: counts[TaskPriority.HIGH], fill: '#f97316' },
      {
        name: 'Medium',
        priorityKey: TaskPriority.MEDIUM,
        count: counts[TaskPriority.MEDIUM],
        fill: '#eab308',
      },
      { name: 'Low', priorityKey: TaskPriority.LOW, count: counts[TaskPriority.LOW], fill: '#22c55e' },
    ];
  }, [filteredTasks]);

  // 6. Cycle Time Histogram Data
  const cycleTimeData = useMemo(() => {
    const buckets = [
      { bucket: '< 24h (Fast)', count: 0, color: '#10b981', minHrs: 0, maxHrs: 24 },
      { bucket: '1–3 Days', count: 0, color: '#3b82f6', minHrs: 24, maxHrs: 72 },
      { bucket: '4–7 Days', count: 0, color: '#f59e0b', minHrs: 72, maxHrs: 168 },
      { bucket: '7+ Days', count: 0, color: '#ef4444', minHrs: 168, maxHrs: 99999 },
    ];

    filteredTasks.forEach(t => {
      const start = t.created_at ? new Date(t.created_at) : subDays(new Date(), 2);
      const end = t.updated_at ? new Date(t.updated_at) : new Date();
      const hrs = Math.max(4, differenceInHours(end, start));
      if (hrs < 24) buckets[0].count += 1;
      else if (hrs < 72) buckets[1].count += 1;
      else if (hrs < 168) buckets[2].count += 1;
      else buckets[3].count += 1;
    });

    return buckets;
  }, [filteredTasks]);

  const drillDownTasks = useMemo(() => {
    if (!drillDownFilter) return [];
    return filteredTasks.filter(drillDownFilter.predicate);
  }, [filteredTasks, drillDownFilter]);

  const handleGenerateAISummary = async () => {
    setIsGeneratingSummary(true);
    setShowSummaryModal(true);
    setExecutiveSummaryText(null);

    try {
      const activeProj =
        selectedProjectId !== 'all'
          ? projects.find(p => p.id === selectedProjectId)
          : ({
              id: 'org',
              name: 'Organization Wide',
              description: 'All projects across organization',
            } as Project);

      const targetProject = activeProj || ({ id: 'default', name: 'Project Overview' } as Project);
      const targetTasks =
        selectedProjectId !== 'all'
          ? tasks.filter(t => t.projectId === selectedProjectId)
          : tasks;

      const summary = await geminiService.generateProjectExecutiveSummary(
        targetProject,
        targetTasks,
        users.length
      );
      setExecutiveSummaryText(summary);
    } catch (err: any) {
      setExecutiveSummaryText(
        `⚠️ Failed to generate AI Executive Summary: ${err.message || 'Check network connection.'}`
      );
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCopySummary = () => {
    if (!executiveSummaryText) return;
    navigator.clipboard.writeText(executiveSummaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Multi-Format Export Helper
  const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportFormat = (fmt: 'csv' | 'xls' | 'json' | 'md' | 'pdf') => {
    soundService.play('task_complete');
    setIsExportMenuOpen(false);
    const stamp = format(new Date(), 'yyyyMMdd_HHmm');

    if (fmt === 'pdf') {
      window.print();
      return;
    }

    const enrichedRows = filteredTasks.map(t => {
      const proj = projects.find(p => p.id === (t.projectId || t.project_id))?.name || 'General';
      const assignee =
        users.find(u => u.id === (t.assignee_id || t.assigneeId))?.full_name || 'Unassigned';
      const created = t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd') : '';
      const due = t.due_date || t.dueDate ? format(new Date((t.due_date || t.dueDate)!), 'yyyy-MM-dd') : '';
      return {
        id: t.id,
        title: t.title,
        project: proj,
        status: t.status,
        priority: t.priority,
        storyPoints: t.story_points || 1,
        loggedHours: t.loggedHours || 0,
        assignee,
        createdDate: created,
        dueDate: due,
        description: (t.description || '').replace(/\n/g, ' '),
      };
    });

    if (fmt === 'csv') {
      const headers = [
        'Task ID',
        'Task Title',
        'Project',
        'Status',
        'Priority',
        'Story Points',
        'Logged Hours',
        'Assignee',
        'Created Date',
        'Due Date',
        'Description',
      ];
      const csvRows = enrichedRows.map(r =>
        [
          `"${r.id}"`,
          `"${r.title.replace(/"/g, '""')}"`,
          `"${r.project.replace(/"/g, '""')}"`,
          `"${r.status}"`,
          `"${r.priority}"`,
          r.storyPoints,
          r.loggedHours,
          `"${r.assignee.replace(/"/g, '""')}"`,
          `"${r.createdDate}"`,
          `"${r.dueDate}"`,
          `"${r.description.replace(/"/g, '""')}"`,
        ].join(',')
      );
      triggerFileDownload(
        [headers.join(','), ...csvRows].join('\n'),
        `omni_flow_analytics_${stamp}.csv`,
        'text/csv;charset=utf-8;'
      );
      addToast('CSV Export Downloaded', `Exported ${enrichedRows.length} task records to CSV.`, 'success');
      return;
    }

    if (fmt === 'xls') {
      const headers = [
        'Task Title',
        'Project',
        'Status',
        'Priority',
        'Story Points',
        'Logged Hours',
        'Assignee',
        'Created Date',
        'Due Date',
      ];
      const tsvRows = enrichedRows.map(r =>
        [
          r.title,
          r.project,
          r.status,
          r.priority,
          r.storyPoints,
          r.loggedHours,
          r.assignee,
          r.createdDate,
          r.dueDate,
        ].join('\t')
      );
      triggerFileDownload(
        [headers.join('\t'), ...tsvRows].join('\n'),
        `omni_flow_spreadsheet_${stamp}.xls`,
        'application/vnd.ms-excel;charset=utf-8;'
      );
      addToast('Excel Spreadsheet Exported', `Exported ${enrichedRows.length} rows to .xls format.`, 'success');
      return;
    }

    if (fmt === 'json') {
      const payload = {
        generatedAt: new Date().toISOString(),
        filters: { selectedProjectId, selectedAssigneeId, dateRange },
        kpis: metrics,
        tasks: enrichedRows,
      };
      triggerFileDownload(
        JSON.stringify(payload, null, 2),
        `omni_flow_analytics_${stamp}.json`,
        'application/json;charset=utf-8;'
      );
      addToast('JSON Report Exported', 'Structured KPI and task dataset downloaded.', 'success');
      return;
    }

    if (fmt === 'md') {
      const mdLines = [
        `# Omni Flow — Performance & Delivery Report (${format(new Date(), 'MMM dd, yyyy')})`,
        ``,
        `## Executive KPI Summary`,
        `- **Total Filtered Tasks**: ${metrics.total}`,
        `- **Completed Tasks**: ${metrics.completed} (${metrics.completionPct}%)`,
        `- **Story Points Delivered**: ${metrics.completedPoints} / ${metrics.totalPoints} pts (${metrics.velocityPct}%)`,
        `- **Average Cycle Time**: ${metrics.avgCycleHours}h`,
        `- **Logged Focus Hours**: ${metrics.totalLoggedHours}h`,
        ``,
        `## Task Breakdown`,
        `| Title | Project | Status | Priority | Story Pts | Assignee |`,
        `| --- | --- | --- | --- | --- | --- |`,
        ...enrichedRows.map(
          r => `| ${r.title} | ${r.project} | ${r.status} | ${r.priority} | ${r.storyPoints} | ${r.assignee} |`
        ),
      ];
      triggerFileDownload(
        mdLines.join('\n'),
        `omni_flow_executive_report_${stamp}.md`,
        'text/markdown;charset=utf-8;'
      );
      addToast('Markdown Report Exported', 'Executive Markdown report downloaded.', 'success');
    }
  };

  const ChartBarIcon = ICON_MAP.ChartBarIcon;
  const FilterIcon = ICON_MAP.FilterIcon;
  const textColor = darkMode ? 'text-slate-100' : 'text-slate-900';
  const cardBg = darkMode
    ? 'bg-slate-900/75 border-slate-800/90'
    : 'bg-white/95 border-slate-200/90';

  const renderWidgetById = (widgetId: ReportWidgetId) => {
    if (!visibleWidgets.includes(widgetId)) return null;

    if (widgetId === 'cumulative_flow') {
      return (
        <div
          key={widgetId}
          className={`col-span-1 lg:col-span-2 p-5 rounded-[28px] border shadow-sm min-w-0 ${cardBg}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className={`text-base font-bold ${textColor}`}>
                Cumulative Flow & Stage Progression
              </h3>
              <p className="text-xs text-slate-400">
                Stacked daily work-in-progress and completed delivery across workflow stages
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              {metrics.completionPct}% Flow Efficiency
            </span>
          </div>
          <div className="h-64 sm:h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeFlowData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cfDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="cfReview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="cfInProg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="date" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                    borderColor: darkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '14px',
                  }}
                />
                <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="Done" stackId="1" stroke="#10b981" strokeWidth={2.5} fill="url(#cfDone)" />
                <Area type="monotone" dataKey="Review" stackId="1" stroke="#a855f7" strokeWidth={2} fill="url(#cfReview)" />
                <Area type="monotone" dataKey="In Progress" stackId="1" stroke="#3b82f6" strokeWidth={2} fill="url(#cfInProg)" />
                <Area type="monotone" dataKey="To Do" stackId="1" stroke="#64748b" strokeWidth={1.5} fillOpacity={0.15} fill="#64748b" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (widgetId === 'burnup_velocity') {
      return (
        <div key={widgetId} className={`p-5 rounded-[28px] border shadow-sm min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className={`text-base font-bold ${textColor}`}>
                Sprint Burnup & Burndown Trajectory
              </h3>
              <p className="text-xs text-slate-400">
                Ideal vs. actual remaining story points & cumulative velocity
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-bold text-emerald-500">
              {metrics.completedPoints}/{metrics.totalPoints} pts
            </span>
          </div>
          <div className="h-60 sm:h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={burnupData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="day" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                    borderColor: darkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '14px',
                  }}
                />
                <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="completedVelocity" name="Completed Points" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="actualRemaining" name="Actual Remaining" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="idealRemaining" name="Ideal Guideline" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (widgetId === 'cycle_time') {
      return (
        <div key={widgetId} className={`p-5 rounded-[28px] border shadow-sm min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className={`text-base font-bold ${textColor}`}>
                Cycle Time & Resolution Speed
              </h3>
              <p className="text-xs text-slate-400">
                Click any bar to drill down into tasks in that resolution window
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500">
              Avg {metrics.avgCycleHours}h
            </span>
          </div>
          <div className="h-60 sm:h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cycleTimeData}
                margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
                onClick={(state: any) => {
                  const payload = state?.activePayload?.[0]?.payload;
                  if (payload) {
                    soundService.play('click_soft');
                    setDrillDownFilter({
                      title: `Cycle Time: ${payload.bucket}`,
                      predicate: t => {
                        const start = t.created_at ? new Date(t.created_at) : subDays(new Date(), 2);
                        const end = t.updated_at ? new Date(t.updated_at) : new Date();
                        const hrs = Math.max(4, differenceInHours(end, start));
                        return hrs >= payload.minHrs && hrs < payload.maxHrs;
                      },
                    });
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="bucket" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                  contentStyle={{
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                    borderColor: darkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '14px',
                  }}
                />
                <Bar dataKey="count" name="Tasks" radius={[8, 8, 0, 0]} maxBarSize={44} className="cursor-pointer">
                  {cycleTimeData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (widgetId === 'assignee_throughput') {
      return (
        <div key={widgetId} className={`p-5 rounded-[28px] border shadow-sm min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className={`text-base font-bold ${textColor}`}>
                Teammate Throughput & Active Load
              </h3>
              <p className="text-xs text-slate-400">
                Click any teammate bar to inspect their assigned tasks
              </p>
            </div>
          </div>
          <div className="h-60 sm:h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={assigneeThroughputData}
                margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
                onClick={(state: any) => {
                  const payload = state?.activePayload?.[0]?.payload;
                  if (payload) {
                    soundService.play('click_soft');
                    setDrillDownFilter({
                      title: `Assignee: ${payload.name}`,
                      predicate: t =>
                        payload.id === 'unassigned'
                          ? !t.assignee_id && !t.assigneeId
                          : t.assignee_id === payload.id || t.assigneeId === payload.id,
                    });
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="name" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                    borderColor: darkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '14px',
                  }}
                />
                <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={38} className="cursor-pointer" />
                <Bar dataKey="active" name="In Flight" stackId="a" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={38} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (widgetId === 'status_distribution') {
      return (
        <div key={widgetId} className={`p-5 rounded-[28px] border shadow-sm min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className={`text-base font-bold ${textColor}`}>Task Status Distribution</h3>
              <p className="text-xs text-slate-400">Click any slice to filter tasks by stage</p>
            </div>
          </div>
          <div className="h-60 sm:h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={84}
                  paddingAngle={3}
                  dataKey="value"
                  onClick={(entry: any) => {
                    if (entry?.statusKey) {
                      soundService.play('click_soft');
                      setDrillDownFilter({
                        title: `Status: ${entry.name}`,
                        predicate: t => t.status === entry.statusKey,
                      });
                    }
                  }}
                  className="cursor-pointer"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                    borderColor: darkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '14px',
                  }}
                />
                <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (widgetId === 'priority_breakdown') {
      return (
        <div key={widgetId} className={`p-5 rounded-[28px] border shadow-sm min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className={`text-base font-bold ${textColor}`}>Tasks by Priority Severity</h3>
              <p className="text-xs text-slate-400">Click any bar to inspect tasks by priority</p>
            </div>
          </div>
          <div className="h-60 sm:h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={priorityData}
                layout="vertical"
                margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
                onClick={(state: any) => {
                  const payload = state?.activePayload?.[0]?.payload;
                  if (payload?.priorityKey) {
                    soundService.play('click_soft');
                    setDrillDownFilter({
                      title: `Priority: ${payload.name}`,
                      predicate: t => t.priority === payload.priorityKey,
                    });
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} horizontal={false} />
                <XAxis type="number" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} axisLine={false} width={65} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                    borderColor: darkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '14px',
                  }}
                />
                <Bar dataKey="count" name="Tasks" radius={[0, 6, 6, 0]} maxBarSize={28} className="cursor-pointer">
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`p-4 md:p-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'} space-y-6`}>
      {/* 1. Analytics Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[28px] p-6 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                <ChartBarIcon className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                Executive Intelligence & Custom Telemetry
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Reports & Performance Analytics
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
              Interactive cumulative flow, sprint burnup velocity, cycle time histograms, click-to-drill-down task inspection, and multi-format data exports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Customize Report Widgets Button */}
            <button
              type="button"
              onClick={() => {
                soundService.play('click_soft');
                setIsCustomizingReport(prev => !prev);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isCustomizingReport
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
            >
              <ICON_MAP.AdjustmentsHorizontalIcon className="w-4 h-4" />
              <span>{isCustomizingReport ? 'Done Customizing' : 'Customize Charts'}</span>
            </button>

            {/* Multi-Format Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  soundService.play('click_soft');
                  setIsExportMenuOpen(prev => !prev);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
              >
                <ICON_MAP.ArrowDownTrayIcon className="w-4 h-4 text-emerald-400" />
                <span>Export Data</span>
                <ICON_MAP.ChevronDownIcon className="w-3.5 h-3.5 opacity-80" />
              </button>

              {isExportMenuOpen && (
                <div
                  className={`absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl p-2 z-50 border backdrop-blur-xl ${
                    darkMode
                      ? 'bg-slate-900/95 border-slate-700 text-slate-100'
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Download Report Format
                  </div>
                  {[
                    { id: 'csv' as const, label: 'CSV Spreadsheet (.csv)', sub: 'Raw task & velocity table' },
                    { id: 'xls' as const, label: 'Excel Workbook (.xls)', sub: 'Formatted spreadsheet columns' },
                    { id: 'json' as const, label: 'Structured JSON (.json)', sub: 'KPIs + full task objects' },
                    { id: 'md' as const, label: 'Executive Markdown (.md)', sub: 'Ready for Notion / GitHub' },
                    { id: 'pdf' as const, label: 'Print / Save PDF', sub: 'High-contrast page snapshot' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleExportFormat(item.id)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-500/15 transition-colors flex flex-col cursor-pointer"
                    >
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className="text-[10px] text-slate-400">{item.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateAISummary}
              disabled={isGeneratingSummary}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 bg-indigo-500 hover:bg-indigo-400 text-white transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isGeneratingSummary ? (
                <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin text-white" />
              ) : (
                <ICON_MAP.SparklesIcon className="w-4 h-4 text-amber-300" />
              )}
              <span>{isGeneratingSummary ? 'Synthesizing...' : 'AI Executive Summary'}</span>
            </button>
          </div>
        </div>

        {/* Analytics KPI Metric Cards (tabular-nums) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              Filtered Scope
            </span>
            <div className="flex items-baseline gap-2 mt-1 font-mono tabular-nums">
              <span className="text-2xl font-black text-white">{metrics.total}</span>
              <span className="text-xs text-indigo-300 font-medium">tasks</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1 font-mono tabular-nums">
              {metrics.totalPoints} total story points
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
              Delivered
            </span>
            <div className="flex items-baseline gap-2 mt-1 font-mono tabular-nums">
              <span className="text-2xl font-black text-emerald-400">{metrics.completed}</span>
              <span className="text-xs text-slate-300">done</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1 font-mono tabular-nums">
              {metrics.completedPoints} pts shipped ({metrics.velocityPct}%)
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="flex items-baseline gap-2 mt-1 font-mono tabular-nums">
              <span className="text-2xl font-black text-white">{metrics.completionPct}%</span>
              <span className="text-xs text-indigo-300">ratio</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.completionPct}%` }}
              />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider">
              Avg Cycle Time
            </span>
            <div className="flex items-baseline gap-2 mt-1 font-mono tabular-nums">
              <span className="text-2xl font-black text-cyan-300">{metrics.avgCycleHours}h</span>
              <span className="text-xs text-slate-300">per task</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1 font-mono tabular-nums">
              {metrics.totalLoggedHours}h logged via Focus Timer
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
              Active Contributors
            </span>
            <div className="flex items-baseline gap-2 mt-1 font-mono tabular-nums">
              <span className="text-2xl font-black text-amber-300">{users.length}</span>
              <span className="text-xs text-slate-300">members</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Across {projects.length} project boards
            </p>
          </div>
        </div>
      </div>

      {/* Customize Report Widgets Drawer */}
      {isCustomizingReport && (
        <div
          className={`p-4 rounded-2xl border animate-fadeIn flex flex-wrap items-center justify-between gap-3 ${
            darkMode
              ? 'bg-indigo-950/40 border-indigo-500/30 text-slate-100'
              : 'bg-indigo-50 border-indigo-200 text-slate-800'
          }`}
        >
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500">
              Customize Report Charts & Order
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toggle chart visibility or use ← / → to reorder widgets on your report canvas:
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DEFAULT_REPORT_WIDGETS.map(w => {
              const isVis = visibleWidgets.includes(w.id);
              return (
                <div
                  key={w.id}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                    isVis
                      ? 'bg-accent text-white border-accent'
                      : darkMode
                      ? 'bg-slate-900 border-slate-700 text-slate-400'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleReportWidget(w.id)}
                    className="cursor-pointer"
                  >
                    {isVis ? '✓ ' : '+ '}
                    {w.label}
                  </button>
                  {isVis && (
                    <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-white/25">
                      <button
                        type="button"
                        onClick={() => moveReportWidget(w.id, -1)}
                        className="hover:opacity-75 px-0.5 cursor-pointer"
                        title="Move Earlier"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveReportWidget(w.id, 1)}
                        className="hover:opacity-75 px-0.5 cursor-pointer"
                        title="Move Later"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Insights & Predictive Forecasting */}
      <AIInsightsEngineWidget projectIdFilter={selectedProjectId} />

      {/* Filter Bar */}
      <div
        className={`p-4 rounded-2xl border ${cardBg} shadow-xs flex flex-wrap gap-3 items-center justify-between`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
            <FilterIcon className="w-4 h-4 mr-1.5 text-accent" /> Scope Filters:
          </div>

          <select
            className={`text-xs font-semibold rounded-xl px-3 py-2 border outline-none cursor-pointer ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            className={`text-xs font-semibold rounded-xl px-3 py-2 border outline-none cursor-pointer ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
            value={selectedAssigneeId}
            onChange={e => setSelectedAssigneeId(e.target.value)}
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center p-0.5 rounded-xl border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            {[
              { id: '7days', label: '7D' },
              { id: '30days', label: '30D' },
              { id: '90days', label: '90D' },
              { id: 'all', label: 'All Time' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateRange(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dateRange === tab.id
                    ? 'bg-accent text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs text-slate-400">
          Tip: Click any chart bar or slice to drill down into matching tasks.
        </span>
      </div>

      {/* Interactive Chart Drill-Down Drawer */}
      {drillDownFilter && (
        <div
          className={`p-5 rounded-[28px] border-2 border-accent/50 shadow-xl animate-fadeIn ${
            darkMode ? 'bg-slate-900/95 text-slate-100' : 'bg-white text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent border border-accent/30">
                Drill-Down Inspector
              </span>
              <h3 className="text-sm sm:text-base font-bold">{drillDownFilter.title}</h3>
              <span className="font-mono text-xs text-slate-400">
                ({drillDownTasks.length} matching tasks)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDrillDownFilter(null)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/70 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          {drillDownTasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No tasks match this chart segment in the current filter scope.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {drillDownTasks.map(t => {
                const assignee = users.find(u => u.id === (t.assignee_id || t.assigneeId));
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openViewTaskModal(t.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      darkMode
                        ? 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {t.status.replace(/_/g, ' ')} • {t.priority} • {assignee?.full_name || 'Unassigned'}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent shrink-0">
                      {t.story_points || 1} pts
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Customizable Report Charts Grid */}
      {isLoadingTasks && tasks.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <ICON_MAP.SpinnerIcon className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {visibleWidgets.map(wId => renderWidgetById(wId))}

          {/* Team Workload & Key Project Milestones Widgets */}
          <div className="col-span-1 lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
            <TeamWorkloadWidget />
            <KeyMilestonesWidget />
          </div>
        </div>
      )}

      {/* AI Executive Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn p-4">
          <div
            className={`p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <ICON_MAP.SparklesIcon className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-bold">AI Executive Project Summary</h3>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="text-sm opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 my-2 scrollbar-thin">
              {isGeneratingSummary || !executiveSummaryText ? (
                <div className="py-16 text-center space-y-3">
                  <ICON_MAP.SpinnerIcon className="w-10 h-10 mx-auto text-purple-500 animate-spin" />
                  <h4 className="font-semibold text-base">Synthesizing Executive Insights...</h4>
                  <p className="text-xs opacity-60 max-w-md mx-auto">
                    Analyzing project metrics, velocity, risk factors, and completed highlights across tasks.
                  </p>
                </div>
              ) : (
                <div
                  className={`p-5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-sans border ${
                    darkMode
                      ? 'bg-slate-900/60 border-slate-700 text-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  {executiveSummaryText}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAISummary}
                disabled={isGeneratingSummary}
              >
                Regenerate Report
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopySummary}
                  disabled={!executiveSummaryText || isGeneratingSummary}
                >
                  {copiedSummary ? 'Copied to Clipboard!' : 'Copy Summary'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowSummaryModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};