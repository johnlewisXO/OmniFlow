
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';

export const InboxPage: React.FC = () => {
  const { darkMode } = useAppStore();
  const InboxIcon = ICON_MAP.InboxIcon;

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="flex items-center mb-6">
        <InboxIcon className={`w-8 h-8 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
        <h1 className="text-2xl md:text-3xl font-semibold">Inbox</h1>
      </div>
      
      <div className={`text-center py-20 p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100/70'} border ${darkMode ? 'border-slate-700/50' : 'border-white/30'}`}>
        <InboxIcon className={`w-24 h-24 mx-auto mb-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'} opacity-70`} />
        <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>All Caught Up!</h2>
        <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-2 max-w-md mx-auto`}>
          Your inbox is currently empty. Notifications about mentions, task assignments, and project updates will appear here.
        </p>
        <p className={`mt-1 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>(Inbox feature coming soon)</p>
      </div>
    </div>
  );
};