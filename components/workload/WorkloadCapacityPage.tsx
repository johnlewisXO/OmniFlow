import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Task, TaskStatus, User } from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button';
import { getUserProfileExtensions } from '../../services/supabaseService';

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
    darkMode,
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

  // Compute per-member workload & weekly capacity utilization
  const memberWorkloads = useMemo(() => {
    const directory = users.length > 0 ? users : currentUser ? [currentUser] : [];
    return directory.map(member => {
      const ext = getUserProfileExtensions(member.id);
      const weeklyCapacityHours = ext.preferences?.weeklyCapacityHours || member.preferences?.weeklyCapacityHours || 40;
      const memberTasks = tasks.filter(t => t.assignee_id === member.id && t.status !== TaskStatus.DONE);
      const completedTasks = tasks.filter(t => t.assignee_id === member.id && t.status === TaskStatus.DONE);
      const storyPoints = memberTasks.reduce((sum, t) => sum + (t.story_points || 3), 0);
      // Estimate 3.5 hours per story point + logged hours
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
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent mb-1">
            <ICON_MAP.ClockIcon className="w-4 h-4" />
            <span>Time Tracking & Resource Capacity Planner</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Team Workload Heatmap & Live Focus Timer
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Monitor weekly engineering capacity, prevent burnout, and log real-time focus hours directly to sprint tasks.
          </p>
        </div>
      </div>

      {/* Live Focus Timer Deck */}
      <div
        className={`rounded-[28px] border p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 ${
          darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200/80'
        }`}
      >
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <ICON_MAP.PlayIcon className="w-3.5 h-3.5" />
            <span>Active Deep-Work Focus Session</span>
          </div>
          {activeTimer ? (
            <>
              <h2 className="text-base sm:text-lg font-bold truncate">
                Timing: {activeTimer.taskTitle}
              </h2>
              <p className="text-xs text-slate-400">
                Session automatically syncs across the top header bar and logs directly to task worklogs.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base sm:text-lg font-bold">Start a Focus Timer on Any Active Task</h2>
              <p className="text-xs text-slate-400">
                Starting a timer on a To-Do task automatically transitions it to In Progress.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTimer ? (
            <>
              <div
                className={`px-4 py-2 rounded-2xl border font-mono text-xl sm:text-2xl font-bold tabular-nums tracking-wider ${
                  darkMode ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-900 text-emerald-400 border-slate-800'
                }`}
              >
                {formatSecondsToHMS(liveElapsedSeconds)}
              </div>

              {activeTimer.isRunning ? (
                <Button variant="outline" size="sm" onClick={pauseTaskTimer}>
                  Pause Timer
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={resumeTaskTimer}>
                  Resume Timer
                </Button>
              )}

              <Button variant="primary" size="sm" onClick={stopAndLogTaskTimer}>
                <ICON_MAP.CheckCircleIcon className="w-4 h-4 mr-1.5" />
                Stop & Log Hours
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedTaskForTimer}
                onChange={e => setSelectedTaskForTimer(e.target.value)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold outline-none min-w-[220px] ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="">Select a task to start timing...</option>
                {activeTasksForTimer.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({String(t.status).replace(/_/g, ' ')})
                  </option>
                ))}
              </select>

              <Button
                variant="primary"
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
      </div>

      {/* Team Capacity Heatmap Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Team Weekly Capacity & Burnout Heatmap</h2>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            {memberWorkloads.length} active members
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memberWorkloads.map(row => {
            const barColor =
              row.status === 'overloaded'
                ? 'bg-red-500'
                : row.status === 'near_capacity'
                ? 'bg-amber-500'
                : 'bg-emerald-500';
            const statusText =
              row.status === 'overloaded'
                ? 'Overloaded (>100%)'
                : row.status === 'near_capacity'
                ? 'Near Capacity'
                : 'Optimal Load';

            return (
              <div
                key={row.member.id}
                className={`rounded-[26px] border p-5 space-y-4 ${
                  darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={row.member} size="md" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate">
                        {row.member.full_name || row.member.email}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {row.memberTasks.length} active tasks · {row.storyPoints} pts · {row.loggedHours}h logged
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold font-mono tabular-nums">
                      {row.estimatedActiveHours}h / {row.weeklyCapacityHours}h
                    </span>
                    <span
                      className={`block text-[11px] font-semibold ${
                        row.status === 'overloaded'
                          ? 'text-red-500'
                          : row.status === 'near_capacity'
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                      }`}
                    >
                      {statusText} ({row.utilizationPct}%)
                    </span>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(100, row.utilizationPct)}%` }}
                  />
                </div>

                {/* Assigned Tasks with 1-Click Reassign & Timer Start */}
                {row.memberTasks.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {row.memberTasks.slice(0, 3).map(t => (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                          darkMode ? 'bg-slate-800/50 border-slate-700/70' : 'bg-slate-50 border-slate-200/70'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openViewTaskModal(t.id)}
                          className="font-medium truncate text-left hover:text-accent cursor-pointer flex-1"
                        >
                          {t.title}
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => startTaskTimer(t)}
                            className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-accent/15 text-accent hover:bg-accent hover:text-white transition-all cursor-pointer"
                            title="Start Focus Timer on this task"
                          >
                            ⏱ Timer
                          </button>
                          {users.length > 1 && (
                            <select
                              value={t.assignee_id || ''}
                              onChange={e => handleQuickReassign(t, e.target.value)}
                              className={`px-2 py-0.5 rounded-lg border text-[11px] outline-none ${
                                darkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                              }`}
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
                  <p className="text-xs text-slate-400 italic">No active open tasks assigned.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Logged Worklog Sessions */}
      {worklogs.length > 0 && (
        <div
          className={`rounded-[26px] border p-5 space-y-3 ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'
          }`}
        >
          <h3 className="text-sm font-bold">Recent Focus Worklog Ledger</h3>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {worklogs.slice(0, 6).map(log => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-bold">{log.taskTitle}</span>
                  <span className="text-slate-400"> · Logged by {log.userName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                  <span className="font-bold text-emerald-500">+{log.durationMinutes}m ({log.hours}h)</span>
                  <span className="text-slate-400">
                    {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
