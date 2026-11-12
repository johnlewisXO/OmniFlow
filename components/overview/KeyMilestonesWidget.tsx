import React, { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { useAppStore } from '../../hooks/useAppStore';
import { TaskStatus } from '../../types';
import { MilestonePhaseTimeline, TimelineMilestoneFlag, TimelinePhaseNode } from '../charts/EditorialCharts';
import { HairlineCard, SegmentedTabs } from '../shared/EditorialUI';

interface KeyMilestonesWidgetProps {
  className?: string;
}

export const KeyMilestonesWidget: React.FC<KeyMilestonesWidgetProps> = ({ className = '' }) => {
  const { projects, tasks, users, setActiveProject, setActiveView } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('all');

  const { milestones, phases, axisLabels } = useMemo(() => {
    const scopedProjects =
      selectedProjectId === 'all' ? projects : projects.filter(p => p.id === selectedProjectId);

    const today = new Date();
    const axis = [0, 1, 2, 3, 4, 5].map(i => format(addDays(today, (i - 1) * 14), 'MMM yyyy'));

    const milestoneFlags: TimelineMilestoneFlag[] =
      scopedProjects.length > 0
        ? scopedProjects.slice(0, 4).map((p, idx) => ({
            id: p.id,
            label: p.name,
            dateLabel: p.created_at
              ? format(addDays(new Date(p.created_at), 28), 'MMM d')
              : format(addDays(today, (idx + 1) * 10), 'MMM d'),
            positionPct: 8 + idx * 24,
          }))
        : [
            { id: 'm1', label: 'Kickoff', dateLabel: format(today, 'MMM d'), positionPct: 8 },
            { id: 'm2', label: 'Design Complete', dateLabel: format(addDays(today, 14), 'MMM d'), positionPct: 36 },
            { id: 'm3', label: 'Beta Release', dateLabel: format(addDays(today, 28), 'MMM d'), positionPct: 64 },
            { id: 'm4', label: 'Launch', dateLabel: format(addDays(today, 42), 'MMM d'), positionPct: 86 },
          ];

    const sourceList = scopedProjects.slice(0, 6);
    const phaseNodes: TimelinePhaseNode[] = sourceList.map((p, idx) => {
      const pTasks = tasks.filter(t => t.projectId === p.id);
      const pDone = pTasks.filter(t => t.status === TaskStatus.DONE).length;
      const pct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : p.progress || 0;
      const assigneeIds = Array.from(new Set(pTasks.map(t => t.assignee_id).filter(Boolean)));
      const assignees = assigneeIds
        .map(id => users.find(u => u.id === id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u));

      return {
        id: p.id,
        stepNumber: String(idx + 1).padStart(2, '0'),
        title: p.name,
        dateRange: p.created_at
          ? `${format(new Date(p.created_at), 'MMM d')} – ${format(addDays(new Date(p.created_at), 28), 'MMM d')}`
          : 'Active stream',
        taskCount: pTasks.length,
        progressPct: pct,
        assignees: assignees.length > 0 ? assignees : users.slice(0, 2),
        row: (idx % 2) as 0 | 1,
        leftPct: 6 + idx * 14,
        onClick: () => {
          setActiveProject(p.id);
          setActiveView('kanban');
        },
      };
    });

    return { milestones: milestoneFlags, phases: phaseNodes, axisLabels: axis };
  }, [projects, tasks, users, selectedProjectId, setActiveProject, setActiveView]);

  return (
    <div className={`space-y-4 ${className}`}>
      <HairlineCard padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Milestones &amp; Delivery Phases</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Interactive project phase progression and target release gates
          </p>
        </div>

        {projects.length > 0 && (
          <SegmentedTabs
            size="sm"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={[
              { id: 'all', label: 'All Projects' },
              ...projects.slice(0, 3).map(p => ({ id: p.id, label: p.name })),
            ]}
          />
        )}
      </HairlineCard>

      {phases.length === 0 ? (
        <HairlineCard className="text-center py-8 text-xs text-[var(--text-muted)]">
          Create a project to populate the interactive milestone timeline.
        </HairlineCard>
      ) : (
        <MilestonePhaseTimeline
          milestones={milestones}
          phases={phases}
          axisLabels={axisLabels}
        />
      )}
    </div>
  );
};
