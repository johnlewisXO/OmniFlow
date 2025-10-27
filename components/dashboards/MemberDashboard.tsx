
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { MyTasksWidget } from '../overview/MyTasksWidget'; 
import { ProjectStatusWidget } from '../overview/ProjectStatusWidget'; 
import { ICON_MAP } from '../../constants';

export const MemberDashboard: React.FC = () => {
  const { currentUser, darkMode } = useAppStore();
  const ChartBarIcon = ICON_MAP.ChartBarIcon; // Example for activity

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">My Dashboard</h1>
        <p className={`text-md ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your tasks, project updates, and contributions.</p>
      </div>
      
      <div className="mb-8">
        <MyTasksWidget /> 
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <ProjectStatusWidget /> {/* Shows general project statuses they might be involved in */}
        
        {/* Recent Activity Placeholder */}
        <div className={`p-4 md:p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
          <div className="flex items-center mb-4">
            <ChartBarIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
            <h2 className="text-xl font-semibold">My Recent Activity</h2>
          </div>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Updates on tasks you've worked on, comments mentioning you, and other relevant project activities will appear here. (Coming Soon)
          </p>
          <div className={`mt-4 h-32 flex items-center justify-center border-2 border-dashed rounded-md ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
              <p className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Activity Feed [Coming Soon]</p>
          </div>
        </div>
      </div>
    </div>
  );
};