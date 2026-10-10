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
    darkMode,
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
    {
      id: 'overview',
      label: 'Overview',
      icon: ICON_MAP.HomeIcon,
      matchViews: ['overview'],
    },
    {
      id: 'kanban',
      label: 'Projects',
      icon: ICON_MAP.FolderIcon,
      matchViews: ['kanban', 'projects_overview', 'sprints_view'],
    },
    {
      id: 'ai_copilot_view',
      label: 'Co-Pilot',
      icon: ICON_MAP.SparklesIcon,
      matchViews: ['ai_copilot_view'],
    },
    {
      id: 'team_chat_view',
      label: 'Chat & Meet',
      icon: ICON_MAP.ChatBubbleLeftRightIcon,
      matchViews: ['team_chat_view', 'calendar_view'],
    },
  ];

  const moreModules: Array<{
    id: ActiveView;
    label: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: 'my_tasks_view',
      label: 'My Tasks',
      subtitle: 'Personal focus queue & deadlines',
      icon: ICON_MAP.ClipboardListIcon,
    },
    {
      id: 'sprints_view',
      label: 'Sprints & Velocity',
      subtitle: 'Backlog planner & burndown',
      icon: ICON_MAP.RocketLaunchIcon,
    },
    {
      id: 'calendar_view',
      label: 'Calendar & 1080p Meet',
      subtitle: 'Schedule & join HD video rooms',
      icon: ICON_MAP.CalendarIcon,
    },
    {
      id: 'inbox_view',
      label: 'Inbox & Approvals',
      subtitle: 'Mentions, alerts & org join requests',
      icon: ICON_MAP.BellIcon,
      badge: unreadCount,
    },
    {
      id: 'task_automations_view',
      label: 'Triggers & Rules',
      subtitle: 'Automated SLA & workflow engine',
      icon: ICON_MAP.CogIcon,
    },
    {
      id: 'reports_view',
      label: 'Executive Reports',
      subtitle: 'Portfolio analytics & CSV/PDF export',
      icon: ICON_MAP.ChartBarIcon,
    },
    {
      id: 'team_management',
      label: 'Team & RBAC Directory',
      subtitle: 'Roles, invites & audit logs',
      icon: ICON_MAP.UserGroupIcon,
    },
    {
      id: 'profile_settings',
      label: 'Profile & Preferences',
      subtitle: 'Account security & workspace theme',
      icon: ICON_MAP.UserIcon,
    },
  ];

  const isMoreActive = moreModules.some(m => m.id === activeView);

  return (
    <>
      {/* Slide-Over Bottom Sheet for "More" Modules */}
      {isMoreSheetOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsMoreSheetOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full rounded-t-3xl border-t p-4 pb-24 max-h-[82vh] overflow-y-auto shadow-2xl ${
              darkMode
                ? 'bg-[#0B0F1C]/95 border-white/10 text-slate-100'
                : 'bg-white/95 border-slate-200 text-slate-900'
            } backdrop-blur-2xl`}
          >
            {/* Drag Handle Affordance */}
            <div className="w-10 h-1.5 rounded-full bg-slate-500/40 mx-auto mb-4" />

            <div className="flex items-center justify-between px-1 mb-4">
              <div>
                <h3 className="text-sm font-bold">Workspace Modules &amp; Quick Actions</h3>
                <p className="text-[11px] text-slate-400">
                  Jump to any tool or create a deliverable
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreSheetOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white"
                aria-label="Close menu sheet"
              >
                <ICON_MAP.XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Creation Actions */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => {
                  setIsMoreSheetOpen(false);
                  openModal();
                }}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md"
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
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                  darkMode
                    ? 'bg-slate-900 border-white/10 text-slate-200'
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <ICON_MAP.FolderIcon className="w-4 h-4 text-indigo-400" />
                <span>New Project</span>
              </button>
            </div>

            {/* Module Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {moreModules.map(mod => {
                const Icon = mod.icon;
                const active = activeView === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelectView(mod.id)}
                    className={`min-h-[52px] p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all ${
                      active
                        ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-400'
                        : darkMode
                        ? 'bg-slate-900/70 border-white/[0.06] text-slate-200 hover:bg-slate-800'
                        : 'bg-slate-50 border-slate-200/80 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : darkMode
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{mod.label}</div>
                        <div className="text-[11px] text-slate-400 truncate">{mod.subtitle}</div>
                      </div>
                    </div>
                    {mod.badge && mod.badge > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold">
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

      {/* Fixed 5-Slot Bottom Thumb-Bar Dock (< 1024px) */}
      <nav
        aria-label="Mobile Primary Navigation"
        className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden h-16 px-2 border-t backdrop-blur-2xl flex items-center justify-around ${
          darkMode
            ? 'bg-[#070A12]/90 border-white/[0.08] text-slate-300'
            : 'bg-white/90 border-slate-200/90 text-slate-700'
        }`}
      >
        {primaryTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.matchViews.includes(activeView);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectView(tab.id)}
              className={`min-w-[56px] min-h-[44px] px-2 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-indigo-500 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}

        {/* 5th Slot: More Modules Sheet Trigger */}
        <button
          type="button"
          onClick={() => setIsMoreSheetOpen(prev => !prev)}
          className={`relative min-w-[56px] min-h-[44px] px-2 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
            isMoreSheetOpen || isMoreActive
              ? 'text-indigo-500 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ICON_MAP.Squares2X2Icon className="w-5 h-5" />
          <span className="text-[10px] tracking-tight whitespace-nowrap">More</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>
      </nav>
    </>
  );
};
