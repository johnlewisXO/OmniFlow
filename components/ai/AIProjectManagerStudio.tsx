import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import geminiService, {
  ProjectBlueprint,
  MeetingExtractionResult,
  AICommandResponse,
} from '../../services/geminiService';
import edgeFunctionService, { EdgeFunctionSlug, EdgeInvocationRecord } from '../../services/edgeFunctionService';
import { TaskStatus, TaskPriority, normalizeTaskStatus } from '../../types';
import { AIInsightsEngineWidget } from './AIInsightsEngineWidget';
import { Avatar } from '../shared/Avatar';
import { AIBotFace } from './AIBotFace';
import { Button, IconButton } from '../shared/Button';
import { HairlineCard } from '../shared/EditorialUI';
import { VoiceTranscribeButton } from '../shared/VoiceTranscribeButton';
import soundService from '../../services/soundService';

type StudioMode = 'copilot' | 'architect' | 'meetings' | 'capacity' | 'insights' | 'edge';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode: StudioMode;
  createdAt: string;
  blueprint?: ProjectBlueprint;
  meetingResult?: MeetingExtractionResult;
  commandResponse?: AICommandResponse;
  showCapacityCard?: boolean;
  executedAction?: boolean;
}

interface StudioThread {
  id: string;
  title: string;
  mode: StudioMode;
  updatedAt: string;
  messages: ChatMessage[];
}

const SAMPLE_MEETING_NOTES = `Engineering & Product Sync - Q4 Roadmap
- Sarah: Mobile authentication flow is 80% complete, need final API rate-limit headers from backend by Thursday.
- Marcus: Payment webhook retry queue is experiencing intermittent timeouts under peak load; we need a high-priority task to add exponential backoff and dead-letter alerting.
- Elena: Design sign-off for the Executive Analytics Export is done. Ready to break into frontend and CSV streaming tasks (5 story points).
- Decision: Freeze Sprint 14 scope on Friday 5pm and prioritize clearing the 3 open QA review tickets.`;

const STARTER_CARDS: {
  id: string;
  mode: StudioMode;
  title: string;
  desc: string;
  prompt: string;
  icon: keyof typeof ICON_MAP;
}[] = [
  {
    id: 'starter-blueprint',
    mode: 'architect',
    title: 'Architect a Roadmap',
    desc: 'Generate sprints, milestones & tasks from a goal',
    prompt: 'Launch mobile app by December with offline sync and biometric login',
    icon: 'RocketLaunchIcon',
  },
  {
    id: 'starter-meeting',
    mode: 'meetings',
    title: 'Extract Meeting Actions',
    desc: 'Turn standup notes into decisions & tickets',
    prompt: SAMPLE_MEETING_NOTES,
    icon: 'DocumentTextIcon',
  },
  {
    id: 'starter-capacity',
    mode: 'capacity',
    title: 'Balance Team Workload',
    desc: 'Inspect story points & rebalance overloaded seats',
    prompt: 'Analyze current team story-point capacity and show workload balance options',
    icon: 'UserGroupIcon',
  },
  {
    id: 'starter-brief',
    mode: 'copilot',
    title: 'Executive Status Brief',
    desc: 'Summarize velocity, overdue items & blockers',
    prompt: 'Summarize active project health, overdue tasks, and critical delivery risks',
    icon: 'SparklesIcon',
  },
];

const MODE_NAV_ITEMS: {
  id: StudioMode;
  label: string;
  shortLabel: string;
  icon: keyof typeof ICON_MAP;
}[] = [
  { id: 'copilot', label: 'Co-Pilot Chat', shortLabel: 'Auto', icon: 'SparklesIcon' },
  { id: 'architect', label: 'Blueprint Architect', shortLabel: 'Blueprint', icon: 'RocketLaunchIcon' },
  { id: 'meetings', label: 'Meeting Extractor', shortLabel: 'Meetings', icon: 'DocumentTextIcon' },
  { id: 'capacity', label: 'Capacity Balancer', shortLabel: 'Capacity', icon: 'UserGroupIcon' },
  { id: 'insights', label: 'Risk Radar', shortLabel: 'Risk Radar', icon: 'ChartBarIcon' },
  { id: 'edge', label: 'Edge Compute', shortLabel: 'Edge', icon: 'BoltIcon' },
];

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
    addToast,
    currentOrganization,
    currentUser,
  } = useAppStore();

  const storageKey = `omni_aether_threads_v2_${currentUser?.id || 'guest'}`;
  const [threads, setThreads] = useState<StudioThread[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StudioThread[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'thread-initial',
        title: 'New Conversation',
        mode: 'copilot',
        updatedAt: new Date().toISOString(),
        messages: [],
      },
    ];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => threads[0]?.id || 'thread-initial');
  const [activeMode, setActiveMode] = useState<StudioMode>('copilot');
  const [isRailOpen, setIsRailOpen] = useState<boolean>(true);
  const [promptInput, setPromptInput] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isExecutingActionId, setIsExecutingActionId] = useState<string | null>(null);

  const [edgeLogs, setEdgeLogs] = useState<EdgeInvocationRecord[]>(() => edgeFunctionService.getInvocations());
  const [runningEdgeSlug, setRunningEdgeSlug] = useState<EdgeFunctionSlug | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return edgeFunctionService.subscribe(() => {
      setEdgeLogs([...edgeFunctionService.getInvocations()]);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(threads.slice(0, 15)));
    } catch {}
  }, [threads, storageKey]);

  const activeThread = useMemo(
    () => threads.find(t => t.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );

  const selectedTargetProject = useMemo(
    () => activeProject || projects[0] || null,
    [activeProject, projects]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages.length, isThinking]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(180, Math.max(44, textareaRef.current.scrollHeight))}px`;
  }, [promptInput]);

  const teamCapacity = useMemo(() => {
    return users.map(u => {
      const userTasks = tasks.filter(t => t.assignee_id === u.id && t.status !== TaskStatus.DONE);
      const completedCount = tasks.filter(t => t.assignee_id === u.id && t.status === TaskStatus.DONE).length;
      const totalPoints = userTasks.reduce((sum, t) => sum + (t.story_points || 2), 0);
      const utilizationPct = Math.min(100, Math.round((totalPoints / 16) * 100));
      return {
        user: u,
        activeTasks: userTasks,
        completedCount,
        totalPoints,
        utilizationPct,
        status: totalPoints > 14 ? 'Overloaded' : totalPoints >= 8 ? 'Optimal' : 'Available',
      };
    });
  }, [users, tasks]);

  const unassignedOpenTasks = useMemo(
    () => tasks.filter(t => t.status !== TaskStatus.DONE && !t.assignee_id),
    [tasks]
  );

  const appendMessagesToThread = (threadId: string, newMsgs: ChatMessage[], firstTitle?: string) => {
    setThreads(prev =>
      prev.map(th => {
        if (th.id !== threadId) return th;
        const shouldRename = th.messages.length === 0 && firstTitle;
        return {
          ...th,
          title: shouldRename
            ? firstTitle.length > 40
              ? `${firstTitle.slice(0, 40)}...`
              : firstTitle
            : th.title,
          updatedAt: new Date().toISOString(),
          messages: [...th.messages, ...newMsgs],
        };
      })
    );
  };

  const handleStartNewThread = (mode: StudioMode = 'copilot') => {
    soundService.play('click_soft');
    const newThread: StudioThread = {
      id: `thread-${Date.now()}`,
      title: 'New Conversation',
      mode,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setActiveMode(mode);
    setPromptInput('');
  };

  const handleDeleteThread = (id: string) => {
    setThreads(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        const fallback: StudioThread = {
          id: `thread-${Date.now()}`,
          title: 'New Conversation',
          mode: 'copilot',
          updatedAt: new Date().toISOString(),
          messages: [],
        };
        setActiveThreadId(fallback.id);
        return [fallback];
      }
      if (activeThreadId === id) {
        setActiveThreadId(next[0].id);
      }
      return next;
    });
  };

  const detectAutoMode = (input: string, chosenMode: StudioMode): StudioMode => {
    if (chosenMode !== 'copilot') return chosenMode;
    const lower = input.toLowerCase();
    if (
      input.split('\n').length >= 3 &&
      (lower.includes('decision') || lower.includes('sync') || lower.includes('- ') || lower.includes('transcript'))
    ) {
      return 'meetings';
    }
    if (lower.includes('blueprint') || (lower.includes('roadmap') && lower.includes('sprint'))) {
      return 'architect';
    }
    if (lower.includes('capacity') || lower.includes('rebalance') || lower.includes('workload')) {
      return 'capacity';
    }
    return 'copilot';
  };

  const handleSendPrompt = async (overridePrompt?: string, overrideMode?: StudioMode) => {
    const text = (overridePrompt ?? promptInput).trim();
    if (!text || isThinking) return;

    const targetThreadId = activeThread?.id || 'thread-initial';
    const effectiveMode = detectAutoMode(text, overrideMode || activeMode);
    if (overrideMode) setActiveMode(overrideMode);

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text,
      mode: effectiveMode,
      createdAt: new Date().toISOString(),
    };

    appendMessagesToThread(targetThreadId, [userMsg], text);
    if (!overridePrompt) setPromptInput('');
    setIsThinking(true);
    soundService.play('click_soft');

    try {
      if (effectiveMode === 'architect') {
        const bp = await geminiService.generateProjectBlueprint(text, Math.max(2, users.length));
        const assistantMsg: ChatMessage = {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          text: bp.executiveBrief || `Synthesized multi-sprint blueprint for **${bp.projectName}**.`,
          mode: 'architect',
          createdAt: new Date().toISOString(),
          blueprint: bp,
        };
        appendMessagesToThread(targetThreadId, [assistantMsg]);
      } else if (effectiveMode === 'meetings') {
        const extracted = await geminiService.extractMeetingActions(
          text,
          selectedTargetProject?.name || 'Workspace Project'
        );
        const assistantMsg: ChatMessage = {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          text: extracted.executiveSummary,
          mode: 'meetings',
          createdAt: new Date().toISOString(),
          meetingResult: extracted,
        };
        appendMessagesToThread(targetThreadId, [assistantMsg]);
      } else if (effectiveMode === 'capacity') {
        const overloaded = teamCapacity.filter(c => c.status === 'Overloaded').length;
        const assistantMsg: ChatMessage = {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          text: `Analyzed story-point load across ${users.length} teammate(s). ${
            overloaded > 0
              ? `${overloaded} member(s) are currently overloaded.`
              : 'Team load is within healthy capacity limits.'
          } ${unassignedOpenTasks.length} open task(s) are unassigned.`,
          mode: 'capacity',
          createdAt: new Date().toISOString(),
          showCapacityCard: true,
        };
        appendMessagesToThread(targetThreadId, [assistantMsg]);
      } else {
        const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE).length;
        const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
        const criticalCount = tasks.filter(
          t => t.priority === TaskPriority.CRITICAL || t.priority === TaskPriority.HIGH
        ).length;
        const overdueCount = tasks.filter(
          t => t.status !== TaskStatus.DONE && t.due_date && new Date(t.due_date) < new Date()
        ).length;
        const cmd = await geminiService.executeNaturalLanguageCommand(text, {
          activeProjectName: selectedTargetProject?.name,
          totalTasks: tasks.length,
          completedTasks,
          inProgressTasks,
          criticalCount,
          overdueCount,
          completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
          teamCount: users.length,
          sprintCount: sprints.length,
        });
        const assistantMsg: ChatMessage = {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          text: cmd.answerMarkdown,
          mode: 'copilot',
          createdAt: new Date().toISOString(),
          commandResponse: cmd,
        };
        appendMessagesToThread(targetThreadId, [assistantMsg]);
      }
    } catch (err: any) {
      appendMessagesToThread(targetThreadId, [
        {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          text: err?.message || 'Unable to process your request right now. Please try again.',
          mode: effectiveMode,
          createdAt: new Date().toISOString(),
        },
      ]);
      addToast('Aether AI Notice', err?.message || 'Request failed.', 'error');
    } finally {
      setIsThinking(false);
    }
  };

  const markMessageExecuted = (msgId: string) => {
    setThreads(prev =>
      prev.map(th => ({
        ...th,
        messages: th.messages.map(m => (m.id === msgId ? { ...m, executedAction: true } : m)),
      }))
    );
  };

  const handleMaterializeBlueprint = async (msgId: string, blueprint: ProjectBlueprint) => {
    setIsExecutingActionId(msgId);
    try {
      const createdProj = await createProject({
        name: blueprint.projectName,
        description: blueprint.projectDescription,
      });

      const targetProjectId =
        (createdProj && 'id' in createdProj ? createdProj.id : selectedTargetProject?.id) || projects[0]?.id;
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
            status: normalizeTaskStatus(TaskStatus.TODO),
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

      markMessageExecuted(msgId);
      setActiveProject(targetProjectId);
      addToast(
        'Blueprint Deployed',
        `Created "${blueprint.projectName}" with ${blueprint.sprints.length} sprints and tasks.`,
        'success'
      );
      setActiveView('kanban');
    } catch (err: any) {
      addToast('Deployment Error', err?.message || 'Failed to deploy blueprint', 'error');
    } finally {
      setIsExecutingActionId(null);
    }
  };

  const handleCreateExtractedTasks = async (msgId: string, meetingResult: MeetingExtractionResult) => {
    const targetProjectId = selectedTargetProject?.id || projects[0]?.id;
    if (!targetProjectId) {
      addToast('No Active Project', 'Create or select a project first.', 'warning');
      return;
    }

    setIsExecutingActionId(msgId);
    try {
      for (let i = 0; i < meetingResult.actionItems.length; i++) {
        const item = meetingResult.actionItems[i];
        const assignee = users.length > 0 ? users[i % users.length] : undefined;
        await createTask({
          title: item.title,
          description: item.description,
          priority: item.priority || TaskPriority.HIGH,
          status: normalizeTaskStatus(TaskStatus.TODO),
          projectId: targetProjectId,
          story_points: item.storyPoints || 3,
          assignee_id: assignee?.id,
        });
      }
      markMessageExecuted(msgId);
      addToast(
        'Action Items Created',
        `Added ${meetingResult.actionItems.length} tasks to ${selectedTargetProject?.name || projects[0]?.name}.`,
        'success'
      );
    } finally {
      setIsExecutingActionId(null);
    }
  };

  const handleAutoBalanceWorkload = async (msgId: string) => {
    if (users.length === 0) {
      addToast('No Team Members', 'Invite team members to balance workload.', 'warning');
      return;
    }
    setIsExecutingActionId(msgId);
    try {
      let changesCount = 0;
      const sortedByAvailable = [...teamCapacity].sort((a, b) => a.totalPoints - b.totalPoints);

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

      markMessageExecuted(msgId);
      addToast(
        'Workload Balanced',
        changesCount > 0
          ? `Optimized ${changesCount} task assignment(s) across ${users.length} contributors.`
          : 'Team workload is already balanced.',
        'success'
      );
    } finally {
      setIsExecutingActionId(null);
    }
  };

  const handleExecuteCommandAction = async (msgId: string, cmd: AICommandResponse) => {
    const targetProjectId = selectedTargetProject?.id || projects[0]?.id;
    setIsExecutingActionId(msgId);
    try {
      if (cmd.intentType === 'create_project_blueprint' && cmd.actionPayload?.title) {
        await handleSendPrompt(cmd.actionPayload.title, 'architect');
        markMessageExecuted(msgId);
        return;
      }
      if (cmd.intentType === 'create_sprint') {
        if (!targetProjectId) {
          addToast('Project Required', 'Select a project first.', 'warning');
          return;
        }
        const start = new Date().toISOString().split('T')[0];
        const end = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
        await createSprint({
          projectId: targetProjectId,
          name: cmd.actionPayload?.sprintName || `Sprint ${sprints.length + 1}`,
          goal: cmd.actionPayload?.sprintGoal || 'Deliver priority sprint backlog',
          status: 'active',
          startDate: start,
          endDate: end,
        });
        markMessageExecuted(msgId);
        addToast('Sprint Created', cmd.actionPayload?.sprintName || 'New sprint added.', 'success');
        setActiveView('sprints_view');
        return;
      }
      if (cmd.intentType === 'filter_tasks') {
        markMessageExecuted(msgId);
        setActiveView('my_tasks_view');
        return;
      }
      if (cmd.intentType === 'summarize_project') {
        markMessageExecuted(msgId);
        setActiveView('reports_view');
        return;
      }
      if (cmd.intentType === 'rebalance_workload') {
        await handleAutoBalanceWorkload(msgId);
        return;
      }
      if (!targetProjectId) {
        addToast('Project Required', 'Create or select a project first.', 'warning');
        return;
      }
      await createTask({
        title: cmd.actionPayload?.title || cmd.headline,
        description: cmd.actionPayload?.description || cmd.answerMarkdown,
        priority:
          cmd.actionPayload?.priority === 'Critical'
            ? TaskPriority.CRITICAL
            : cmd.actionPayload?.priority === 'Low'
            ? TaskPriority.LOW
            : TaskPriority.HIGH,
        status: normalizeTaskStatus(TaskStatus.TODO),
        projectId: targetProjectId,
        story_points: cmd.actionPayload?.storyPoints || 3,
      });
      markMessageExecuted(msgId);
      addToast('Task Created', `Added "${cmd.actionPayload?.title || cmd.headline}" to project.`, 'success');
    } finally {
      setIsExecutingActionId(null);
    }
  };

  const renderMarkdownText = (raw: string) => {
    return raw.split('\n').map((line, i) => {
      const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return (
        <p
          key={i}
          className="text-sm leading-relaxed text-[var(--text-primary)]"
          dangerouslySetInnerHTML={{ __html: formatted || '&nbsp;' }}
        />
      );
    });
  };

  const isConversationalMode = !['insights', 'edge'].includes(activeMode);

  return (
    <div className="h-full min-h-[calc(100vh-110px)] flex flex-col lg:flex-row gap-3 p-3 sm:p-5 max-w-[1440px] mx-auto w-full text-[var(--text-primary)]">
      {/* Collapsible Thread & Mode Rail */}
      {isRailOpen && (
        <aside className="w-full lg:w-[252px] shrink-0 liquid-bezel-section p-3 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AIBotFace mood={isThinking ? 'thinking' : 'happy'} size="sm" />
                <div>
                  <div className="text-xs font-bold tracking-tight text-[var(--text-primary)]">Aether AI</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Workspace Co-Pilot</div>
                </div>
              </div>
              <IconButton
                variant="glass"
                size="xs"
                onClick={() => setIsRailOpen(false)}
                title="Collapse sidebar"
                aria-label="Collapse AI sidebar"
              >
                <ICON_MAP.ChevronLeftIcon className="w-3.5 h-3.5" />
              </IconButton>
            </div>

            <Button
              variant="lime"
              size="sm"
              onClick={() => handleStartNewThread('copilot')}
              className="w-full justify-center"
            >
              <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
              <span>New Thread</span>
            </Button>

            {/* Capability Modes */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Capabilities
              </div>
              {MODE_NAV_ITEMS.map(item => {
                const Icon = ICON_MAP[item.icon];
                const isActive = activeMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      soundService.play('click_soft');
                      setActiveMode(item.id);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--bg-sage)] text-[var(--text-primary)] font-semibold border border-[var(--glass-border-strong)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[var(--accent-text)]' : ''}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Recent Threads */}
            <div className="space-y-1 pt-2 border-t border-[var(--border-hairline)]">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Recent Threads
              </div>
              <div className="space-y-0.5 max-h-[210px] overflow-y-auto scrollbar-thin pr-0.5">
                {threads.map(th => {
                  const selected = th.id === activeThread?.id && isConversationalMode;
                  return (
                    <div
                      key={th.id}
                      className={`group flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                        selected
                          ? 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveThreadId(th.id);
                          setActiveMode(th.mode === 'insights' || th.mode === 'edge' ? 'copilot' : th.mode);
                        }}
                        className="flex-1 text-left truncate cursor-pointer"
                        title={th.title}
                      >
                        {th.title}
                      </button>
                      {threads.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteThread(th.id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-rose-500 cursor-pointer p-0.5"
                          title="Delete thread"
                          aria-label="Delete thread"
                        >
                          <ICON_MAP.XMarkIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-2.5 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
            <span>Engine</span>
            <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)] font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              {isThinking ? 'Thinking' : 'Ready'}
            </span>
          </div>
        </aside>
      )}

      {/* Main Conversational & Workspace Canvas */}
      <div className="flex-1 min-w-0 liquid-bezel-section flex flex-col overflow-hidden">
        {/* Minimal Studio Top Strip */}
        <div className="px-4 py-2.5 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!isRailOpen && (
              <IconButton
                variant="glass"
                size="sm"
                onClick={() => setIsRailOpen(true)}
                title="Show AI sidebar"
                aria-label="Show AI sidebar"
              >
                <ICON_MAP.Bars3Icon className="w-4 h-4" />
              </IconButton>
            )}
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {MODE_NAV_ITEMS.find(m => m.id === activeMode)?.label || 'Co-Pilot Chat'}
            </span>
            <span className="text-[var(--text-muted)] text-xs">·</span>
            <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
              {currentOrganization?.name || 'Workspace'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {projects.length > 0 && (
              <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <ICON_MAP.FolderIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <select
                  value={selectedTargetProject?.id || ''}
                  onChange={e => e.target.value && setActiveProject(e.target.value)}
                  className="!py-1 !px-2.5 !rounded-full border text-[11px] font-medium bg-[var(--surface-glass-2)]"
                  aria-label="Target project"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {isConversationalMode && activeThread?.messages.length > 0 && (
              <Button variant="outline" size="xs" onClick={() => handleStartNewThread(activeMode)}>
                <ICON_MAP.PlusIcon className="w-3 h-3" />
                New
              </Button>
            )}
          </div>
        </div>

        {/* Mode Content */}
        {activeMode === 'insights' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-5xl mx-auto">
              <AIInsightsEngineWidget />
            </div>
          </div>
        ) : activeMode === 'edge' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-5xl mx-auto space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Edge Compute Pipelines</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Offload AI risk synthesis, SLA evaluations, transactional alerts, and TURN provisioning.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full self-start">
                  4 Pipelines Ready
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    slug: 'ai-copilot-synthesis' as EdgeFunctionSlug,
                    title: 'ai-copilot-synthesis',
                    desc: 'Server-side sprint risk radar and executive status synthesis.',
                    payload: {
                      operation: 'sprint_risk_radar',
                      payload: {
                        projectName: selectedTargetProject?.name || 'Organization Portfolio',
                        sprintName: sprints[0]?.name || 'Active Sprint',
                        tasks: tasks.slice(0, 20),
                      },
                    },
                  },
                  {
                    slug: 'transactional-notifications' as EdgeFunctionSlug,
                    title: 'transactional-notifications',
                    desc: 'Dispatch invitation & approval notifications with fallback delivery.',
                    payload: {
                      eventType: 'ORG_JOIN_REQUEST_APPROVED',
                      recipientEmail: currentUser?.email || 'team@omniflow.app',
                      organizationName: currentOrganization?.name || 'Workspace',
                      role: currentUser?.role || 'OWNER',
                    },
                  },
                  {
                    slug: 'automation-rule-engine' as EdgeFunctionSlug,
                    title: 'automation-rule-engine',
                    desc: 'Evaluate overdue SLA thresholds and WHEN → IF → THEN escalation rules.',
                    payload: {
                      organizationName: currentOrganization?.name || 'Workspace',
                      tasks,
                    },
                  },
                  {
                    slug: 'webrtc-turn-and-scribe' as EdgeFunctionSlug,
                    title: 'webrtc-turn-and-scribe',
                    desc: 'Provision low-latency 1080p/Opus ICE/TURN session credentials.',
                    payload: {
                      roomId: `org-${currentOrganization?.id || 'studio'}-hd`,
                      qualityProfile: '1080p_60fps_opus_48khz',
                    },
                  },
                ].map(fn => {
                  const isRunning = runningEdgeSlug === fn.slug;
                  return (
                    <HairlineCard key={fn.slug} className="flex flex-col justify-between gap-4">
                      <div>
                        <div className="text-xs font-mono font-bold text-[var(--accent-text)]">{fn.title}</div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{fn.desc}</p>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isRunning}
                        onClick={async () => {
                          setRunningEdgeSlug(fn.slug);
                          try {
                            const res = await edgeFunctionService.invoke(fn.slug, fn.payload);
                            addToast(
                              `Edge Executed (${res.latencyMs}ms)`,
                              res.data?.summary || `${fn.slug} completed.`,
                              'success'
                            );
                          } catch (err: any) {
                            addToast('Edge Execution Error', err?.message || 'Failed to invoke', 'error');
                          } finally {
                            setRunningEdgeSlug(null);
                          }
                        }}
                      >
                        {isRunning ? 'Executing...' : 'Run Pipeline →'}
                      </Button>
                    </HairlineCard>
                  );
                })}
              </div>

              {edgeLogs.length > 0 && (
                <HairlineCard className="space-y-2.5">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                    Recent Edge Telemetry
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {edgeLogs.map(log => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={log.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}>●</span>
                          <span className="font-bold text-[var(--accent-text)]">{log.slug}</span>
                          <span className="text-[var(--text-secondary)] truncate">· {log.summary}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                          {log.latencyMs}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </HairlineCard>
              )}
            </div>
          </div>
        ) : (
          /* Minimal Conversational Canvas + Anchored Glass Composer */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scrollbar-thin">
              <div className="max-w-3xl mx-auto w-full">
                {activeThread?.messages.length === 0 ? (
                  <div className="py-8 sm:py-14 flex flex-col items-center text-center space-y-6">
                    <AIBotFace mood={isThinking ? 'thinking' : 'happy'} size="lg" />
                    <div className="space-y-1.5 max-w-lg">
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                        What are we shipping today?
                      </h1>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                        Architect multi-sprint plans, extract meeting tasks, balance team capacity, or ask about delivery.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-2 text-left">
                      {STARTER_CARDS.map(card => {
                        const Icon = ICON_MAP[card.icon];
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => handleSendPrompt(card.prompt, card.mode)}
                            className="liquid-glass-card p-3.5 rounded-2xl text-left hover:scale-[1.01] transition-all cursor-pointer group space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                                <Icon className="w-4 h-4 text-[var(--accent-text)]" />
                                <span>{card.title}</span>
                              </div>
                              <ICON_MAP.ArrowRightIcon className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)]">{card.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activeThread?.messages.map(msg =>
                      msg.role === 'user' ? (
                        <div key={msg.id} className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl px-4 py-2.5 liquid-glass-card text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                            {msg.text}
                          </div>
                        </div>
                      ) : (
                        <div key={msg.id} className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5">
                            <AIBotFace mood="happy" size="sm" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="space-y-1.5">{renderMarkdownText(msg.text)}</div>

                            {/* Embedded Blueprint Card */}
                            {msg.blueprint && (
                              <div className="liquid-glass-card rounded-2xl p-4 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
                                  <div>
                                    <div className="text-[11px] font-mono text-[var(--accent-text)] font-semibold">
                                      Target: {msg.blueprint.targetLaunchDate} · {msg.blueprint.confidenceScore}% confidence
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                                      {msg.blueprint.projectName}
                                    </h3>
                                  </div>
                                  <Button
                                    variant="lime"
                                    size="sm"
                                    disabled={isExecutingActionId === msg.id || msg.executedAction}
                                    onClick={() => handleMaterializeBlueprint(msg.id, msg.blueprint!)}
                                  >
                                    <ICON_MAP.RocketLaunchIcon className="w-3.5 h-3.5" />
                                    {msg.executedAction
                                      ? 'Deployed ✓'
                                      : isExecutingActionId === msg.id
                                      ? 'Deploying...'
                                      : 'Deploy Blueprint'}
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                  {msg.blueprint.sprints.map((sp, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] space-y-1.5"
                                    >
                                      <div className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">
                                        {sp.name}
                                      </div>
                                      <div className="text-[10.5px] font-mono text-[var(--text-muted)]">
                                        {sp.durationDays}d · {sp.tasks.length} tasks
                                      </div>
                                      <ul className="space-y-0.5 text-[11px] text-[var(--text-secondary)]">
                                        {sp.tasks.slice(0, 3).map((t, tIdx) => (
                                          <li key={tIdx} className="truncate">
                                            · {t.title}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Embedded Meeting Extraction Card */}
                            {msg.meetingResult && (
                              <div className="liquid-glass-card rounded-2xl p-4 space-y-3.5">
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-hairline)]">
                                  <span className="text-xs font-bold text-[var(--text-primary)]">
                                    Extracted Actions ({msg.meetingResult.actionItems.length})
                                  </span>
                                  <Button
                                    variant="lime"
                                    size="sm"
                                    disabled={isExecutingActionId === msg.id || msg.executedAction}
                                    onClick={() => handleCreateExtractedTasks(msg.id, msg.meetingResult!)}
                                  >
                                    <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                                    {msg.executedAction
                                      ? 'Tasks Created ✓'
                                      : isExecutingActionId === msg.id
                                      ? 'Creating...'
                                      : `Create ${msg.meetingResult.actionItems.length} Tasks`}
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)]">
                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                                      Decisions ({msg.meetingResult.keyDecisions.length})
                                    </div>
                                    <ul className="space-y-1 text-[11px] text-[var(--text-secondary)]">
                                      {msg.meetingResult.keyDecisions.map((d, i) => (
                                        <li key={i}>· {d}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)]">
                                    <div className="font-bold text-amber-600 dark:text-amber-400 mb-1">
                                      Blockers ({msg.meetingResult.detectedBlockers.length})
                                    </div>
                                    <ul className="space-y-1 text-[11px] text-[var(--text-secondary)]">
                                      {msg.meetingResult.detectedBlockers.map((b, i) => (
                                        <li key={i}>· {b}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {msg.meetingResult.actionItems.map((act, idx) => (
                                    <div
                                      key={idx}
                                      className="p-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-xs space-y-0.5"
                                    >
                                      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                                        <span>{act.priority}</span>
                                        <span>{act.storyPoints} pts</span>
                                      </div>
                                      <div className="font-semibold text-[var(--text-primary)]">{act.title}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Embedded Capacity Card */}
                            {msg.showCapacityCard && (
                              <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-hairline)]">
                                  <span className="text-xs font-bold text-[var(--text-primary)]">
                                    Team Capacity ({users.length} seats)
                                  </span>
                                  <Button
                                    variant="lime"
                                    size="sm"
                                    disabled={isExecutingActionId === msg.id || msg.executedAction}
                                    onClick={() => handleAutoBalanceWorkload(msg.id)}
                                  >
                                    <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
                                    {msg.executedAction
                                      ? 'Balanced ✓'
                                      : isExecutingActionId === msg.id
                                      ? 'Balancing...'
                                      : 'Auto-Balance Workload'}
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {teamCapacity.slice(0, 6).map(item => (
                                    <div
                                      key={item.user.id}
                                      className="p-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Avatar user={item.user} size="xs" />
                                          <span className="text-xs font-semibold truncate">
                                            {item.user.full_name || item.user.email}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                                          {item.totalPoints}/16 pts
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 rounded-full bg-[var(--bg-sage)] overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            item.status === 'Overloaded'
                                              ? 'bg-rose-500'
                                              : item.status === 'Optimal'
                                              ? 'bg-emerald-500'
                                              : 'bg-[var(--accent-lime)]'
                                          }`}
                                          style={{ width: `${item.utilizationPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Command Action & Follow-up Chips */}
                            {msg.commandResponse && (
                              <div className="space-y-2.5 pt-1">
                                {msg.commandResponse.suggestedActionLabel && (
                                  <div>
                                    <Button
                                      variant="lime"
                                      size="sm"
                                      disabled={isExecutingActionId === msg.id || msg.executedAction}
                                      onClick={() => handleExecuteCommandAction(msg.id, msg.commandResponse!)}
                                    >
                                      <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
                                      {msg.executedAction
                                        ? 'Done ✓'
                                        : isExecutingActionId === msg.id
                                        ? 'Running...'
                                        : msg.commandResponse.suggestedActionLabel}
                                    </Button>
                                  </div>
                                )}
                                {msg.commandResponse.followUpPrompts?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {msg.commandResponse.followUpPrompts.map((fp, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleSendPrompt(fp, 'copilot')}
                                        className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
                                      >
                                        {fp}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}

                    {isThinking && (
                      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <AIBotFace mood="thinking" size="sm" />
                        <span>Synthesizing workspace response...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Anchored Glossy Composer */}
            <div className="px-4 sm:px-6 pb-4 pt-2">
              <div className="max-w-3xl mx-auto liquid-glass-card rounded-[24px] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex flex-wrap items-center gap-1">
                    {MODE_NAV_ITEMS.slice(0, 4).map(m => {
                      const active = activeMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setActiveMode(m.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                            active
                              ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-text)] shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                          }`}
                        >
                          {m.shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  {activeMode === 'meetings' && (
                    <button
                      type="button"
                      onClick={() => setPromptInput(SAMPLE_MEETING_NOTES)}
                      className="text-[11px] font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                    >
                      Load sample notes
                    </button>
                  )}
                </div>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={promptInput}
                  onChange={e => setPromptInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendPrompt();
                    }
                  }}
                  placeholder={
                    activeMode === 'architect'
                      ? 'Describe a project goal & target launch date to generate sprints...'
                      : activeMode === 'meetings'
                      ? 'Paste or dictate standup notes to extract decisions & tasks...'
                      : activeMode === 'capacity'
                      ? 'Ask to analyze or rebalance team story points...'
                      : 'Ask Aether AI anything about projects, sprints, tasks, or risks...'
                  }
                  className="w-full !bg-transparent !border-0 !shadow-none px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none"
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <VoiceTranscribeButton
                      compact={false}
                      label="Voice Prompt"
                      prompt="Project management prompt, meeting notes, or task instructions"
                      onTranscript={text =>
                        setPromptInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))
                      }
                      onError={msg => addToast('Voice Input', msg, 'warning')}
                    />
                    <span className="hidden sm:inline text-[11px] text-[var(--text-muted)]">
                      Enter to send · Shift+Enter for newline
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="lime"
                    size="sm"
                    disabled={isThinking || !promptInput.trim()}
                    onClick={() => handleSendPrompt()}
                    className="!rounded-full !px-3.5"
                  >
                    <ICON_MAP.PaperAirplaneIcon className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
