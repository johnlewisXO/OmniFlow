import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskStatus, TaskPriority } from '../../types';
import geminiService, { AICommandResponse } from '../../services/geminiService';
import { AIBotFace } from '../ai/AIBotFace';
import { useAnimatedMount } from '../shared/Modal';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type SearchCategory = 'all' | 'ai' | 'tasks' | 'projects' | 'sprints' | 'knowledge';

interface CommandItem {
  id: string;
  category: SearchCategory | 'navigation';
  title: string;
  subtitle?: string;
  meta?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    tasks,
    myTasks,
    projects,
    sprints,
    users,
    activeProject,
    activeView,
    taskToView,
    setActiveProject,
    setActiveView,
    openModal,
    openCreateProjectModal,
    openViewTaskModal,
    createTask,
    createSprint,
    toggleDarkMode,
    darkMode,
    addToast,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [aiResponse, setAiResponse] = useState<AICommandResponse | null>(null);
  const [isExecutingAIAction, setIsExecutingAIAction] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setAiResponse(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
    }
  }, [isOpen]);

  const allTasks = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach(t => map.set(t.id, t));
    myTasks.forEach(t => map.set(t.id, t));
    return Array.from(map.values());
  }, [tasks, myTasks]);

  // Context-Aware AI Prompts based on current page/project/task
  const contextualSuggestions = useMemo(() => {
    const projName = activeProject?.name || projects[0]?.name || 'Active Project';
    if (taskToView) {
      return [
        `Break down "${taskToView.title.slice(0, 35)}" into subtasks`,
        `Identify blockers and delivery risks for this ticket`,
        `Estimate Fibonacci story points for "${taskToView.title.slice(0, 30)}"`,
        `Generate a stakeholder update for ${projName}`,
      ];
    }
    if (activeView === 'sprints_view') {
      return [
        'Create a sprint for next month',
        'Rebalance overloaded team members across sprints',
        'Show unestimated backlog tasks',
        `Summarise sprint velocity for ${projName}`,
      ];
    }
    if (activeView === 'reports_view') {
      return [
        `Generate a stakeholder update for ${projName}`,
        'Show overdue tasks and critical bottlenecks',
        'Forecast project completion trajectory',
        'Launch mobile app by December',
      ];
    }
    return [
      'Create a sprint for next month',
      'Show overdue tasks',
      `Summarise project ${projName}`,
      'Generate a stakeholder update',
      'Launch mobile app by December',
    ];
  }, [activeProject, projects, activeView, taskToView]);

  const workspaceContext = useMemo(() => {
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === TaskStatus.DONE).length;
    const inProgressTasks = allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const criticalCount = allTasks.filter(
      t => t.status !== TaskStatus.DONE && (t.priority === TaskPriority.CRITICAL || t.priority === TaskPriority.HIGH)
    ).length;
    const overdueCount = allTasks.filter(t => {
      if (t.status === TaskStatus.DONE) return false;
      const d = t.dueDate || t.due_date;
      return d ? new Date(d).getTime() < Date.now() : false;
    }).length;

    return {
      activeView,
      activeProjectName: activeProject?.name || projects[0]?.name || 'Workspace',
      totalTasks,
      completedTasks,
      inProgressTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      criticalCount,
      overdueCount,
      sprintCount: sprints.length,
      teamCount: users.length,
    };
  }, [allTasks, activeView, activeProject, projects, sprints, users]);

  const handleRunAICommand = async (promptText?: string) => {
    const targetQuery = (promptText ?? query).trim();
    if (!targetQuery) return;
    setQuery(targetQuery);
    setIsAIThinking(true);
    try {
      const result = await geminiService.executeNaturalLanguageCommand(targetQuery, workspaceContext);
      setAiResponse(result);
    } catch (err: any) {
      addToast('AI Command Error', err?.message || 'Failed to execute natural language command', 'error');
    } finally {
      setIsAIThinking(false);
    }
  };

  const handleExecuteAIAction = async () => {
    if (!aiResponse) return;
    setIsExecutingAIAction(true);
    try {
      const targetProjId = activeProject?.id || projects[0]?.id;
      if (aiResponse.intentType === 'create_sprint' && targetProjId) {
        const start = new Date().toISOString().split('T')[0];
        const end = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
        await createSprint({
          projectId: targetProjId,
          name: aiResponse.actionPayload?.sprintName || `Sprint ${sprints.length + 1} · AI Planned`,
          goal: aiResponse.actionPayload?.sprintGoal || 'Deliver priority backlog items',
          status: 'planned',
          startDate: start,
          endDate: end,
        });
        addToast('Sprint Created via AI', 'New planned sprint added to Sprint Planning.', 'success');
        setActiveView('sprints_view');
        onClose();
      } else if (aiResponse.intentType === 'create_task' && targetProjId) {
        await createTask({
          title: aiResponse.actionPayload?.title || query,
          description: aiResponse.actionPayload?.description || 'Created via AI Command Centre',
          priority: (aiResponse.actionPayload?.priority as TaskPriority) || TaskPriority.HIGH,
          status: TaskStatus.TODO,
          projectId: targetProjId,
          story_points: aiResponse.actionPayload?.storyPoints || 3,
        });
        addToast('Task Created via AI', `Added "${aiResponse.actionPayload?.title || query}" to project.`, 'success');
        onClose();
      } else if (aiResponse.intentType === 'create_project_blueprint') {
        setActiveView('ai_copilot_view');
        onClose();
      } else if (aiResponse.intentType === 'summarize_project') {
        setActiveView('reports_view');
        onClose();
      } else if (aiResponse.intentType === 'filter_tasks') {
        const criticalTask = allTasks.find(
          t => t.status !== TaskStatus.DONE && (t.priority === TaskPriority.CRITICAL || t.priority === TaskPriority.HIGH)
        );
        if (criticalTask) {
          onClose();
          openViewTaskModal(criticalTask.id, true);
        } else {
          setActiveView('my_tasks_view');
          onClose();
        }
      } else {
        setActiveView('ai_copilot_view');
        onClose();
      }
    } finally {
      setIsExecutingAIAction(false);
    }
  };

  // Build unified search & command items
  const items: CommandItem[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    const result: CommandItem[] = [];

    // 1. AI Co-Pilot Actions
    const aiItems: CommandItem[] = [
      {
        id: 'ai-open-studio',
        category: 'ai',
        title: 'Open AI Project Manager & Blueprint Studio',
        subtitle: 'Generate multi-sprint project blueprints, rebalance capacity & extract meeting notes',
        meta: 'AI Studio',
        icon: ICON_MAP.SparklesIcon,
        action: () => {
          setActiveView('ai_copilot_view');
          onClose();
        },
      },
      ...contextualSuggestions.map((promptText, idx) => ({
        id: `ai-prompt-${idx}`,
        category: 'ai' as SearchCategory,
        title: `Ask AI: "${promptText}"`,
        subtitle: `Context-aware action · ${workspaceContext.activeProjectName}`,
        meta: 'AI Co-Pilot',
        icon: ICON_MAP.SparklesIcon,
        action: () => {
          handleRunAICommand(promptText);
        },
      })),
    ];

    // 2. Quick Workspace Actions & Navigation
    const navItems: CommandItem[] = [
      {
        id: 'action-create-task',
        category: 'navigation',
        title: 'Create New Task',
        subtitle: activeProject ? `In ${activeProject.name}` : 'Create a deliverable ticket',
        meta: 'Action',
        icon: ICON_MAP.PlusIcon,
        action: () => {
          onClose();
          openModal();
        },
      },
      {
        id: 'action-create-project',
        category: 'navigation',
        title: 'Create New Project',
        subtitle: 'Initialize a new team portfolio',
        meta: 'Action',
        icon: ICON_MAP.FolderPlusIcon || ICON_MAP.FolderIcon,
        action: () => {
          onClose();
          openCreateProjectModal();
        },
      },
      {
        id: 'nav-sprints',
        category: 'sprints',
        title: 'Go to Sprint Planning & Backlog',
        subtitle: `${sprints.length} sprint cycles · Fibonacci story point grooming`,
        meta: 'Sprints',
        icon: ICON_MAP.RocketLaunchIcon,
        action: () => {
          setActiveView('sprints_view');
          onClose();
        },
      },
      {
        id: 'nav-whiteboard-studio',
        category: 'knowledge',
        title: 'Collaborative Whiteboard & Design Canvas (Figma / FigJam)',
        subtitle: 'Infinite canvas, frames, stickies, freehand pen, live cursors & 1-click task conversion',
        meta: 'Whiteboard Studio',
        icon: ICON_MAP.SparklesIcon,
        action: () => {
          setActiveView('whiteboard_view');
          onClose();
        },
      },
      {
        id: 'nav-docs-wiki',
        category: 'knowledge',
        title: 'Project Docs & Spec Wiki Hub',
        subtitle: 'Collaborative PRDs, technical specs & 1-click task conversion',
        meta: 'Docs & Wiki',
        icon: ICON_MAP.DocumentTextIcon,
        action: () => {
          setActiveView('docs_wiki_view');
          onClose();
        },
      },
      {
        id: 'nav-okrs-goals',
        category: 'knowledge',
        title: 'OKRs, Strategic Goals & Milestone Rollups',
        subtitle: 'Track company Objectives & Key Results linked to project velocity',
        meta: 'OKRs & Goals',
        icon: ICON_MAP.TagIcon,
        action: () => {
          setActiveView('okrs_goals_view');
          onClose();
        },
      },
      {
        id: 'nav-triage-intake',
        category: 'tasks',
        title: 'Triage Queue & Bug/Feature Intake Forms',
        subtitle: 'Review incoming bug reports, feature requests & route to sprint',
        meta: 'Triage',
        icon: ICON_MAP.ExclamationTriangleIcon,
        action: () => {
          setActiveView('triage_intake_view');
          onClose();
        },
      },
      {
        id: 'nav-workload-timer',
        category: 'sprints',
        title: 'Live Task Focus Timer & Team Workload Heatmap',
        subtitle: 'Monitor weekly team capacity, active focus timers & rebalance load',
        meta: 'Workload',
        icon: ICON_MAP.ClockIcon,
        action: () => {
          setActiveView('workload_capacity_view');
          onClose();
        },
      },
      {
        id: 'nav-reports',
        category: 'knowledge',
        title: 'Executive Reports & AI Summary',
        subtitle: 'Velocity burnup, team workload & stakeholder briefs',
        meta: 'Analytics',
        icon: ICON_MAP.ChartBarIcon,
        action: () => {
          setActiveView('reports_view');
          onClose();
        },
      },
      {
        id: 'action-toggle-theme',
        category: 'navigation',
        title: darkMode ? 'Switch to Light Appearance' : 'Switch to Dark Appearance',
        subtitle: 'Toggle workspace surface theme',
        meta: 'Theme',
        icon: darkMode ? ICON_MAP.SunIcon : ICON_MAP.MoonIcon,
        action: () => {
          toggleDarkMode();
          onClose();
        },
      },
    ];

    // 3. Projects Search
    const projItems: CommandItem[] = projects
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)))
      .slice(0, 5)
      .map(p => ({
        id: `proj-${p.id}`,
        category: 'projects',
        title: p.name,
        subtitle: p.description || 'Project portfolio workspace',
        meta: `Project · ${p.status}`,
        icon: ICON_MAP.FolderIcon,
        action: () => {
          setActiveProject(p);
          setActiveView('kanban');
          onClose();
        },
      }));

    // 4. Sprints Search
    const sprintItems: CommandItem[] = sprints
      .filter(s => !q || s.name.toLowerCase().includes(q) || (s.goal && s.goal.toLowerCase().includes(q)))
      .slice(0, 4)
      .map(s => ({
        id: `sprint-${s.id}`,
        category: 'sprints',
        title: s.name,
        subtitle: s.goal || 'Agile sprint iteration',
        meta: `Sprint · ${s.status}`,
        icon: ICON_MAP.RocketLaunchIcon,
        action: () => {
          setActiveProject(s.projectId);
          setActiveView('sprints_view');
          onClose();
        },
      }));

    // 5. Tasks Search
    const taskItems: CommandItem[] = allTasks
      .filter(
        t =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (q.includes('overdue') && (t.dueDate || t.due_date) && t.status !== TaskStatus.DONE) ||
          (q.includes('critical') && t.priority === TaskPriority.CRITICAL)
      )
      .slice(0, 8)
      .map(t => {
        const statusLabel = (t.status || 'todo').replace('_', ' ');
        return {
          id: `task-${t.id}`,
          category: 'tasks',
          title: t.title,
          subtitle: `${statusLabel} · ${t.priority || 'Medium'} · ${t.story_points || 1} pts`,
          meta: statusLabel,
          icon: ICON_MAP.DocumentTextIcon || ICON_MAP.ClipboardListIcon,
          action: () => {
            onClose();
            openViewTaskModal(t.id, true);
          },
        };
      });

    // 6. Knowledge & Docs Search
    const knowledgeItems: CommandItem[] = [
      {
        id: 'kb-meeting-extractor',
        category: 'knowledge',
        title: 'AI Standup & Meeting Notes Extractor',
        subtitle: 'Convert meeting transcripts into structured decisions and tasks',
        meta: 'Knowledge',
        icon: ICON_MAP.DocumentTextIcon,
        action: () => {
          setActiveView('ai_copilot_view');
          onClose();
        },
      },
      {
        id: 'kb-automations',
        category: 'knowledge',
        title: 'Workflow Automations & Webhook Rules',
        subtitle: 'Configure event-driven triggers and outbound integrations',
        meta: 'Rules',
        icon: ICON_MAP.BoltIcon,
        action: () => {
          setActiveView('task_automations');
          onClose();
        },
      },
    ].filter(k => !q || k.title.toLowerCase().includes(q) || (k.subtitle && k.subtitle.toLowerCase().includes(q)));

    const combined = [
      ...aiItems.filter(a => !q || a.title.toLowerCase().includes(q) || (a.subtitle && a.subtitle.toLowerCase().includes(q))),
      ...navItems.filter(n => !q || n.title.toLowerCase().includes(q) || (n.subtitle && n.subtitle.toLowerCase().includes(q))),
      ...projItems,
      ...sprintItems,
      ...taskItems,
      ...knowledgeItems,
    ];

    if (selectedCategory === 'all') {
      result.push(...combined);
    } else {
      result.push(...combined.filter(item => item.category === selectedCategory));
    }

    return result;
  }, [
    query,
    selectedCategory,
    allTasks,
    projects,
    sprints,
    activeProject,
    darkMode,
    contextualSuggestions,
    workspaceContext,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (items.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % (items.length || 1));
      } else if (e.key === 'Enter' && e.metaKey) {
        e.preventDefault();
        handleRunAICommand();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, onClose, query]);

  const { shouldRender, isClosing } = useAnimatedMount(isOpen, 190);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100 animate-fadeIn'
      }`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden transition-all ${
          isClosing ? 'animate-modal-disappear' : 'animate-modal-appear'
        } ${
          darkMode ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Command Input Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            if (query.trim().split(/\s+/).length >= 2 || selectedCategory === 'ai') {
              handleRunAICommand();
            } else if (items[selectedIndex]) {
              items[selectedIndex].action();
            }
          }}
          className={`flex items-center px-4 py-3.5 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}
        >
          <AIBotFace mood={isAIThinking ? 'thinking' : aiResponse ? 'speaking' : 'idle'} size="sm" className="mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder='Ask AI ("Create a sprint for next month", "Show overdue tasks") or search...'
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className={`flex-1 bg-transparent border-none outline-none text-sm sm:text-base font-medium placeholder:font-normal ${
              darkMode ? 'placeholder:text-slate-500 text-slate-100' : 'placeholder:text-slate-400 text-slate-800'
            }`}
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => handleRunAICommand()}
              disabled={isAIThinking}
              className="mr-2 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {isAIThinking ? 'Thinking...' : 'Run AI ↵'}
            </button>
          )}
          <kbd
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded border ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            ESC
          </kbd>
        </form>

        {/* Segmented Search Scope Filter Tabs */}
        <div
          className={`flex items-center gap-1 px-4 py-2 border-b overflow-x-auto scrollbar-none ${
            darkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'
          }`}
        >
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'ai', label: 'AI Co-Pilot' },
              { id: 'tasks', label: `Tasks (${allTasks.length})` },
              { id: 'projects', label: `Projects (${projects.length})` },
              { id: 'sprints', label: `Sprints (${sprints.length})` },
              { id: 'knowledge', label: 'Knowledge & Docs' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedCategory(tab.id);
                setSelectedIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === tab.id
                  ? 'bg-indigo-600 text-white'
                  : darkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* AI Co-Pilot Natural Language Execution Panel */}
        {(isAIThinking || aiResponse) && (
          <div
            className={`p-4 border-b space-y-3 ${
              darkMode ? 'bg-indigo-950/25 border-slate-800' : 'bg-indigo-50/50 border-indigo-100'
            }`}
          >
            {isAIThinking ? (
              <div className="flex items-center gap-3 text-xs text-indigo-600 dark:text-indigo-400 py-2">
                <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
                <span>AI Co-Pilot is analyzing workspace context ({workspaceContext.activeProjectName})...</span>
              </div>
            ) : (
              aiResponse && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        AI Command Centre · {workspaceContext.activeProjectName}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {aiResponse.headline}
                      </h4>
                    </div>
                    {aiResponse.suggestedActionLabel && (
                      <button
                        type="button"
                        onClick={handleExecuteAIAction}
                        disabled={isExecutingAIAction}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {isExecutingAIAction ? 'Executing...' : aiResponse.suggestedActionLabel}
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {aiResponse.answerMarkdown}
                  </div>

                  {aiResponse.followUpPrompts?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400">Next:</span>
                      {aiResponse.followUpPrompts.map((fp, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleRunAICommand(fp)}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            darkMode
                              ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400'
                          }`}
                        >
                          {fp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Results List */}
        <div ref={listRef} className="max-h-[340px] sm:max-h-[380px] overflow-y-auto p-2 scrollbar-thin">
          {items.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <ICON_MAP.SparklesIcon className="w-7 h-7 mx-auto text-indigo-500 opacity-70" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Execute "{query}" with AI Co-Pilot
              </p>
              <button
                type="button"
                onClick={() => handleRunAICommand()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Ask AI Co-Pilot Now
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    data-index={idx}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                      isSelected
                        ? darkMode
                          ? 'bg-indigo-600/20 text-white'
                          : 'bg-indigo-50 text-slate-900'
                        : darkMode
                        ? 'hover:bg-slate-800/60 text-slate-300'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`p-2 rounded-lg flex-shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : darkMode
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className={`text-[11px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    {item.meta && (
                      <span className="text-[11px] font-mono text-slate-400 flex-shrink-0 whitespace-nowrap">
                        {item.meta}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Context & Shortcuts Bar */}
        <div
          className={`px-4 py-2.5 border-t flex items-center justify-between text-[11px] ${
            darkMode ? 'bg-slate-900/90 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <span>
              Context: <strong className="text-slate-700 dark:text-slate-200">{workspaceContext.activeProjectName}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{workspaceContext.completionRate}% velocity</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span>Press ↵ to run AI or select</span>
          </div>
        </div>
      </div>
    </div>
  );
};
