import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Task, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button';
import { getUserProfileExtensions } from '../../services/supabaseService';
import { PageHeader, InlineKpiStrip, HairlineCard, StatusDot } from '../shared/EditorialUI';
import { SlimProgressBar } from '../charts/EditorialCharts';

interface WorklogRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId?: string;
  userId: string;
  userName: string;
  durationSeconds: number;
  durationMinutes: number;
  hours: number;
  loggedAt: string;
}

const formatSecondsToHMS = (totalSecs: number): string => {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':');
};

export const WorkloadCapacityPage: React.FC = () => {
  const {
    users,
    tasks,
    currentUser,
    activeTimer,
    startTaskTimer,
    pauseTaskTimer,
    resumeTaskTimer,
    stopAndLogTaskTimer,
    updateTask,
    openViewTaskModal,
    addToast,
  } = useAppStore();

  const [timerTick, setTimerTick] = useState(0);
  const [selectedTaskForTimer, setSelectedTaskForTimer] = useState<string>('');
  const [worklogs, setWorklogs] = useState<WorklogRecord[]>([]);

  useEffect(() => {
    const loadWorklogs = () => {
      try {
        const raw = localStorage.getItem('omni_task_worklogs');
        setWorklogs(raw ? JSON.parse(raw) : []);
      } catch {
        setWorklogs([]);
      }
    };
    loadWorklogs();
    window.addEventListener('omni_worklogs_updated', loadWorklogs);
    return () => window.removeEventListener('omni_worklogs_updated', loadWorklogs);
  }, []);

  useEffect(() => {
    if (!activeTimer?.isRunning) return;
    const t = setInterval(() => setTimerTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [activeTimer?.isRunning]);

  const liveElapsedSeconds = useMemo(() => {
    if (!activeTimer) return 0;
    const runningDelta = activeTimer.isRunning
      ? Math.max(0, Math.floor((Date.now() - activeTimer.startedAt) / 1000))
      : 0;
    return activeTimer.accumulatedSeconds + runningDelta;
  }, [activeTimer, timerTick]);

  const activeTasksForTimer = useMemo(
    () => tasks.filter(t => t.status !== TaskStatus.DONE),
    [tasks]
  );

  const memberWorkloads = useMemo(() => {
    const directory = users.length > 0 ? users : currentUser ? [currentUser] : [];
    return directory.map(member => {
      const ext = getUserProfileExtensions(member.id);
      const weeklyCapacityHours = ext.preferences?.weeklyCapacityHours || member.preferences?.weeklyCapacityHours || 40;
      const memberTasks = tasks.filter(t => t.assignee_id === member.id && t.status !== TaskStatus.DONE);
      const completedTasks = tasks.filter(t => t.assignee_id === member.id && t.status === TaskStatus.DONE);
      const storyPoints = memberTasks.reduce((sum, t) => sum + (t.story_points || 3), 0);
      const loggedHours = worklogs
        .filter(w => w.userId === member.id)
        .reduce((sum, w) => sum + (w.hours || 0), 0);
      const estimatedActiveHours = Number((storyPoints * 3.2 + loggedHours).toFixed(1));
      const utilizationPct = Math.round((estimatedActiveHours / Math.max(1, weeklyCapacityHours)) * 100);

      const status: 'optimal' | 'near_capacity' | 'overloaded' =
        utilizationPct > 100 ? 'overloaded' : utilizationPct >= 80 ? 'near_capacity' : 'optimal';

      return {
        member,
        weeklyCapacityHours,
        memberTasks,
        completedCount: completedTasks.length,
        storyPoints,
        loggedHours: Number(loggedHours.toFixed(1)),
        estimatedActiveHours,
        utilizationPct,
        status,
      };
    });
  }, [users, currentUser, tasks, worklogs]);

  const totalLoggedHours = useMemo(
    () => Number(worklogs.reduce((sum, w) => sum + (w.hours || 0), 0).toFixed(1)),
    [worklogs]
  );

  const overloadedCount = useMemo(
    () => memberWorkloads.filter(m => m.status === 'overloaded').length,
    [memberWorkloads]
  );

  const avgUtilization = useMemo(() => {
    if (memberWorkloads.length === 0) return 0;
    return Math.round(
      memberWorkloads.reduce((sum, m) => sum + m.utilizationPct, 0) / memberWorkloads.length
    );
  }, [memberWorkloads]);

  const handleQuickReassign = async (task: Task, newAssigneeId: string) => {
    if (!newAssigneeId || task.assignee_id === newAssigneeId) return;
    const targetUser = users.find(u => u.id === newAssigneeId);
    await updateTask(task.id, { assignee_id: newAssigneeId });
    addToast(
      'Workload Rebalanced',
      `Reassigned "${task.title}" to ${targetUser?.full_name || targetUser?.email || 'teammate'}.`,
      'success',
      { entity_type: 'task', entity_id: task.id }
    );
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-5 max-w-[1440px] mx-auto w-full text-[var(--text-primary)]">
      <PageHeader
        eyebrow="Resource Capacity · Focus Telemetry"
        title="Team Workload & Time Tracking"
        subtitle="Balance weekly engineering capacity across active deliverables and log live focus hours directly to sprint tasks."
      />

      <InlineKpiStrip
        items={[
          {
            id: 'members',
            label: 'Active Contributors',
            value: memberWorkloads.length,
            sublabel: 'Tracked seats',
            tone: 'default',
          },
          {
            id: 'utilization',
            label: 'Avg Capacity Load',
            value: `${avgUtilization}%`,
            sublabel: 'Weekly allocation',
            tone: avgUtilization > 90 ? 'warning' : 'lime',
          },
          {
            id: 'hours',
            label: 'Focus Hours Logged',
            value: `${totalLoggedHours}h`,
            sublabel: `${worklogs.length} sessions`,
            tone: 'success',
          },
          {
            id: 'overloaded',
            label: 'Overloaded Members',
            value: overloadedCount,
            sublabel: overloadedCount > 0 ? 'Needs rebalancing' : 'Healthy balance',
            tone: overloadedCount > 0 ? 'danger' : 'success',
          },
        ]}
      />

      {/* Live Focus Timer Deck */}
      <HairlineCard className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <ICON_MAP.PlayIcon className="w-3.5 h-3.5 text-[#6F8254] dark:text-[var(--accent-lime)]" />
            <span>Active Deep-Work Focus Session</span>
          </div>
          {activeTimer ? (
            <>
              <h2 className="text-base sm:text-lg font-bold truncate">
                Timing: {activeTimer.taskTitle}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Syncs across the workspace header and writes directly to task worklogs upon completion.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base sm:text-lg font-bold">Start a Focus Timer on Any Active Task</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Starting a timer on a To-Do task automatically transitions it to In Progress.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTimer ? (
            <>
              <div className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sage)] font-mono text-xl sm:text-2xl font-bold tabular-nums tracking-wider text-[var(--text-primary)]">
                {formatSecondsToHMS(liveElapsedSeconds)}
              </div>

              {activeTimer.isRunning ? (
                <Button variant="outline" size="sm" onClick={pauseTaskTimer}>
                  Pause
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={resumeTaskTimer}>
                  Resume
                </Button>
              )}

              <Button variant="lime" size="sm" onClick={stopAndLogTaskTimer}>
                <ICON_MAP.CheckCircleIcon className="w-4 h-4 mr-1.5" />
                Stop & Log Hours
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedTaskForTimer}
                onChange={e => setSelectedTaskForTimer(e.target.value)}
                className="px-3.5 py-2 text-xs font-medium min-w-[230px]"
              >
                <option value="">Select a task to start timing...</option>
                {activeTasksForTimer.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({String(t.status).replace(/_/g, ' ')})
                  </option>
                ))}
              </select>

              <Button
                variant="lime"
                size="sm"
                disabled={!selectedTaskForTimer && activeTasksForTimer.length === 0}
                onClick={() => {
                  const target =
                    activeTasksForTimer.find(t => t.id === selectedTaskForTimer) ||
                    activeTasksForTimer[0];
                  if (target) startTaskTimer(target);
                }}
              >
                <ICON_MAP.PlayIcon className="w-4 h-4 mr-1.5" />
                Start Focus Timer
              </Button>
            </div>
          )}
        </div>
      </HairlineCard>

      {/* Team Allocation Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Weekly Allocation & Load Balancing</h2>
          <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
            {memberWorkloads.length} active members
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memberWorkloads.map(row => {
            const tone: 'danger' | 'warning' | 'success' =
              row.status === 'overloaded'
                ? 'danger'
                : row.status === 'near_capacity'
                ? 'warning'
                : 'success';
            const barTone: 'danger' | 'warning' | 'sage' =
              row.status === 'overloaded'
                ? 'danger'
                : row.status === 'near_capacity'
                ? 'warning'
                : 'sage';
            const statusText =
              row.status === 'overloaded'
                ? 'Overloaded'
                : row.status === 'near_capacity'
                ? 'Near Capacity'
                : 'Optimal Load';

            return (
              <HairlineCard key={row.member.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={row.member} size="md" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate">
                        {row.member.full_name || row.member.email}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {row.memberTasks.length} active tasks · {row.storyPoints} pts · {row.loggedHours}h logged
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-0.5">
                    <span className="text-sm font-bold font-mono tabular-nums">
                      {row.estimatedActiveHours}h / {row.weeklyCapacityHours}h
                    </span>
                    <div className="flex justify-end">
                      <StatusDot tone={tone} label={`${statusText} · ${row.utilizationPct}%`} />
                    </div>
                  </div>
                </div>

                <SlimProgressBar value={row.utilizationPct} tone={barTone} heightClass="h-1.5" />

                {row.memberTasks.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {row.memberTasks.slice(0, 3).map(t => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => openViewTaskModal(t.id)}
                          className="font-medium truncate text-left hover:underline cursor-pointer flex-1"
                        >
                          {t.title}
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => startTaskTimer(t)}
                            className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-[var(--bg-sage)] hover:bg-[var(--accent-lime)] hover:text-[var(--accent-ink)] text-[var(--text-primary)] transition-colors cursor-pointer"
                            title="Start Focus Timer on this task"
                          >
                            ⏱ Timer
                          </button>
                          {users.length > 1 && (
                            <select
                              value={t.assignee_id || ''}
                              onChange={e => handleQuickReassign(t, e.target.value)}
                              className="px-2 py-0.5 text-[11px]"
                              title="Rebalance / Reassign task"
                            >
                              {users.map(u => (
                                <option key={u.id} value={u.id}>
                                  → {(u.full_name || u.email).split(' ')[0]}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic">No active open tasks assigned.</p>
                )}
              </HairlineCard>
            );
          })}
        </div>
      </div>

      {/* Recent Logged Worklog Sessions */}
      {worklogs.length > 0 && (
        <HairlineCard className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Recent Focus Worklog Ledger</h3>
            <span className="text-xs font-mono text-[var(--text-muted)]">{worklogs.length} total entries</span>
          </div>
          <div className="divide-y divide-[var(--border-hairline)]">
            {worklogs.slice(0, 6).map(log => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-[var(--text-primary)]">{log.taskTitle}</span>
                  <span className="text-[var(--text-secondary)]"> · Logged by {log.userName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    +{log.durationMinutes}m ({log.hours}h)
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </HairlineCard>
      )}
    </div>
  );
};
