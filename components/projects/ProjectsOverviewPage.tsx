
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';

export const ProjectsOverviewPage: React.FC = () => {
  const { projects, isLoadingProjects, projectsError, setActiveProject, openCreateProjectModal, darkMode } = useAppStore();
  const FolderIcon = ICON_MAP.FolderIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Projects</h1>
        <Button onClick={openCreateProjectModal} variant="primary" size="md">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Project
        </Button>
      </div>

      {isLoadingProjects && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`p-6 rounded-xl border shadow-sm animate-pulse ${darkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white/50 border-slate-200/50'}`}>
              <div className="flex items-center mb-4">
                <div className={`w-8 h-8 rounded-md mr-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                <div className={`h-5 w-32 rounded ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              </div>
              <div className={`h-4 w-24 rounded mb-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className={`h-3 w-full rounded mb-1 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className={`h-3 w-2/3 rounded mb-4 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className={`h-2 w-full rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            </div>
          ))}
        </div>
      )}

      {projectsError && !isLoadingProjects && (
        <div className={`text-center p-6 rounded-lg ${darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-100/80 border-red-300'} border shadow-md`}>
          <ExclamationIcon className={`w-12 h-12 mx-auto mb-4 text-red-500 dark:text-red-400`} />
          <h2 className={`text-xl font-semibold text-red-700 dark:text-red-300`}>Error Loading Projects</h2>
          <p className={`text-red-600 dark:text-red-400 mt-1`}>{projectsError}</p>
        </div>
      )}

      {!isLoadingProjects && !projectsError && projects.length === 0 && (
        <div className="text-center py-10">
          <FolderIcon className={`w-20 h-20 mx-auto mb-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'} opacity-70`} />
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>No Projects Found</h2>
          <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
            Get started by creating your first project.
          </p>
        </div>
      )}

      {!isLoadingProjects && !projectsError && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {projects.map(project => (
            <div 
              key={project.id} 
              className={`p-6 rounded-xl cursor-pointer transition-all duration-300 ease-in-out
                         ${darkMode ? 'bg-slate-800/60 hover:bg-slate-700/80 border-slate-700/50' 
                                   : 'bg-white/70 hover:bg-slate-50/90 border-slate-200/70'} 
                         border shadow-lg hover:shadow-xl`}
              onClick={() => setActiveProject(project.id)}
            >
              <div className="flex items-center mb-3">
                <FolderIcon className={`w-7 h-7 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
                <h3 className={`text-lg font-semibold truncate ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{project.name}</h3>
              </div>
              <p className={`text-sm mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Status: <span className="font-medium">{project.status}</span></p>
              {project.description && <p className={`text-xs mb-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'} truncate-2-lines`}>{project.description}</p>}
               {project.progress !== undefined && (
                  <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-1">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${project.progress}%` }}
                      title={`${project.progress}% complete`}
                    ></div>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};