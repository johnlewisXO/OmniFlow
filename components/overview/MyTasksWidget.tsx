
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task } from '../../types';

export const MyTasksWidget: React.FC = () => {
  const { tasks, currentUser, darkMode } = useAppStore();
  const ClipboardListIcon: React.FC<{ className?: string }> = ICON_MAP.ClipboardListIcon;

  // Basic filtering for tasks assigned to current user and due soon (example logic)
  const myTasks = tasks
    .filter(task => task.assignee_id === currentUser?.id) 
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    })
    .slice(0, 5); // Show top 5

  return (
    <div className={`p-4 md:p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'} shadow-lg`}>
      <div className="flex items-center mb-4">
        <ClipboardListIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
        <h2 className="text-xl font-semibold">My Upcoming Tasks</h2>
      </div>
      {myTasks.length === 0 && (
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>You have no upcoming tasks assigned to you, or tasks data is still loading.</p>
      )}
      <ul className="space-y-3">
        {myTasks.map(task => (
          <li
            key={task.id}
            className={`p-3 rounded-md transition-all ${darkMode ? 'bg-slate-700/70 hover:bg-slate-700' : 'bg-white/80 hover:bg-slate-50'} border ${darkMode ? 'border-slate-600/50' : 'border-slate-200/60'}`}
          >
            <div className="flex justify-between items-center">
                <span className={`font-medium text-sm ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{task.title}</span>
                {task.dueDate && <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-primary/30 text-primary-light' : 'bg-primary/10 text-primary-dark'}`}>{new Date(task.dueDate).toLocaleDateString()}</span>}
            </div>
            <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Project: {task.projectId}</p> {/* Replace with project name lookup later */}
          </li>
        ))}
      </ul>
    </div>
  );
};