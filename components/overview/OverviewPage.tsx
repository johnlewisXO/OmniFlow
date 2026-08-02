
import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { MyTasksWidget } from './MyTasksWidget';
import { ProjectStatusWidget } from './ProjectStatusWidget';
import { TeamWorkloadWidget } from './TeamWorkloadWidget';
import { KeyMilestonesWidget } from './KeyMilestonesWidget';
import { ICON_MAP } from '../../constants';

interface OverviewPageProps {
  showWelcomeMessage?: boolean; 
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ showWelcomeMessage = true }) => {
  const { currentUser, darkMode } = useAppStore();
  const ChartBarIcon = ICON_MAP.ChartBarIcon;

  if (!currentUser && showWelcomeMessage) { 
    return (
      <div className="p-6 text-center">
        <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading user data or not logged in.</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-y-auto scrollbar-thin space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      {showWelcomeMessage && currentUser && (
        <div className="flex-shrink-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Welcome back, {currentUser.full_name || currentUser.email}!</h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Here's your comprehensive Omni Flow performance & workload overview.</p>
        </div>
      )}

      {/* Row 1: My Tasks & Project Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-shrink-0">
        <MyTasksWidget />
        <ProjectStatusWidget />
      </div>

      {/* Row 2: Team Workload Overview & Key Project Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-shrink-0">
        <TeamWorkloadWidget />
        <KeyMilestonesWidget />
      </div>
    </div>
  );
};