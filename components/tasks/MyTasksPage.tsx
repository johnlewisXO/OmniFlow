
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { isBefore, isToday, startOfDay, parseISO } from 'date-fns';
import { generateTaskSummary } from '../../services/aiService';

export const MyTasksPage: React.FC = () => {
  const { myTasks, currentUser, darkMode, isLoadingTasks, tasksError, projects } = useAppStore();
  const [summary, setSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const ClipboardListIcon = ICON_MAP.ClipboardListIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const SparklesIcon = ICON_MAP.SparklesIcon;

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    const result = await generateTaskSummary(myTasks);
    setSummary(result);
    setIsGenerating(false);
  };

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Unknown Project';
  }

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

    // Sort each category
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

  const renderTaskCard = (task: Task) => (
    <div 
      key={task.id} 
      onClick={() => useAppStore.getState().openViewTaskModal(task.id, true)}
      className={`p-4 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/80' : 'bg-white/70 border-slate-200/70 hover:bg-slate-50/90'} transition-colors cursor-pointer`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className={`text-lg font-medium ${darkMode ? 'text-slate-50' : 'text-slate-900'} line-clamp-1`}>{task.title}</h3>
        <div className="flex gap-2">
          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider
            ${task.status === TaskStatus.DONE ? 'bg-green-500/20 text-green-600 dark:text-green-400' : ''}
            ${task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : ''}
            ${task.status === TaskStatus.TODO ? 'bg-slate-500/20 text-slate-600 dark:text-slate-400' : ''}
          `}>{(task.status || '').replace('_', ' ')}</span>
          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider
            ${task.priority === TaskPriority.CRITICAL ? 'bg-red-500 text-white' : ''}
            ${task.priority === TaskPriority.HIGH ? 'bg-orange-500 text-white' : ''}
            ${task.priority === TaskPriority.MEDIUM ? 'bg-yellow-500 text-white' : ''}
            ${task.priority === TaskPriority.LOW ? 'bg-green-500 text-white' : ''}
          `}>{task.priority}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-4">
          <span className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {getProjectName(task.projectId)}
          </span>
          {task.dueDate && (
            <span className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1`}>
              📅 {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
        
        {/* Quick Actions Placeholder */}
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              useAppStore.getState().openViewTaskModal(task.id, true);
            }}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );

  const renderSection = (title: string, icon: string, tasksToRender: Task[], colorClass: string) => {
    if (tasksToRender.length === 0) return null;
    return (
      <div className="mb-8">
        <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${colorClass}`}>
          <span>{icon}</span> {title} <span className="text-sm font-normal opacity-70 ml-2">({tasksToRender.length})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasksToRender.map(renderTaskCard)}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex-1 p-4 md:p-8 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100 bg-slate-900' : 'text-slate-800 bg-slate-50'}`}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <ClipboardListIcon className={`w-8 h-8 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Tasks</h1>
        </div>
        <button
          onClick={handleGenerateSummary}
          disabled={isGenerating || myTasks.length === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-sm ${
            darkMode 
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-800 disabled:text-slate-500' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-200 disabled:text-slate-400'
          }`}
        >
          {isGenerating ? (
            <SpinnerIcon className="w-5 h-5 animate-spin" />
          ) : (
            <SparklesIcon className="w-5 h-5" />
          )}
          AI Summary
        </button>
      </div>

      {summary && (
        <div className={`mb-8 p-6 rounded-xl border shadow-sm ${darkMode ? 'bg-indigo-900/20 border-indigo-800/50' : 'bg-indigo-50 border-indigo-100'}`}>
          <div className="flex items-start gap-3">
            <SparklesIcon className={`w-6 h-6 mt-1 flex-shrink-0 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <div>
              <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>AI Workload Summary</h3>
              <p className={`leading-relaxed ${darkMode ? 'text-indigo-100/80' : 'text-indigo-900/80'}`}>{summary}</p>
            </div>
          </div>
        </div>
      )}

      {isLoadingTasks && myTasks.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`p-4 rounded-xl border shadow-sm animate-pulse ${darkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white/50 border-slate-200/50'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`h-5 w-2/3 rounded ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                <div className={`h-4 w-16 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              </div>
              <div className="flex items-center justify-between mt-6">
                <div className={`h-3 w-24 rounded ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                <div className={`h-6 w-6 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tasksError && !isLoadingTasks && (
         <div className={`text-center p-8 rounded-xl ${darkMode ? 'bg-red-900/20 border-red-900/50' : 'bg-red-50 border-red-100'} border shadow-sm max-w-md mx-auto mt-10`}>
          <ExclamationIcon className={`w-12 h-12 mx-auto mb-4 text-red-500`} />
          <h2 className={`text-xl font-semibold text-red-700 dark:text-red-400`}>Error Loading Tasks</h2>
          <p className={`text-red-600 dark:text-red-300 mt-2 text-sm`}>{tasksError}</p>
        </div>
      )}

      {!isLoadingTasks && !tasksError && myTasks.length === 0 && (
        <div className="text-center py-20 max-w-md mx-auto">
          <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
            <ClipboardListIcon className={`w-12 h-12 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>You're all caught up!</h2>
          <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mb-8`}>
            You have no tasks assigned to you. Enjoy your free time or browse projects to find new work.
          </p>
          <button 
            onClick={() => useAppStore.getState().setActiveView('projects_overview')}
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium shadow-sm hover:bg-primary-dark transition-colors"
          >
            Browse Projects
          </button>
        </div>
      )}
      
      {!isLoadingTasks && !tasksError && myTasks.length > 0 && (
         <div className="space-y-2">
          {renderSection("Overdue", "🔥", overdue, "text-red-600 dark:text-red-400")}
          {renderSection("Due Today", "📅", dueToday, "text-orange-600 dark:text-orange-400")}
          {renderSection("Upcoming", "📌", upcoming, "text-blue-600 dark:text-blue-400")}
          {renderSection("Completed", "✅", completed, "text-green-600 dark:text-green-400")}
        </div>
      )}
    </div>
  );
};