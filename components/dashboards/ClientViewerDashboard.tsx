
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';

export const ClientViewerDashboard: React.FC = () => {
  const { currentUser, darkMode, projects, tasks } = useAppStore(); // tasks unused currently
  const EyeIcon = ICON_MAP.InboxIcon; // Placeholder
  const ChartBarIcon = ICON_MAP.ChartBarIcon; // For timeline/gantt

  // This filtering logic is a placeholder. Real implementation needs a proper sharing mechanism.
  // For now, let's assume clients might see all projects if no specific sharing is implemented.
  // Or, if you want to simulate, filter by a known project ID or a flag on the project.
  const sharedProjects = projects; // Placeholder: shows all projects. Adapt if sharing logic exists.
  
  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Project Viewer Dashboard</h1>
        <p className={`text-md ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>View progress on projects shared with you.</p>
      </div>

      {/* Shared Projects Summaries Placeholder */}
      <div className={`mb-8 p-4 md:p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
        <div className="flex items-center mb-4"> {/* Ensured correct className usage */}
          <EyeIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
          <h2 className="text-xl font-semibold">Shared Project Summaries</h2>
        </div>
        {sharedProjects.length > 0 ? (
            <ul className="space-y-3">
                {sharedProjects.map(p => (
                    <li key={p.id} className={`p-3 rounded-md ${darkMode ? 'bg-slate-700/60' : 'bg-slate-50/80'} border ${darkMode ? 'border-slate-600/40' : 'border-slate-200/50'}`}>
                        <h3 className={`text-md font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{p.name}</h3>
                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Status: {p.status}</p>
                        {p.progress !== undefined && (
                            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 mt-2">
                                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${p.progress}%` }}></div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        ) : (
             <div className={`mt-4 h-32 flex items-center justify-center border-2 border-dashed rounded-md ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                <p className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No projects currently shared with you or data is loading.</p>
            </div>
        )}
      </div>
      
      {/* Read-only Gantt/Timeline Placeholder */}
      <div className={`p-4 md:p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
        <div className="flex items-center mb-4"> {/* Ensured correct className usage */}
          <ChartBarIcon className={`w-6 h-6 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
          <h2 className="text-xl font-semibold">Project Timelines (Read-Only)</h2>
        </div>
        <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Interactive Gantt charts or timeline views for shared projects will be displayed here, providing a visual overview of schedules and progress. (Coming Soon)
        </p>
        <div className={`h-48 flex items-center justify-center border-2 border-dashed rounded-md ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
            <p className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gantt/Timeline Chart Area [Coming Soon]</p>
        </div>
      </div>
    </div>
  );
};