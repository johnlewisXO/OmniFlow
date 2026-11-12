import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { ActiveView } from '../../types';

export const MobileBottomNav: React.FC = () => {
  const {
    currentUser,
    activeView,
    setActiveView,
    notifications,
    openModal,
    openCreateProjectModal,
  } = useAppStore();

  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  if (!currentUser) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSelectView = (view: ActiveView) => {
    setActiveView(view);
    setIsMoreSheetOpen(false);
  };

  const primaryTabs: Array<{
    id: ActiveView;
    label: string;
    icon: React.FC<{ className?: string }>;
    matchViews: ActiveView[];
  }> = [
    { id: 'overview', label: 'Home', icon: ICON_MAP.HomeIcon, matchViews: ['overview', 'my_tasks_view'] },
    {
      id: 'projects_overview',
      label: 'Projects',
      icon: ICON_MAP.FolderIcon,
      matchViews: ['projects_overview', 'kanban', 'sprints_view', 'gantt_roadmap_view'],
    },
    {
      id: 'team_chat_view',
      label: 'Meet',
      icon: ICON_MAP.ChatBubbleLeftRightIcon,
      matchViews: ['team_chat_view', 'calendar_view'],
    },
    { id: 'reports_view', label: 'Reports', icon: ICON_MAP.ChartBarIcon, matchViews: ['reports_view', 'okrs_goals_view'] },
  ];

  const moreModules: Array<{
    id: ActiveView;
    label: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'my_tasks_view', label: 'My Tasks', subtitle: 'Focus queue & deadlines', icon: ICON_MAP.ClipboardListIcon },
    { id: 'sprints_view', label: 'Sprints & Backlog', subtitle: 'Backlog planner & velocity', icon: ICON_MAP.RocketLaunchIcon },
    { id: 'calendar_view', label: 'Calendar & Meetings', subtitle: 'Schedule & video rooms', icon: ICON_MAP.CalendarIcon },
    { id: 'inbox_view', label: 'Inbox & Alerts', subtitle: 'Mentions & join requests', icon: ICON_MAP.BellIcon, badge: unreadCount },
    { id: 'workload_capacity_view', label: 'Workload & Timer', subtitle: 'Capacity bars & time log', icon: ICON_MAP.ClockIcon },
    { id: 'team_management', label: 'Team Directory', subtitle: 'Roles & invites', icon: ICON_MAP.UserGroupIcon },
    { id: 'ai_copilot_view', label: 'AI Studio', subtitle: 'Executive planner & brief', icon: ICON_MAP.SparklesIcon },
    { id: 'profile_settings', label: 'Settings', subtitle: 'Account & theme', icon: ICON_MAP.UserIcon },
  ];

  return (
    <>
      {isMoreSheetOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/50 backdrop-blur-[2px]"
          onClick={() => setIsMoreSheetOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full rounded-t-[24px] border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] p-4 pb-24 max-h-[82vh] overflow-y-auto shadow-2xl"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mb-4" />

            <div className="flex items-center justify-between px-1 mb-3">
              <div>
                <h3 className="text-sm font-bold">Workspace Modules</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Navigate or create</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreSheetOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Close menu sheet"
              >
                <ICON_MAP.XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setIsMoreSheetOpen(false);
                  openModal();
                }}
                className="min-h-[42px] px-3 py-2 rounded-full bg-[#191B17] text-white dark:bg-[#CCF048] dark:text-[#131511] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <ICON_MAP.PlusIcon className="w-4 h-4" />
                <span>New Task</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMoreSheetOpen(false);
                  openCreateProjectModal();
                }}
                className="min-h-[42px] px-3 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <ICON_MAP.FolderIcon className="w-4 h-4" />
                <span>New Project</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {moreModules.map(mod => {
                const Icon = mod.icon;
                const active = activeView === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelectView(mod.id)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors ${
                      active
                        ? 'bg-[var(--bg-sage)] border-[var(--border-strong)]'
                        : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] hover:bg-[var(--bg-sage)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{mod.label}</div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate">{mod.subtitle}</div>
                      </div>
                    </div>
                    {mod.badge && mod.badge > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)] font-mono text-[10px] font-bold">
                        {mod.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile Primary Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden h-15 px-2 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-around"
      >
        {primaryTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.matchViews.includes(activeView);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectView(tab.id)}
              className={`min-w-[56px] min-h-[42px] px-2 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsMoreSheetOpen(prev => !prev)}
          className="relative min-w-[56px] min-h-[42px] px-2 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ICON_MAP.Squares2X2Icon className="w-5 h-5" />
          <span className="text-[10px] whitespace-nowrap">More</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-rose-600" />
          )}
        </button>
      </nav>
    </>
  );
};
