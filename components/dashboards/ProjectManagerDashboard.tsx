import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { OverviewPage } from '../overview/OverviewPage';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { SystemLogMonitorPanel } from '../shared/SystemLogMonitorModal';
import { PendingJoinRequestsBanner } from '../team/PendingJoinRequestsBanner';
import soundService from '../../services/soundService';
import { PageHeader, SegmentedTabs, HairlineCard, StatusDot } from '../shared/EditorialUI';
import { SlimProgressBar } from '../charts/EditorialCharts';
import { TaskStatus } from '../../types';

export const ProjectManagerDashboard: React.FC = () => {
  const { currentUser, openCreateProjectModal, projects, tasks, setActiveProject, setActiveView } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'telemetry'>('overview');

  const handleViewProjectKanban = (projectId: string) => {
    soundService.play('click_soft');
    setActiveProject(projectId);
    setActiveView('kanban');
  };

  const managedProjects = projects.filter(
    p => p.owner_id === currentUser?.id || p.organization_id === currentUser?.organization_id
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
      <PageHeader
        eyebrow="Delivery & Portfolio Control"
        title="Project Manager Dashboard"
        subtitle="Coordinate portfolio health, sprint schedules, and team capacity across active initiatives."
        actions={
          <>
            <SegmentedTabs
              size="sm"
              value={activeTab}
              onChange={tab => {
                soundService.play('click_soft');
                setActiveTab(tab);
              }}
              options={[
                { id: 'overview', label: 'Overview' },
                { id: 'projects', label: 'Managed Projects', count: managedProjects.length },
                { id: 'telemetry', label: 'System Logs' },
              ]}
            />
            <Button onClick={openCreateProjectModal} variant="primary" size="sm">
              <ICON_MAP.PlusIcon className="w-4 h-4" />
              New Project
            </Button>
          </>
        }
      />

      <PendingJoinRequestsBanner />

      {activeTab === 'telemetry' ? (
        <SystemLogMonitorPanel />
      ) : activeTab === 'projects' ? (
        <HairlineCard padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Managed Projects</h2>
              <p className="text-xs text-[var(--text-secondary)]">Direct access to project boards and completion ratios.</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
              {managedProjects.length} total
            </span>
          </div>

          {managedProjects.length === 0 ? (
            <div className="p-10 text-center text-xs text-[var(--text-muted)]">
              No managed projects yet. Create a project to begin planning sprints.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-surface-subtle)]">
                    <th className="py-2.5 px-5">Project</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 w-56">Progress</th>
                    <th className="py-2.5 px-4">Tasks</th>
                    <th className="py-2.5 px-5 text-right">Board</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {managedProjects.map(p => {
                    const pTasks = tasks.filter(t => t.projectId === p.id);
                    const done = pTasks.filter(t => t.status === TaskStatus.DONE).length;
                    const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : p.progress || 0;
                    const tone = p.status === 'completed' ? 'success' : p.status === 'on hold' ? 'warning' : 'lime';
                    return (
                      <tr key={p.id} className="hover:bg-[var(--bg-surface-subtle)] transition-colors">
                        <td className="py-3 px-5">
                          <p className="font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                          {p.description && (
                            <p className="text-[11px] text-[var(--text-muted)] truncate max-w-md">{p.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 capitalize">
                          <StatusDot tone={tone} label={p.status || 'active'} />
                        </td>
                        <td className="py-3 px-4">
                          <SlimProgressBar value={pct} tone={pct >= 85 ? 'sage' : 'charcoal'} showPercent />
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[var(--text-secondary)]">
                          {done}/{pTasks.length}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <Button size="sm" variant="outline" onClick={() => handleViewProjectKanban(p.id)}>
                            View Board
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </HairlineCard>
      ) : (
        <OverviewPage showWelcomeMessage={false} />
      )}
    </div>
  );
};
