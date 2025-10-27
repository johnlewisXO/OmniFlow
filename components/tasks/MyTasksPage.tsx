
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskPriority, TaskStatus } from '../../types'; // Import PRIORITY_STYLES if needed

export const MyTasksPage: React.FC = () => {
  const { tasks, currentUser, darkMode, isLoadingTasks, tasksError, projects } = useAppStore();
  const ClipboardListIcon = ICON_MAP.ClipboardListIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;

  const myOpenTasks = tasks
    .filter(task => task.assignee_id === currentUser?.id && task.status !== TaskStatus.DONE)
    .sort((a, b) => {
      // Sort by due date (earliest first), then by priority (Critical > High > Medium > Low)
      if (a.dueDate && b.dueDate) {
        const dateComparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (dateComparison !== 0) return dateComparison;
      } else if (a.dueDate) return -1; // Tasks with due dates come before those without
      else if (b.dueDate) return 1;

      const priorityOrder = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW];
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });
  
  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Unknown Project';
  }

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="flex items-center mb-6">
        <ClipboardListIcon className={`w-8 h-8 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
        <h1 className="text-2xl md:text-3xl font-semibold">My Tasks</h1>
      </div>

      {isLoadingTasks && (
        <div className="text-center py-10">
          <SpinnerIcon className={`w-12 h-12 mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-500'} animate-spin`} />
          <p className={`mt-4 text-lg ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Loading Your Tasks...</p>
        </div>
      )}

      {tasksError && !isLoadingTasks && (
         <div className={`text-center p-6 rounded-lg ${darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-100/80 border-red-300'} border shadow-md`}>
          <ExclamationIcon className={`w-12 h-12 mx-auto mb-4 text-red-500 dark:text-red-400`} />
          <h2 className={`text-xl font-semibold text-red-700 dark:text-red-300`}>Error Loading Tasks</h2>
          <p className={`text-red-600 dark:text-red-400 mt-1`}>{tasksError}</p>
        </div>
      )}

      {!isLoadingTasks && !tasksError && myOpenTasks.length === 0 && (
        <div className="text-center py-10">
          <ClipboardListIcon className={`w-20 h-20 mx-auto mb-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'} opacity-70`} />
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>No Active Tasks</h2>
          <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
            You have no tasks assigned to you, or all your tasks are completed!
          </p>
        </div>
      )}
      
      {!isLoadingTasks && !tasksError && myOpenTasks.length > 0 && (
         <div className="space-y-4">
          {myOpenTasks.map(task => (
            <div key={task.id} className={`p-4 rounded-lg shadow-md border ${darkMode ? 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/80' : 'bg-white/70 border-slate-200/70 hover:bg-slate-50/90'} transition-colors`}>
              <div className="flex justify-between items-start">
                <h3 className={`text-lg font-medium ${darkMode ? 'text-slate-50' : 'text-slate-900'}`}>{task.title}</h3>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold
                  ${task.priority === TaskPriority.CRITICAL ? 'bg-red-500 text-white' : ''}
                  ${task.priority === TaskPriority.HIGH ? (darkMode ? 'bg-orange-600 text-white' : 'bg-orange-400 text-orange-800') : ''}
                  ${task.priority === TaskPriority.MEDIUM ? (darkMode ? 'bg-yellow-600 text-white' : 'bg-yellow-400 text-yellow-800') : ''}
                  ${task.priority === TaskPriority.LOW ? (darkMode ? 'bg-green-700 text-green-100' : 'bg-green-400 text-green-800') : ''}
                `}>{task.priority}</span>
              </div>
              {task.description && <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'} truncate-2-lines`}>{task.description}</p>}
              <div className="mt-3 flex justify-between items-center text-xs">
                <span className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Project: <span className="font-medium text-primary">{getProjectName(task.projectId)}</span>
                </span>
                {task.dueDate && (
                  <span className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Due: <span className="font-medium text-amber-600 dark:text-amber-400">{new Date(task.dueDate).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};