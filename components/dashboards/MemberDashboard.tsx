import React, { useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { TasklyBentoWorkspaceHub } from './TasklyBentoWorkspaceHub';
import { ICON_MAP } from '../../constants';
import { PageHeader, HairlineCard, StatusDot } from '../shared/EditorialUI';
import { Button } from '../shared/Button';

export const MemberDashboard: React.FC = () => {
  const { currentUser, notifications, openViewTaskModal, setActiveView } = useAppStore();

  const recentActivities = useMemo(() => {
    return notifications.slice(0, 5);
  }, [notifications]);

  const roleLabel = currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER';

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title={`Welcome back, ${currentUser?.full_name?.split(' ')[0] || 'Teammate'}`}
        subtitle="Stay centered on today's priorities, team updates, and sprint progress."
        actions={
          <>
            <StatusDot tone="lime" label={roleLabel} className="px-2.5 py-1 rounded-full bg-[var(--bg-sage)] border border-[var(--border-hairline)] text-[11px] font-medium" />
            <Button variant="outline" size="sm" onClick={() => setActiveView('my_tasks')}>
              Open My Tasks
            </Button>
          </>
        }
      />

      <TasklyBentoWorkspaceHub roleBadgeLabel={roleLabel} />

      {recentActivities.length > 0 && (
        <HairlineCard padding="md">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
            <div className="flex items-center gap-2">
              <ICON_MAP.BellIcon className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Recent Team Updates</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('inbox_view')}
              className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              View inbox →
            </button>
          </div>

          <div className="divide-y divide-[var(--border-hairline)]">
            {recentActivities.map(activity => (
              <div
                key={activity.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {activity.title || activity.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="text-[var(--text-secondary)] truncate">
                      {activity.message || activity.content}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {activity.entity_id && activity.entity_type === 'task' && (
                    <button
                      type="button"
                      onClick={() => openViewTaskModal(activity.entity_id, true)}
                      className="text-[11px] font-semibold text-[var(--text-primary)] hover:underline cursor-pointer"
                    >
                      Open →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </HairlineCard>
      )}
    </div>
  );
};
