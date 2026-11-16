import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { ActiveView } from '../../types';
import { GLASS_SPRING } from '../shared/LiquidGlass';

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
      <AnimatePresence>
        {isMoreSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={GLASS_SPRING.scrim}
            className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/45 backdrop-blur-sm"
            onClick={() => setIsMoreSheetOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={GLASS_SPRING.spatial}
              onClick={e => e.stopPropagation()}
              className="w-full rounded-t-[26px] liquid-glass-overlay p-4 pb-24 max-h-[82vh] overflow-y-auto shadow-2xl"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mb-4" />

              <div className="flex items-center justify-between px-1 mb-3">
                <div>
                  <h3 className="text-sm font-bold">Workspace Modules</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Navigate or create</p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  transition={GLASS_SPRING.micro}
                  onClick={() => setIsMoreSheetOpen(false)}
                  className="p-1.5 rounded-full glass-bubble-control text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="Close menu sheet"
                >
                  <ICON_MAP.XMarkIcon className="w-5 h-5" />
                </motion.button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={GLASS_SPRING.micro}
                  onClick={() => {
                    setIsMoreSheetOpen(false);
                    openModal();
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ICON_MAP.PlusIcon className="w-4 h-4" />
                  <span>New Task</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={GLASS_SPRING.micro}
                  onClick={() => {
                    setIsMoreSheetOpen(false);
                    openCreateProjectModal();
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-full glass-bubble-control text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ICON_MAP.FolderIcon className="w-4 h-4" />
                  <span>New Project</span>
                </motion.button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {moreModules.map(mod => {
                  const Icon = mod.icon;
                  const active = activeView === mod.id;
                  return (
                    <motion.button
                      key={mod.id}
                      type="button"
                      whileTap={{ scale: 0.975 }}
                      transition={GLASS_SPRING.micro}
                      onClick={() => handleSelectView(mod.id)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--bg-sage)] border-[var(--border-strong)]'
                          : 'bg-white/45 dark:bg-white/[0.04] border-[var(--border-hairline)] hover:bg-[var(--bg-sage)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-white/75 dark:bg-white/10 border border-[var(--border-hairline)] flex items-center justify-center shrink-0">
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
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        aria-label="Mobile Primary Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden h-16 px-2 border-t border-[var(--border-hairline)] frosted-shell-panel flex items-center justify-around"
      >
        {primaryTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.matchViews.includes(activeView);
          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.91 }}
              transition={GLASS_SPRING.micro}
              onClick={() => handleSelectView(tab.id)}
              className={`relative min-w-[56px] min-h-[44px] px-2.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                isActive
                  ? 'text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-bottom-active-pill"
                  transition={GLASS_SPRING.morph}
                  className="absolute inset-x-1 inset-y-0.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] -z-10"
                  aria-hidden="true"
                />
              )}
              <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--accent-text)]' : ''}`} />
              <span className="text-[10px] whitespace-nowrap">{tab.label}</span>
            </motion.button>
          );
        })}

        <motion.button
          type="button"
          whileTap={{ scale: 0.91 }}
          transition={GLASS_SPRING.micro}
          onClick={() => setIsMoreSheetOpen(prev => !prev)}
          className="relative min-w-[56px] min-h-[44px] px-2.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <ICON_MAP.Squares2X2Icon className="w-5 h-5" />
          <span className="text-[10px] whitespace-nowrap">More</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-rose-600" />
          )}
        </motion.button>
      </nav>
    </>
  );
};
