import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Sprint, Task, TaskStatus, TaskPriority } from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';

export const SprintPlanningView: React.FC = () => {
  const {
    activeProject,
    tasks,
    sprints,
    users,
    createSprint,
    deleteSprint,
    startSprint,
    completeSprint,
    assignTaskToSprint,
    updateTask,
    openViewTaskModal,
    openModal,
    darkMode,
    currentUser,
    presences
  } = useAppStore();

  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [batchSprintTarget, setBatchSprintTarget] = useState<string>('');
  const [sprintViewTab, setSprintViewTab] = useState<'all' | 'active' | 'planned' | 'completed'>('all');

  // Filter project sprints
  const projectSprints = useMemo(() => {
    if (!activeProject) return [];
    return sprints.filter(s => s.projectId === activeProject.id);
  }, [sprints, activeProject]);

  // Active Sprint
  const activeSprint = useMemo(() => {
    return projectSprints.find(s => s.status === 'active') || null;
  }, [projectSprints]);

  // Planned Sprints
  const plannedSprints = useMemo(() => {
    return projectSprints.filter(s => s.status === 'planned');
  }, [projectSprints]);

  // Completed Sprints
  const completedSprints = useMemo(() => {
    return projectSprints.filter(s => s.status === 'completed');
  }, [projectSprints]);

  // Project tasks
  const projectTasks = useMemo(() => {
    if (!activeProject) return [];
    return tasks.filter(t => t.projectId === activeProject.id);
  }, [tasks, activeProject]);

  // Backlog tasks (tasks not assigned to any active or planned sprint)
  const backlogTasks = useMemo(() => {
    return projectTasks.filter(t => {
      const matchesSearch = !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const isUnassignedToSprint = !t.sprintId || !projectSprints.some(s => s.id === t.sprintId && s.status !== 'completed');
      return matchesSearch && matchesPriority && isUnassignedToSprint;
    });
  }, [projectTasks, searchQuery, priorityFilter, projectSprints]);

  // Active teammates online across the platform
  const activeCollabs = useMemo(() => {
    return presences.filter(p => p.userId !== currentUser?.id);
  }, [presences, currentUser]);

  // Helper for sprint statistics
  const getSprintStats = (sprintId: string) => {
    const sprintTasks = projectTasks.filter(t => t.sprintId === sprintId);
    const total = sprintTasks.length;
    const done = sprintTasks.filter(t => t.status === TaskStatus.DONE).length;
    const inProgress = sprintTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const totalPoints = sprintTasks.reduce((acc, t) => acc + (t.story_points || 1), 0);
    const completedPoints = sprintTasks
      .filter(t => t.status === TaskStatus.DONE)
      .reduce((acc, t) => acc + (t.story_points || 1), 0);
    const remainingPoints = totalPoints - completedPoints;
    const percent = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    return { total, done, inProgress, totalPoints, completedPoints, remainingPoints, percent, tasks: sprintTasks };
  };

  // Overall Backlog Analytics
  const backlogAnalytics = useMemo(() => {
    const totalBacklogPoints = backlogTasks.reduce((acc, t) => acc + (t.story_points || 1), 0);
    const estimatedTasks = backlogTasks.filter(t => t.story_points !== undefined).length;
    const groomingPercentage = backlogTasks.length > 0 ? Math.round((estimatedTasks / backlogTasks.length) * 100) : 100;
    const activeStats = activeSprint ? getSprintStats(activeSprint.id) : null;

    return {
      totalBacklogTasks: backlogTasks.length,
      totalBacklogPoints,
      groomingPercentage,
      activeSprintStats: activeStats,
      totalSprints: projectSprints.length
    };
  }, [backlogTasks, activeSprint, projectSprints]);

  const handleCreateSprintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !sprintName.trim()) return;

    await createSprint({
      projectId: activeProject.id,
      name: sprintName.trim(),
      goal: sprintGoal.trim() || undefined,
      status: 'planned',
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    setSprintName('');
    setSprintGoal('');
    setStartDate('');
    setEndDate('');
    setIsCreateSprintOpen(false);
  };

  // Toggle selection for batch move
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const selectAllBacklog = () => {
    if (selectedTaskIds.length === backlogTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(backlogTasks.map(t => t.id));
    }
  };

  const handleBatchMove = async (targetSprintId: string | null) => {
    if (selectedTaskIds.length === 0) return;
    for (const taskId of selectedTaskIds) {
      await assignTaskToSprint(taskId, targetSprintId);
    }
    setSelectedTaskIds([]);
  };

  if (!activeProject) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-lg mx-auto mt-12 shadow-sm">
        <ICON_MAP.RocketLaunchIcon className="w-12 h-12 text-accent mx-auto mb-3 opacity-60" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">No Active Project Selected</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Select or create a project to manage agile sprints and grooming backlogs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 p-4 md:p-6">

      {/* 1. Analytics Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/50 relative overflow-hidden">
        {/* Subtle geometric pattern overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
                <ICON_MAP.RocketLaunchIcon className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                Agile Iteration & Sprint Center
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Sprint Planning & Backlog
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
              Track delivery velocity, groom user stories with Fibonacci points, and manage iterations for <span className="font-semibold text-white">{activeProject.name}</span>.
            </p>
          </div>

          {/* Action Button & Active Online Teammates */}
          <div className="flex items-center gap-3 flex-wrap">
            {activeCollabs.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white">
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-semibold text-indigo-200">
                  Online:
                </span>
                <div className="flex -space-x-1.5 items-center">
                  {activeCollabs.slice(0, 4).map(collab => (
                    <div
                      key={collab.userId}
                      title={`${collab.userName} (${collab.isEditing ? 'Editing' : collab.isTypingComment ? 'Typing' : 'Planning'})`}
                      className="w-6 h-6 rounded-full border-2 ring-1 ring-black/40 overflow-hidden flex items-center justify-center text-[9px] font-bold text-white bg-indigo-600 hover:scale-110 transition-transform shadow-xs"
                      style={{ borderColor: collab.color || '#6366f1' }}
                    >
                      {collab.userAvatar ? (
                        <img src={collab.userAvatar} alt={collab.userName} className="w-full h-full object-cover" />
                      ) : (
                        collab.userName.charAt(0).toUpperCase()
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setIsCreateSprintOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 cursor-pointer"
            >
              <ICON_MAP.PlusIcon className="w-4 h-4" />
              <span>Create New Sprint</span>
            </button>
          </div>
        </div>

        {/* Analytics KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Active Velocity</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">
                {backlogAnalytics.activeSprintStats?.completedPoints || 0}
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                / {backlogAnalytics.activeSprintStats?.totalPoints || 0} pts
              </span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${backlogAnalytics.activeSprintStats?.percent || 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Backlog Depth</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{backlogAnalytics.totalBacklogTasks}</span>
              <span className="text-xs text-indigo-300 font-medium">tasks</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1.5">
              {backlogAnalytics.totalBacklogPoints} total story points ready
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Grooming Health</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{backlogAnalytics.groomingPercentage}%</span>
              <span className="text-xs text-indigo-300 font-medium">estimated</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1.5">
              Fibonacci estimated backlog items
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Sprint Cadence</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-300">
                {activeSprint ? '1 Active' : '0 Active'}
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                ({plannedSprints.length} planned)
              </span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1.5 truncate">
              {activeSprint?.endDate ? `Target: ${activeSprint.endDate}` : 'No active cycle'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Active/Planned Sprints (Left Column) & Modernized Product Backlog (Right Column) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Sprints (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Sprint Section */}
          {activeSprint ? (
            (() => {
              const stats = getSprintStats(activeSprint.id);
              return (
                <div className="bg-white dark:bg-slate-800/90 rounded-2xl border-2 border-emerald-500/40 dark:border-emerald-500/40 p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Active Sprint Cycle
                        </span>
                        {activeSprint.startDate && activeSprint.endDate && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <ICON_MAP.ClockIcon className="w-3.5 h-3.5" />
                            {activeSprint.startDate} → {activeSprint.endDate}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                        {activeSprint.name}
                      </h2>
                      {activeSprint.goal && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">
                          "{activeSprint.goal}"
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => completeSprint(activeSprint.id)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer self-start"
                    >
                      <ICON_MAP.CheckCircleIcon className="w-4 h-4" />
                      <span>Complete Sprint</span>
                    </button>
                  </div>

                  {/* Velocity Metrics Bar */}
                  <div className="grid grid-cols-4 gap-2.5 my-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Committed</p>
                      <p className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.totalPoints} pts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Done</p>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{stats.completedPoints} pts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Remaining</p>
                      <p className="text-lg font-black text-amber-600 dark:text-amber-400">{stats.remainingPoints} pts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Progress</p>
                      <p className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.percent}%</p>
                    </div>
                  </div>

                  {/* Progress Meter */}
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden mb-4">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>

                  {/* Sprint Tasks List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Tasks in Active Sprint ({stats.tasks.length})</span>
                      <span>{stats.done} of {stats.total} completed</span>
                    </div>

                    {stats.tasks.length === 0 ? (
                      <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                        No tasks in active sprint yet. Use the Product Backlog list to move tasks here!
                      </div>
                    ) : (
                      <div className="space-y-2 pr-1">
                        {stats.tasks.map(task => {
                          const taskAssignee = users.find(u => u.id === task.assignee_id);
                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 hover:shadow-xs transition-all"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  task.status === TaskStatus.DONE ? 'bg-emerald-500' :
                                  task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                                  task.status === TaskStatus.REVIEW ? 'bg-amber-500' : 'bg-slate-400'
                                }`} />
                                <span
                                  onClick={() => openViewTaskModal(task.id)}
                                  className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 truncate cursor-pointer"
                                >
                                  {task.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {task.story_points || 1} pts
                                </span>
                                {taskAssignee && (
                                  <Avatar user={taskAssignee} size="sm" />
                                )}
                                <button
                                  onClick={() => assignTaskToSprint(task.id, null)}
                                  title="Return task to Backlog"
                                  className="text-[11px] font-semibold text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                                >
                                  Backlog
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-xs">
              <ICON_MAP.PlayIcon className="w-10 h-10 text-indigo-500 mx-auto mb-2 opacity-60" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">No Active Sprint Right Now</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Create a planned sprint below or click "Start Sprint" on a planned iteration to launch your agile cycle.
              </p>
            </div>
          )}

          {/* Planned Sprints List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Planned Sprints ({plannedSprints.length})
              </h2>
            </div>

            {plannedSprints.length === 0 ? (
              <div className="p-5 text-center rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                No upcoming planned sprints. Click "Create New Sprint" to schedule your next iteration.
              </div>
            ) : (
              plannedSprints.map(sprint => {
                const stats = getSprintStats(sprint.id);
                return (
                  <div
                    key={sprint.id}
                    className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-indigo-400 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            Planned
                          </span>
                          {sprint.startDate && sprint.endDate && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {sprint.startDate} → {sprint.endDate}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {sprint.name}
                        </h3>
                        {sprint.goal && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                            "{sprint.goal}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startSprint(sprint.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Start Sprint
                        </button>
                        <button
                          onClick={() => deleteSprint(sprint.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                          title="Delete Sprint"
                        >
                          <ICON_MAP.TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <span>{stats.tasks.length} tasks committed</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{stats.totalPoints} story points</span>
                    </div>

                    {stats.tasks.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {stats.tasks.map(t => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-xs border border-slate-200/50 dark:border-slate-700/50"
                          >
                            <span
                              onClick={() => openViewTaskModal(t.id)}
                              className="font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate cursor-pointer flex-1"
                            >
                              {t.title}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="font-bold text-slate-500">{t.story_points || 1} pts</span>
                              <button
                                onClick={() => assignTaskToSprint(t.id, null)}
                                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Modernized, Highly-Legible Product Backlog (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-5 space-y-4">
            
            {/* Backlog Header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Product Backlog
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    {backlogTasks.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {backlogAnalytics.totalBacklogPoints} total story points unassigned
                </p>
              </div>

              <button
                onClick={() => openModal()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Filter backlog tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                />
                <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="text-xs rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="all">All Priorities</option>
                <option value={TaskPriority.CRITICAL}>Critical</option>
                <option value={TaskPriority.HIGH}>High</option>
                <option value={TaskPriority.MEDIUM}>Medium</option>
                <option value={TaskPriority.LOW}>Low</option>
              </select>
            </div>

            {/* Batch Action Bar */}
            {backlogTasks.length > 0 && (
              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.length === backlogTasks.length && backlogTasks.length > 0}
                    onChange={selectAllBacklog}
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Select All ({selectedTaskIds.length}/{backlogTasks.length})</span>
                </label>

                {selectedTaskIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {activeSprint && (
                      <button
                        onClick={() => handleBatchMove(activeSprint.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all shadow-xs"
                      >
                        + Active Sprint ({selectedTaskIds.length})
                      </button>
                    )}
                    {plannedSprints.length > 0 && (
                      <select
                        onChange={e => {
                          if (e.target.value) handleBatchMove(e.target.value);
                        }}
                        defaultValue=""
                        className="text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1"
                      >
                        <option value="" disabled>Move {selectedTaskIds.length} to...</option>
                        {plannedSprints.map(ps => (
                          <option key={ps.id} value={ps.id}>{ps.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Backlog Items List with High Contrast & Legibility */}
            <div className="space-y-2.5 pr-1">
              {backlogTasks.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                  {searchQuery ? 'No backlog items match your search filter.' : 'Your backlog is clear! Click "Add Task" above to add work items.'}
                </div>
              ) : (
                backlogTasks.map(task => {
                  const taskAssignee = users.find(u => u.id === task.assignee_id);
                  const isSelected = selectedTaskIds.includes(task.id);

                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-600 shadow-xs'
                          : 'bg-slate-50/70 dark:bg-slate-900/70 border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      {/* Top Row: Checkbox, Title, Fibonacci Selector */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <span
                              onClick={() => openViewTaskModal(task.id)}
                              className="text-xs font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 leading-snug cursor-pointer line-clamp-2"
                            >
                              {task.title}
                            </span>
                            {task.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Story Points Estimator */}
                        <div className="flex items-center gap-1 flex-shrink-0" title="Fibonacci Story Points">
                          <select
                            value={task.story_points || 1}
                            onChange={e => updateTask(task.id, { story_points: parseInt(e.target.value, 10) })}
                            className="text-[11px] font-extrabold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 shadow-xs cursor-pointer"
                          >
                            <option value={1}>1 pt</option>
                            <option value={2}>2 pts</option>
                            <option value={3}>3 pts</option>
                            <option value={5}>5 pts</option>
                            <option value={8}>8 pts</option>
                            <option value={13}>13 pts</option>
                          </select>
                        </div>
                      </div>

                      {/* Bottom Row: Metadata & Quick Add Actions */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase ${
                            task.priority === TaskPriority.CRITICAL ? 'text-red-600 dark:text-red-400' :
                            task.priority === TaskPriority.HIGH ? 'text-amber-600 dark:text-amber-400' :
                            'text-slate-500 dark:text-slate-400'
                          }`}>
                            {task.priority}
                          </span>
                          {taskAssignee && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                              <span aria-hidden="true">·</span>
                              <Avatar user={taskAssignee} size="sm" />
                              <span className="truncate max-w-[80px]">{taskAssignee.full_name?.split(' ')[0] || 'User'}</span>
                            </div>
                          )}
                        </div>

                        {/* Quick-Add Buttons to Sprint */}
                        <div className="flex items-center gap-1.5">
                          {activeSprint && (
                            <button
                              onClick={() => assignTaskToSprint(task.id, activeSprint.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                              title={`Add directly to ${activeSprint.name}`}
                            >
                              <ICON_MAP.PlusIcon className="w-3 h-3" />
                              <span>Active Sprint</span>
                            </button>
                          )}
                          {plannedSprints.length > 0 && (
                            <select
                              onChange={e => {
                                if (e.target.value) assignTaskToSprint(task.id, e.target.value);
                              }}
                              defaultValue=""
                              className="text-[10px] font-medium bg-slate-200 dark:bg-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 border-none cursor-pointer"
                            >
                              <option value="" disabled>Move to...</option>
                              {plannedSprints.map(ps => (
                                <option key={ps.id} value={ps.id}>{ps.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Sprint Modal */}
      {isCreateSprintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <ICON_MAP.RocketLaunchIcon className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create New Sprint</h3>
              </div>
              <button
                onClick={() => setIsCreateSprintOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <ICON_MAP.XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSprintSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sprint Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sprint 14 - Q3 Release"
                  value={sprintName}
                  onChange={e => setSprintName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sprint Goal
                </label>
                <textarea
                  rows={2}
                  placeholder="What is the objective or deliverable of this iteration?"
                  value={sprintGoal}
                  onChange={e => setSprintGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateSprintOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20"
                >
                  Create Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
