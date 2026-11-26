import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { TeamWorkloadWidget } from './TeamWorkloadWidget';
import { KeyMilestonesWidget } from './KeyMilestonesWidget';
import { TasklyBentoWorkspaceHub } from '../dashboards/TasklyBentoWorkspaceHub';
import { PageHeader, SegmentedTabs } from '../shared/EditorialUI';

interface OverviewPageProps {
  showWelcomeMessage?: boolean;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ showWelcomeMessage = true }) => {
  const { currentUser, currentOrganization } = useAppStore();
  const [subTab, setSubTab] = useState<'focus' | 'allocation' | 'milestones'>('focus');

  if (!currentUser && showWelcomeMessage) {
    return (
      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className={showWelcomeMessage ? 'p-4 sm:p-6 space-y-5 max-w-[1440px] w-full mx-auto' : 'space-y-5'}>
      {showWelcomeMessage && (
        <PageHeader
          eyebrow={currentOrganization?.name || 'Workspace'}
          title={`Welcome back, ${currentUser?.full_name?.split(' ')[0] || 'Teammate'}`}
          subtitle="Priorities, project health, and sprint velocity."
          actions={
            <SegmentedTabs
              size="sm"
              value={subTab}
              onChange={setSubTab}
              options={[
                { id: 'focus', label: 'Focus & Health' },
                { id: 'allocation', label: 'Team Allocation' },
                { id: 'milestones', label: 'Milestones' },
              ]}
            />
          }
        />
      )}

      {!showWelcomeMessage && (
        <div className="flex justify-end">
          <SegmentedTabs
            size="sm"
            value={subTab}
            onChange={setSubTab}
            options={[
              { id: 'focus', label: 'Focus & Health' },
              { id: 'allocation', label: 'Team Allocation' },
              { id: 'milestones', label: 'Milestones' },
            ]}
          />
        </div>
      )}

      {subTab === 'focus' && <TasklyBentoWorkspaceHub />}
      {subTab === 'allocation' && <TeamWorkloadWidget />}
      {subTab === 'milestones' && <KeyMilestonesWidget />}
    </div>
  );
};
