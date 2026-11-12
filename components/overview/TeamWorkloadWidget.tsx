import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { TaskStatus } from '../../types';
import { Avatar } from '../shared/Avatar';
import { HairlineCard, SegmentedTabs, StatusDot } from '../shared/EditorialUI';
import { SlimProgressBar, getEditorialChartTheme } from '../charts/EditorialCharts';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface TeamWorkloadWidgetProps {
  className?: string;
}

export const TeamWorkloadWidget: React.FC<TeamWorkloadWidgetProps> = ({ className = '' }) => {
  const { users, tasks, darkMode, currentUser } = useAppStore();
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const chartTheme = getEditorialChartTheme(darkMode);

  const memberRows = useMemo(() => {
    const directory = users.length > 0 ? users : currentUser ? [currentUser] : [];
    return directory.map(u => {
      const userTasks = tasks.filter(t => t.assignee_id === u.id);
      const todo = userTasks.filter(t => t.status === TaskStatus.TODO).length;
      const inProgress = userTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
      const review = userTasks.filter(t => t.status === TaskStatus.REVIEW).length;
      const done = userTasks.filter(t => t.status === TaskStatus.DONE).length;
      const openCount = todo + inProgress + review;
      const workloadPct = Math.min(100, Math.round((openCount / 8) * 100));

      return {
        user: u,
        name: (u.full_name || u.email.split('@')[0]).split(' ')[0],
        fullName: u.full_name || u.email,
        role: (u.role || 'MEMBER').replace(/_/g, ' '),
        ToDo: todo,
        InProgress: inProgress,
        Review: review,
        Done: done,
        openCount,
        workloadPct,
        availability: workloadPct >= 85 ? 'Busy' : 'Available',
      };
    });
  }, [users, tasks, currentUser]);

  return (
    <HairlineCard padding="none" className={className}>
      <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Team Allocation</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Active task capacity across {memberRows.length} team member{memberRows.length === 1 ? '' : 's'}
          </p>
        </div>

        <SegmentedTabs
          size="sm"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { id: 'table', label: 'Allocation Bars' },
            { id: 'chart', label: 'Breakdown Chart' },
          ]}
        />
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-muted)]">
                <th className="py-2.5 px-4 sm:px-5">Member</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 w-48">Workload</th>
                <th className="py-2.5 px-3 text-right">Open</th>
                <th className="py-2.5 px-4 sm:px-5 text-right">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)] text-xs">
              {memberRows.map(row => (
                <tr key={row.user.id} className="hover:bg-[var(--bg-surface-subtle)] transition-colors">
                  <td className="py-3 px-4 sm:px-5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar user={row.user} size="xs" disableHoverCard />
                      <span className="font-semibold text-[var(--text-primary)] truncate">
                        {row.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-secondary)] capitalize whitespace-nowrap">
                    {row.role.toLowerCase()}
                  </td>
                  <td className="py-3 px-3">
                    <SlimProgressBar
                      value={row.workloadPct}
                      tone={row.workloadPct >= 85 ? 'warning' : 'charcoal'}
                      showPercent
                    />
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-[var(--text-primary)]">
                    {row.openCount}
                  </td>
                  <td className="py-3 px-4 sm:px-5 text-right">
                    <StatusDot
                      tone={row.availability === 'Available' ? 'lime' : 'neutral'}
                      label={row.availability}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 sm:p-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={memberRows} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
              <XAxis dataKey="name" stroke={chartTheme.axisColor} tick={{ fontSize: 11 }} />
              <YAxis stroke={chartTheme.axisColor} tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTheme.tooltipStyle} />
              <Bar dataKey="ToDo" name="To Do" stackId="a" fill={chartTheme.series.muted} maxBarSize={30} />
              <Bar dataKey="InProgress" name="In Progress" stackId="a" fill={chartTheme.series.sage} maxBarSize={30} />
              <Bar dataKey="Review" name="Review" stackId="a" fill={chartTheme.series.lime} maxBarSize={30} />
              <Bar dataKey="Done" name="Done" stackId="a" fill={chartTheme.series.charcoal} radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </HairlineCard>
  );
};
