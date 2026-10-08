import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { isBefore, isToday, startOfDay, parseISO } from 'date-fns';
import { generateTaskSummary } from '../../services/aiService';
import { TaskLivePresenceBadge, useTaskPresenceHighlight } from '../shared/TaskLivePresenceBadge';

export const MyTasksPage: React.FC = () => {
  const { myTasks, currentUser, darkMode, isLoadingTasks, tasksError, projects, openViewTaskModal } = useAppStore();
  const [summary, setSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'dueToday' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const ClipboardListIcon = ICON_MAP.ClipboardListIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const SparklesIcon = ICON_MAP.SparklesIcon;
  const ClockIcon = ICON_MAP.ClockIcon;
  const CheckCircleIcon = ICON_MAP.CheckCircleIcon;

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const result = await generateTaskSummary(myTasks);
      setSummary(result);
    } catch (e) {
      setSummary("Could not generate task summary right now. Please check your tasks directly below.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'General Workspace';
  };

  const { overdue, dueToday, upcoming, completed } = useMemo(() => {
    const today = startOfDay(new Date());
    
    const categorized = {
      overdue: [] as Task[],
      dueToday: [] as Task[],
      upcoming: [] as Task[],
      completed: [] as Task[]
    };

    myTasks.forEach(task => {
      if (task.status === TaskStatus.DONE) {
        categorized.completed.push(task);
        return;
      }

      if (!task.dueDate) {
        categorized.upcoming.push(task);
        return;
      }

      const dueDate = startOfDay(parseISO(task.dueDate));
      
      if (isBefore(dueDate, today)) {
        categorized.overdue.push(task);
      } else if (isToday(dueDate)) {
        categorized.dueToday.push(task);
      } else {
        categorized.upcoming.push(task);
      }
    });

    const sortTasks = (tasksToSort: Task[]) => tasksToSort.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      
      const priorityOrder = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW];
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    return {
      overdue: sortTasks(categorized.overdue),
      dueToday: sortTasks(categorized.dueToday),
      upcoming: sortTasks(categorized.upcoming),
      completed: sortTasks(categorized.completed)
    };
  }, [myTasks]);

  // Total task analytics
  const totalTasks = myTasks.length;
  const completedCount = completed.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const criticalCount = myTasks.filter(t => t.priority === TaskPriority.CRITICAL && t.status !== TaskStatus.DONE).length;

  const currentDisplayTasks = useMemo(() => {
    let list: Task[] = [];
    if (activeFilterTab === 'dueToday') list = dueToday;
    else if (activeFilterTab === 'overdue') list = overdue;
    else if (activeFilterTab === 'upcoming') list = upcoming;
    else if (activeFilterTab === 'completed') list = completed;
    else list = [...overdue, ...dueToday, ...upcoming, ...completed];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    return list;
  }, [activeFilterTab, overdue, dueToday, upcoming, completed, searchQuery]);

  return (
    <div className={`p-4 md:p-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'} space-y-6`}>
      
      {/* 1. Analytics Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                <ClipboardListIcon className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                Personal Task Command Center
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              My Assigned Tasks
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-xl leading-relaxed">
              Stay focused on your highest priority deliverables, upcoming deadlines, and cross-project commitments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateSummary}
              disabled={isGenerating || myTasks.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 cursor-pointer"
            >
              {isGenerating ? (
                <SpinnerIcon className="w-4 h-4 animate-spin text-white" />
              ) : (
                <SparklesIcon className="w-4 h-4 text-amber-300" />
              )}
              <span>{isGenerating ? 'Analyzing Workload...' : 'AI Daily Briefing'}</span>
            </button>
          </div>
        </div>

        {/* Analytics KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Due Today</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-300">{dueToday.length}</span>
              <span className="text-xs text-indigo-300 font-medium">action items</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              {dueToday.length > 0 ? 'High focus required today' : 'No immediate due dates'}
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">Overdue</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${overdue.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {overdue.length}
              </span>
              <span className="text-xs text-indigo-300 font-medium">past target</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              {overdue.length > 0 ? 'Needs escalation or reschedule' : 'All deadlines on track'}
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Completion Rate</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{completionRate}%</span>
              <span className="text-xs text-indigo-300 font-medium">({completedCount}/{totalTasks})</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Critical Attention</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-rose-400">{criticalCount}</span>
              <span className="text-xs text-indigo-300 font-medium">critical</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              {upcoming.length} upcoming scheduled tasks
            </p>
          </div>
        </div>
      </div>

      {/* AI Summary Banner if generated */}
      {summary && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 shadow-xs flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 mb-1">
              AI Task Briefing & Prioritization
            </h4>
            <p className="text-xs text-indigo-950 dark:text-indigo-300 whitespace-pre-line leading-relaxed">
              {summary}
            </p>
          </div>
          <button
            onClick={() => setSummary(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <ICON_MAP.XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Filter & Search Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: `All (${totalTasks})` },
            { id: 'dueToday', label: `Due Today (${dueToday.length})` },
            { id: 'overdue', label: `Overdue (${overdue.length})` },
            { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
            { id: 'completed', label: `Done (${completed.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilterTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeFilterTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search my tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
          />
          <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* 3. Task Cards Display */}
      {currentDisplayTasks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <ClipboardListIcon className="w-14 h-14 mx-auto mb-3 text-slate-400 opacity-60" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            {searchQuery ? 'No tasks matching your search' : 'No tasks in this category'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {activeFilterTab === 'overdue' ? 'Great job! You have zero overdue items.' : 'Check other tabs or collaborate on project boards to pick up work.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentDisplayTasks.map(task => {
            const isTaskOverdue = task.dueDate && isBefore(startOfDay(parseISO(task.dueDate)), startOfDay(new Date())) && task.status !== TaskStatus.DONE;
            const isTaskDueToday = task.dueDate && isToday(parseISO(task.dueDate)) && task.status !== TaskStatus.DONE;

            return (
              <div
                key={task.id}
                onClick={() => openViewTaskModal(task.id, true)}
                className={`p-4 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col justify-between ${
                  darkMode ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-indigo-500/50' :
                  'bg-white hover:bg-slate-50/80 border-slate-200/90 hover:border-indigo-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 truncate max-w-[140px]">
                      {getProjectName(task.projectId)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <TaskLivePresenceBadge taskId={task.id} compact={true} />
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        task.priority === TaskPriority.CRITICAL ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                        task.priority === TaskPriority.HIGH ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-1.5">
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {task.dueDate ? (
                      <span className={`text-[11px] font-medium ${
                        isTaskOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' :
                        isTaskDueToday ? 'text-amber-600 dark:text-amber-400 font-bold' : ''
                      }`}>
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">No due date</span>
                    )}
                  </div>

                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                    task.status === TaskStatus.DONE ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
