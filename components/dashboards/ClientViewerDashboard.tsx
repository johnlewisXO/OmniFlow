import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { TasklyBentoWorkspaceHub } from './TasklyBentoWorkspaceHub';
import { TaskStatus } from '../../types';
import soundService from '../../services/soundService';
import { PageHeader, HairlineCard, StatusDot } from '../shared/EditorialUI';
import { SlimProgressBar } from '../charts/EditorialCharts';

export const ClientViewerDashboard: React.FC = () => {
  const { projects, tasks, setActiveProject, setActiveView } = useAppStore();
  const FolderIcon = ICON_MAP.FolderIcon;

  const sharedProjects = projects;

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
      <PageHeader
        eyebrow="Stakeholder & Client Portal"
        title="Project Viewer Dashboard"
        subtitle="Live read-only visibility into shared project milestones, health metrics, and release progress."
        actions={
          <StatusDot
            tone="lime"
            label="Read-Only Access"
            className="px-3 py-1 rounded-full bg-[var(--bg-sage)] border border-[var(--border-hairline)] text-xs font-medium"
          />
        }
      />

      <TasklyBentoWorkspaceHub roleBadgeLabel="CLIENT VIEWER" />

      <HairlineCard padding="none" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Shared Project Portfolio</h2>
            <p className="text-xs text-[var(--text-secondary)]">Select any stream to inspect deliverables and milestones.</p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
            {sharedProjects.length} active
          </span>
        </div>

        {sharedProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-surface-subtle)]">
                  <th className="py-2.5 px-5">Project</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 w-56">Progress</th>
                  <th className="py-2.5 px-4">Deliverables</th>
                  <th className="py-2.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {sharedProjects.map(p => {
                  const projTasks = tasks.filter(t => t.projectId === p.id);
                  const doneTasks = projTasks.filter(t => t.status === TaskStatus.DONE).length;
                  const pct = projTasks.length > 0 ? Math.round((doneTasks / projTasks.length) * 100) : p.progress || 0;
                  const tone = p.status === 'completed' || pct >= 85 ? 'success' : p.status === 'on hold' ? 'warning' : 'lime';
                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        soundService.play('click_soft');
                        setActiveProject(p.id);
                        setActiveView('kanban');
                      }}
                      className="hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-[var(--bg-sage)] flex items-center justify-center shrink-0">
                            <FolderIcon className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                            <p className="text-[11px] text-[var(--text-muted)] truncate max-w-md">
                              {p.description || 'Active delivery stream tracked in real time.'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <StatusDot tone={tone} label={p.status || 'active'} />
                      </td>
                      <td className="py-3 px-4">
                        <SlimProgressBar
                          value={pct}
                          tone={pct >= 90 ? 'sage' : 'charcoal'}
                          showPercent
                        />
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[var(--text-secondary)]">
                        {doneTasks} / {projTasks.length} tasks
                      </td>
                      <td className="py-3 px-5 text-right font-semibold text-[var(--text-primary)]">
                        View →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-xs text-[var(--text-muted)]">
            No shared projects yet.
          </div>
        )}
      </HairlineCard>
    </div>
  );
};