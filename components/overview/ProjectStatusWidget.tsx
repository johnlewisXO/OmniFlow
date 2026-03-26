
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Project } from '../../types';

export const ProjectStatusWidget: React.FC = () => {
  const { projects, darkMode, isLoadingProjects } = useAppStore();
  const FolderIcon = ICON_MAP.FolderIcon;

  // Example: Show first 5 projects or projects with progress
  const recentProjects = projects
    .filter(p => p.status === 'active') // Changed 'Active' to 'active'
    .slice(0, 5);

  return (
    <div className={`p-4 md:p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'} shadow-lg`}>
      <div className="flex items-center mb-4">
        <FolderIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
        <h2 className="text-xl font-semibold">Active Projects Overview</h2>
      </div>
      
      {isLoadingProjects ? (
        <ul className="space-y-3">
          {[1, 2, 3].map(i => (
            <li key={i} className={`p-3 rounded-md animate-pulse ${darkMode ? 'bg-slate-700/40 border-slate-600/30' : 'bg-white/50 border-slate-200/50'} border`}>
              <div className="flex justify-between items-center mb-2">
                <div className={`h-4 w-1/2 rounded ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
                <div className={`h-4 w-16 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
              </div>
              <div className={`h-2.5 w-full rounded-full mt-1.5 ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
            </li>
          ))}
        </ul>
      ) : recentProjects.length === 0 ? (
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No active projects to display.</p>
      ) : (
        <ul className="space-y-3">
          {recentProjects.map(project => (
            <li 
              key={project.id}
              className={`p-3 rounded-md ${darkMode ? 'bg-slate-700/70' : 'bg-white/80'} border ${darkMode ? 'border-slate-600/50' : 'border-slate-200/60'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`font-medium text-sm ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{project.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-sky-700 text-sky-200' : 'bg-sky-100 text-sky-700'}`}>{project.status}</span>
              </div>
              {project.progress !== undefined && (
                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5 mt-1.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${project.progress}%` }}
                    title={`${project.progress}% complete`}
                  ></div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};