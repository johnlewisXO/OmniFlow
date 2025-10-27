
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';

export const ReportsPage: React.FC = () => {
  const { darkMode } = useAppStore();
  const ChartBarIcon = ICON_MAP.ChartBarIcon;

  const reportPlaceholders = [
    { title: "Project Completion Rate", description: "Track how many projects are completed on time versus overdue." },
    { title: "Task Status Distribution", description: "Visualize the spread of tasks across different statuses (To Do, In Progress, Done)." },
    { title: "Team Workload & Capacity", description: "Understand task distribution among team members and identify potential bottlenecks." },
    { title: "Burn Down/Up Charts", description: "Monitor progress against planned work over time for sprints or projects." },
  ];

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="flex items-center mb-6">
        <ChartBarIcon className={`w-8 h-8 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
        <h1 className="text-2xl md:text-3xl font-semibold">Reports & Analytics</h1>
      </div>
      
       <div className={`p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'} mb-8`}>
        <h2 className={`text-xl font-semibold mb-3 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Coming Soon: Powerful Insights</h2>
        <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} text-sm`}>
          Our advanced reporting features are under development. Soon, you'll be able to generate detailed reports on project performance, team productivity, resource allocation, and much more to make data-driven decisions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {reportPlaceholders.map(report => (
          <div key={report.title} className={`p-4 rounded-lg shadow-md ${darkMode ? 'bg-slate-700/70 border-slate-600/50' : 'bg-white/80 border-slate-200/60'} border`}>
            <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{report.title}</h3>
            <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{report.description}</p>
            <div className={`h-32 flex items-center justify-center border-2 border-dashed rounded-md ${darkMode ? 'border-slate-600' : 'border-slate-300'}`}>
              <p className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Chart/Data Placeholder</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};