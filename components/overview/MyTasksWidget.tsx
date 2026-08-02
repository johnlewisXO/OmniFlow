
import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task } from '../../types';

export const MyTasksWidget: React.FC = () => {
  const { myTasks, currentUser, darkMode, isLoadingTasks, openViewTaskModal } = useAppStore();
  const ClipboardListIcon: React.FC<{ className?: string }> = ICON_MAP.ClipboardListIcon;

  // Basic filtering for tasks assigned to current user and due soon (example logic)
  const upcomingTasks = myTasks
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    })
    .slice(0, 5); // Show top 5

  return (
    <div className={`p-4 md:p-6 rounded-lg ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'} shadow-sm`}>
      <div className="flex items-center mb-4">
        <ClipboardListIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
        <h2 className="text-xl font-semibold">My Upcoming Tasks</h2>
      </div>
      
      {isLoadingTasks ? (
        <ul className="space-y-2">
          {[1, 2, 3].map(i => (
            <li key={i} className={`p-3 rounded-md animate-pulse ${darkMode ? 'bg-slate-700/40 border-slate-600/30' : 'bg-white/50 border-slate-200/50'} border`}>
              <div className="flex justify-between items-center mb-2">
                <div className={`h-4 w-1/2 rounded ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
                <div className={`h-4 w-16 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
              </div>
              <div className={`h-3 w-1/3 rounded ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
            </li>
          ))}
        </ul>
      ) : upcomingTasks.length === 0 ? (
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>You have no upcoming tasks assigned to you.</p>
      ) : (
        <ul className="space-y-2">
          {upcomingTasks.map(task => (
            <li
              key={task.id}
              onClick={() => openViewTaskModal(task.id, true)}
              className={`p-3 rounded-md transition-all cursor-pointer ${darkMode ? 'bg-slate-700/70 hover:bg-slate-700' : 'bg-white/80 hover:bg-slate-50 hover:shadow-sm'} border ${darkMode ? 'border-slate-600/50' : 'border-slate-200/60'}`}
            >
              <div className="flex justify-between items-center">
                  <span className={`font-medium text-sm ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{task.title}</span>
                  {task.dueDate && <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-primary/30 text-primary-light' : 'bg-primary/10 text-primary-dark'}`}>{new Date(task.dueDate).toLocaleDateString()}</span>}
              </div>
              <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Project: {task.projectId}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};