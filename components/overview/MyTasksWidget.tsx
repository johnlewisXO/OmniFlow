
import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task } from '../../types';

export const MyTasksWidget: React.FC = () => {
  const { myTasks, projects, currentUser, darkMode, isLoadingTasks, openViewTaskModal } = useAppStore();
  const ClipboardListIcon: React.FC<{ className?: string }> = ICON_MAP.ClipboardListIcon;

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'General';
    return projects.find(p => p.id === projectId)?.name || 'Project';
  };

  // Filter for incomplete tasks assigned to current user, sorted by due date
  const upcomingTasks = myTasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    })
    .slice(0, 5); // Show top 5

  return (
    <div className="editorial-surface p-4 md:p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <ClipboardListIcon className="w-5 h-5 mr-2.5 text-[var(--accent-text)]" />
            <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">My Upcoming Tasks</h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
            {upcomingTasks.length} {upcomingTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {isLoadingTasks ? (
          <ul className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <li key={i} className="p-3 rounded-xl animate-pulse bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)]">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-4 w-1/2 rounded bg-[var(--bg-sage)]"></div>
                  <div className="h-4 w-16 rounded-full bg-[var(--bg-sage)]"></div>
                </div>
                <div className="h-3 w-1/3 rounded bg-[var(--bg-sage)]"></div>
              </li>
            ))}
          </ul>
        ) : upcomingTasks.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-[var(--border-hairline)] text-[var(--text-muted)]">
            <p className="text-sm">You have no pending tasks assigned to you.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {upcomingTasks.map(task => (
              <li
                key={task.id}
                onClick={() => openViewTaskModal(task.id, true)}
                className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-sage)] border border-[var(--border-hairline)] hover:border-[var(--border-strong)] transition-all duration-150 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate text-[var(--text-primary)]">
                    {task.title}
                  </span>
                  {task.dueDate && (
                    <span className="text-[11px] font-mono tabular-nums font-medium text-[var(--accent-text)] flex-shrink-0">
                      {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1.5 text-xs">
                  <span className="font-medium text-[var(--text-muted)] truncate">
                    {getProjectName(task.projectId)}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      task.status === 'in_progress'
                        ? 'bg-[var(--accent-lime)]/25 text-[var(--accent-text)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]'
                    }`}
                  >
                    {(task.status || 'todo').replace('_', ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};