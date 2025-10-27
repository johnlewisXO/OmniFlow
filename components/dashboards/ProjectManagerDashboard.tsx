
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { OverviewPage } from '../overview/OverviewPage'; 
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';

export const ProjectManagerDashboard: React.FC = () => {
  const { currentUser, darkMode, openCreateProjectModal, setActiveView, projects, activeProject, setActiveProject } = useAppStore();
  const FolderIcon = ICON_MAP.FolderIcon; 
  const UserCircleIcon = ICON_MAP.UserCircleIcon; // Example for workload
  const ClipboardListIcon = ICON_MAP.ClipboardListIcon; // Example for milestones

  const handleViewProjectKanban = (projectId: string) => {
    setActiveProject(projectId);
    // setActiveView('kanban'); // setActiveProject in store already handles this
  };

  // Filter projects to those the PM might "manage" - simplistic: owned by them or in their org
  // In a real app, this would be based on explicit project_manager assignments.
  const managedProjects = projects.filter(p => p.owner_id === currentUser?.id || p.organization_id === currentUser?.organization_id);


  return (
    <div className={`flex-1 flex flex-col p-0 overflow-hidden min-h-0`}>
      <div className="p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Project Manager Dashboard</h1>
        <p className={`text-md ${darkMode ? 'text-slate-400' : 'text-slate-500'} mb-6`}>
            Oversee your projects, manage tasks, and track team progress.
        </p>
        <Button onClick={openCreateProjectModal} variant="primary" size="md" className="mb-6">
            <ICON_MAP.PlusIcon className="w-5 h-5 mr-2" />
            Create New Project
        </Button>

        {managedProjects.length > 0 && (
          <div className={`mb-6 p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
            <h2 className="text-lg font-semibold mb-3">Your Projects:</h2>
            <div className="max-h-60 overflow-y-auto scrollbar-thin space-y-2 pr-2">
              {managedProjects.map(p => (
                <div key={p.id} className={`flex justify-between items-center p-2.5 rounded-md ${darkMode ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-200'}`}>
                  <span className="truncate font-medium">{p.name}</span>
                  <Button size="sm" variant="outline" onClick={() => handleViewProjectKanban(p.id)}>View Board</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
            {/* Team Workload Placeholder */}
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
                <div className="flex items-center mb-2">
                    <UserCircleIcon className={`w-5 h-5 mr-2 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
                    <h3 className="text-md font-semibold">Team Workload Overview</h3>
                </div>
                <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Visualize task distribution and team capacity.</p>
                <div className={`h-24 flex items-center justify-center border-2 border-dashed rounded-md ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                    <p className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Workload Chart [Coming Soon]</p>
                </div>
            </div>
            {/* Key Milestones Placeholder */}
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
                <div className="flex items-center mb-2">
                    <ClipboardListIcon className={`w-5 h-5 mr-2 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
                    <h3 className="text-md font-semibold">Key Project Milestones</h3>
                </div>
                <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Track upcoming deadlines and critical milestones across projects.</p>
                 <div className={`h-24 flex items-center justify-center border-2 border-dashed rounded-md ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                    <p className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Milestones Timeline [Coming Soon]</p>
                </div>
            </div>
        </div>
      </div>
      <OverviewPage showWelcomeMessage={false} /> 
    </div>
  );
};