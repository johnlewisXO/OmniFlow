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
    <div className="editorial-surface p-5 transition-all">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-2xl bg-[var(--bg-sage)] text-[var(--accent-text)] border border-[var(--border-hairline)] flex-shrink-0 mt-0.5">
            <ICON_MAP.SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--accent-text)]">Smart Insights</span>
              <span aria-hidden="true">·</span>
              <span>Workspace Suggestions</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] mt-0.5">
              Work Insights & Tips
            </h2>
          </div>
        </div>

        {/* Tabular Strip */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-right">
            <div className="text-[11px] text-[var(--text-muted)]">Workspace Health</div>
            <div className="text-sm font-mono tabular-nums font-bold text-[var(--text-primary)]">
              {report.healthScore}/100 ·{' '}
              <span
                className={
                  report.riskLevel === 'Low'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : report.riskLevel === 'Moderate'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }
              >
                {report.riskLevel}
              </span>
            </div>
          </div>

          <div className="h-7 w-px bg-[var(--border-hairline)] hidden sm:block" />

          <div className="text-right">
            <div className="text-[11px] text-[var(--text-muted)]">Team Pace</div>
            <div className="text-sm font-mono tabular-nums font-bold text-[var(--accent-text)]">
              {report.predictedVelocityPointsPerSprint} tasks / cycle
            </div>
          </div>

          <button
            onClick={() => setActiveView('ai_copilot_view')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[var(--accent-ink)] text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
            <span>AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Forecast Banner */}
      <div className="mt-3.5 px-3.5 py-2.5 rounded-2xl bg-[var(--bg-sage)] border border-[var(--border-hairline)] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <ICON_MAP.BoltIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span>{report.forecastSummary}</span>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] whitespace-nowrap hidden md:inline">
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
              className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] hover:border-[var(--border-strong)] flex flex-col justify-between gap-3 transition-all"
            >
              <div className="space-y-1.5">
                {/* Clean metadata line */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span
                      className={
                        isCritical
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : isWarning
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      }
                    >
                      {isCritical ? 'Needs Action' : isWarning ? 'Heads Up' : 'Tip'}
                    </span>
                    <span aria-hidden="true" className="text-[var(--text-muted)]">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-muted)]">{insight.metric}</span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                  {insight.title}
                </h3>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {insight.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2.5">
                <p className="text-[11px] text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">Suggestion:</strong>{' '}
                  {insight.recommendation}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleExecuteInsightAction(insight)}
                    disabled={executingId === insight.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#191B17] text-white hover:bg-[#2C3028] dark:bg-[#CCF048] dark:text-[#131511] dark:hover:bg-[#D8F568] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
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
                      className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
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
