import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Task, TaskChecklistItem, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import geminiService, { TaskCopilotAnalysis } from '../../services/geminiService';
import { AIBotFace } from './AIBotFace';

interface TaskAICopilotPanelProps {
  task: Task;
  onUpdateTask: (updates: Partial<Task>) => Promise<void>;
  onCreateSubtask: (title: string, priority: any) => Promise<void>;
  onLinkBlocker?: (blockerTaskId: string) => Promise<void>;
}

export const TaskAICopilotPanel: React.FC<TaskAICopilotPanelProps> = ({
  task,
  onUpdateTask,
  onCreateSubtask,
  onLinkBlocker,
}) => {
  const { tasks, users, darkMode, addToast } = useAppStore();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TaskCopilotAnalysis | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [creatingSubtasks, setCreatingSubtasks] = useState(false);

  const projectTasks = tasks.filter(t => t.projectId === task.projectId);

  const handleRunCopilot = async () => {
    setIsAnalyzing(true);
    setIsExpanded(true);
    try {
      const result = await geminiService.analyzeTaskWithCopilot(task, projectTasks, users);
      setAnalysis(result);
    } catch (err: any) {
      addToast('AI Co-Pilot Error', err?.message || 'Could not complete task analysis', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyStoryPoints = async () => {
    if (!analysis) return;
    await onUpdateTask({
      story_points: analysis.estimatedStoryPoints,
      priority: analysis.recommendedPriority,
    });
    addToast(
      'Effort & Priority Applied',
      `Set task to ${analysis.estimatedStoryPoints} effort pts (${analysis.recommendedPriority} priority).`,
      'success'
    );
  };

  const handleApplySmartAssignee = async () => {
    if (!analysis?.recommendedAssigneeId) return;
    const member = users.find(u => u.id === analysis.recommendedAssigneeId);
    await onUpdateTask({ assignee_id: analysis.recommendedAssigneeId });
    addToast(
      'Smart Assignee Applied',
      `Assigned ticket to ${member?.full_name || member?.email || 'recommended member'}.`,
      'success'
    );
  };

  const handleApplyEnhancedSpec = async () => {
    if (!analysis?.enhancedDescription) return;
    await onUpdateTask({ description: analysis.enhancedDescription });
    addToast('Specification Updated', 'Applied AI-structured engineering specification.', 'success');
  };

  const handleApplyChecklist = async () => {
    if (!analysis?.acceptanceCriteria?.length) return;
    const existing = task.checklist || [];
    const newItems: TaskChecklistItem[] = analysis.acceptanceCriteria.map(text => ({
      id: crypto.randomUUID(),
      title: text,
      completed: false,
      created_at: new Date().toISOString(),
    }));
    await onUpdateTask({ checklist: [...existing, ...newItems] });
    addToast(
      'Acceptance Checklist Added',
      `Added ${newItems.length} testable QA acceptance criteria to checklist.`,
      'success'
    );
  };

  const handleCreateAllSuggestedSubtasks = async () => {
    if (!analysis?.suggestedSubtasks?.length) return;
    setCreatingSubtasks(true);
    try {
      for (const sub of analysis.suggestedSubtasks) {
        await onCreateSubtask(sub.title, sub.priority);
      }
      addToast(
        'Subtasks Created',
        `Created ${analysis.suggestedSubtasks.length} AI-generated subtasks.`,
        'success'
      );
    } finally {
      setCreatingSubtasks(false);
    }
  };

  const recommendedUser = analysis?.recommendedAssigneeId
    ? users.find(u => u.id === analysis.recommendedAssigneeId)
    : null;

  return (
    <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sage)] p-4 transition-all text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AIBotFace mood={isAnalyzing ? 'thinking' : analysis ? 'happy' : 'idle'} size="sm" className="flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Context-Aware Task Co-Pilot</span>
              <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
              <span className="text-[var(--text-secondary)]">
                Effort Estimation · Risk Detection · Subtask & Spec Synthesis
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunCopilot}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[var(--accent-ink)] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
          >
            {isAnalyzing ? (
              <ICON_MAP.SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
            )}
            <span>{isAnalyzing ? 'Analyzing Context...' : analysis ? 'Refresh AI Analysis' : 'Analyze Task with AI'}</span>
          </button>

          {analysis && (
            <button
              type="button"
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-1.5 rounded-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              title={isExpanded ? 'Collapse AI Panel' : 'Expand AI Panel'}
            >
              <ICON_MAP.ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Analysis Output */}
      {analysis && isExpanded && (
        <div className="mt-4 pt-4 border-t border-[var(--border-hairline)] space-y-4 text-xs">
          {/* Top Row: Effort Estimate, Smart Assignee, Risk Posture */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Effort & Priority */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Effort & Priority</span>
                <span className="font-mono tabular-nums font-bold text-[#5C7022] dark:text-[#CCF048]">
                  {analysis.estimatedStoryPoints} pts · {analysis.recommendedPriority}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                {analysis.estimationRationale}
              </p>
              <button
                type="button"
                onClick={handleApplyStoryPoints}
                className="mt-2.5 w-full py-1.5 px-2.5 rounded-full bg-[#191B17] hover:bg-[#2C3028] dark:bg-[var(--bg-sage)] dark:hover:bg-[var(--bg-sage-hover)] dark:text-[var(--text-primary)] text-white font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Apply {analysis.estimatedStoryPoints} Story Points
              </button>
            </div>

            {/* 2. Smart Assignee */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Smart Capacity Match</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 truncate max-w-[120px]">
                  {recommendedUser ? recommendedUser.full_name || recommendedUser.email : 'Balanced Load'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                {analysis.recommendedAssigneeReason}
              </p>
              {recommendedUser && (
                <button
                  type="button"
                  onClick={handleApplySmartAssignee}
                  className="mt-2.5 w-full py-1.5 px-2.5 rounded-full bg-[#191B17] hover:bg-[#2C3028] dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 dark:text-emerald-300 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Assign to {recommendedUser.full_name?.split(' ')[0] || recommendedUser.email}
                </button>
              )}
            </div>

            {/* 3. Risk & Blocker Detection */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Delivery Risk Level</span>
                <span
                  className={`font-semibold ${
                    analysis.riskLevel === 'High'
                      ? 'text-rose-600 dark:text-rose-400'
                      : analysis.riskLevel === 'Medium'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {analysis.riskLevel} Risk
                </span>
              </div>
              <ul className="mt-1.5 space-y-1 text-[11px] text-[var(--text-secondary)]">
                {analysis.riskAnalysis.slice(0, 2).map((r, i) => (
                  <li key={i} className="leading-snug">
                    · {r}
                  </li>
                ))}
              </ul>
              {analysis.potentialBlockerTaskIds.length > 0 && onLinkBlocker && (
                <button
                  type="button"
                  onClick={() => onLinkBlocker(analysis.potentialBlockerTaskIds[0])}
                  className="mt-2.5 w-full py-1.5 px-2.5 rounded-full bg-amber-600/15 hover:bg-amber-600/25 text-amber-700 dark:text-amber-300 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Link Detected Prerequisite Blocker
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Acceptance Checklist, Subtasks, and Spec Enhancement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Suggested Subtasks & Acceptance Criteria */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text-primary)]">
                  Suggested Subtasks ({analysis.suggestedSubtasks.length}) & QA Criteria ({analysis.acceptanceCriteria.length})
                </span>
              </div>
              <ul className="space-y-1 text-[11px] text-[var(--text-secondary)]">
                {analysis.suggestedSubtasks.map((s, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2">
                    <span className="truncate">· {s.title}</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">{s.priority}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateAllSuggestedSubtasks}
                  disabled={creatingSubtasks}
                  className="flex-1 py-1.5 px-2.5 rounded-full bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[var(--accent-ink)] font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {creatingSubtasks ? 'Creating...' : '+ Create Subtasks'}
                </button>
                <button
                  type="button"
                  onClick={handleApplyChecklist}
                  className="flex-1 py-1.5 px-2.5 rounded-full border border-[var(--border-hairline)] hover:bg-[var(--bg-sage)] font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  + Add QA Checklist
                </button>
              </div>
            </div>

            {/* Enhanced Specification Preview */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col justify-between space-y-2">
              <div>
                <div className="font-semibold text-[var(--text-primary)] mb-1">
                  AI Engineering Specification Draft
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] line-clamp-3 whitespace-pre-line leading-relaxed">
                  {analysis.enhancedDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplyEnhancedSpec}
                className="w-full py-1.5 px-2.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-sage)] hover:bg-[var(--bg-sage-hover)] text-[var(--text-primary)] font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Apply Structured Specification to Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
