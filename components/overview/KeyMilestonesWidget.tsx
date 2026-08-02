import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, addDays } from 'date-fns';

interface KeyMilestonesWidgetProps {
  className?: string;
}

export const KeyMilestonesWidget: React.FC<KeyMilestonesWidgetProps> = ({ className = '' }) => {
  const { projects, tasks, darkMode } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const ClipboardListIcon = ICON_MAP.ClipboardListIcon;
  const SparklesIcon = ICON_MAP.SparklesIcon;

  // Compute milestone trends and metrics
  const { chartData, milestoneCards, avgProgress } = useMemo(() => {
    // If we have projects in the store, calculate real milestone cards and metrics
    if (projects.length > 0) {
      const relevantTasks = selectedProjectId === 'all'
        ? tasks
        : tasks.filter(t => t.projectId === selectedProjectId);

      const total = relevantTasks.length;
      const doneCount = relevantTasks.filter(t => t.status === 'done').length;
      const calculatedAvg = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      // Generate trend points based on task progress
      const today = new Date();
      const points = [
        { date: format(addDays(today, -14), 'MMM d'), Progress: Math.max(0, calculatedAvg - 30), Target: 25 },
        { date: format(addDays(today, -7), 'MMM d'), Progress: Math.max(15, calculatedAvg - 15), Target: 50 },
        { date: format(today, 'MMM d'), Progress: calculatedAvg, Target: 75 },
        { date: format(addDays(today, 7), 'MMM d'), Progress: Math.min(95, calculatedAvg + 15), Target: 90 },
        { date: format(addDays(today, 14), 'MMM d'), Progress: Math.min(100, calculatedAvg + 30), Target: 100 },
      ];

      // Form milestone cards from real store projects
      const cards = (selectedProjectId === 'all' ? projects : projects.filter(p => p.id === selectedProjectId))
        .map((p, idx) => {
          const pTasks = tasks.filter(t => t.projectId === p.id);
          const pDone = pTasks.filter(t => t.status === 'done').length;
          const pTotal = Math.max(1, pTasks.length);
          const pct = Math.round((pDone / pTotal) * 100);

          return {
            id: p.id,
            name: p.name,
            phase: p.description ? (p.description.length > 30 ? p.description.substring(0, 30) + '...' : p.description) : `Phase ${idx + 1}: Execution`,
            progress: pct,
            dueDate: p.created_at ? format(addDays(new Date(p.created_at), 30), 'MMM d, yyyy') : format(addDays(new Date(), (idx + 1) * 7), 'MMM d, yyyy'),
            status: pct >= 80 ? 'On Track' : pct >= 40 ? 'In Progress' : pDone === pTotal && pTotal > 1 ? 'Completed' : 'Needs Attention'
          };
        });

      return { chartData: points, milestoneCards: cards, avgProgress: calculatedAvg };
    }

    // Fallback sample milestone dataset if no projects exist
    const today = new Date();
    const fallbackTrend = [
      { date: format(addDays(today, -14), 'MMM d'), Progress: 20, Target: 25 },
      { date: format(addDays(today, -7), 'MMM d'), Progress: 42, Target: 50 },
      { date: format(today, 'MMM d'), Progress: 68, Target: 75 },
      { date: format(addDays(today, 7), 'MMM d'), Progress: 85, Target: 90 },
      { date: format(addDays(today, 14), 'MMM d'), Progress: 100, Target: 100 },
    ];

    const fallbackMilestones = [
      { id: 'm1', name: 'Omni Flow Engine Core', phase: 'Phase 1: Architecture & Auth', progress: 100, dueDate: format(addDays(today, 2), 'MMM d, yyyy'), status: 'Completed' },
      { id: 'm2', name: 'Task Triggers & Rules', phase: 'Phase 2: Automation Rules Engine', progress: 85, dueDate: format(addDays(today, 5), 'MMM d, yyyy'), status: 'On Track' },
      { id: 'm3', name: 'Gantt & List View Enhancements', phase: 'Phase 3: Interactive Drag & Drop', progress: 65, dueDate: format(addDays(today, 10), 'MMM d, yyyy'), status: 'In Progress' },
      { id: 'm4', name: 'Final Production Deployment', phase: 'Phase 4: QA & Security Audit', progress: 30, dueDate: format(addDays(today, 18), 'MMM d, yyyy'), status: 'Upcoming' }
    ];

    return { chartData: fallbackTrend, milestoneCards: fallbackMilestones, avgProgress: 70 };
  }, [projects, tasks, selectedProjectId]);

  return (
    <div className={`p-5 rounded-2xl border shadow-sm flex flex-col transition-all ${
      darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
    } ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
            <ClipboardListIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Key Project Milestones
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                {avgProgress}% Velocity
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Milestone completion curve and timeline progress</p>
          </div>
        </div>

        {/* Project Selector Filter */}
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className={`text-xs rounded-lg px-2.5 py-1.5 border font-semibold outline-hidden transition-all ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700'
              }`}
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Recharts Area Curve with Horizontal Scroll */}
      <div className="w-full overflow-x-auto scrollbar-thin pt-1">
        <div className="min-w-[500px] h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="date" stroke={darkMode ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} />
              <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                  borderColor: darkMode ? '#334155' : '#cbd5e1',
                  borderRadius: '12px',
                  color: darkMode ? '#f8fafc' : '#0f172a',
                }}
              />
              <Area type="monotone" dataKey="Progress" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorProgress)" name="Progress %" />
              <Area type="monotone" dataKey="Target" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" fillOpacity={0} name="Target Pace" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Milestone Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        {milestoneCards.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
              darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/80'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                  {m.phase}
                </span>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {m.name}
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                m.status === 'Completed' || m.status === 'On Track'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : m.status === 'In Progress'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}>
                {m.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>Due: {m.dueDate}</span>
                <span>{m.progress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    m.progress >= 80 ? 'bg-emerald-500' : m.progress >= 50 ? 'bg-purple-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${m.progress}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
