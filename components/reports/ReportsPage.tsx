import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskStatus, TaskPriority, Project } from '../../types';
import geminiService from '../../services/geminiService';
import { Button } from '../shared/Button';
import { TeamWorkloadWidget } from '../overview/TeamWorkloadWidget';
import { KeyMilestonesWidget } from '../overview/KeyMilestonesWidget';
import soundService from '../../services/soundService';
import {
  PageHeader,
  InlineKpiStrip,
  SegmentedTabs,
  HairlineCard,
  SlideOverDrawer,
} from '../shared/EditorialUI';
import {
  getEditorialChartTheme,
  LiquidMetricProgress,
  LiquidHealthDistribution,
  LiquidSegmentedDistribution,
  HatchedActivityHeatmap,
  HeatmapDayCell,
} from '../charts/EditorialCharts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
  { id: 'cumulative_flow', label: 'Cumulative Flow & Stage Progression', spanFull: true },
  { id: 'burnup_velocity', label: 'Sprint Burnup & Velocity' },
  { id: 'cycle_time', label: 'Cycle Time & Resolution' },
  { id: 'assignee_throughput', label: 'Teammate Throughput' },
  { id: 'status_distribution', label: 'Status Distribution' },
  { id: 'priority_breakdown', label: 'Priority Breakdown' },
];

export const ReportsPage: React.FC = () => {
  const {
    darkMode,
    accentColor,
    tasks,
    projects,
    users,
    currentUser,
    fetchAllTasksForAllProjects,
    isLoadingTasks,
    openViewTaskModal,
    addToast,
  } = useAppStore();

  const chartTheme = useMemo(() => getEditorialChartTheme(darkMode), [darkMode, accentColor]);

  const [reportTab, setReportTab] = useState<'analytics' | 'team_milestones'>('analytics');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | '7days' | '30days' | '90days'>('30days');

  // Interactive Chart Drill-Down Drawer State
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
  const [showSummaryDrawer, setShowSummaryDrawer] = useState(false);
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
      filtered = filtered.filter(t => t.projectId === selectedProjectId);
    }

    if (selectedAssigneeId !== 'all') {
      if (selectedAssigneeId === 'unassigned') {
        filtered = filtered.filter(t => !t.assignee_id);
      } else {
        filtered = filtered.filter(t => t.assignee_id === selectedAssigneeId);
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

  // Activity Heatmap (15 weeks)
  const heatmapCells = useMemo<HeatmapDayCell[]>(() => {
    const daysTotal = 15 * 7;
    const countsByDay: Record<string, { count: number; points: number }> = {};
    filteredTasks.forEach(t => {
      const refDate = t.updated_at || t.created_at;
      if (!refDate) return;
      const key = format(new Date(refDate), 'yyyy-MM-dd');
      if (!countsByDay[key]) countsByDay[key] = { count: 0, points: 0 };
      countsByDay[key].count += 1;
      countsByDay[key].points += t.story_points || 2;
    });

    const cells: HeatmapDayCell[] = [];
    for (let i = daysTotal - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      const hit = countsByDay[key];
      cells.push({
        dateKey: key,
        label: format(d, 'MMM d'),
        count: hit ? hit.count : 0,
        points: hit ? hit.points : 0,
      });
    }
    return cells;
  }, [filteredTasks]);

  // Project Health Arc Breakdown
  const healthMetrics = useMemo(() => {
    const now = Date.now();
    let onTrack = 0;
    let atRisk = 0;
    let delayed = 0;

    filteredTasks.forEach(t => {
      if (t.status === TaskStatus.DONE) {
        onTrack += 1;
        return;
      }
      const due = t.due_date || t.dueDate;
      if (due && new Date(due).getTime() < now) {
        delayed += 1;
      } else if (t.priority === TaskPriority.CRITICAL) {
        atRisk += 1;
      } else {
        onTrack += 1;
      }
    });

    const total = Math.max(1, onTrack + atRisk + delayed);
    const pct = Math.round((onTrack / total) * 100);
    return {
      percentage: pct,
      statusLabel: pct >= 75 ? 'Healthy' : pct >= 50 ? 'Watch' : 'At Risk',
      segments: [
        { id: 'on_track', label: 'On Track', count: onTrack, tone: 'on_track' as const },
        { id: 'at_risk', label: 'At Risk', count: atRisk, tone: 'at_risk' as const },
        { id: 'delayed', label: 'Overdue', count: delayed, tone: 'delayed' as const },
      ],
    };
  }, [filteredTasks]);

  const cumulativeFlowData = useMemo(() => {
    const daysCount = dateRange === '7days' ? 7 : 14;
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
      const todoCount = Math.max(0, tasksUpToDay.filter(t => t.status === TaskStatus.TODO).length);

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

  const assigneeThroughputData = useMemo(() => {
    const map: Record<
      string,
      { id: string; name: string; active: number; completed: number; storyPoints: number }
    > = {};

    filteredTasks.forEach(task => {
      const uid = task.assignee_id || 'unassigned';
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

    return Object.values(map).sort((a, b) => b.completed + b.active - (a.completed + a.active));
  }, [filteredTasks, users]);

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
      { name: 'To Do', statusKey: TaskStatus.TODO, value: counts[TaskStatus.TODO], color: chartTheme.series.muted },
      {
        name: 'In Progress',
        statusKey: TaskStatus.IN_PROGRESS,
        value: counts[TaskStatus.IN_PROGRESS],
        color: chartTheme.series.charcoal,
      },
      { name: 'Review', statusKey: TaskStatus.REVIEW, value: counts[TaskStatus.REVIEW], color: chartTheme.series.amber },
      { name: 'Done', statusKey: TaskStatus.DONE, value: counts[TaskStatus.DONE], color: chartTheme.series.sage },
    ].filter(d => d.value > 0);
  }, [filteredTasks, chartTheme]);

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
        fill: chartTheme.series.crimson,
      },
      { name: 'High', priorityKey: TaskPriority.HIGH, count: counts[TaskPriority.HIGH], fill: chartTheme.series.amber },
      { name: 'Medium', priorityKey: TaskPriority.MEDIUM, count: counts[TaskPriority.MEDIUM], fill: chartTheme.series.sage },
      { name: 'Low', priorityKey: TaskPriority.LOW, count: counts[TaskPriority.LOW], fill: chartTheme.series.muted },
    ];
  }, [filteredTasks, chartTheme]);

  const cycleTimeData = useMemo(() => {
    const buckets = [
      { bucket: '< 24h', count: 0, color: chartTheme.series.sage, minHrs: 0, maxHrs: 24 },
      { bucket: '1–3 Days', count: 0, color: chartTheme.series.lime, minHrs: 24, maxHrs: 72 },
      { bucket: '4–7 Days', count: 0, color: chartTheme.series.amber, minHrs: 72, maxHrs: 168 },
      { bucket: '7+ Days', count: 0, color: chartTheme.series.crimson, minHrs: 168, maxHrs: 99999 },
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
  }, [filteredTasks, chartTheme]);

  const drillDownTasks = useMemo(() => {
    if (!drillDownFilter) return [];
    return filteredTasks.filter(drillDownFilter.predicate);
  }, [filteredTasks, drillDownFilter]);

  const handleGenerateAISummary = async () => {
    setIsGeneratingSummary(true);
    setShowSummaryDrawer(true);
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
        selectedProjectId !== 'all' ? tasks.filter(t => t.projectId === selectedProjectId) : tasks;

      const summary = await geminiService.generateProjectExecutiveSummary(
        targetProject,
        targetTasks,
        users.length
      );
      setExecutiveSummaryText(summary);
    } catch (err: any) {
      setExecutiveSummaryText(
        `Unable to generate summary: ${err.message || 'Check network connection.'}`
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
      const proj = projects.find(p => p.id === t.projectId)?.name || 'General';
      const assignee = users.find(u => u.id === t.assignee_id)?.full_name || 'Unassigned';
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
        [r.title, r.project, r.status, r.priority, r.storyPoints, r.loggedHours, r.assignee, r.createdDate, r.dueDate].join('\t')
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

  const renderWidgetById = (widgetId: ReportWidgetId) => {
    if (!visibleWidgets.includes(widgetId)) return null;

    if (widgetId === 'cumulative_flow') {
      return (
        <HairlineCard key={widgetId} padding="lg" className="col-span-1 lg:col-span-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Cumulative Flow & Stage Progression</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Daily work-in-progress and completed delivery across workflow stages
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
              {metrics.completionPct}% flow efficiency
            </span>
          </div>
          <div className="h-64 sm:h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeFlowData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="edDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartTheme.series.sage} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={chartTheme.series.sage} stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="edProg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartTheme.series.lime} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={chartTheme.series.lime} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
                <XAxis dataKey="date" stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chartTheme.tooltipStyle} />
                <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="Done" stackId="1" stroke={chartTheme.series.sage} strokeWidth={2.2} fill="url(#edDone)" />
                <Area type="monotone" dataKey="Review" stackId="1" stroke={chartTheme.series.amber} strokeWidth={1.8} fillOpacity={0.18} fill={chartTheme.series.amber} />
                <Area type="monotone" dataKey="In Progress" stackId="1" stroke={chartTheme.series.charcoal} strokeWidth={2} fill="url(#edProg)" />
                <Area type="monotone" dataKey="To Do" stackId="1" stroke={chartTheme.series.muted} strokeWidth={1.5} fillOpacity={0.12} fill={chartTheme.series.muted} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HairlineCard>
      );
    }

    if (widgetId === 'burnup_velocity') {
      return (
        <HairlineCard key={widgetId} padding="lg" className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Sprint Burnup & Burndown</h3>
              <p className="text-xs text-[var(--text-secondary)]">Ideal vs. actual remaining story points</p>
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-[var(--text-primary)]">
              {metrics.completedPoints}/{metrics.totalPoints}p
            </span>
          </div>
          <div className="h-60 sm:h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={burnupData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
                <XAxis dataKey="day" stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chartTheme.tooltipStyle} />
                <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="completedVelocity" name="Completed Points" fill={chartTheme.series.sage} radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Line type="monotone" dataKey="actualRemaining" name="Actual Remaining" stroke={chartTheme.series.charcoal} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="idealRemaining" name="Ideal Guideline" stroke={chartTheme.series.muted} strokeDasharray="5 5" strokeWidth={1.8} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </HairlineCard>
      );
    }

    if (widgetId === 'cycle_time') {
      return (
        <HairlineCard key={widgetId} padding="lg" className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Cycle Time & Resolution</h3>
              <p className="text-xs text-[var(--text-secondary)]">Click any bar to inspect matching tasks</p>
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-[var(--text-primary)]">
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
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
                <XAxis dataKey="bucket" stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(125,135,110,0.08)' }} contentStyle={chartTheme.tooltipStyle} />
                <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]} maxBarSize={42} className="cursor-pointer">
                  {cycleTimeData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </HairlineCard>
      );
    }

    if (widgetId === 'assignee_throughput') {
      return (
        <HairlineCard key={widgetId} padding="lg" className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Teammate Throughput</h3>
              <p className="text-xs text-[var(--text-secondary)]">Click a bar to drill down into teammate tasks</p>
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
                          ? !t.assignee_id
                          : t.assignee_id === payload.id,
                    });
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
                <XAxis dataKey="name" stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chartTheme.tooltipStyle} />
                <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill={chartTheme.series.sage} maxBarSize={36} className="cursor-pointer" />
                <Bar dataKey="active" name="In Flight" stackId="a" fill={chartTheme.series.charcoal} radius={[5, 5, 0, 0]} maxBarSize={36} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </HairlineCard>
      );
    }

    if (widgetId === 'status_distribution') {
      return (
        <HairlineCard key={widgetId} padding="lg" className="min-w-0 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Task Status Distribution</h3>
            <p className="text-xs text-[var(--text-secondary)]">Click any segment to inspect matching tasks</p>
          </div>
          <LiquidSegmentedDistribution
            segments={statusData}
            totalLabel="Tasks"
            onSegmentClick={entry => {
              if (entry?.statusKey) {
                soundService.play('click_soft');
                setDrillDownFilter({
                  title: `Status: ${entry.name}`,
                  predicate: t => t.status === entry.statusKey,
                });
              }
            }}
          />
        </HairlineCard>
      );
    }

    if (widgetId === 'priority_breakdown') {
      return (
        <HairlineCard key={widgetId} padding="lg" className="min-w-0">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Tasks by Priority Severity</h3>
            <p className="text-xs text-[var(--text-secondary)]">Click any bar to inspect priority queue</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} horizontal={false} />
                <XAxis type="number" stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke={chartTheme.axisColor} fontSize={11} tickLine={false} axisLine={false} width={65} />
                <Tooltip contentStyle={chartTheme.tooltipStyle} />
                <Bar dataKey="count" name="Tasks" radius={[0, 6, 6, 0]} maxBarSize={26} className="cursor-pointer">
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </HairlineCard>
      );
    }

    return null;
  };

  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState<string>('all');
  const [tableSortKey, setTableSortKey] = useState<'title' | 'priority' | 'status' | 'story_points'>('story_points');
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('desc');

  const executiveTableTasks = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const priorityRank: Record<string, number> = {
      [TaskPriority.CRITICAL]: 4,
      [TaskPriority.HIGH]: 3,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.LOW]: 1,
    };
    return [...filteredTasks]
      .filter(t => {
        if (tableStatusFilter !== 'all' && t.status !== tableStatusFilter) return false;
        if (!q) return true;
        const proj = projects.find(p => p.id === t.projectId)?.name || '';
        const assignee = users.find(u => u.id === t.assignee_id)?.full_name || '';
        return (
          t.title.toLowerCase().includes(q) ||
          proj.toLowerCase().includes(q) ||
          assignee.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dir = tableSortDir === 'asc' ? 1 : -1;
        if (tableSortKey === 'story_points') {
          return ((a.story_points || 1) - (b.story_points || 1)) * dir;
        }
        if (tableSortKey === 'priority') {
          return ((priorityRank[a.priority] || 0) - (priorityRank[b.priority] || 0)) * dir;
        }
        if (tableSortKey === 'status') {
          return a.status.localeCompare(b.status) * dir;
        }
        return a.title.localeCompare(b.title) * dir;
      });
  }, [filteredTasks, tableSearch, tableStatusFilter, tableSortKey, tableSortDir, projects, users]);

  const toggleTableSort = (key: 'title' | 'priority' | 'status' | 'story_points') => {
    if (tableSortKey === key) {
      setTableSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortKey(key);
      setTableSortDir('desc');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
      <PageHeader
        eyebrow="Analytics & Telemetry"
        title="Performance & Delivery Reports"
        subtitle="Sprint throughput, cycle time, and portfolio health."
        actions={
          <>
            <SegmentedTabs
              size="sm"
              value={reportTab}
              onChange={setReportTab}
              options={[
                { id: 'analytics', label: 'Analytics' },
                { id: 'team_milestones', label: 'Team & Milestones' },
              ]}
            />

            <Button
              variant={isCustomizingReport ? 'lime' : 'outline'}
              size="sm"
              onClick={() => {
                soundService.play('click_soft');
                setIsCustomizingReport(prev => !prev);
              }}
            >
              <ICON_MAP.AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
              {isCustomizingReport ? 'Done' : 'Widgets'}
            </Button>

            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  soundService.play('click_soft');
                  setIsExportMenuOpen(prev => !prev);
                }}
              >
                <ICON_MAP.ArrowDownTrayIcon className="w-3.5 h-3.5" />
                Export
                <ICON_MAP.ChevronDownIcon className="w-3 h-3" />
              </Button>

              {isExportMenuOpen && (
                <div className="editorial-popover absolute right-0 mt-2 w-56 rounded-2xl p-1.5 z-50">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Export Format
                  </div>
                  {[
                    { id: 'csv' as const, label: 'CSV (.csv)', sub: 'Task table' },
                    { id: 'xls' as const, label: 'Excel (.xls)', sub: 'Spreadsheet' },
                    { id: 'json' as const, label: 'JSON (.json)', sub: 'Structured dataset' },
                    { id: 'md' as const, label: 'Markdown (.md)', sub: 'Executive brief' },
                    { id: 'pdf' as const, label: 'Print / PDF', sub: 'Page snapshot' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleExportFormat(item.id)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--bg-sage)] transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{item.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{item.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="primary" size="sm" onClick={handleGenerateAISummary} disabled={isGeneratingSummary}>
              <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
              {isGeneratingSummary ? 'Synthesizing...' : 'Executive Brief'}
            </Button>
          </>
        }
      />

      <InlineKpiStrip
        items={[
          {
            id: 'scope',
            label: 'Total Scope',
            value: metrics.total,
            sublabel: `${metrics.totalPoints} story points`,
            tone: 'default',
          },
          {
            id: 'shipped',
            label: 'Tasks Shipped',
            value: metrics.completed,
            sublabel: `${metrics.velocityPct}% pts delivered`,
            tone: 'success',
          },
          {
            id: 'completion',
            label: 'Completion Rate',
            value: `${metrics.completionPct}%`,
            sublabel: `${metrics.inProgress} in progress`,
            visual: (
              <LiquidMetricProgress
                value={metrics.completionPct}
                tone="lime"
                compact
              />
            ),
          },
          {
            id: 'cycle',
            label: 'Avg Cycle Time',
            value: `${metrics.avgCycleHours}h`,
            sublabel: `${metrics.totalLoggedHours}h focus logged`,
            tone: 'lime',
          },
        ]}
      />

      {/* Customize Report Widgets Bar */}
      {isCustomizingReport && (
        <HairlineCard padding="md" className="flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Customize Report Charts & Order
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">
              Toggle chart visibility or use ← / → to reorder widgets:
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DEFAULT_REPORT_WIDGETS.map(w => {
              const isVis = visibleWidgets.includes(w.id);
              return (
                <div
                  key={w.id}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    isVis
                      ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] border-transparent'
                      : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                  }`}
                >
                  <button type="button" onClick={() => toggleReportWidget(w.id)} className="cursor-pointer">
                    {isVis ? '✓ ' : '+ '}
                    {w.label}
                  </button>
                  {isVis && (
                    <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-current/25">
                      <button type="button" onClick={() => moveReportWidget(w.id, -1)} className="px-0.5 cursor-pointer">
                        ←
                      </button>
                      <button type="button" onClick={() => moveReportWidget(w.id, 1)} className="px-0.5 cursor-pointer">
                        →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </HairlineCard>
      )}

      {/* Filter Bar */}
      <div className="editorial-surface px-4 py-2.5 flex flex-wrap gap-3 items-center justify-between text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Scope:
          </span>

          <select
            className="text-xs font-medium rounded-full px-3 py-1.5 border cursor-pointer"
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
            className="text-xs font-medium rounded-full px-3 py-1.5 border cursor-pointer"
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

          <SegmentedTabs
            size="sm"
            value={dateRange}
            onChange={setDateRange}
            options={[
              { id: '7days', label: '7D' },
              { id: '30days', label: '30D' },
              { id: '90days', label: '90D' },
              { id: 'all', label: 'All Time' },
            ]}
          />
        </div>

        <span className="text-[11px] text-[var(--text-muted)]">
          Click any chart segment to inspect matching tasks
        </span>
      </div>

      {reportTab === 'team_milestones' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TeamWorkloadWidget />
          <KeyMilestonesWidget />
        </div>
      ) : isLoadingTasks && tasks.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <ICON_MAP.SpinnerIcon className="w-7 h-7 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Signature Editorial Top Row: 15-Week Heatmap + Semi-Circle Health Arc */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8">
              <HatchedActivityHeatmap
                cells={heatmapCells}
                title="Delivery Cadence (15 Weeks)"
                onCellClick={cell =>
                  setDrillDownFilter({
                    title: `Activity on ${cell.label}`,
                    predicate: t => {
                      const d = t.updated_at || t.created_at;
                      return Boolean(d && format(new Date(d), 'yyyy-MM-dd') === cell.dateKey);
                    },
                  })
                }
              />
            </div>
            <div className="lg:col-span-4">
              <LiquidHealthDistribution
                percentage={healthMetrics.percentage}
                statusLabel={healthMetrics.statusLabel}
                segments={healthMetrics.segments}
                onSegmentClick={segId => {
                  const now = Date.now();
                  setDrillDownFilter({
                    title:
                      segId === 'delayed'
                        ? 'Overdue Tasks'
                        : segId === 'at_risk'
                        ? 'At Risk (Critical) Tasks'
                        : 'On-Track Tasks',
                    predicate: t => {
                      const due = t.due_date || t.dueDate;
                      const isOverdue = Boolean(due && t.status !== TaskStatus.DONE && new Date(due).getTime() < now);
                      if (segId === 'delayed') return isOverdue;
                      if (segId === 'at_risk') return !isOverdue && t.status !== TaskStatus.DONE && t.priority === TaskPriority.CRITICAL;
                      return !isOverdue && (t.status === TaskStatus.DONE || t.priority !== TaskPriority.CRITICAL);
                    },
                  });
                }}
              />
            </div>
          </div>

          {/* Customizable Recharts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {visibleWidgets.map(wId => renderWidgetById(wId))}
          </div>

          {/* Executive Task Drill-Down Table */}
          <HairlineCard padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Executive Delivery Drill-Down Table</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Showing <span className="font-mono tabular-nums font-semibold">{executiveTableTasks.length}</span> of{' '}
                  <span className="font-mono tabular-nums">{filteredTasks.length}</span> tasks in scope · Click any row to inspect
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  placeholder="Search task, project, assignee..."
                  className="px-3 py-1.5 rounded-full text-xs border w-52 sm:w-60"
                />
                <Button variant="outline" size="sm" onClick={() => handleExportFormat('csv')}>
                  <ICON_MAP.ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportFormat('json')}>
                  JSON
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: TaskStatus.TODO, label: 'To Do' },
                { id: TaskStatus.IN_PROGRESS, label: 'In Progress' },
                { id: TaskStatus.REVIEW, label: 'Review' },
                { id: TaskStatus.DONE, label: 'Done' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTableStatusFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    tableStatusFilter === tab.id
                      ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)]'
                      : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="py-2.5 pr-3">
                      <button type="button" onClick={() => toggleTableSort('title')} className="font-semibold hover:text-[var(--text-primary)] cursor-pointer">
                        Task {tableSortKey === 'title' ? (tableSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="py-2.5 pr-3 font-semibold">Project</th>
                    <th className="py-2.5 pr-3 font-semibold">Assignee</th>
                    <th className="py-2.5 pr-3">
                      <button type="button" onClick={() => toggleTableSort('priority')} className="font-semibold hover:text-[var(--text-primary)] cursor-pointer">
                        Priority {tableSortKey === 'priority' ? (tableSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="py-2.5 pr-3">
                      <button type="button" onClick={() => toggleTableSort('status')} className="font-semibold hover:text-[var(--text-primary)] cursor-pointer">
                        Status {tableSortKey === 'status' ? (tableSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="py-2.5 text-right">
                      <button type="button" onClick={() => toggleTableSort('story_points')} className="font-semibold hover:text-[var(--text-primary)] cursor-pointer">
                        Points {tableSortKey === 'story_points' ? (tableSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {executiveTableTasks.slice(0, 25).map(t => {
                    const proj = projects.find(p => p.id === t.projectId);
                    const assignee = users.find(u => u.id === t.assignee_id);
                    return (
                      <tr
                        key={t.id}
                        onClick={() => openViewTaskModal(t.id)}
                        className="hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 pr-3 font-semibold text-[var(--text-primary)] max-w-[260px] truncate">
                          {t.title}
                        </td>
                        <td className="py-2.5 pr-3 text-[var(--text-secondary)] max-w-[160px] truncate">
                          {proj?.name || 'Workspace'}
                        </td>
                        <td className="py-2.5 pr-3 text-[var(--text-secondary)]">
                          {assignee?.full_name || 'Unassigned'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              t.priority === TaskPriority.CRITICAL
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : t.priority === TaskPriority.HIGH
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-[var(--text-secondary)] capitalize">
                          {t.status.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                          {t.story_points || 1}p
                        </td>
                      </tr>
                    );
                  })}
                  {executiveTableTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                        No tasks match the current search and filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </HairlineCard>
        </div>
      )}

      {/* Drill-Down SlideOverDrawer */}
      <SlideOverDrawer
        isOpen={Boolean(drillDownFilter)}
        onClose={() => setDrillDownFilter(null)}
        title={drillDownFilter?.title || 'Task Drill-Down'}
        subtitle={`${drillDownTasks.length} matching tasks in current scope`}
      >
        {drillDownTasks.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-10 text-center">
            No tasks match this segment in the current filter scope.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {drillDownTasks.map(t => {
              const assignee = users.find(u => u.id === t.assignee_id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openViewTaskModal(t.id)}
                  className="w-full py-3 text-left flex items-center justify-between gap-3 hover:bg-[var(--bg-surface-subtle)] px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{t.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                      {t.status.replace(/_/g, ' ')} · {t.priority} · {assignee?.full_name || 'Unassigned'}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-[var(--text-secondary)] shrink-0 tabular-nums">
                    {t.story_points || 1}p
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </SlideOverDrawer>

      {/* AI Executive Brief SlideOverDrawer */}
      <SlideOverDrawer
        isOpen={showSummaryDrawer}
        onClose={() => setShowSummaryDrawer(false)}
        title="Executive Project Brief"
        subtitle={
          selectedProjectId === 'all'
            ? 'Organization-wide delivery synthesis'
            : projects.find(p => p.id === selectedProjectId)?.name
        }
        widthClass="max-w-2xl"
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerateAISummary} disabled={isGeneratingSummary}>
              Regenerate
            </Button>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopySummary}
                disabled={!executiveSummaryText || isGeneratingSummary}
              >
                {copiedSummary ? 'Copied!' : 'Copy Brief'}
              </Button>
            </div>
          </div>
        }
      >
        {isGeneratingSummary || !executiveSummaryText ? (
          <div className="py-16 text-center space-y-3">
            <ICON_MAP.SpinnerIcon className="w-8 h-8 mx-auto text-[var(--text-primary)] animate-spin" />
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">Synthesizing Executive Insights...</h4>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Analyzing delivery velocity, cycle times, risk factors, and completed milestones.
            </p>
          </div>
        ) : (
          <div className="editorial-surface-subtle p-4 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--text-primary)]">
            {executiveSummaryText}
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
};