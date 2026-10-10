import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { OverviewPage } from '../overview/OverviewPage';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { SystemLogMonitorPanel } from '../shared/SystemLogMonitorModal';
import { PendingJoinRequestsBanner } from '../team/PendingJoinRequestsBanner';
import soundService from '../../services/soundService';

export const ProjectManagerDashboard: React.FC = () => {
  const { currentUser, darkMode, openCreateProjectModal, projects, setActiveProject, setActiveView } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry'>('overview');

  const handleViewProjectKanban = (projectId: string) => {
    soundService.play('click_soft');
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
            Task Overview, Concentric Project Status, Meet Schedule, and Sprint Delivery Control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-full bg-slate-200/70 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                soundService.play('click_soft');
                setActiveTab('overview');
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Portfolio &amp; Delivery
            </button>
            <button
              type="button"
              onClick={() => {
                soundService.play('click_soft');
                setActiveTab('telemetry');
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'telemetry'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Exception &amp; Console Logs
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
          {/* 1. Primary Task Overview, Project Status Rings, Meet Schedule & Calendar Hub at the TOP */}
          <div>
            <OverviewPage showWelcomeMessage={false} />
          </div>

          {/* 2. Active Managed Projects Quick-Jump Grid */}
          {managedProjects.length > 0 && (
            <div
              className={`p-5 rounded-[32px] ${
                darkMode ? 'bg-slate-900/75 border-white/10' : 'bg-white/88 border-white shadow-sm'
              } border`}
            >
              <h2 className="text-xs font-bold mb-3 uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Managed Projects ({managedProjects.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {managedProjects.map(p => (
                  <div
                    key={p.id}
                    className={`flex justify-between items-center p-3.5 rounded-[24px] border transition-all ${
                      darkMode
                        ? 'bg-slate-800/75 border-white/[0.08] hover:bg-slate-800'
                        : 'bg-slate-50/90 border-slate-200/70 hover:bg-white'
                    }`}
                  >
                    <span className="truncate font-bold text-sm">{p.name}</span>
                    <Button size="sm" variant="outline" onClick={() => handleViewProjectKanban(p.id)}>
                      View Board
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
