import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { OverviewPage } from '../overview/OverviewPage';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { SystemLogMonitorPanel } from '../shared/SystemLogMonitorModal';
import { PendingJoinRequestsBanner } from '../team/PendingJoinRequestsBanner';

export const ProjectManagerDashboard: React.FC = () => {
  const { currentUser, darkMode, openCreateProjectModal, projects, setActiveProject, setActiveView } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry'>('overview');

  const handleViewProjectKanban = (projectId: string) => {
    setActiveProject(projectId);
    setActiveView('kanban');
  };

  const managedProjects = projects.filter(
    p => p.owner_id === currentUser?.id || p.organization_id === currentUser?.organization_id
  );

  return (
    <div className={`flex flex-col p-4 md:p-6 space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Project Manager Dashboard</h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Oversee projects, manage team roles & capacity, and monitor live platform telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Portfolio & Delivery
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'telemetry'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Exception & Console Logs
            </button>
          </div>

          <Button onClick={openCreateProjectModal} variant="primary" size="sm">
            <ICON_MAP.PlusIcon className="w-4 h-4 mr-1.5" />
            New Project
          </Button>
        </div>
      </div>

      <PendingJoinRequestsBanner />

      {activeTab === 'telemetry' ? (
        <SystemLogMonitorPanel />
      ) : (
        <>
          {managedProjects.length > 0 && (
            <div
              className={`p-4 rounded-xl ${
                darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'
              } border ${darkMode ? 'border-slate-700/50' : 'border-slate-200'}`}
            >
              <h2 className="text-sm font-bold mb-3 uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Managed Projects ({managedProjects.length})
              </h2>
              <div className="space-y-2">
                {managedProjects.map(p => (
                  <div
                    key={p.id}
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                      darkMode
                        ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate font-semibold text-sm">{p.name}</span>
                    <Button size="sm" variant="outline" onClick={() => handleViewProjectKanban(p.id)}>
                      View Board
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <OverviewPage showWelcomeMessage={false} />
          </div>
        </>
      )}
    </div>
  );
};
