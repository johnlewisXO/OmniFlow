import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import geminiService, { ProjectBlueprint, MeetingExtractionResult } from '../../services/geminiService';
import edgeFunctionService, { EdgeFunctionSlug, EdgeInvocationRecord } from '../../services/edgeFunctionService';
import { TaskStatus, TaskPriority } from '../../types';
import { AIInsightsEngineWidget } from './AIInsightsEngineWidget';
import { Avatar } from '../shared/Avatar';
import { AIBotFace } from './AIBotFace';
import { PageHeader, SegmentedTabs, HairlineCard } from '../shared/EditorialUI';
import { Button } from '../shared/Button';

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
    currentOrganization,
    currentUser,
  } = useAppStore();

  const [activeStudioTab, setActiveStudioTab] = useState<'architect' | 'capacity' | 'meetings' | 'insights' | 'edge'>('architect');
  const [edgeLogs, setEdgeLogs] = useState<EdgeInvocationRecord[]>(() => edgeFunctionService.getInvocations());
  const [runningEdgeSlug, setRunningEdgeSlug] = useState<EdgeFunctionSlug | null>(null);

  useEffect(() => {
    return edgeFunctionService.subscribe(() => {
      setEdgeLogs([...edgeFunctionService.getInvocations()]);
    });
  }, []);

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full text-[var(--text-primary)] space-y-5 animate-fadeIn">
      {/* Studio Header */}
      <PageHeader
        eyebrow="AI-Native Project Co-Pilot · Autonomous Virtual PM"
        title="AI Project Manager & Strategy Studio"
        subtitle="Transform natural-language goals into multi-sprint roadmaps, balance team story-point capacity, extract action items from standup transcripts, and resolve delivery risks."
        actions={
          <div className="flex items-center gap-3">
            <AIBotFace
              mood={isGeneratingBlueprint || isMaterializing || isRebalancing || isExtractingMeeting ? 'thinking' : 'happy'}
              size="md"
              className="flex-shrink-0"
            />
          </div>
        }
      />

      {/* Segmented Studio Mode Selector */}
      <div className="flex items-center">
        <SegmentedTabs
          value={activeStudioTab}
          onChange={setActiveStudioTab}
          size="sm"
          options={[
            { id: 'architect', label: '1. Blueprint Architect', icon: <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" /> },
            { id: 'capacity', label: '2. Capacity Balancer', icon: <ICON_MAP.UserGroupIcon className="w-3.5 h-3.5" /> },
            { id: 'meetings', label: '3. Meeting Intelligence', icon: <ICON_MAP.DocumentTextIcon className="w-3.5 h-3.5" /> },
            { id: 'insights', label: '4. Risk & Insights', icon: <ICON_MAP.ChartBarIcon className="w-3.5 h-3.5" /> },
            { id: 'edge', label: '5. Edge Compute', icon: <ICON_MAP.BoltIcon className="w-3.5 h-3.5" /> },
          ]}
        />
      </div>

      {/* TAB 1: AI Initiative Blueprint Architect */}
      {activeStudioTab === 'architect' && (
        <div className="space-y-6">
          <HairlineCard>
            <div className="max-w-3xl space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Natural Language Goal → Full Project Execution Blueprint
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
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
                    className="flex-1 px-4 py-2.5 rounded-full border text-sm font-medium"
                  />
                  <Button
                    type="submit"
                    variant="lime"
                    disabled={isGeneratingBlueprint || !goalPrompt.trim()}
                    className="whitespace-nowrap"
                  >
                    {isGeneratingBlueprint ? (
                      <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <ICON_MAP.SparklesIcon className="w-4 h-4" />
                    )}
                    <span>{isGeneratingBlueprint ? 'Architecting Plan...' : 'Generate Execution Blueprint'}</span>
                  </Button>
                </div>

                {/* Preset Prompt Starters */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">Examples:</span>
                  {EXAMPLE_INITIATIVES.map((sample, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGoalPrompt(sample)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </HairlineCard>

          {/* Generated Blueprint Output */}
          {blueprint && (
            <HairlineCard className="space-y-6">
              {/* Blueprint Header & Materialize CTA */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[var(--border-hairline)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-semibold">
                    <span className="text-[#5C7022] dark:text-[#CCF048]">AI Execution Blueprint</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Target: {blueprint.targetLaunchDate}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {blueprint.confidenceScore}% Delivery Confidence
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)]">{blueprint.projectName}</h3>
                  <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                    {blueprint.projectDescription}
                  </p>
                </div>

                <Button
                  variant="lime"
                  onClick={handleMaterializeBlueprint}
                  disabled={isMaterializing}
                  className="whitespace-nowrap self-start"
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
                </Button>
              </div>

              {/* Milestones Strip */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  Key Milestones & Release Gates ({blueprint.milestones.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {blueprint.milestones.map((ms, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]"
                    >
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span className="font-semibold text-[#5C7022] dark:text-[#CCF048]">
                          0{idx + 1}. Milestone
                        </span>
                        <span className="font-mono tabular-nums">{ms.targetDate}</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{ms.title}</div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{ms.deliverable}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sprints & Tasks Breakdown */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  Phased Agile Sprints & Fibonacci Task Breakdown ({blueprint.sprints.length} Sprints)
                </h4>
                <div className="space-y-4">
                  {blueprint.sprints.map((sp, sIdx) => {
                    const sprintPts = sp.tasks.reduce((sum, t) => sum + (t.storyPoints || 3), 0);
                    return (
                      <div
                        key={sIdx}
                        className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
                          <div>
                            <div className="text-sm font-bold text-[var(--text-primary)]">{sp.name}</div>
                            <div className="text-xs text-[var(--text-secondary)]">{sp.goal}</div>
                          </div>
                          <div className="text-xs font-mono tabular-nums text-[#5C7022] dark:text-[#CCF048] font-semibold">
                            {sp.durationDays} days · {sp.tasks.length} tasks · {sprintPts} story pts
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          {sp.tasks.map((t, tIdx) => (
                            <div
                              key={tIdx}
                              className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] mb-1">
                                  <span className="font-semibold text-[var(--text-secondary)]">{t.priority}</span>
                                  <span className="font-mono tabular-nums font-bold text-[#5C7022] dark:text-[#CCF048]">
                                    {t.storyPoints} pts
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-[var(--text-primary)] leading-snug">
                                  {t.title}
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                                  {t.description}
                                </p>
                              </div>
                              {t.checklist?.length > 0 && (
                                <div className="pt-2 border-t border-[var(--border-hairline)] text-[10px] text-[var(--text-muted)]">
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                    Predictive Risk & Mitigation Matrix
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {blueprint.keyRisks.map((rk, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {rk.impact} Impact Risk
                          </span>
                        </div>
                        <div className="font-semibold text-[var(--text-primary)]">{rk.risk}</div>
                        <p className="text-[var(--text-secondary)]">
                          <strong>Mitigation:</strong> {rk.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </HairlineCard>
          )}
        </div>
      )}

      {/* TAB 2: AI Capacity & Workload Balancer */}
      {activeStudioTab === 'capacity' && (
        <HairlineCard className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                AI Team Capacity & Story-Point Load Balancer
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Real-time story point distribution across {users.length} team member(s) · {unassignedOpenTasks.length} unassigned open task(s).
              </p>
            </div>

            <Button
              variant="lime"
              onClick={handleAutoBalanceWorkload}
              disabled={isRebalancing}
              className="whitespace-nowrap"
            >
              {isRebalancing ? (
                <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ICON_MAP.SparklesIcon className="w-4 h-4" />
              )}
              <span>{isRebalancing ? 'Rebalancing Load...' : 'AI Auto-Balance Team Workload'}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamCapacity.map(item => (
              <div
                key={item.user.id}
                className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar user={item.user} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {item.user.full_name || item.user.email}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {(item.user.role || 'MEMBER').replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      item.status === 'Overloaded'
                        ? 'text-rose-600 dark:text-rose-400'
                        : item.status === 'Optimal'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-[#5C7022] dark:text-[#CCF048]'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-[var(--text-muted)]">
                      {item.activeTasks.length} active · {item.completedCount} shipped
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">{item.totalPoints} / 16 pts</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--bg-sage)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.status === 'Overloaded'
                          ? 'bg-rose-500'
                          : item.status === 'Optimal'
                          ? 'bg-emerald-500'
                          : 'bg-[#8FA643] dark:bg-[#CCF048]'
                      }`}
                      style={{ width: `${item.utilizationPct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </HairlineCard>
      )}

      {/* TAB 3: Meeting & Standup Intelligence */}
      {activeStudioTab === 'meetings' && (
        <HairlineCard className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              AI Meeting & Standup Transcript Extractor
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Paste standup notes, stakeholder call transcripts, or chat threads to automatically extract decisions, blockers, and ready-to-create tasks.
            </p>
          </div>

          <textarea
            rows={5}
            value={meetingTranscript}
            onChange={e => setMeetingTranscript(e.target.value)}
            className="w-full p-3.5 rounded-xl border text-xs font-mono leading-relaxed"
            placeholder="Paste meeting notes or standup transcript here..."
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--text-secondary)]">
              Target Project: <strong className="text-[var(--text-primary)]">{activeProject?.name || projects[0]?.name || 'Workspace'}</strong>
            </span>
            <Button
              variant="lime"
              onClick={handleExtractMeetingNotes}
              disabled={isExtractingMeeting || !meetingTranscript.trim()}
            >
              {isExtractingMeeting ? (
                <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ICON_MAP.SparklesIcon className="w-4 h-4" />
              )}
              <span>{isExtractingMeeting ? 'Extracting Action Items...' : 'Extract Decisions & Tasks'}</span>
            </Button>
          </div>

          {meetingResult && (
            <div className="pt-5 border-t border-[var(--border-hairline)] space-y-4">
              <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                <div className="text-xs font-bold text-[#5C7022] dark:text-[#CCF048] mb-1">Executive Summary</div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {meetingResult.executiveSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                    Key Decisions ({meetingResult.keyDecisions.length})
                  </div>
                  <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    {meetingResult.keyDecisions.map((d, i) => (
                      <li key={i}>· {d}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">
                    Detected Blockers ({meetingResult.detectedBlockers.length})
                  </div>
                  <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    {meetingResult.detectedBlockers.map((b, i) => (
                      <li key={i}>· {b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Extracted Action Items ({meetingResult.actionItems.length})
                  </h3>
                  <Button
                    variant="lime"
                    size="sm"
                    onClick={handleCreateExtractedTasks}
                    disabled={isCreatingMeetingTasks}
                  >
                    <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                    <span>
                      {isCreatingMeetingTasks ? 'Creating Tasks...' : 'Create All Tasks in Project'}
                    </span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {meetingResult.actionItems.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                        <span className="font-semibold text-[#5C7022] dark:text-[#CCF048]">{act.priority}</span>
                        <span className="font-mono tabular-nums font-bold">{act.storyPoints} pts</span>
                      </div>
                      <div className="font-semibold text-[var(--text-primary)]">{act.title}</div>
                      <p className="text-[var(--text-secondary)]">{act.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </HairlineCard>
      )}

      {/* TAB 4: Full AI Insights Engine */}
      {activeStudioTab === 'insights' && <AIInsightsEngineWidget />}

      {/* TAB 5: Supabase Edge Functions & Server Compute Pipeline */}
      {activeStudioTab === 'edge' && (
        <div className="space-y-6">
          <HairlineCard>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--border-hairline)]">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#5C7022] dark:text-[#CCF048]">
                  Supabase Edge Functions + Server Compute Runtime
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
                  High-Demand Compute Offloading Pipelines
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Execute AI risk synthesis, transactional SMTP/Brevo notifications, scheduled SLA rule evaluations, and 1080p WebRTC TURN/ICE provisioning off the main browser thread.
                </p>
              </div>
              <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full shrink-0">
                4 Edge Pipelines Active
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {[
                {
                  slug: 'ai-copilot-synthesis' as EdgeFunctionSlug,
                  title: '01 · ai-copilot-synthesis',
                  desc: 'Runs server-side Gemini 3.8 Flash sprint risk radar & executive report compilation.',
                  payload: {
                    operation: 'sprint_risk_radar',
                    payload: {
                      projectName: activeProject?.name || projects[0]?.name || 'Organization Portfolio',
                      sprintName: sprints[0]?.name || 'Active Sprint',
                      tasks: tasks.slice(0, 20),
                    },
                  },
                },
                {
                  slug: 'transactional-notifications' as EdgeFunctionSlug,
                  title: '02 · transactional-notifications',
                  desc: 'Dispatches Brevo/SMTP organization invite & join-request approval webhooks with tokenized fallback.',
                  payload: {
                    eventType: 'ORG_JOIN_REQUEST_APPROVED',
                    recipientEmail: currentUser?.email || 'team@omniflow.app',
                    organizationName: currentOrganization?.name || 'Workspace',
                    role: currentUser?.role || 'OWNER',
                  },
                },
                {
                  slug: 'automation-rule-engine' as EdgeFunctionSlug,
                  title: '03 · automation-rule-engine',
                  desc: 'Evaluates overdue SLA thresholds and WHEN → IF → THEN task escalation triggers.',
                  payload: {
                    organizationName: currentOrganization?.name || 'Workspace',
                    tasks,
                  },
                },
                {
                  slug: 'webrtc-turn-and-scribe' as EdgeFunctionSlug,
                  title: '04 · webrtc-turn-and-scribe',
                  desc: 'Provisions ephemeral 1080p/60fps & 48kHz Opus ICE/TURN credentials for low-latency video calls.',
                  payload: {
                    roomId: `org-${currentOrganization?.id || 'studio'}-hd`,
                    qualityProfile: '1080p_60fps_opus_48khz',
                  },
                },
              ].map(fn => {
                const isRunning = runningEdgeSlug === fn.slug;
                return (
                  <div
                    key={fn.slug}
                    className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-[#5C7022] dark:text-[#CCF048]">
                          {fn.title}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          supabase/functions/{fn.slug}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                        {fn.desc}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        setRunningEdgeSlug(fn.slug);
                        try {
                          const res = await edgeFunctionService.invoke(fn.slug, fn.payload);
                          addToast(
                            `Edge Function Executed (${res.latencyMs}ms)`,
                            res.data?.summary || `${fn.slug} completed successfully.`,
                            'success'
                          );
                        } catch (err: any) {
                          addToast('Edge Execution Error', err?.message || 'Failed to invoke function', 'error');
                        } finally {
                          setRunningEdgeSlug(null);
                        }
                      }}
                      disabled={isRunning}
                      className="w-full"
                    >
                      {isRunning ? 'Executing on Edge Runtime...' : 'Invoke Live Edge Function →'}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Live Invocation Telemetry Log */}
            {edgeLogs.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[var(--border-hairline)] space-y-2.5">
                <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Recent Edge Invocation Telemetry
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {edgeLogs.map(log => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={log.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}>
                          ●
                        </span>
                        <span className="font-bold text-[#5C7022] dark:text-[#CCF048]">{log.slug}</span>
                        <span className="text-[var(--text-secondary)] truncate">· {log.summary}</span>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] shrink-0 tabular-nums">
                        {log.latencyMs}ms · {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </HairlineCard>
        </div>
      )}
    </div>
  );
};
