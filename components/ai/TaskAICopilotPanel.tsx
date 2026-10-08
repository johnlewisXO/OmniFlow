import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Task, TaskChecklistItem, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import geminiService, { TaskCopilotAnalysis } from '../../services/geminiService';

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
      `Set task to ${analysis.estimatedStoryPoints} Fibonacci pts (${analysis.recommendedPriority} priority).`,
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
    <div
      className={`rounded-xl border p-4 transition-all ${
        darkMode
          ? 'bg-slate-900/90 border-indigo-500/30 text-slate-100'
          : 'bg-indigo-50/30 border-indigo-200/80 text-slate-900'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white flex-shrink-0">
            <ICON_MAP.SparklesIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">Context-Aware Task Co-Pilot</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="text-slate-500 dark:text-slate-400">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
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
              className="p-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              title={isExpanded ? 'Collapse AI Panel' : 'Expand AI Panel'}
            >
              <ICON_MAP.ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Analysis Output */}
      {analysis && isExpanded && (
        <div className="mt-4 pt-4 border-t border-indigo-200/60 dark:border-slate-800 space-y-4 text-xs">
          {/* Top Row: Effort Estimate, Smart Assignee, Risk Posture */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Effort & Priority */}
            <div className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200/80'}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Effort & Priority</span>
                <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                  {analysis.estimatedStoryPoints} pts · {analysis.recommendedPriority}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                {analysis.estimationRationale}
              </p>
              <button
                type="button"
                onClick={handleApplyStoryPoints}
                className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 dark:text-indigo-300 text-white font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Apply {analysis.estimatedStoryPoints} Story Points
              </button>
            </div>

            {/* 2. Smart Assignee */}
            <div className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200/80'}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Smart Capacity Match</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[120px]">
                  {recommendedUser ? recommendedUser.full_name || recommendedUser.email : 'Balanced Load'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                {analysis.recommendedAssigneeReason}
              </p>
              {recommendedUser && (
                <button
                  type="button"
                  onClick={handleApplySmartAssignee}
                  className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 dark:text-emerald-300 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Assign to {recommendedUser.full_name?.split(' ')[0] || recommendedUser.email}
                </button>
              )}
            </div>

            {/* 3. Risk & Blocker Detection */}
            <div className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200/80'}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Delivery Risk Level</span>
                <span
                  className={`font-semibold ${
                    analysis.riskLevel === 'High'
                      ? 'text-red-600 dark:text-red-400'
                      : analysis.riskLevel === 'Medium'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {analysis.riskLevel} Risk
                </span>
              </div>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
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
                  className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-amber-600/15 hover:bg-amber-600/25 text-amber-700 dark:text-amber-300 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Link Detected Prerequisite Blocker
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Acceptance Checklist, Subtasks, and Spec Enhancement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Suggested Subtasks & Acceptance Criteria */}
            <div className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200/80'} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Suggested Subtasks ({analysis.suggestedSubtasks.length}) & QA Criteria ({analysis.acceptanceCriteria.length})
                </span>
              </div>
              <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                {analysis.suggestedSubtasks.map((s, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2">
                    <span className="truncate">· {s.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{s.priority}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateAllSuggestedSubtasks}
                  disabled={creatingSubtasks}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {creatingSubtasks ? 'Creating...' : '+ Create Subtasks'}
                </button>
                <button
                  type="button"
                  onClick={handleApplyChecklist}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  + Add QA Checklist
                </button>
              </div>
            </div>

            {/* Enhanced Specification Preview */}
            <div className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200/80'} flex flex-col justify-between space-y-2`}>
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  AI Engineering Specification Draft
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-line leading-relaxed">
                  {analysis.enhancedDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplyEnhancedSpec}
                className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 font-semibold text-[11px] transition-colors cursor-pointer"
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
