
import React from 'react';
import { KanbanColumn } from './KanbanColumn';
import { TaskStatus as TaskStatusEnum } from '../../types'; // Renamed import
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { TASK_STATUS_COLUMNS, ICON_MAP } from '../../constants';


export const KanbanBoard: React.FC = () => {
  const { 
    activeProject, 
    darkMode, 
    isLoadingTasks, 
    tasksError,
    isLoadingProjects // To know if project itself is still loading
  } = useAppStore();
  
  const FolderIcon = ICON_MAP.FolderIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;

  if (isLoadingProjects && !activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-transparent">
        <div className="text-center">
          <SpinnerIcon className={`w-12 h-12 mx-auto mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'} animate-spin`} />
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Loading Project...</h2>
        </div>
      </div>
    );
  }
  
  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-transparent">
        <div className="text-center">
          <FolderIcon className={`w-24 h-24 mx-auto mb-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'} opacity-70`} />
          <h2 className={`text-2xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>No Project Selected</h2>
          <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-1`}>Please select a project from the sidebar to view tasks.</p>
        </div>
      </div>
    );
  }

  // Display loading spinner for tasks only if activeProject is loaded but tasks are still fetching.
  if (activeProject && isLoadingTasks) {
    return (
      <div className="flex-1 flex space-x-3 md:space-x-4 p-4 md:p-6 overflow-x-auto bg-transparent">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className={`flex-shrink-0 w-72 md:w-80 rounded-xl flex flex-col ${darkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-100/50 border-slate-200/50'} border shadow-sm`}>
            <div className="p-3 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className={`h-5 w-24 rounded animate-pulse ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            </div>
            <div className="flex-1 p-2 space-y-3 overflow-y-auto">
              {[1, 2, 3].map((task) => (
                <div key={task} className={`p-4 rounded-lg border shadow-sm animate-pulse ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className={`h-4 w-3/4 rounded mb-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <div className="flex justify-between items-center mt-4">
                    <div className={`h-3 w-16 rounded ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                    <div className={`h-6 w-6 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Display error message if tasksError is present and activeProject is loaded.
  if (activeProject && tasksError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-transparent">
        <div className={`text-center p-4 rounded-lg ${darkMode ? 'bg-red-900/30' : 'bg-red-100/70'}`}>
          <ExclamationIcon className={`w-16 h-16 mx-auto mb-4 text-red-500 dark:text-red-400`} />
          <h2 className={`text-xl font-semibold text-red-700 dark:text-red-300`}>Error Loading Tasks</h2>
          <p className={`text-red-600 dark:text-red-400 mt-1`}>{tasksError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 p-4 md:p-6 overflow-x-auto overflow-y-auto bg-transparent">
      {TASK_STATUS_COLUMNS.map(column => (
        <div key={column.id} className="w-full md:w-auto md:shrink">
          <KanbanColumn
            status={column.id as TaskStatusEnum} 
            title={column.title}
            colorClass={column.color}
          />
        </div>
      ))}
    </div>
  );
};