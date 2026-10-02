
import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task } from '../../types';

export const MyTasksWidget: React.FC = () => {
  const { myTasks, projects, currentUser, darkMode, isLoadingTasks, openViewTaskModal } = useAppStore();
  const ClipboardListIcon: React.FC<{ className?: string }> = ICON_MAP.ClipboardListIcon;

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'General';
    return projects.find(p => p.id === projectId)?.name || 'Project';
  };

  // Filter for incomplete tasks assigned to current user, sorted by due date
  const upcomingTasks = myTasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    })
    .slice(0, 5); // Show top 5

  return (
    <div className={`p-4 md:p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'} shadow-sm flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <ClipboardListIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
            <h2 className="text-xl font-bold tracking-tight">My Upcoming Tasks</h2>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            {upcomingTasks.length} {upcomingTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
        
        {isLoadingTasks ? (
          <ul className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <li key={i} className={`p-3 rounded-lg animate-pulse ${darkMode ? 'bg-slate-700/40 border-slate-600/30' : 'bg-white/50 border-slate-200/50'} border`}>
                <div className="flex justify-between items-center mb-2">
                  <div className={`h-4 w-1/2 rounded ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
                  <div className={`h-4 w-16 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
                </div>
                <div className={`h-3 w-1/3 rounded ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
              </li>
            ))}
          </ul>
        ) : upcomingTasks.length === 0 ? (
          <div className={`p-6 text-center rounded-lg border border-dashed ${darkMode ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
            <p className="text-sm">You have no pending tasks assigned to you.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {upcomingTasks.map(task => (
              <li
                key={task.id}
                onClick={() => openViewTaskModal(task.id, true)}
                className={`p-3.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  darkMode 
                    ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 hover:border-slate-600' 
                    : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
                } border shadow-xs hover:shadow-sm`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-medium text-sm truncate ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {task.title}
                  </span>
                  {task.dueDate && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      darkMode ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}>
                      📅 {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className={`font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'} truncate`}>
                    📁 {getProjectName(task.projectId)}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    task.status === 'in_progress' 
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' 
                      : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                  }`}>
                    {(task.status || 'todo').replace('_', ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};