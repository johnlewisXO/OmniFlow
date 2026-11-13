
import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Project } from '../../types';

export const ProjectStatusWidget: React.FC = () => {
  const { projects, darkMode, isLoadingProjects, setActiveProject, setActiveView } = useAppStore();
  const FolderIcon = ICON_MAP.FolderIcon;

  // Example: Show first 5 projects or projects with progress
  const recentProjects = projects
    .filter(p => p.status === 'active') // Changed 'Active' to 'active'
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] shadow-xs">
      <div className="flex items-center mb-4">
        <FolderIcon className="w-5 h-5 mr-2.5 text-[#4E6126] dark:text-[#CCF048]" />
        <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">Active Projects Overview</h2>
      </div>
      
      {isLoadingProjects ? (
        <ul className="space-y-2">
          {[1, 2, 3].map(i => (
            <li key={i} className="p-3 rounded-xl animate-pulse bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)]">
              <div className="flex justify-between items-center mb-2">
                <div className="h-4 w-1/2 rounded bg-[var(--bg-sage)]"></div>
                <div className="h-4 w-16 rounded-full bg-[var(--bg-sage)]"></div>
              </div>
              <div className="h-2 w-full rounded-full mt-1.5 bg-[var(--bg-sage)]"></div>
            </li>
          ))}
        </ul>
      ) : recentProjects.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No active projects to display.</p>
      ) : (
        <ul className="space-y-2">
          {recentProjects.map(project => (
            <li 
              key={project.id}
              onClick={() => {
                setActiveProject(project);
                setActiveView('kanban');
              }}
              className="p-3 rounded-xl cursor-pointer transition-all bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-sage)] border border-[var(--border-hairline)]"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-sm text-[var(--text-primary)]">{project.name}</span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--bg-sage)] text-[#4E6126] dark:text-[#CCF048] border border-[var(--border-strong)] whitespace-nowrap">{project.status}</span>
              </div>
              {project.progress !== undefined && (
                <div className="w-full bg-[var(--bg-sage)] rounded-full h-2 mt-2 overflow-hidden">
                  <div 
                    className="bg-[#191B17] dark:bg-[#CCF048] h-2 rounded-full transition-all duration-500 ease-out" 
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