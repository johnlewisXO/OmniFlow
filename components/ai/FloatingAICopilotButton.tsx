import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import geminiService from '../../services/geminiService';

export const FloatingAICopilotButton: React.FC = () => {
  const {
    projects,
    tasks,
    sprints,
    users,
    openCommandPalette,
    setActiveView,
    activeView,
    darkMode,
  } = useAppStore();

  const report = React.useMemo(() => {
    return geminiService.computeWorkspaceInsights(projects, tasks, sprints, users);
  }, [projects, tasks, sprints, users]);

  const criticalCount = report.insights.filter(i => i.severity === 'critical').length;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
      {activeView !== 'ai_copilot_view' && (
        <button
          onClick={() => setActiveView('ai_copilot_view')}
          title="Open AI Project Manager Studio"
          className={`hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold shadow-lg transition-all cursor-pointer ${
            darkMode
              ? 'bg-slate-900/95 border-slate-700 text-slate-200 hover:border-indigo-500'
              : 'bg-white/95 border-slate-200 text-slate-800 hover:border-indigo-400'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              criticalCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`}
          />
          <span className="font-mono tabular-nums">Health {report.healthScore}%</span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="text-indigo-600 dark:text-indigo-400">AI PM Studio</span>
        </button>
      )}

      <button
        onClick={openCommandPalette}
        title="Open AI Command Centre (Ctrl+K / Cmd+K)"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xl shadow-indigo-600/25 transition-all cursor-pointer"
      >
        <ICON_MAP.SparklesIcon className="w-4 h-4 text-amber-300" />
        <span>AI Co-Pilot</span>
        <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-indigo-700/80 text-indigo-100 rounded">
          ⌘K
        </kbd>
      </button>
    </div>
  );
};
