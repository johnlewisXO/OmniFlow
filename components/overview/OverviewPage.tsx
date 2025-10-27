
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { MyTasksWidget } from './MyTasksWidget';
import { ProjectStatusWidget } from './ProjectStatusWidget';
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
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      {showWelcomeMessage && currentUser && (
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold">Welcome back, {currentUser.full_name || currentUser.email}!</h1>
          <p className={`text-md ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Here's a quick look at your Omni Flow dashboard.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <MyTasksWidget />
        <ProjectStatusWidget />
      </div>

      <div className={`mt-8 p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
        <div className="flex items-center mb-4">
          <ChartBarIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
          <h2 className="text-xl font-semibold">Activity Feed & Analytics</h2>
        </div>
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Detailed activity logs and comprehensive analytics charts will be available here soon.
          Stay tuned for more insights into your team's productivity and project progress! (Preview)
        </p>
        <div className="mt-4 h-48 flex items-center justify-center border-2 border-dashed rounded-md ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
            <p className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Chart/Feed Area [Coming Soon]</p>
        </div>
      </div>
    </div>
  );
};