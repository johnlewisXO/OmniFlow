
import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { OverviewPage } from '../overview/OverviewPage'; 
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';

export const ProjectManagerDashboard: React.FC = () => {
  const { currentUser, darkMode, openCreateProjectModal, projects, setActiveProject } = useAppStore();

  const handleViewProjectKanban = (projectId: string) => {
    setActiveProject(projectId);
  };

  const managedProjects = projects.filter(p => p.owner_id === currentUser?.id || p.organization_id === currentUser?.organization_id);

  return (
    <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-y-auto scrollbar-thin space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Project Manager Dashboard</h1>
        <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Oversee your projects, manage tasks, and track team progress seamlessly.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={openCreateProjectModal} variant="primary" size="md">
          <ICON_MAP.PlusIcon className="w-5 h-5 mr-2" />
          Create New Project
        </Button>
      </div>

      {managedProjects.length > 0 && (
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <h2 className="text-sm font-bold mb-3 uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Managed Projects ({managedProjects.length})</h2>
          <div className="max-h-60 overflow-y-auto scrollbar-thin space-y-2 pr-2">
            {managedProjects.map(p => (
              <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${darkMode ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <span className="truncate font-semibold text-sm">{p.name}</span>
                <Button size="sm" variant="outline" onClick={() => handleViewProjectKanban(p.id)}>View Board</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2">
        <OverviewPage showWelcomeMessage={false} /> 
      </div>
    </div>
  );
};