import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import geminiService, { AIInsightItem } from '../../services/geminiService';
import { TaskPriority, TaskStatus } from '../../types';

interface AIInsightsEngineWidgetProps {
  compact?: boolean;
  projectIdFilter?: string;
}

export const AIInsightsEngineWidget: React.FC<AIInsightsEngineWidgetProps> = ({
  compact = false,
  projectIdFilter,
}) => {
  const {
    projects,
    tasks,
    sprints,
    users,
    darkMode,
    updateTask,
    openViewTaskModal,
    setActiveView,
    addToast,
  } = useAppStore();

  const [executingId, setExecutingId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  const scopedTasks = useMemo(() => {
    if (projectIdFilter && projectIdFilter !== 'all') {
      return tasks.filter(t => t.projectId === projectIdFilter);
    }
    return tasks;
  }, [tasks, projectIdFilter]);

  const scopedProjects = useMemo(() => {
    if (projectIdFilter && projectIdFilter !== 'all') {
      return projects.filter(p => p.id === projectIdFilter);
    }
    return projects;
  }, [projects, projectIdFilter]);

  const report = useMemo(() => {
    return geminiService.computeWorkspaceInsights(scopedProjects, scopedTasks, sprints, users);
  }, [scopedProjects, scopedTasks, sprints, users]);

  const visibleInsights = useMemo(() => {
    return report.insights.filter(item => !resolvedIds.includes(item.id));
  }, [report.insights, resolvedIds]);

  const handleExecuteInsightAction = async (insight: AIInsightItem) => {
    setExecutingId(insight.id);
    try {
      if (insight.category === 'resource_overload' && insight.targetEntityId && insight.secondaryEntityId) {
        const targetUser = users.find(u => u.id === insight.secondaryEntityId);
        await updateTask(insight.targetEntityId, { assignee_id: insight.secondaryEntityId });
        setResolvedIds(prev => [...prev, insight.id]);
        addToast(
          'Workload Rebalanced by AI',
          `Reassigned task to ${targetUser?.full_name || targetUser?.email || 'available teammate'} to optimize sprint velocity.`,
          'success'
        );
      } else if (insight.category === 'project_risk' && insight.targetEntityId && users.length > 0) {
        // Smart auto-assign to least loaded user
        const loadMap = users.map(u => ({
          user: u,
          count: scopedTasks.filter(t => t.assignee_id === u.id && t.status !== TaskStatus.DONE).length,
        }));
        loadMap.sort((a, b) => a.count - b.count);
        const bestUser = loadMap[0]?.user;
        if (bestUser) {
          await updateTask(insight.targetEntityId, { assignee_id: bestUser.id });
          setResolvedIds(prev => [...prev, insight.id]);
          addToast(
            'Smart Owner Assigned',
            `Assigned critical deliverable to ${bestUser.full_name || bestUser.email} (${loadMap[0].count} active tasks).`,
            'success'
          );
        }
      } else if (insight.id === 'insight-unestimated-backlog') {
        const unestimated = scopedTasks.filter(t => t.status !== TaskStatus.DONE && !t.story_points).slice(0, 6);
        for (const t of unestimated) {
          const pts =
            t.priority === TaskPriority.CRITICAL
              ? 8
              : t.priority === TaskPriority.HIGH
              ? 5
              : t.priority === TaskPriority.MEDIUM
              ? 3
              : 2;
          await updateTask(t.id, { story_points: pts });
        }
        setResolvedIds(prev => [...prev, insight.id]);
        addToast(
          'AI Story Point Estimation Complete',
          `Populated Fibonacci story points across ${unestimated.length} backlog task(s).`,
          'success'
        );
      } else if (insight.targetEntityType === 'task' && insight.targetEntityId) {
        openViewTaskModal(insight.targetEntityId);
      } else {
        setActiveView('ai_copilot_view');
      }
    } catch (err: any) {
      addToast('Action Failed', err?.message || 'Could not apply AI recommendation', 'error');
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div
      className={`glass-panel rounded-[20px] border p-5 transition-all backdrop-blur-2xl ${
        darkMode
          ? 'bg-slate-900/35 border-white/10 text-slate-100'
          : 'bg-white/25 border-white/40 text-slate-900 shadow-xs'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/30 dark:border-slate-800/80">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-[20px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex-shrink-0 mt-0.5">
            <ICON_MAP.SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">Smart Insights</span>
              <span aria-hidden="true">·</span>
              <span>Workspace Suggestions</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Work Insights & Tips
            </h2>
          </div>
        </div>

        {/* Tabular Strip */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-right">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Workspace Health</div>
            <div className="text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-white">
              {report.healthScore}/100 ·{' '}
              <span
                className={
                  report.riskLevel === 'Low'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : report.riskLevel === 'Moderate'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                {report.riskLevel}
              </span>
            </div>
          </div>

          <div className="h-7 w-px bg-slate-200/60 dark:bg-slate-800 hidden sm:block" />

          <div className="text-right">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Team Pace</div>
            <div className="text-sm font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
              {report.predictedVelocityPointsPerSprint} tasks / cycle
            </div>
          </div>

          <button
            onClick={() => setActiveView('ai_copilot_view')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[20px] bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
            <span>AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Forecast Banner */}
      <div className="mt-3.5 px-3.5 py-2.5 rounded-[20px] bg-white/30 dark:bg-slate-800/50 border border-white/40 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <ICON_MAP.BoltIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span>{report.forecastSummary}</span>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap hidden md:inline">
          {scopedTasks.length} tasks reviewed
        </span>
      </div>

      {/* Insights Grid */}
      <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-3.5 mt-4`}>
        {visibleInsights.map(insight => {
          const isCritical = insight.severity === 'critical';
          const isWarning = insight.severity === 'warning';

          return (
            <div
              key={insight.id}
              className={`p-4 rounded-[20px] border flex flex-col justify-between gap-3 transition-all backdrop-blur-xl ${
                darkMode
                  ? 'bg-slate-900/35 border-white/10 hover:border-indigo-500/50'
                  : 'bg-white/25 border-white/35 hover:border-indigo-400/60 shadow-xs'
              }`}
            >
              <div className="space-y-1.5">
                {/* Clean metadata line */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span
                      className={
                        isCritical
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : isWarning
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      }
                    >
                      {isCritical ? 'Needs Action' : isWarning ? 'Heads Up' : 'Tip'}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">{insight.metric}</span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                  {insight.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {insight.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/30 dark:border-slate-800/80 space-y-2.5">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-800 dark:text-slate-200">Suggestion:</strong>{' '}
                  {insight.recommendation}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleExecuteInsightAction(insight)}
                    disabled={executingId === insight.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
                  >
                    {executingId === insight.id ? (
                      <ICON_MAP.SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
                    )}
                    <span>{insight.actionLabel}</span>
                  </button>

                  {insight.targetEntityId && insight.targetEntityType === 'task' && (
                    <button
                      onClick={() => openViewTaskModal(insight.targetEntityId!)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      View Task →
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
