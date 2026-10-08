import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import geminiService, { ProjectBlueprint, MeetingExtractionResult } from '../../services/geminiService';
import { TaskStatus, TaskPriority } from '../../types';
import { AIInsightsEngineWidget } from './AIInsightsEngineWidget';
import { Avatar } from '../shared/Avatar';
import { AIBotFace } from './AIBotFace';

const EXAMPLE_INITIATIVES = [
  'Launch mobile app by December with offline sync and biometric login',
  'Enterprise SOC2 Type II security compliance & audit readiness in 6 weeks',
  'Build customer self-serve usage billing & analytics portal for Q4',
  'Migrate real-time collaboration engine to multi-region architecture',
];

const SAMPLE_MEETING_NOTES = `Engineering & Product Sync - Q4 Roadmap
- Sarah: Mobile authentication flow is 80% complete, need final API rate-limit headers from backend by Thursday.
- Marcus: Payment webhook retry queue is experiencing intermittent timeouts under peak load; we need a high-priority task to add exponential backoff and dead-letter alerting.
- Elena: Design sign-off for the Executive Analytics Export is done. Ready to break into frontend and CSV streaming tasks (5 story points).
- Decision: Freeze Sprint 14 scope on Friday 5pm and prioritize clearing the 3 open QA review tickets.`;

export const AIProjectManagerStudio: React.FC = () => {
  const {
    projects,
    tasks,
    sprints,
    users,
    activeProject,
    setActiveProject,
    setActiveView,
    createProject,
    createSprint,
    createTask,
    updateTask,
    darkMode,
    addToast,
  } = useAppStore();

  const [activeStudioTab, setActiveStudioTab] = useState<'architect' | 'capacity' | 'meetings' | 'insights'>('architect');

  // Tab 1: Blueprint Architect State
  const [goalPrompt, setGoalPrompt] = useState('Launch mobile app by December with offline sync and biometric login');
  const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
  const [blueprint, setBlueprint] = useState<ProjectBlueprint | null>(null);
  const [isMaterializing, setIsMaterializing] = useState(false);

  // Tab 2: Capacity & Workload Rebalancing State
  const [isRebalancing, setIsRebalancing] = useState(false);

  // Tab 3: Meeting Extractor State
  const [meetingTranscript, setMeetingTranscript] = useState(SAMPLE_MEETING_NOTES);
  const [isExtractingMeeting, setIsExtractingMeeting] = useState(false);
  const [meetingResult, setMeetingResult] = useState<MeetingExtractionResult | null>(null);
  const [isCreatingMeetingTasks, setIsCreatingMeetingTasks] = useState(false);

  // Compute real-time team capacity metrics
  const teamCapacity = useMemo(() => {
    return users.map(u => {
      const userTasks = tasks.filter(t => t.assignee_id === u.id && t.status !== TaskStatus.DONE);
      const completedCount = tasks.filter(t => t.assignee_id === u.id && t.status === TaskStatus.DONE).length;
      const totalPoints = userTasks.reduce((sum, t) => sum + (t.story_points || 2), 0);
      const criticalCount = userTasks.filter(
        t => t.priority === TaskPriority.CRITICAL || t.priority === TaskPriority.HIGH
      ).length;
      const utilizationPct = Math.min(100, Math.round((totalPoints / 16) * 100));
      return {
        user: u,
        activeTasks: userTasks,
        completedCount,
        totalPoints,
        criticalCount,
        utilizationPct,
        status: totalPoints > 14 ? 'Overloaded' : totalPoints >= 8 ? 'Optimal' : 'Available Capacity',
      };
    });
  }, [users, tasks]);

  const unassignedOpenTasks = useMemo(() => {
    return tasks.filter(t => t.status !== TaskStatus.DONE && !t.assignee_id);
  }, [tasks]);

  const handleGenerateBlueprint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!goalPrompt.trim()) return;
    setIsGeneratingBlueprint(true);
    try {
      const result = await geminiService.generateProjectBlueprint(goalPrompt.trim(), Math.max(2, users.length));
      setBlueprint(result);
      addToast(
        'Execution Blueprint Synthesized',
        `Generated ${result.sprints.length} sprints and ${result.sprints.reduce((a, s) => a + s.tasks.length, 0)} tasks for "${result.projectName}".`,
        'success'
      );
    } catch (err: any) {
      addToast('Blueprint Generation Error', err?.message || 'Could not generate blueprint', 'error');
    } finally {
      setIsGeneratingBlueprint(false);
    }
  };

  const handleMaterializeBlueprint = async () => {
    if (!blueprint) return;
    setIsMaterializing(true);
    try {
      const createdProj = await createProject({
        name: blueprint.projectName,
        description: blueprint.projectDescription,
      });

      const targetProjectId = (createdProj && 'id' in createdProj ? createdProj.id : activeProject?.id) || projects[0]?.id;
      if (!targetProjectId) {
        addToast('Project Creation Required', 'Could not resolve target project ID.', 'error');
        return;
      }

      let dayOffset = 0;
      let assigneeIdx = 0;

      for (let sIdx = 0; sIdx < blueprint.sprints.length; sIdx++) {
        const bpSprint = blueprint.sprints[sIdx];
        const start = new Date(Date.now() + dayOffset * 86400000).toISOString().split('T')[0];
        const end = new Date(Date.now() + (dayOffset + (bpSprint.durationDays || 14)) * 86400000)
          .toISOString()
          .split('T')[0];
        dayOffset += bpSprint.durationDays || 14;

        const createdSprint = await createSprint({
          projectId: targetProjectId,
          name: bpSprint.name,
          goal: bpSprint.goal,
          status: sIdx === 0 ? 'active' : 'planned',
          startDate: start,
          endDate: end,
        });

        for (const bpTask of bpSprint.tasks) {
          const assignedUser = users.length > 0 ? users[assigneeIdx % users.length] : undefined;
          assigneeIdx++;

          await createTask({
            title: bpTask.title,
            description: bpTask.description,
            priority: bpTask.priority || TaskPriority.MEDIUM,
            status: TaskStatus.TODO,
            projectId: targetProjectId,
            sprintId: createdSprint?.id,
            story_points: bpTask.storyPoints || 3,
            assignee_id: assignedUser?.id,
            checklist: (bpTask.checklist || []).map(itemText => ({
              id: crypto.randomUUID(),
              title: itemText,
              completed: false,
              created_at: new Date().toISOString(),
            })),
          });
        }
      }

      setActiveProject(targetProjectId);
      addToast(
        'Blueprint Materialized into Workspace',
        `Created "${blueprint.projectName}" with ${blueprint.sprints.length} sprints and assigned tasks across your team.`,
        'success'
      );
      setActiveView('kanban');
    } catch (err: any) {
      addToast('Materialization Error', err?.message || 'Failed to materialize project blueprint', 'error');
    } finally {
      setIsMaterializing(false);
    }
  };

  const handleAutoBalanceWorkload = async () => {
    if (users.length === 0) {
      addToast('No Team Members', 'Invite team members to balance workload.', 'warning');
      return;
    }
    setIsRebalancing(true);
    try {
      let changesCount = 0;
      const sortedByAvailable = [...teamCapacity].sort((a, b) => a.totalPoints - b.totalPoints);

      // 1. Assign unassigned tasks to least loaded members
      for (let i = 0; i < unassignedOpenTasks.length; i++) {
        const targetMember = sortedByAvailable[i % sortedByAvailable.length]?.user;
        if (targetMember) {
          await updateTask(unassignedOpenTasks[i].id, {
            assignee_id: targetMember.id,
            story_points: unassignedOpenTasks[i].story_points || 3,
          });
          changesCount++;
        }
      }

      // 2. If someone is overloaded, move 1 task to least loaded member
      const mostLoaded = [...teamCapacity].sort((a, b) => b.totalPoints - a.totalPoints)[0];
      const leastLoaded = sortedByAvailable[0];
      if (
        mostLoaded &&
        leastLoaded &&
        mostLoaded.user.id !== leastLoaded.user.id &&
        mostLoaded.activeTasks.length >= 2 &&
        mostLoaded.totalPoints >= leastLoaded.totalPoints + 4
      ) {
        const taskToMove = mostLoaded.activeTasks[mostLoaded.activeTasks.length - 1];
        if (taskToMove) {
          await updateTask(taskToMove.id, { assignee_id: leastLoaded.user.id });
          changesCount++;
        }
      }

      addToast(
        'AI Workload Rebalancing Complete',
        changesCount > 0
          ? `Optimized ${changesCount} task assignment(s) across ${users.length} contributors.`
          : 'Team workload is already balanced across active sprints.',
        'success'
      );
    } finally {
      setIsRebalancing(false);
    }
  };

  const handleExtractMeetingNotes = async () => {
    if (!meetingTranscript.trim()) return;
    setIsExtractingMeeting(true);
    try {
      const result = await geminiService.extractMeetingActions(
        meetingTranscript,
        activeProject?.name || projects[0]?.name || 'Workspace Project'
      );
      setMeetingResult(result);
      addToast(
        'Meeting Intelligence Extracted',
        `Identified ${result.actionItems.length} actionable tasks and ${result.keyDecisions.length} decisions.`,
        'success'
      );
    } finally {
      setIsExtractingMeeting(false);
    }
  };

  const handleCreateExtractedTasks = async () => {
    if (!meetingResult?.actionItems.length) return;
    const targetProjectId = activeProject?.id || projects[0]?.id;
    if (!targetProjectId) {
      addToast('No Active Project', 'Create or select a project first.', 'warning');
      return;
    }

    setIsCreatingMeetingTasks(true);
    try {
      for (let i = 0; i < meetingResult.actionItems.length; i++) {
        const item = meetingResult.actionItems[i];
        const assignee = users.length > 0 ? users[i % users.length] : undefined;
        await createTask({
          title: item.title,
          description: item.description,
          priority: item.priority || TaskPriority.HIGH,
          status: TaskStatus.TODO,
          projectId: targetProjectId,
          story_points: item.storyPoints || 3,
          assignee_id: assignee?.id,
        });
      }
      addToast(
        'Action Items Created',
        `Added ${meetingResult.actionItems.length} tasks to ${activeProject?.name || projects[0]?.name}.`,
        'success'
      );
    } finally {
      setIsCreatingMeetingTasks(false);
    }
  };

  return (
    <div className={`p-4 md:p-6 space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Studio Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-indigo-900/60 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <AIBotFace
              mood={isGeneratingBlueprint || isMaterializing || isRebalancing || isExtractingMeeting ? 'thinking' : 'happy'}
              size="lg"
              className="flex-shrink-0 mt-1"
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold">
                <ICON_MAP.SparklesIcon className="w-4 h-4 text-amber-300" />
                <span>AI-Native Project Co-Pilot · Autonomous Virtual PM</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                AI Project Manager & Strategy Studio
              </h1>
              <p className="text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
                Transform natural-language goals into multi-sprint roadmaps, balance team story-point capacity, extract action items from standup transcripts, and resolve delivery risks.
              </p>
            </div>
          </div>

          {/* Segmented Studio Mode Selector */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white/10 border border-white/15 self-start">
            {[
              { id: 'architect', label: '1. Blueprint Architect' },
              { id: 'capacity', label: '2. Capacity Balancer' },
              { id: 'meetings', label: '3. Meeting Intelligence' },
              { id: 'insights', label: '4. Risk & Insights' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveStudioTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeStudioTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-indigo-100 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: AI Initiative Blueprint Architect */}
      {activeStudioTab === 'architect' && (
        <div className="space-y-6">
          <div
            className={`p-6 rounded-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
            }`}
          >
            <div className="max-w-3xl space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Natural Language Goal → Full Project Execution Blueprint
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Describe your target outcome and deadline. The AI Project Manager will architect milestones, sprints, Fibonacci-estimated tasks, acceptance checklists, and risk mitigations.
                </p>
              </div>

              <form onSubmit={handleGenerateBlueprint} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={goalPrompt}
                    onChange={e => setGoalPrompt(e.target.value)}
                    placeholder='e.g. "Launch mobile app by December" or "Migrate auth to Passkeys in 4 weeks"'
                    className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      darkMode
                        ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isGeneratingBlueprint || !goalPrompt.trim()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {isGeneratingBlueprint ? (
                      <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <ICON_MAP.SparklesIcon className="w-4 h-4" />
                    )}
                    <span>{isGeneratingBlueprint ? 'Architecting Plan...' : 'Generate Execution Blueprint'}</span>
                  </button>
                </div>

                {/* Preset Prompt Starters */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">Examples:</span>
                  {EXAMPLE_INITIATIVES.map((sample, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGoalPrompt(sample)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        darkMode
                          ? 'bg-slate-800/70 border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500/50'
                          : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </div>

          {/* Generated Blueprint Output */}
          {blueprint && (
            <div
              className={`p-6 rounded-2xl border space-y-6 ${
                darkMode ? 'bg-slate-900 border-indigo-500/30' : 'bg-white border-indigo-200 shadow-sm'
              }`}
            >
              {/* Blueprint Header & Materialize CTA */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                    <span>AI Execution Blueprint</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Target: {blueprint.targetLaunchDate}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {blueprint.confidenceScore}% Delivery Confidence
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{blueprint.projectName}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                    {blueprint.projectDescription}
                  </p>
                </div>

                <button
                  onClick={handleMaterializeBlueprint}
                  disabled={isMaterializing}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap self-start"
                >
                  {isMaterializing ? (
                    <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <ICON_MAP.RocketLaunchIcon className="w-4 h-4" />
                  )}
                  <span>
                    {isMaterializing
                      ? 'Deploying Project, Sprints & Tasks...'
                      : 'Deploy Entire Blueprint to Workspace'}
                  </span>
                </button>
              </div>

              {/* Milestones Strip */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Key Milestones & Release Gates ({blueprint.milestones.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {blueprint.milestones.map((ms, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border ${
                        darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          0{idx + 1}. Milestone
                        </span>
                        <span className="font-mono tabular-nums">{ms.targetDate}</span>
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{ms.title}</div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{ms.deliverable}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sprints & Tasks Breakdown */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Phased Agile Sprints & Fibonacci Task Breakdown ({blueprint.sprints.length} Sprints)
                </h4>
                <div className="space-y-4">
                  {blueprint.sprints.map((sp, sIdx) => {
                    const sprintPts = sp.tasks.reduce((sum, t) => sum + (t.storyPoints || 3), 0);
                    return (
                      <div
                        key={sIdx}
                        className={`p-4 rounded-xl border ${
                          darkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/60 border-slate-200/80'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{sp.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{sp.goal}</div>
                          </div>
                          <div className="text-xs font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">
                            {sp.durationDays} days · {sp.tasks.length} tasks · {sprintPts} story pts
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          {sp.tasks.map((t, tIdx) => (
                            <div
                              key={tIdx}
                              className={`p-3 rounded-lg border flex flex-col justify-between gap-2 ${
                                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{t.priority}</span>
                                  <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                                    {t.storyPoints} pts
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                                  {t.title}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                  {t.description}
                                </p>
                              </div>
                              {t.checklist?.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
                                  {t.checklist.length} QA checklist items included
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Risk Matrix */}
              {blueprint.keyRisks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Predictive Risk & Mitigation Matrix
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {blueprint.keyRisks.map((rk, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {rk.impact} Impact Risk
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white">{rk.risk}</div>
                        <p className="text-slate-600 dark:text-slate-400">
                          <strong>Mitigation:</strong> {rk.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI Capacity & Workload Balancer */}
      {activeStudioTab === 'capacity' && (
        <div
          className={`p-6 rounded-2xl border space-y-5 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                AI Team Capacity & Story-Point Load Balancer
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time story point distribution across {users.length} team member(s) · {unassignedOpenTasks.length} unassigned open task(s).
              </p>
            </div>

            <button
              onClick={handleAutoBalanceWorkload}
              disabled={isRebalancing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isRebalancing ? (
                <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ICON_MAP.SparklesIcon className="w-4 h-4" />
              )}
              <span>{isRebalancing ? 'Rebalancing Load...' : 'AI Auto-Balance Team Workload'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamCapacity.map(item => (
              <div
                key={item.user.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/70 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar user={item.user} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.user.full_name || item.user.email}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {(item.user.role || 'MEMBER').replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      item.status === 'Overloaded'
                        ? 'text-red-600 dark:text-red-400'
                        : item.status === 'Optimal'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">
                      {item.activeTasks.length} active · {item.completedCount} shipped
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{item.totalPoints} / 16 pts</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.status === 'Overloaded'
                          ? 'bg-red-500'
                          : item.status === 'Optimal'
                          ? 'bg-emerald-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${item.utilizationPct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Meeting & Standup Intelligence */}
      {activeStudioTab === 'meetings' && (
        <div
          className={`p-6 rounded-2xl border space-y-5 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
          }`}
        >
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              AI Meeting & Standup Transcript Extractor
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste standup notes, stakeholder call transcripts, or chat threads to automatically extract decisions, blockers, and ready-to-create tasks.
            </p>
          </div>

          <textarea
            rows={5}
            value={meetingTranscript}
            onChange={e => setMeetingTranscript(e.target.value)}
            className={`w-full p-3.5 rounded-xl border text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              darkMode ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
            }`}
            placeholder="Paste meeting notes or standup transcript here..."
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Target Project: <strong>{activeProject?.name || projects[0]?.name || 'Workspace'}</strong>
            </span>
            <button
              onClick={handleExtractMeetingNotes}
              disabled={isExtractingMeeting || !meetingTranscript.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExtractingMeeting ? (
                <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ICON_MAP.SparklesIcon className="w-4 h-4" />
              )}
              <span>{isExtractingMeeting ? 'Extracting Action Items...' : 'Extract Decisions & Tasks'}</span>
            </button>
          </div>

          {meetingResult && (
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">Executive Summary</div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {meetingResult.executiveSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                    Key Decisions ({meetingResult.keyDecisions.length})
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {meetingResult.keyDecisions.map((d, i) => (
                      <li key={i}>· {d}</li>
                    ))}
                  </ul>
                </div>

                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">
                    Detected Blockers ({meetingResult.detectedBlockers.length})
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {meetingResult.detectedBlockers.map((b, i) => (
                      <li key={i}>· {b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Extracted Action Items ({meetingResult.actionItems.length})
                  </h3>
                  <button
                    onClick={handleCreateExtractedTasks}
                    disabled={isCreatingMeetingTasks}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                    <span>
                      {isCreatingMeetingTasks ? 'Creating Tasks...' : 'Create All Tasks in Project'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {meetingResult.actionItems.map((act, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{act.priority}</span>
                        <span className="font-mono tabular-nums font-bold">{act.storyPoints} pts</span>
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">{act.title}</div>
                      <p className="text-slate-500 dark:text-slate-400">{act.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Full AI Insights Engine */}
      {activeStudioTab === 'insights' && <AIInsightsEngineWidget />}
    </div>
  );
};
