import React, { useState, useMemo } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { TaskStatus, UserRole, Task, TaskPriority } from '../../types';
import { useAppStore } from '../../hooks/useAppStore';
import { TASK_STATUS_COLUMNS, ICON_MAP } from '../../constants';
import { GanttTimelineView } from './GanttTimelineView';
import { TaskListView } from './TaskListView';
import { SprintPlanningView } from '../sprints/SprintPlanningView';
import { AutomatedTriggersModal } from './AutomatedTriggersModal';
import { Button } from '../shared/Button';
import { ProjectLiveCollabBar } from '../projects/ProjectLiveCollabBar';

type SwimlaneType = 'none' | 'assignee' | 'priority';

export const KanbanBoard: React.FC = () => {
  const { 
    activeProject, 
    darkMode, 
    isLoadingTasks, 
    tasksError,
    isLoadingProjects,
    tasks,
    users,
    currentUser,
    openViewTaskModal,
    sprints,
    activeSprintId
  } = useAppStore();

  const [viewMode, setViewMode] = useState<'kanban' | 'sprints' | 'list' | 'gantt'>('kanban');
  const [isAutomationsOpen, setIsAutomationsOpen] = useState(false);
  const [isWipModalOpen, setIsWipModalOpen] = useState(false);

  // Quick Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterSprint, setFilterSprint] = useState<string>('all');
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneType>('none');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});

  // WIP Limits (persisted in local state per project)
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(`wip_limits_${activeProject?.id}`);
      return stored ? JSON.parse(stored) : { in_progress: 5, in_review: 3 };
    } catch {
      return { in_progress: 5, in_review: 3 };
    }
  });

  const handleUpdateWipLimit = (status: string, limit: number) => {
    const updated = { ...wipLimits, [status]: limit };
    setWipLimits(updated);
    if (activeProject) {
      localStorage.setItem(`wip_limits_${activeProject.id}`, JSON.stringify(updated));
    }
  };

  const toggleSwimlane = (id: string) => {
    setCollapsedSwimlanes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hasActiveFilters = searchQuery !== '' || filterMyTasks || filterPriority !== 'all' || filterUnassigned || filterSprint !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setFilterMyTasks(false);
    setFilterPriority('all');
    setFilterUnassigned(false);
    setFilterSprint('all');
  };

  const FolderIcon = ICON_MAP.FolderIcon;
  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ExclamationIcon = ICON_MAP.ExclamationIcon;

  // Project tasks
  const rawProjectTasks = useMemo(() => {
    return activeProject ? tasks.filter(t => t.projectId === activeProject.id) : [];
  }, [tasks, activeProject]);

  // Filtered tasks based on search & quick filters
  const filteredProjectTasks = useMemo(() => {
    return rawProjectTasks.filter(task => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesTag = task.tags?.some(tag => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTag) return false;
      }

      // My tasks filter
      if (filterMyTasks && currentUser) {
        if (task.assignee_id !== currentUser.id) return false;
      }

      // Unassigned filter
      if (filterUnassigned) {
        if (task.assignee_id) return false;
      }

      // Priority filter
      if (filterPriority !== 'all') {
        const pNorm = (task.priority || '').toLowerCase();
        if (pNorm !== filterPriority.toLowerCase()) return false;
      }

      // Sprint filter
      if (filterSprint !== 'all') {
        if (filterSprint === 'active') {
          const activeSp = sprints.find(s => s.projectId === activeProject?.id && s.status === 'active');
          if (!activeSp || task.sprintId !== activeSp.id) return false;
        } else if (filterSprint === 'backlog') {
          if (task.sprintId) return false;
        } else {
          if (task.sprintId !== filterSprint) return false;
        }
      }

      return true;
    });
  }, [rawProjectTasks, searchQuery, filterMyTasks, currentUser, filterUnassigned, filterPriority, filterSprint, sprints, activeProject]);

  // Agile Metrics (Total, Done, In Progress, Velocity, Story points estimation)
  const stats = useMemo(() => {
    const total = rawProjectTasks.length;
    const done = rawProjectTasks.filter(t => t.status === TaskStatus.DONE).length;
    const inProgress = rawProjectTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const inReview = rawProjectTasks.filter(t => t.status === TaskStatus.REVIEW).length;
    const todo = rawProjectTasks.filter(t => t.status === TaskStatus.TODO).length;
    const totalStoryPoints = rawProjectTasks.reduce((acc, t) => acc + (t.story_points || 1), 0);
    const completedStoryPoints = rawProjectTasks.filter(t => t.status === TaskStatus.DONE).reduce((acc, t) => acc + (t.story_points || 1), 0);
    const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, inProgress, inReview, todo, totalStoryPoints, completedStoryPoints, progressPercent };
  }, [rawProjectTasks]);

  // Swimlane definitions
  const swimlanes = useMemo(() => {
    if (swimlaneMode === 'assignee') {
      const assigneeIds = Array.from(new Set(rawProjectTasks.map(t => t.assignee_id || 'unassigned')));
      return assigneeIds.map(id => {
        if (id === 'unassigned') {
          return {
            id: 'unassigned',
            title: 'Unassigned',
            avatar: null,
            tasks: filteredProjectTasks.filter(t => !t.assignee_id)
          };
        }
        const user = users.find(u => u.id === id);
        return {
          id,
          title: user?.full_name || user?.email || 'Unknown Member',
          avatar: user?.avatar_url,
          tasks: filteredProjectTasks.filter(t => t.assignee_id === id)
        };
      });
    }

    if (swimlaneMode === 'priority') {
      const priorities: TaskPriority[] = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW];
      return priorities.map(p => ({
        id: p,
        title: `${p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()} Priority`,
        avatar: null,
        priority: p,
        tasks: filteredProjectTasks.filter(t => t.priority === p)
      }));
    }

    return [];
  }, [swimlaneMode, rawProjectTasks, filteredProjectTasks, users]);

  if (isLoadingProjects && !activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-transparent">
        <div className="text-center">
          <SpinnerIcon className={`w-12 h-12 mx-auto mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'} animate-spin`} />
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Loading Project...</h2>
        </div>
      </div>
    );
  }
  
  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-transparent">
        <div className="text-center">
          <FolderIcon className={`w-24 h-24 mx-auto mb-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'} opacity-70`} />
          <h2 className={`text-2xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>No Project Selected</h2>
          <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mt-1`}>Please select a project from the sidebar to view tasks.</p>
        </div>
      </div>
    );
  }

  if (activeProject && isLoadingTasks) {
    return (
      <div className="flex-1 flex space-x-3 md:space-x-4 p-4 md:p-6 overflow-x-auto bg-transparent">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className={`flex-shrink-0 w-72 md:w-80 rounded-xl flex flex-col ${darkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-100/50 border-slate-200/50'} border shadow-sm`}>
            <div className="p-3 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className={`h-5 w-24 rounded animate-pulse ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            </div>
            <div className="flex-1 p-2 space-y-3 overflow-y-auto">
              {[1, 2, 3].map((task) => (
                <div key={task} className={`p-4 rounded-lg border shadow-sm animate-pulse ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className={`h-4 w-3/4 rounded mb-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  <div className="flex justify-between items-center mt-4">
                    <div className={`h-3 w-16 rounded ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                    <div className={`h-6 w-6 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeProject && tasksError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-transparent">
        <div className={`text-center p-4 rounded-lg ${darkMode ? 'bg-red-900/30' : 'bg-red-100/70'}`}>
          <ExclamationIcon className={`w-16 h-16 mx-auto mb-4 text-red-500 dark:text-red-400`} />
          <h2 className={`text-xl font-semibold text-red-700 dark:text-red-300`}>Error Loading Tasks</h2>
          <p className={`text-red-600 dark:text-red-400 mt-1`}>{tasksError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full p-2 sm:p-4 md:p-6 bg-transparent overflow-y-auto md:overflow-hidden space-y-3">
      
      {/* Live Project Collaborator Interaction Bar */}
      <ProjectLiveCollabBar />

      {/* Top Agile Toolbar: View Switcher, Stats & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1 flex-shrink-0">
        
        {/* Left: View Mode Tabs */}
        <div className="flex items-center gap-2">
          <div className={`flex p-1 rounded-xl border ${darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-accent text-white shadow-sm'
                  : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ICON_MAP.ClipboardListIcon className="w-4 h-4" />
              Board
            </button>

            <button
              onClick={() => setViewMode('sprints')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'sprints'
                  ? 'bg-accent text-white shadow-sm'
                  : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ICON_MAP.RocketLaunchIcon className="w-4 h-4" />
              Sprints & Backlog
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-accent text-white shadow-sm'
                  : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ICON_MAP.DocumentTextIcon className="w-4 h-4" />
              List
            </button>

            <button
              onClick={() => setViewMode('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'gantt'
                  ? 'bg-accent text-white shadow-sm'
                  : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ICON_MAP.ClockIcon className="w-4 h-4" />
              Gantt / Timeline
            </button>
          </div>

          {/* Swimlane Dropdown (only on Kanban mode) */}
          {viewMode === 'kanban' && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium ${
              darkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <span className="text-slate-400">Swimlanes:</span>
              <select
                value={swimlaneMode}
                onChange={(e) => setSwimlaneMode(e.target.value as SwimlaneType)}
                className={`bg-transparent outline-none cursor-pointer font-semibold ${
                  darkMode ? 'text-slate-200' : 'text-slate-900'
                }`}
              >
                <option value="none" className={darkMode ? 'bg-slate-800' : 'bg-white'}>None (Standard)</option>
                <option value="assignee" className={darkMode ? 'bg-slate-800' : 'bg-white'}>By Assignee</option>
                <option value="priority" className={darkMode ? 'bg-slate-800' : 'bg-white'}>By Priority</option>
              </select>
            </div>
          )}
        </div>

        {/* Right: Agile Stats & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Progress / Velocity Badge */}
          <div className={`hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl border text-xs ${
            darkMode ? 'bg-slate-800/60 border-slate-700/60 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span className="font-semibold">{stats.done}/{stats.total} Done ({stats.progressPercent}%)</span>
            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${stats.progressPercent}%` }} />
            </div>
            <span className="text-slate-400">|</span>
            <span className="font-semibold text-accent">{stats.completedStoryPoints}/{stats.totalStoryPoints} pts</span>
          </div>

          {/* WIP Limit Settings Button */}
          {viewMode === 'kanban' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsWipModalOpen(true)}
              className="gap-1.5 text-xs font-semibold"
              title="Configure Work-In-Progress Limits"
            >
              <ICON_MAP.AdjustmentsHorizontalIcon className="w-3.5 h-3.5 text-slate-400" />
              WIP Limits
            </Button>
          )}

          {/* Automations Button */}
          {(currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.PROJECT_MANAGER) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAutomationsOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <ICON_MAP.CogIcon className="w-4 h-4 text-accent" />
              Automations
            </Button>
          )}
        </div>
      </div>

      {/* Quick Filters Bar (Jira / Linear Style) */}
      <div className={`flex items-center gap-2 p-2.5 mb-3 rounded-xl border flex-wrap text-xs ${
        darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/80 border-slate-200/80'
      }`}>
        {/* Search Filter Input */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by title, tag, desc..."
            className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none transition-all ${
              darkMode 
                ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-accent' 
                : 'bg-white border-slate-300 text-slate-800 focus:border-accent'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              ×
            </button>
          )}
        </div>

        {/* Quick Filter Chips */}
        <button
          onClick={() => setFilterMyTasks(!filterMyTasks)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all border ${
            filterMyTasks
              ? 'bg-accent text-white border-accent shadow-sm'
              : darkMode 
                ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ICON_MAP.UserIcon className="w-3.5 h-3.5" />
          My Tasks
        </button>

        <button
          onClick={() => setFilterUnassigned(!filterUnassigned)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all border ${
            filterUnassigned
              ? 'bg-accent text-white border-accent shadow-sm'
              : darkMode 
                ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ICON_MAP.UserGroupIcon className="w-3.5 h-3.5" />
          Unassigned
        </button>

        {/* Priority Filter Select */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
          darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <span className="text-slate-400">Priority:</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className={`bg-transparent outline-none cursor-pointer font-medium ${
              darkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            <option value="all" className={darkMode ? 'bg-slate-800' : 'bg-white'}>All</option>
            <option value="urgent" className={darkMode ? 'bg-slate-800' : 'bg-white'}>Urgent</option>
            <option value="high" className={darkMode ? 'bg-slate-800' : 'bg-white'}>High</option>
            <option value="medium" className={darkMode ? 'bg-slate-800' : 'bg-white'}>Medium</option>
            <option value="low" className={darkMode ? 'bg-slate-800' : 'bg-white'}>Low</option>
          </select>
        </div>

        {/* Sprint Filter Select */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
          darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <span className="text-slate-400">Sprint:</span>
          <select
            value={filterSprint}
            onChange={(e) => setFilterSprint(e.target.value)}
            className={`bg-transparent outline-none cursor-pointer font-medium ${
              darkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            <option value="all" className={darkMode ? 'bg-slate-800' : 'bg-white'}>All Tasks</option>
            <option value="active" className={darkMode ? 'bg-slate-800' : 'bg-white'}>Active Sprint</option>
            <option value="backlog" className={darkMode ? 'bg-slate-800' : 'bg-white'}>Product Backlog</option>
            {sprints.filter(s => s.projectId === activeProject?.id).map(sp => (
              <option key={sp.id} value={sp.id} className={darkMode ? 'bg-slate-800' : 'bg-white'}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Count & Reset */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-accent font-semibold">
              Showing {filteredProjectTasks.length} of {rawProjectTasks.length}
            </span>
            <button
              onClick={resetFilters}
              className="text-xs text-red-500 hover:underline font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Main View Render */}
      {viewMode === 'sprints' ? (
        <SprintPlanningView />
      ) : viewMode === 'kanban' ? (
        swimlaneMode === 'none' ? (
          /* Standard Columns */
          <div className="flex-1 flex space-x-3 md:space-x-4 overflow-x-auto scrollbar-thin">
            {TASK_STATUS_COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                status={column.id as TaskStatus} 
                title={column.title}
                colorClass={column.color}
                tasksOverride={hasActiveFilters ? filteredProjectTasks : undefined}
                wipLimit={wipLimits[column.id]}
              />
            ))}
          </div>
        ) : (
          /* Swimlane Rows */
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
            {swimlanes.map(swimlane => {
              const isCollapsed = collapsedSwimlanes[swimlane.id];
              return (
                <div 
                  key={swimlane.id}
                  className={`rounded-2xl border transition-all ${
                    darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  {/* Swimlane Header */}
                  <div 
                    onClick={() => toggleSwimlane(swimlane.id)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer select-none rounded-t-2xl ${
                      darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-slate-400 text-xs">
                        {isCollapsed ? '▶' : '▼'}
                      </span>
                      {swimlane.avatar ? (
                        <img src={swimlane.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold">
                          {swimlane.title.charAt(0)}
                        </span>
                      )}
                      <h3 className={`font-bold text-sm ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {swimlane.title}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {swimlane.tasks.length} tasks
                      </span>
                    </div>
                  </div>

                  {/* Swimlane Columns Body */}
                  {!isCollapsed && (
                    <div className="p-3 flex space-x-3 overflow-x-auto scrollbar-thin">
                      {TASK_STATUS_COLUMNS.map(column => (
                        <KanbanColumn
                          key={`${swimlane.id}-${column.id}`}
                          status={column.id as TaskStatus}
                          title={column.title}
                          colorClass={column.color}
                          tasksOverride={swimlane.tasks}
                          wipLimit={wipLimits[column.id]}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : viewMode === 'list' ? (
        <TaskListView
          tasks={filteredProjectTasks}
          users={users}
          darkMode={darkMode}
          onTaskClick={openViewTaskModal}
        />
      ) : (
        <GanttTimelineView
          tasks={filteredProjectTasks}
          users={users}
          darkMode={darkMode}
          onTaskClick={openViewTaskModal}
        />
      )}

      {/* Automated Triggers Modal */}
      <AutomatedTriggersModal
        isOpen={isAutomationsOpen}
        onClose={() => setIsAutomationsOpen(false)}
        users={users}
        darkMode={darkMode}
      />

      {/* WIP Limits Configuration Modal */}
      {isWipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Configure WIP Limits</h3>
              <button onClick={() => setIsWipModalOpen(false)} className="text-slate-400 hover:text-slate-200 text-lg">✕</button>
            </div>
            <p className={`text-xs mb-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Set maximum task thresholds per column to maintain agile flow and prevent team bottlenecks.
            </p>

            <div className="space-y-4">
              {TASK_STATUS_COLUMNS.map(col => (
                <div key={col.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${col.color}`} />
                    <span className="text-sm font-medium">{col.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={wipLimits[col.id] || 0}
                      onChange={(e) => handleUpdateWipLimit(col.id, parseInt(e.target.value) || 0)}
                      className={`w-20 px-3 py-1.5 rounded-lg border text-sm font-semibold text-center outline-none ${
                        darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                      }`}
                    />
                    <span className="text-xs text-slate-400">max</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={() => setIsWipModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
