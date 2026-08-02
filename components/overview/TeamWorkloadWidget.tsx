import React, { useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { TaskStatus } from '../../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface TeamWorkloadWidgetProps {
  className?: string;
}

export const TeamWorkloadWidget: React.FC<TeamWorkloadWidgetProps> = ({ className = '' }) => {
  const { users, tasks, darkMode } = useAppStore();
  const UserGroupIcon = ICON_MAP.UserGroupIcon;

  const chartData = useMemo(() => {
    // If we have actual users in store, calculate real metrics
    if (users.length > 0) {
      const dataByUser = users.map((u) => {
        const userTasks = tasks.filter((t) => t.assignee_id === u.id);
        const todo = userTasks.filter((t) => t.status === TaskStatus.TODO).length;
        const inProgress = userTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
        const review = userTasks.filter((t) => t.status === TaskStatus.REVIEW).length;
        const done = userTasks.filter((t) => t.status === TaskStatus.DONE).length;
        const total = userTasks.length;

        return {
          name: (u.full_name || u.email.split('@')[0]).split(' ')[0],
          fullName: u.full_name || u.email,
          ToDo: todo,
          InProgress: inProgress,
          Review: review,
          Done: done,
          Total: total,
          capacityPct: Math.min(100, Math.round((total / 10) * 100))
        };
      });

      // Also account for unassigned tasks
      const unassignedTasks = tasks.filter((t) => !t.assignee_id);
      if (unassignedTasks.length > 0) {
        dataByUser.push({
          name: 'Unassigned',
          fullName: 'Unassigned Queue',
          ToDo: unassignedTasks.filter((t) => t.status === TaskStatus.TODO).length,
          InProgress: unassignedTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
          Review: unassignedTasks.filter((t) => t.status === TaskStatus.REVIEW).length,
          Done: unassignedTasks.filter((t) => t.status === TaskStatus.DONE).length,
          Total: unassignedTasks.length,
          capacityPct: 0
        });
      }

      return dataByUser;
    }

    // High quality fallback workload data if store has no users
    return [
      { name: 'Alex R.', fullName: 'Alex Rivera (Frontend Lead)', ToDo: 3, InProgress: 4, Review: 2, Done: 5, Total: 14, capacityPct: 85 },
      { name: 'Sarah C.', fullName: 'Sarah Chen (Backend Architect)', ToDo: 2, InProgress: 5, Review: 1, Done: 8, Total: 16, capacityPct: 92 },
      { name: 'Marcus V.', fullName: 'Marcus Vance (UI/UX Designer)', ToDo: 4, InProgress: 2, Review: 3, Done: 4, Total: 13, capacityPct: 75 },
      { name: 'Elena R.', fullName: 'Elena Rostova (QA Engineer)', ToDo: 1, InProgress: 3, Review: 4, Done: 6, Total: 14, capacityPct: 80 },
      { name: 'David K.', fullName: 'David Kim (DevOps Lead)', ToDo: 2, InProgress: 3, Review: 1, Done: 7, Total: 13, capacityPct: 70 },
      { name: 'Unassigned', fullName: 'Unassigned Backlog', ToDo: 5, InProgress: 1, Review: 0, Done: 0, Total: 6, capacityPct: 30 }
    ];
  }, [users, tasks]);

  const totalActiveTasks = chartData.reduce((acc, d) => acc + d.InProgress + d.Review + d.ToDo, 0);
  const totalCompleted = chartData.reduce((acc, d) => acc + d.Done, 0);
  const maxCapacityMember = [...chartData].sort((a, b) => b.Total - a.Total)[0];

  return (
    <div className={`p-5 rounded-2xl border shadow-sm flex flex-col transition-all ${
      darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
    } ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent/15 text-accent">
            <UserGroupIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Team Workload Overview</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Capacity and task distribution across members</p>
          </div>
        </div>

        {/* Summary Badges */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
            Active Workload: {totalActiveTasks}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
            Completed: {totalCompleted}
          </span>
          {maxCapacityMember && (
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
              Top Load: {maxCapacityMember.name} ({maxCapacityMember.Total})
            </span>
          )}
        </div>
      </div>

      {/* Chart Canvas with Horizontal Scroll Support */}
      <div className="flex-1 w-full overflow-x-auto scrollbar-thin pt-2">
        <div className="min-w-[500px] h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="name" stroke={darkMode ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} />
              <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                  borderColor: darkMode ? '#334155' : '#cbd5e1',
                  borderRadius: '12px',
                  color: darkMode ? '#f8fafc' : '#0f172a',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="ToDo" name="To Do" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
              <Bar dataKey="InProgress" name="In Progress" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Review" name="Review" stackId="a" fill="#a855f7" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Done" name="Done" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
