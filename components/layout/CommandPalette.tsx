import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, Project, ActiveView } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type CommandItemType = 'action' | 'navigation' | 'task' | 'project';

interface CommandItem {
  id: string;
  type: CommandItemType;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    tasks,
    myTasks,
    projects,
    activeProject,
    setActiveProject,
    setActiveView,
    openModal,
    openCreateProjectModal,
    openViewTaskModal,
    toggleDarkMode,
    darkMode,
    currentUser,
    signOut,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Combine unique tasks from active project & my tasks
  const allTasks = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach(t => map.set(t.id, t));
    myTasks.forEach(t => map.set(t.id, t));
    return Array.from(map.values());
  }, [tasks, myTasks]);

  // Build command palette items
  const items: CommandItem[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    const result: CommandItem[] = [];

    // 1. Quick Actions
    const actions: CommandItem[] = [
      {
        id: 'action-create-task',
        type: 'action',
        title: 'Create New Task',
        subtitle: activeProject ? `In ${activeProject.name}` : 'Create a new task',
        icon: ICON_MAP.PlusIcon,
        badge: 'Action',
        badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        action: () => {
          onClose();
          openModal();
        },
      },
      {
        id: 'action-create-project',
        type: 'action',
        title: 'Create New Project',
        subtitle: 'Start a new team initiative',
        icon: ICON_MAP.FolderPlusIcon || ICON_MAP.FolderIcon,
        badge: 'Action',
        badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        action: () => {
          onClose();
          openCreateProjectModal();
        },
      },
      {
        id: 'action-toggle-theme',
        type: 'action',
        title: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: 'Toggle platform appearance',
        icon: darkMode ? ICON_MAP.SunIcon : ICON_MAP.MoonIcon,
        badge: 'Theme',
        badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
        action: () => {
          toggleDarkMode();
          onClose();
        },
      },
    ];

    // 2. Navigation Views
    const navViews: CommandItem[] = [
      {
        id: 'nav-kanban',
        type: 'navigation',
        title: 'Go to Kanban Board',
        subtitle: 'Active project visual workflow',
        icon: ICON_MAP.ClipboardListIcon,
        badge: 'View',
        action: () => {
          setActiveView('project_detail_view');
          onClose();
        },
      },
      {
        id: 'nav-my-tasks',
        type: 'navigation',
        title: 'Go to My Tasks',
        subtitle: 'All tasks assigned to you',
        icon: ICON_MAP.CheckCircleIcon || ICON_MAP.CheckIcon,
        badge: 'View',
        action: () => {
          setActiveView('my_tasks_view');
          onClose();
        },
      },
      {
        id: 'nav-projects',
        type: 'navigation',
        title: 'Go to Projects Directory',
        subtitle: 'View all organization projects',
        icon: ICON_MAP.FolderIcon,
        badge: 'View',
        action: () => {
          setActiveView('projects_overview_view');
          onClose();
        },
      },
      {
        id: 'nav-reports',
        type: 'navigation',
        title: 'Go to Reports & Analytics',
        subtitle: 'Velocity, workload & status metrics',
        icon: ICON_MAP.ChartBarIcon || ICON_MAP.ClockIcon,
        badge: 'View',
        action: () => {
          setActiveView('reports_view');
          onClose();
        },
      },
      {
        id: 'nav-automations',
        type: 'navigation',
        title: 'Go to Task Automations',
        subtitle: 'No-code event triggers & rules',
        icon: ICON_MAP.SparklesIcon,
        badge: 'View',
        action: () => {
          setActiveView('task_automations_view');
          onClose();
        },
      },
      {
        id: 'nav-team',
        type: 'navigation',
        title: 'Go to Team Management',
        subtitle: 'Members, roles & invitations',
        icon: ICON_MAP.UsersIcon || ICON_MAP.UserGroupIcon,
        badge: 'View',
        action: () => {
          setActiveView('team_management_view');
          onClose();
        },
      },
      {
        id: 'nav-inbox',
        type: 'navigation',
        title: 'Go to Inbox & Notifications',
        subtitle: 'Recent mentions, assignments & updates',
        icon: ICON_MAP.BellIcon,
        badge: 'View',
        action: () => {
          setActiveView('inbox_view');
          onClose();
        },
      },
    ];

    // Filter Actions and Navs
    if (q) {
      actions.forEach(a => {
        if (a.title.toLowerCase().includes(q) || (a.subtitle && a.subtitle.toLowerCase().includes(q))) {
          result.push(a);
        }
      });
      navViews.forEach(v => {
        if (v.title.toLowerCase().includes(q) || (v.subtitle && v.subtitle.toLowerCase().includes(q))) {
          result.push(v);
        }
      });
    } else {
      result.push(...actions, ...navViews);
    }

    // 3. Projects search
    const filteredProjects = projects.filter(p => 
      !q || p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
    );
    filteredProjects.slice(0, 4).forEach(p => {
      result.push({
        id: `proj-${p.id}`,
        type: 'project',
        title: p.name,
        subtitle: p.description || 'Project workspace',
        icon: ICON_MAP.FolderIcon,
        badge: 'Project',
        badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        action: () => {
          setActiveProject(p);
          setActiveView('project_detail_view');
          onClose();
        },
      });
    });

    // 4. Tasks search
    const filteredTasks = allTasks.filter(t => 
      !q || t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))
    );
    filteredTasks.slice(0, 8).forEach(t => {
      const statusLabel = (t.status || 'todo').replace('_', ' ');
      result.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.title,
        subtitle: `Status: ${statusLabel} • Priority: ${t.priority || 'Medium'}`,
        icon: ICON_MAP.DocumentTextIcon || ICON_MAP.ClipboardListIcon,
        badge: statusLabel.toUpperCase(),
        badgeColor: t.status === 'done' 
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
          : t.status === 'in_progress' 
          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' 
          : 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
        action: () => {
          onClose();
          openViewTaskModal(t.id, true);
        },
      });
    });

    return result;
  }, [query, allTasks, projects, activeProject, darkMode]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (items.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % (items.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden transition-all transform scale-100 ${
          darkMode ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className={`flex items-center px-4 py-3.5 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <ICON_MAP.SearchIcon className={`w-5 h-5 mr-3 flex-shrink-0 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, jump to a task, project, or view..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className={`flex-1 bg-transparent border-none outline-none text-sm sm:text-base font-medium placeholder:font-normal ${
              darkMode ? 'placeholder:text-slate-500 text-slate-100' : 'placeholder:text-slate-400 text-slate-800'
            }`}
          />
          <kbd className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border ${
            darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}>
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="max-h-[380px] sm:max-h-[440px] overflow-y-auto p-2 scrollbar-thin"
        >
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <ICON_MAP.SearchIcon className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
              <p className="text-sm font-medium text-slate-500">No matching commands or tasks found</p>
              <p className="text-xs text-slate-400 mt-0.5">Try searching with a different keyword</p>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    data-index={idx}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-100 ${
                      isSelected
                        ? darkMode
                          ? 'bg-accent/20 text-white shadow-xs'
                          : 'bg-accent/10 text-slate-900 shadow-xs'
                        : darkMode
                        ? 'hover:bg-slate-800/60 text-slate-300'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        isSelected 
                          ? 'bg-accent text-white' 
                          : darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm truncate">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className={`text-[11px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    {item.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider ${
                        item.badgeColor || (darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700')
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className={`px-4 py-2.5 border-t flex items-center justify-between text-[11px] ${
          darkMode ? 'bg-slate-900/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
        }`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px]">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px]">↵</kbd>
              Select
            </span>
          </div>
          <div className="hidden sm:block">
            <span>OmniFlow Quick Command</span>
          </div>
        </div>
      </div>
    </div>
  );
};
