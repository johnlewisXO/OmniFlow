

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { EditTaskModal } from './components/tasks/EditTaskModal'; 
import { TaskDetailsModal } from './components/tasks/TaskDetailsModal';
import { CreateProjectModal } from './components/projects/CreateProjectModal';
import { CreateOrJoinOrganizationModal } from './components/auth/CreateOrJoinOrganizationModal';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from './hooks/useAppStore';
import supabaseService, { supabase } from './services/supabaseService';
import { AuthPage } from './components/auth/AuthPage';
import { User as AppUserType, Project, UserRole, ActiveView } from './types';

// Import Role Specific Dashboards
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { ProjectManagerDashboard } from './components/dashboards/ProjectManagerDashboard';
import { MemberDashboard } from './components/dashboards/MemberDashboard';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
import { OwnerDashboard } from './components/dashboards/OwnerDashboard';
import { ClientViewerDashboard } from './components/dashboards/ClientViewerDashboard';
import { KanbanBoard } from './components/tasks/KanbanBoard';
import { ICON_MAP } from './constants';

// Import Landing Page
import LandingPage from './components/landing/LandingPage';

// Import New Placeholder Page Components
import { ProjectsOverviewPage } from './components/projects/ProjectsOverviewPage';
import { MyTasksPage } from './components/tasks/MyTasksPage';
import { InboxPage } from './components/inbox/InboxPage';
import { ReportsPage } from './components/reports/ReportsPage';
import { TeamManagementPage } from './components/team/TeamManagementPage'; 
import { TaskAutomationsDashboard } from './components/automations/TaskAutomationsDashboard'; 
import { SprintPlanningView } from './components/sprints/SprintPlanningView';
import { TeamsChatPage } from './components/chat/TeamsChatPage';
import { CommandPalette } from './components/layout/CommandPalette'; 
import { KeyboardShortcutsModal } from './components/layout/KeyboardShortcutsModal'; 
import { AIProjectManagerStudio } from './components/ai/AIProjectManagerStudio';
import { FloatingAICopilotButton } from './components/ai/FloatingAICopilotButton';
import logMonitorService from './services/logMonitorService';
import { SystemLogMonitorModal } from './components/shared/SystemLogMonitorModal';
import { EmailOutboxAndVerifyModal } from './components/shared/EmailOutboxAndVerifyModal';
import emailNotificationService from './services/emailNotificationService';
import { CalendarMeetingsPage } from './components/calendar/CalendarMeetingsPage';
import { VideoCallStudioModal } from './components/chat/VideoCallStudioModal';

// Initialize global exception and console log monitoring immediately
if (typeof logMonitorService?.init === 'function') {
  logMonitorService.init();
}

const ToastContainer: React.FC = () => {
  const {
    notifications,
    markNotificationAsRead,
    darkMode,
    tasks,
    projects,
    setActiveProject,
    setActiveView,
    openViewTaskModal,
    setHighlightedTaskId,
    setHighlightedProjectId
  } = useAppStore();
  const [visibleToasts, setVisibleToasts] = useState<string[]>([]);
  const seenToastIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();
    const newUnread = notifications.filter(n => {
      const createdTime = new Date(n.created_at).getTime();
      return !n.read && now - createdTime < 7000 && !seenToastIdsRef.current.has(n.id);
    });

    if (newUnread.length > 0) {
      const newIds = newUnread.map(n => n.id);
      newIds.forEach(id => seenToastIdsRef.current.add(id));
      setVisibleToasts(prev => Array.from(new Set([...prev, ...newIds])));

      newIds.forEach(id => {
        setTimeout(() => {
          setVisibleToasts(prev => prev.filter(tId => tId !== id));
        }, 5500);
      });
    }
  }, [notifications]);

  const getToastActionConfig = (n: any): { isInteractive: boolean; label: string | null } => {
    const typeStr = (n.type || '').toUpperCase();
    const titleStr = (n.title || '').toLowerCase();
    const entityType = n.entity_type;

    // 1. ONLY show "View & reply →" for Teams Chat messages and Task Mentions / Task Comments
    const isChatMsg =
      (entityType === 'chat' && !titleStr.includes('updated status')) ||
      typeStr.includes('CHAT_MESSAGE') ||
      typeStr.includes('DIRECT_MESSAGE') ||
      titleStr.startsWith('💬');

    const isTaskMentionOrComment =
      typeStr === 'MENTION' ||
      typeStr.includes('COMMENT') ||
      Boolean(n.metadata?.isComment) ||
      titleStr.includes('mentioned by') ||
      titleStr.includes('new comment on');

    if (isChatMsg || isTaskMentionOrComment) {
      return { isInteractive: true, label: 'View & reply →' };
    }

    // 2. Teammate status update in chat
    if (entityType === 'chat' && titleStr.includes('updated status')) {
      return { isInteractive: true, label: 'Open Direct Message →' };
    }

    // 3. Task Deleted
    if (typeStr === 'TASK_DELETED') {
      return { isInteractive: true, label: 'View project board →' };
    }

    // 4. Other Task Updates (Assigned, Created, Status Changed, Due Soon, Overdue)
    if (entityType === 'task' || typeStr.includes('TASK')) {
      return { isInteractive: true, label: 'Open task details →' };
    }

    // 5. Project Updates
    if (entityType === 'project' || typeStr.includes('PROJECT')) {
      return { isInteractive: true, label: 'Open project board →' };
    }

    // 6. Team / Role / Organization Invites
    if (
      entityType === 'user' ||
      typeStr.includes('ROLE') ||
      typeStr.includes('INVITE') ||
      titleStr.includes('role updated')
    ) {
      return { isInteractive: true, label: 'View team directory →' };
    }

    // 7. Calendar & RSVP notifications
    if (
      entityType === 'calendar' ||
      typeStr.includes('CALENDAR') ||
      typeStr.includes('RSVP') ||
      titleStr.startsWith('📅')
    ) {
      return { isInteractive: true, label: 'Open Calendar & RSVP →' };
    }

    // 8. Incoming Video Call notifications
    if (typeStr.includes('VIDEO_CALL') || titleStr.startsWith('📹')) {
      return { isInteractive: true, label: 'Join Video Call →' };
    }

    // 9. Sprint updates
    if (typeStr.includes('SPRINT') || titleStr.includes('sprint ')) {
      return { isInteractive: true, label: 'View sprint board →' };
    }

    // 10. Email / Verification updates
    if (titleStr.includes('email') || titleStr.includes('verification')) {
      return { isInteractive: true, label: 'Open Email Center →' };
    }

    return { isInteractive: false, label: null };
  };

  const handleToastClick = async (n: any) => {
    markNotificationAsRead(n.id);
    setVisibleToasts(prev => prev.filter(id => id !== n.id));

    const typeStr = (n.type || '').toUpperCase();
    const titleStr = (n.title || '').toLowerCase();
    const entityType =
      n.entity_type ||
      (typeStr.includes('CALENDAR') || typeStr.includes('RSVP')
        ? 'calendar'
        : typeStr.includes('CHAT')
        ? 'chat'
        : typeStr.includes('TASK') || typeStr === 'MENTION'
        ? 'task'
        : typeStr.includes('PROJECT')
        ? 'project'
        : undefined);
    const targetId = n.entity_id || n.reference_id;

    // 0. Calendar or RSVP notification -> open Calendar & Meetings
    if (
      entityType === 'calendar' ||
      typeStr.includes('CALENDAR') ||
      typeStr.includes('RSVP') ||
      titleStr.startsWith('📅')
    ) {
      setActiveView('calendar_view');
      return;
    }

    // 1. Direct message or chat notification
    if (entityType === 'chat' || typeStr.includes('CHAT') || titleStr.startsWith('💬')) {
      setActiveView('team_chat_view');
      if (targetId) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('omni_select_chat_contact', { detail: { userId: targetId } }));
        }, 80);
      }
      return;
    }

    // 2. Task Deleted -> go to Kanban board
    if (typeStr === 'TASK_DELETED') {
      setActiveView('kanban');
      return;
    }

    // 3. Task comment, mention, or task update
    if (entityType === 'task' || typeStr === 'MENTION' || typeStr.includes('TASK')) {
      let targetTask = tasks.find(t => t.id === targetId);
      if (!targetTask && targetId) {
        try {
          const { data } = await supabase.from('tasks').select('*').eq('id', targetId).single();
          if (data) {
            targetTask = data as any;
          }
        } catch (e) {}
      }

      if (targetTask) {
        if (targetTask.project_id) {
          const proj = projects.find(p => p.id === targetTask!.project_id);
          if (proj) setActiveProject(proj);
        }
        setActiveView('kanban');
        setHighlightedTaskId(targetTask.id);
        openViewTaskModal(targetTask);

        if (typeStr === 'MENTION' || n.metadata?.isComment) {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('omni_focus_task_comments', {
                detail: { taskId: targetTask!.id, commentId: n.metadata?.commentId },
              })
            );
          }, 150);
        }
      }
      return;
    }

    // 4. Project update
    if (entityType === 'project' || typeStr.includes('PROJECT')) {
      const proj = projects.find(p => p.id === targetId);
      if (proj) {
        setActiveProject(proj);
        setHighlightedProjectId(proj.id);
        setActiveView('kanban');
      } else {
        setActiveView('projects_overview');
      }
      return;
    }

    // 5. Team / Role / User update
    if (entityType === 'user' || typeStr.includes('ROLE') || typeStr.includes('INVITE') || titleStr.includes('role updated')) {
      setActiveView('team_management');
      return;
    }

    // 6. Sprint update
    if (typeStr.includes('SPRINT') || titleStr.includes('sprint ')) {
      setActiveView('sprints_view');
      return;
    }

    // 7. Email / Verification center
    if (titleStr.includes('email') || titleStr.includes('verification')) {
      window.dispatchEvent(new CustomEvent('omni_open_email_center', { detail: { tab: 'outbox' } }));
    }
  };

  if (visibleToasts.length === 0) return null;

  const toastsToShow = notifications.filter(n => visibleToasts.includes(n.id));

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toastsToShow.map(n => {
        const type = n.toastType || (n.type === 'TASK_DELETED' || n.type === 'USER_REMOVED_FROM_ORG' ? 'error' : 'success');
        const { isInteractive, label: actionLabel } = getToastActionConfig(n);
        
        let iconEl = <ICON_MAP.CheckIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
        let borderClass = 'border-emerald-500/30 dark:border-emerald-500/40';
        let bgAccent = 'bg-emerald-500/10';

        if (type === 'error') {
          iconEl = <ICON_MAP.ExclamationIcon className="w-5 h-5 text-red-500 flex-shrink-0" />;
          borderClass = 'border-red-500/30 dark:border-red-500/40';
          bgAccent = 'bg-red-500/10';
        } else if (type === 'warning') {
          iconEl = <ICON_MAP.ExclamationIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />;
          borderClass = 'border-amber-500/30 dark:border-amber-500/40';
          bgAccent = 'bg-amber-500/10';
        } else if (type === 'info') {
          iconEl = <ICON_MAP.SparklesIcon className="w-5 h-5 text-accent flex-shrink-0" />;
          borderClass = 'border-accent/30 dark:border-accent/40';
          bgAccent = 'bg-accent/10';
        }

        return (
          <div
            key={n.id}
            onClick={() => isInteractive && handleToastClick(n)}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-xl border backdrop-blur-md flex items-start gap-3 transition-all duration-300 transform translate-y-0 animate-in slide-in-from-bottom-4 ${borderClass} ${
              isInteractive ? 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl active:scale-[0.99]' : ''
            } ${
              darkMode ? 'bg-slate-900/95 text-slate-100' : 'bg-white/95 text-slate-900'
            }`}
          >
            <div className={`p-1.5 rounded-lg ${bgAccent}`}>
              {iconEl}
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 leading-snug truncate">
                  {n.title || (n.type ? n.type.replace(/_/g, ' ') : 'Notification')}
                </h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5 break-words">
                {n.message || n.content}
              </p>
              {isInteractive && actionLabel && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  {actionLabel}
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                markNotificationAsRead(n.id);
                setVisibleToasts(prev => prev.filter(id => id !== n.id));
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              aria-label="Dismiss notification"
            >
              <ICON_MAP.XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

const MainAppLayout: React.FC = () => {
  const {
    currentUser,
    authError,
    activeView,
    activeProject,
    setActiveView,
    openModal,
    isCreateProjectModalOpen, closeCreateProjectModal,
    createProject: createProjectActionFromStore,
    isLoadingCreateProject,
    createProjectError,
    isCommandPaletteOpen, closeCommandPalette, toggleCommandPalette,
    openShortcutsModal,
    toggleMobileSidebar,
    projectsError, 
    tasksError,    
    darkMode,
    fetchUsersForAssignmentList, 
    users, 
    isLoadingUsersForAssignment,
    error
  } = useAppStore();

  const ExclamationIcon = ICON_MAP.ExclamationIcon;
  const [isSystemLogMonitorOpen, setIsSystemLogMonitorOpen] = useState(false);
  const [isEmailCenterOpen, setIsEmailCenterOpen] = useState(false);
  const [emailCenterInitialTab, setEmailCenterInitialTab] = useState<'verify' | 'outbox'>('verify');
  const [scrollBounceState, setScrollBounceState] = useState<'none' | 'top' | 'bottom'>('none');

  useEffect(() => {
    const handleOpenLogMonitor = () => setIsSystemLogMonitorOpen(true);
    const handleOpenEmailCenter = (e: any) => {
      if (e?.detail?.tab) {
        setEmailCenterInitialTab(e.detail.tab);
      } else {
        setEmailCenterInitialTab('verify');
      }
      setIsEmailCenterOpen(true);
    };
    window.addEventListener('omni_open_system_log_monitor', handleOpenLogMonitor);
    window.addEventListener('omni_open_email_center', handleOpenEmailCenter as EventListener);
    return () => {
      window.removeEventListener('omni_open_system_log_monitor', handleOpenLogMonitor);
      window.removeEventListener('omni_open_email_center', handleOpenEmailCenter as EventListener);
    };
  }, []);

  // Subtle elastic bubble-stretch effect when reaching scroll boundaries on views or scrollable components
  useEffect(() => {
    let bounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastBounceTime = 0;

    const handleScrollCapture = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.scrollTop !== 'number' || typeof target.scrollHeight !== 'number') return;
      if (target.scrollHeight <= target.clientHeight + 24) return;

      const now = Date.now();
      if (now - lastBounceTime < 550) return;

      const atTop = target.scrollTop <= 0;
      const atBottom = Math.ceil(target.scrollTop + target.clientHeight) >= target.scrollHeight - 2;

      if (atTop || atBottom) {
        lastBounceTime = now;
        const animClass = atTop ? 'animate-bubbleStretchTop' : 'animate-bubbleStretchBottom';
        target.classList.remove('animate-bubbleStretchTop', 'animate-bubbleStretchBottom');
        void target.offsetWidth; // Reflow to trigger animation cleanly
        target.classList.add(animClass);

        if (target.dataset?.mainScrollView === 'true') {
          setScrollBounceState(atTop ? 'top' : 'bottom');
          if (bounceTimeout) clearTimeout(bounceTimeout);
          bounceTimeout = setTimeout(() => setScrollBounceState('none'), 480);
        }

        setTimeout(() => {
          target.classList.remove('animate-bubbleStretchTop', 'animate-bubbleStretchBottom');
        }, 500);
      }
    };

    window.addEventListener('scroll', handleScrollCapture, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollCapture, { capture: true } as any);
      if (bounceTimeout) clearTimeout(bounceTimeout);
    };
  }, []);

  useEffect(() => {
    if (currentUser && activeView === 'team_management' && currentUser.organization_id && users.length === 0 && !isLoadingUsersForAssignment) {
      fetchUsersForAssignmentList();
    }
  }, [activeView, currentUser, users, isLoadingUsersForAssignment, fetchUsersForAssignmentList]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      // Cmd+K / Ctrl+K Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      if (isInput) return;

      // ? for Keyboard Shortcuts
      if (e.key === '?') {
        e.preventDefault();
        openShortcutsModal();
        return;
      }

      // C for Create Task
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openModal();
        return;
      }

      // B to toggle sidebar on mobile/desktop
      if (e.key.toLowerCase() === 'b' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleMobileSidebar();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleCommandPalette, openShortcutsModal, openModal, toggleMobileSidebar]);

  const handleCreateProjectSubmit = async (projectData: Pick<Project, 'name' | 'description'>) => {
    try {
        const newProject = await createProjectActionFromStore(projectData);
    } catch (error) {
        console.error("[App.tsx MainAppLayout] Error calling createProjectActionFromStore:", error);
    }
  };

  const renderContentByView = () => {
    if (!currentUser) {
      return <AuthPage />;
    }

    const criticalBackendError = projectsError || tasksError;
    if (criticalBackendError && (criticalBackendError.toLowerCase().includes("policy") || criticalBackendError.toLowerCase().includes("recursion") || criticalBackendError.toLowerCase().includes("rls"))) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 bg-transparent">
          <div className={`text-center p-6 rounded-squircle-lg border shadow-glass-lg ${darkMode ? 'bg-status-error/20 border-status-error/40' : 'bg-status-error/10 border-status-error/30'}`}
               style={{backgroundColor: 'hsl(var(--panel-background))'}} /* Ensure glass panel style */
          >
            <ExclamationIcon className={`w-16 h-16 mx-auto mb-4 text-status-error`} />
            <h2 className={`text-xl font-semibold text-status-error`}>Backend Data Error</h2>
            <p className={`${darkMode ? 'text-red-300' : 'text-red-700'} mt-2 text-sm max-w-md mx-auto`}>
              The application cannot load essential data due to a backend configuration issue (likely RLS policies).
              Please check the console for details and resolve the backend error.
            </p>
            <p className={`mt-1 text-xs ${darkMode ? 'text-red-400' : 'text-red-600'}`}>Details: {criticalBackendError}</p>
          </div>
        </div>
      );
    }


    switch (activeView) {
      case 'overview':
        if (!currentUser.role && !authError) { 
          return <MemberDashboard />; 
        }
        switch (currentUser.role) {
          case UserRole.OWNER: return <OwnerDashboard />;
          case UserRole.ADMIN: return <AdminDashboard />;
          case UserRole.PROJECT_MANAGER: return <ProjectManagerDashboard />;
          case UserRole.MEMBER: return <MemberDashboard />;
          case UserRole.CLIENT_VIEWER: return <ClientViewerDashboard />;
          default:
            return <MemberDashboard />; 
        }
      case 'kanban':
        return <KanbanBoard />;
      case 'projects_overview':
        return <ProjectsOverviewPage />;
      case 'sprints_view':
        return <SprintPlanningView />;
      case 'my_tasks_view':
        return <MyTasksPage />;
      case 'team_chat_view':
        return <TeamsChatPage />;
      case 'inbox_view':
        return <InboxPage />;
      case 'reports_view':
        return <ReportsPage />;
      case 'user_logs_view':
        return <TeamManagementPage />;
      case 'team_management':
        return <TeamManagementPage />; 
      case 'task_automations':
      case 'task_automations_view':
        return <TaskAutomationsDashboard />;
      case 'ai_copilot_view':
        return <AIProjectManagerStudio />;
      case 'calendar_view':
        return <CalendarMeetingsPage />;
      case 'admin_settings':
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.OWNER) {
          return <AdminDashboard />;
        }
        return <MemberDashboard />;
      case 'profile_settings':
        return <ProfileSettingsPage />;
      default:
         if (currentUser.role === UserRole.OWNER) return <OwnerDashboard />;
         if (currentUser.role === UserRole.ADMIN) return <AdminDashboard />;
        return <MemberDashboard />;
    }
  };

  return (
    <div className="h-full w-full flex gap-2 sm:gap-3 md:gap-4 min-w-0">
      <Sidebar />
      <div className="flex-1 flex flex-col gap-2 sm:gap-3 md:gap-4 min-w-0 h-full overflow-hidden">
        <Header />
        <div
          data-main-scroll-view="true"
          className={`flex-1 flex flex-col glass-panel rounded-2xl p-0 overflow-y-auto scrollbar-thin min-h-0 min-w-0 transition-transform duration-300 ${
            scrollBounceState === 'top'
              ? 'animate-bubbleStretchTop'
              : scrollBounceState === 'bottom'
                ? 'animate-bubbleStretchBottom'
                : ''
          }`}
        >
          {authError && !authError.toLowerCase().includes("rls") && !authError.toLowerCase().includes("policy") && ( 
            <div className={`p-3 m-3 rounded-xl text-xs sm:text-sm text-center border ${darkMode ? 'bg-status-error/20 text-red-300 border-status-error/40' : 'bg-status-error/10 text-red-700 border-status-error/30'}`}>
                <strong>Authentication Issue:</strong> {authError}
            </div>
          )}
          {error && (
            <div className={`p-3 m-3 rounded-xl text-xs sm:text-sm text-center border ${darkMode ? 'bg-status-error/20 text-red-300 border-status-error/40' : 'bg-status-error/10 text-red-700 border-status-error/30'}`}>
                <strong>Error:</strong> {error}
            </div>
          )}
          {renderContentByView()}
        </div>
      </div>
      <ToastContainer />
      <EditTaskModal /> 
      <TaskDetailsModal />
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={closeCreateProjectModal}
        onCreateProject={handleCreateProjectSubmit}
        isLoading={isLoadingCreateProject}
        error={createProjectError}
      />
      <CreateOrJoinOrganizationModal />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
      />
      <FloatingAICopilotButton />
      <KeyboardShortcutsModal />
      <SystemLogMonitorModal
        isOpen={isSystemLogMonitorOpen}
        onClose={() => setIsSystemLogMonitorOpen(false)}
      />
      <EmailOutboxAndVerifyModal
        isOpen={isEmailCenterOpen}
        onClose={() => setIsEmailCenterOpen(false)}
        initialTab={emailCenterInitialTab}
      />
      <VideoCallStudioModal />
    </div>
  );
};

const GlobalSpinner: React.FC = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  return (
    <div className={`h-screen w-screen flex gap-3 md:gap-4 p-3 md:p-4 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Sidebar Skeleton */}
      <div className={`w-64 flex-shrink-0 rounded-xl border shadow-sm animate-pulse ${isDarkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white/50 border-slate-200/50'}`}>
        <div className="p-6 space-y-6">
          <div className={`h-8 w-3/4 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`h-6 w-full rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col gap-3 md:gap-4 min-w-0">
        {/* Header Skeleton */}
        <div className={`h-16 rounded-xl border shadow-sm animate-pulse flex items-center justify-between px-6 ${isDarkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white/50 border-slate-200/50'}`}>
          <div className={`h-6 w-48 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          <div className="flex gap-4">
            <div className={`h-8 w-8 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            <div className={`h-8 w-8 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          </div>
        </div>
        
        {/* Content Area Skeleton */}
        <div className={`flex-1 rounded-xl border shadow-sm animate-pulse p-6 ${isDarkMode ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white/50 border-slate-200/50'}`}>
          <div className={`h-8 w-64 rounded mb-8 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={`h-48 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const localParseErrorMessage = (error: any, defaultMessage: string = "An unexpected error occurred in the application."): string => {
  if (!error) return defaultMessage;
  let message = defaultMessage;

  if (typeof error === 'string' && error.trim()) {
    message = error;
  } else if (error.message && typeof error.message === 'string' && error.message.trim()) {
    message = error.message;
  } else if (error.error_description && typeof error.error_description === 'string' && error.error_description.trim()) {
    message = error.error_description;
  }
  return message;
};

function App() {
  const [currentRoute, setCurrentRoute] = useState(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isAuthCallback =
      hash.includes('access_token=') ||
      hash.includes('type=signup') ||
      hash.includes('type=recovery') ||
      hash.includes('verify-email=') ||
      search.includes('token_hash=') ||
      search.includes('type=signup') ||
      search.includes('type=recovery');
    if (isAuthCallback) return '#/app';
    return (!hash || hash === '#' || hash === '#/') ? '/' : hash;
  });

  const {
    currentUser, setCurrentUser,
    appLoading, setAppLoading,
    authError, setAuthError,
    fetchProjects,
    fetchMyTasks,
    fetchNotifications,
    addNotification,
    fetchUsersForAssignmentList,
    activeProject, setActiveProject,
    projects, setProjects, 
    projectsError, 
    activeView, setActiveView,
    users, setUsers,
    tasks, setTasks,
    isLoadingProjects,
    setTasksError, setProjectsError, setUsersForAssignmentError,
    updateUserPresence,
  } = useAppStore();

  // Seamlessly broadcast user's current view and project presence across the platform
  useEffect(() => {
    if (currentUser?.id) {
      updateUserPresence(undefined, activeView, {
        projectId: activeProject?.id,
        statusAction: activeProject ? `viewing_${activeView}` : 'online'
      });
    }
  }, [currentUser?.id, activeProject?.id, activeView, updateUserPresence]);


  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash || '/';
      if (
        newHash.includes('access_token=') ||
        newHash.includes('type=signup') ||
        newHash.includes('type=recovery') ||
        newHash.includes('verify-email=')
      ) {
        setCurrentRoute('#/app');
        return;
      }
      setCurrentRoute(newHash === '#/' || newHash === '#' ? '/' : newHash);
    };
    window.addEventListener('hashchange', handleHashChange);

    const browserHash = window.location.hash;
    const isAuthHash =
      browserHash.includes('access_token=') ||
      browserHash.includes('type=signup') ||
      browserHash.includes('type=recovery') ||
      browserHash.includes('verify-email=');

    if ((browserHash === '' || browserHash === '#' || browserHash === '#/') && currentRoute.startsWith('#/app')) {
        setCurrentRoute('/'); 
    } else if ((browserHash.startsWith('#/app') || isAuthHash) && currentRoute === '/') {
        setCurrentRoute('#/app'); 
    }


    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [currentRoute]); 

  useEffect(() => {
    // 1. Immediately extract and save any invitation token present in URL
    const hash = window.location.hash;
    const search = window.location.search;
    let urlToken: string | null = null;

    if (hash.includes('join-token=')) {
      urlToken = hash.split('join-token=')[1]?.split('&')[0];
    } else if (search.includes('invite=')) {
      urlToken = new URLSearchParams(search).get('invite');
    }

    if (urlToken) {
      localStorage.setItem('pending_invite_token', urlToken);
    }

    // 2. Process Invitation Tokens in Hash, Query String, or LocalStorage
    const processInvitationToken = async () => {
      if (!currentUser) return;
      const token = localStorage.getItem('pending_invite_token') || urlToken;

      if (token) {
        try {
          const invite = await supabaseService.getInvitationByToken(token);
          if (invite && invite.status === 'pending') {
            const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
            if (isExpired) {
              alert('This organization invitation link has expired.');
              localStorage.removeItem('pending_invite_token');
              return;
            }

            // Accept invitation: assign user to org & role
            await supabaseService.client
              .from('user_profiles')
              .update({ organization_id: invite.organization_id, role: invite.role })
              .eq('id', currentUser.id);

            setCurrentUser({
              ...currentUser,
              organization_id: invite.organization_id,
              role: invite.role
            });

            // Mark invitation accepted & clear pending storage
            await supabaseService.revokeInvitation(invite.id);
            localStorage.removeItem('pending_invite_token');

            // Log Audit Event
            await supabaseService.logAuditEvent({
              organization_id: invite.organization_id,
              actor_id: currentUser.id,
              actor_name: currentUser.full_name || currentUser.email,
              actor_email: currentUser.email,
              action: 'invite_accepted',
              target_type: 'user',
              target_id: currentUser.id,
              target_name: currentUser.full_name || currentUser.email,
              details: { role: invite.role, invitation_id: invite.id }
            });

            addNotification({
              id: crypto.randomUUID(),
              user_id: currentUser.id,
              type: 'ORGANIZATION_INVITE_ACCEPTED',
              title: 'Invitation Accepted!',
              message: `You successfully joined the organization with role "${invite.role}".`,
              read: false,
              created_at: new Date().toISOString()
            });

            // Clean token from URL
            window.history.replaceState(null, '', window.location.pathname + '#/app');
          }
        } catch (err) {
          console.error('Error processing invitation token:', err);
        }
      }
    };

    processInvitationToken();
  }, [currentUser, currentRoute]);

  useEffect(() => {
    if (currentRoute.startsWith('#/app')) {
      document.body.classList.remove('landing-page-active');
      document.title = currentUser ? "Omni Flow - App" : "Omni Flow - Login";
    } else { 
      document.body.classList.add('landing-page-active');
      document.title = "Omni Flow - Flow Like a Pro";
      if (activeView !== 'overview') setActiveView('overview'); 
      if (activeProject) setActiveProject(null); 
    }
  }, [currentRoute, currentUser, activeView, activeProject, setActiveView, setActiveProject]);


  useEffect(() => {
    console.log('[App.tsx AuthEffect] Initializing auth handling.');
    let mounted = true;

    // Handle email confirmation tokens (#access_token=...&type=signup or ?token_hash=...&type=signup)
    const processUrlEmailConfirmation = async () => {
      if (typeof window === 'undefined') return;
      const combined = `${window.location.hash}&${window.location.search}`;
      const isSignupConfirm = combined.includes('type=signup') || combined.includes('type=email') || combined.includes('verify-email=');
      const accessTokenMatch = combined.match(/access_token=([^&]+)/);
      const refreshTokenMatch = combined.match(/refresh_token=([^&]+)/);
      const tokenHashMatch = combined.match(/token_hash=([^&]+)/);

      if (accessTokenMatch?.[1] && refreshTokenMatch?.[1] && !combined.includes('type=recovery')) {
        try {
          const { data } = await supabase.auth.setSession({
            access_token: decodeURIComponent(accessTokenMatch[1]),
            refresh_token: decodeURIComponent(refreshTokenMatch[1]),
          });
          if (data?.user && isSignupConfirm) {
            const prof = await supabaseService.ensureUserProfileForSession(data.user);
            if (prof) {
              await emailNotificationService.verifyUserEmail(prof);
              useAppStore.getState().addToast('Email Confirmed!', `Your email (${prof.email}) is now verified.`, 'success');
            }
            window.history.replaceState(null, '', window.location.pathname + '#/app');
          }
        } catch {}
      } else if (tokenHashMatch?.[1] && isSignupConfirm) {
        try {
          const { data } = await supabase.auth.verifyOtp({
            token_hash: decodeURIComponent(tokenHashMatch[1]),
            type: 'signup',
          });
          if (data?.user) {
            const prof = await supabaseService.ensureUserProfileForSession(data.user);
            if (prof) {
              await emailNotificationService.verifyUserEmail(prof);
              useAppStore.getState().addToast('Email Confirmed!', `Your email (${prof.email}) is now verified.`, 'success');
            }
            window.history.replaceState(null, '', window.location.pathname + '#/app');
          }
        } catch {}
      }
    };
    processUrlEmailConfirmation();

    const finishInitialLoad = () => {
      if (mounted && useAppStore.getState().appLoading) {
        setAppLoading(false);
      }
    };

    // Safety fallback timer to prevent infinite loading screen under any condition
    const safetyTimer = setTimeout(() => {
      if (mounted && useAppStore.getState().appLoading) {
        console.warn('[App.tsx AuthEffect] Initial loading timeout reached, forcing appLoading to false.');
        setAppLoading(false);
      }
    }, 4000);

    let activeSessionUserIdInFlight: string | null = null;
    let lastResolvedSessionUserId: string | null = null;

    const handleSession = async (session: any, forceRefresh = false) => {
      if (!mounted) return;
      setAuthError(null);

      if (session && session.user) {
        const uid = session.user.id;
        if (!forceRefresh && (activeSessionUserIdInFlight === uid || (lastResolvedSessionUserId === uid && useAppStore.getState().currentUser?.id === uid))) {
          finishInitialLoad();
          return;
        }
        activeSessionUserIdInFlight = uid;
        console.log(`[App.tsx AuthEffect] Session active. User ID: ${uid}. Fetching or ensuring profile.`);
        try {
          // Timeout profile fetch/ensure after 10 seconds to guarantee the app loads without getting stuck
          const profilePromise = supabaseService.ensureUserProfileForSession(session.user);
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
          const userProfile = await Promise.race([profilePromise, timeoutPromise]);
          
          if (userProfile && mounted) {
            console.log(`[App.tsx AuthEffect] Profile fetched: ID ${userProfile.id}, Role: ${userProfile.role}, Org: ${userProfile.organization_id || 'none'}`);
            const normalizedPayload = supabaseService.normalizeAppUser({
              ...userProfile,
              id: userProfile.id,
              supabase_auth_id: session.user.id,
              email: session.user.email || userProfile.email || '',
            });
            try {
              localStorage.setItem(`omni_user_profile_${session.user.id}`, JSON.stringify(normalizedPayload));
            } catch (e) {}
            if (!normalizedPayload.organization_id && typeof window !== 'undefined' && session.user.email_confirmed_at) {
              const hasSeenOrgPrompt = localStorage.getItem(`omni_org_prompt_seen_${session.user.id}`);
              if (!hasSeenOrgPrompt) {
                sessionStorage.setItem('omni_just_registered', 'true');
                localStorage.setItem(`omni_org_prompt_seen_${session.user.id}`, 'true');
              }
            }
            lastResolvedSessionUserId = uid;
            setCurrentUser(normalizedPayload);
            useAppStore.getState().setAuthLoading(false);

            if (!window.location.hash.startsWith('#/app')) {
              window.location.hash = '#/app';
              setCurrentRoute('#/app');
            }
          } else if (mounted) {
             console.warn("[App.tsx AuthEffect] Profile not found or timed out. Checking cached user profile.");
             let cachedProfile: AppUserType | null = null;
             try {
               const raw = localStorage.getItem(`omni_user_profile_${session.user.id}`);
               if (raw) cachedProfile = JSON.parse(raw);
             } catch (e) {}
             const existingStoreUser = useAppStore.getState().currentUser;
             const fallbackUser = supabaseService.normalizeAppUser({
               id: session.user.id,
               supabase_auth_id: session.user.id,
               email: session.user.email || cachedProfile?.email || '',
               full_name: cachedProfile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
               avatar_url: cachedProfile?.avatar_url || session.user.user_metadata?.avatar_url,
               organization_id: cachedProfile?.organization_id || (existingStoreUser?.id === session.user.id ? existingStoreUser.organization_id : undefined),
               role: cachedProfile?.role || (existingStoreUser?.id === session.user.id ? existingStoreUser.role : UserRole.MEMBER),
             });
             lastResolvedSessionUserId = uid;
             setCurrentUser(fallbackUser);
             useAppStore.getState().setAuthLoading(false);
             if (!window.location.hash.startsWith('#/app')) {
               window.location.hash = '#/app';
               setCurrentRoute('#/app');
             }
          }
        } catch (error: any) {
          if (mounted) {
            console.error("[App.tsx AuthEffect] Error fetching/setting user profile:", error);
            let cachedProfile: AppUserType | null = null;
            try {
              const raw = localStorage.getItem(`omni_user_profile_${session.user.id}`);
              if (raw) cachedProfile = JSON.parse(raw);
            } catch (e) {}
            const existingStoreUser = useAppStore.getState().currentUser;
            const fallbackUser = supabaseService.normalizeAppUser({
              id: session.user.id,
              supabase_auth_id: session.user.id,
              email: session.user.email || cachedProfile?.email || '',
              full_name: cachedProfile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              avatar_url: cachedProfile?.avatar_url || session.user.user_metadata?.avatar_url,
              organization_id: cachedProfile?.organization_id || (existingStoreUser?.id === session.user.id ? existingStoreUser.organization_id : undefined),
              role: cachedProfile?.role || (existingStoreUser?.id === session.user.id ? existingStoreUser.role : UserRole.MEMBER),
            });
            lastResolvedSessionUserId = uid;
            setCurrentUser(fallbackUser);
            useAppStore.getState().setAuthLoading(false);
            if (!window.location.hash.startsWith('#/app')) {
              window.location.hash = '#/app';
              setCurrentRoute('#/app');
            }
          }
        } finally {
          if (activeSessionUserIdInFlight === uid) {
            activeSessionUserIdInFlight = null;
          }
          if (mounted) {
            useAppStore.getState().setAuthLoading(false);
            finishInitialLoad();
          }
        }
      } else {
        activeSessionUserIdInFlight = null;
        lastResolvedSessionUserId = null;
        if (mounted) {
          console.log("[App.tsx AuthEffect] No active session. Setting current user to null.");
          setCurrentUser(null);
          setAuthError(null);
          useAppStore.getState().setAuthLoading(false);
          finishInitialLoad();
        }
      }
    };

    // 1. Proactively check stored session
    supabaseService.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      console.log("[App.tsx AuthEffect] getSession resolved:", session ? session.user.id : "no session");
      handleSession(session);
    }).catch(err => {
      console.error("[App.tsx AuthEffect] getSession error:", err);
      if (mounted) finishInitialLoad();
    });

    // 2. Listen for future auth state changes
    const { data: authListener } = supabaseService.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        // Defer async Supabase DB queries outside the synchronous onAuthStateChange callback
        // so the internal Supabase GoTrue lock is released immediately.
        setTimeout(() => {
          if (!mounted) return;
          if (_event === 'SIGNED_OUT') {
            handleSession(null, true);
            return;
          }

          const currentStoreUser = useAppStore.getState().currentUser;
          const newUserId = session?.user?.id;
          const currentUserId = currentStoreUser?.supabase_auth_id;

          if ((newUserId && newUserId !== currentUserId) || (!newUserId && currentUserId) || !currentStoreUser) {
            handleSession(session);
          } else {
            finishInitialLoad();
          }
        }, 0);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [setCurrentUser, setAppLoading, setAuthError]);


  useEffect(() => {
    console.log(`[App.tsx DataFetchEffect] Evaluating. AppLoading: ${appLoading}, UserID: ${currentUser?.id}, UserRole: ${currentUser?.role}, OrgID: ${currentUser?.organization_id}`);

    if (appLoading) {
      console.log("[App.tsx DataFetchEffect] App is loading, deferring data fetch.");
      return;
    }

    let channel: any = null;

    if (currentUser?.id) {
      console.log(`[App.tsx DataFetchEffect] User ${currentUser.id} (Org: ${currentUser.organization_id || 'N/A'}) exists. Triggering fetchProjects.`);
      
      // Fetch notifications first so fetchMyTasks can use them to avoid duplicate due date notifications
      fetchNotifications()
        .then(() => fetchMyTasks())
        .catch(e => console.error("[App.tsx DataFetchEffect] Error during fetchNotifications or fetchMyTasks:", e));
        
      fetchProjects().catch(e => console.error("[App.tsx DataFetchEffect] Error during fetchProjects:", e));

      // Set up realtime subscription for notifications
      channel = supabase.channel(`notifications:user_id=eq.${currentUser.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`
        }, (payload) => {
          const newNotif = payload.new as any;
          console.log('New notification received:', newNotif);
          addNotification(newNotif);
          if (newNotif?.type === 'ORGANIZATION_JOIN_REQUEST') {
            window.dispatchEvent(new CustomEvent('omni_org_join_request_updated'));
            useAppStore.getState().addToast(
              newNotif.title || 'New Organization Join Request',
              newNotif.message || 'A user has requested to join your organization.',
              'info',
              { entity_type: 'team_management' }
            );
          } else if (newNotif?.type === 'ORGANIZATION_JOIN_APPROVED') {
            window.dispatchEvent(new CustomEvent('omni_org_join_request_updated'));
            supabaseService.getUserProfile(currentUser.id).then(fresh => {
              if (fresh?.organization_id) {
                setCurrentUser(fresh);
              }
            });
          }
        })
        .subscribe();

      if (currentUser.organization_id) {
        console.log(`[App.tsx DataFetchEffect] User ${currentUser.id} belongs to Org ${currentUser.organization_id}. Triggering fetchUsersForAssignmentList.`);
        fetchUsersForAssignmentList().catch(e => console.error("[App.tsx DataFetchEffect] Error during fetchUsersForAssignmentList:", e));
        if (useAppStore.getState().projectsError === "You can create personal projects or join an organization to see shared projects.") {
             setProjectsError(null);
         }
      } else {
        console.log(`[App.tsx DataFetchEffect] User ${currentUser.id} has NO Org ID. Clearing org-specific user list.`);
        setUsers([]);
        setUsersForAssignmentError("Join an organization to collaborate with team members.");
         if (useAppStore.getState().projectsError === "You are not part of an organization. Join or create one to see projects.") {
             setProjectsError("You can create personal projects or join an organization to see shared projects.");
         }
      }
      if (useAppStore.getState().authError === "You are not part of an organization. Join or create one to see projects.") {
            setAuthError(null);
       }
    } else {
      console.log(`[App.tsx DataFetchEffect] No current user. Clearing projects, users, tasks, activeProject, and related errors.`);
      setProjects([]);
      setUsers([]);
      setTasks([]);
      setActiveProject(null);
      setProjectsError(null);
      setUsersForAssignmentError(null);
      setTasksError(null);
      if (currentRoute.startsWith('#/app') && useAppStore.getState().activeView !== 'overview') {
           console.log(`[App.tsx DataFetchEffect] No user, on app route, not on overview. Setting activeView to 'overview'.`);
           setActiveView('overview');
      }
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [
    currentUser?.id, currentUser?.organization_id, appLoading, 
    fetchProjects, fetchMyTasks, fetchNotifications, fetchUsersForAssignmentList,
    setProjects, setUsers, setTasks, setActiveProject,
    setProjectsError, setUsersForAssignmentError, setTasksError,
    setActiveView, setAuthError, addNotification
  ]);

   useEffect(() => {
    if (appLoading || !currentUser || isLoadingProjects) return;

    if (activeView === 'kanban' && !activeProject) {
      console.log("[App.tsx ViewConsistencyEffect] Active view is 'kanban' but no active project. Setting view to 'projects_overview'.");
      setActiveView('projects_overview');
    }
  }, [currentUser, projects, activeProject, activeView, setActiveProject, setActiveView, appLoading, isLoadingProjects]);


  const isAppRoute = currentRoute.startsWith('#/app');

  if (appLoading && isAppRoute) {
    return <GlobalSpinner />;
  }

  if (!isAppRoute) {
    return <LandingPage />;
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden p-2 md:p-3 animate-fadeIn"> {/* Adjusted padding */}
       <MainAppLayout />
    </div>
  );
}

export default App;
