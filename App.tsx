

import React, { useEffect, useCallback, useState } from 'react';
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

const ToastContainer: React.FC = () => {
  const { notifications, markNotificationAsRead, darkMode } = useAppStore();
  const [visibleToasts, setVisibleToasts] = useState<string[]>([]);

  useEffect(() => {
    // Find new unread notifications that we haven't shown yet
    const newUnread = notifications.filter(n => !n.read && (new Date().getTime() - new Date(n.created_at).getTime()) < 5000);
    
    if (newUnread.length > 0) {
      const newIds = newUnread.map(n => n.id).filter(id => !visibleToasts.includes(id));
      if (newIds.length > 0) {
        setVisibleToasts(prev => [...prev, ...newIds]);
        
        // Auto-dismiss after 5 seconds
        newIds.forEach(id => {
          setTimeout(() => {
            setVisibleToasts(prev => prev.filter(tId => tId !== id));
          }, 5000);
        });
      }
    }
  }, [notifications, visibleToasts]);

  if (visibleToasts.length === 0) return null;

  const toastsToShow = notifications.filter(n => visibleToasts.includes(n.id));

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toastsToShow.map(n => (
        <div key={n.id} className={`p-4 rounded-lg shadow-lg border flex items-start gap-3 w-80 animate-in slide-in-from-bottom-5 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex-1">
            <h4 className="font-medium text-sm">{n.title}</h4>
            <p className="text-xs mt-1 opacity-80">{n.message}</p>
          </div>
          <button onClick={() => {
            markNotificationAsRead(n.id);
            setVisibleToasts(prev => prev.filter(id => id !== n.id));
          }} className="text-slate-400 hover:text-slate-600">
            <ICON_MAP.CheckIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

const MainAppLayout: React.FC = () => {
  const {
    currentUser,
    authError,
    activeView,
    activeProject,
    isCreateProjectModalOpen, closeCreateProjectModal,
    createProject: createProjectActionFromStore,
    isLoadingCreateProject,
    createProjectError,
    projectsError, 
    tasksError,    
    darkMode,
    fetchUsersForAssignmentList, 
    users, 
    isLoadingUsersForAssignment,
    error
  } = useAppStore();

  const ExclamationIcon = ICON_MAP.ExclamationIcon;

  useEffect(() => {
    if (currentUser && activeView === 'team_management' && currentUser.organization_id && users.length === 0 && !isLoadingUsersForAssignment) {
      fetchUsersForAssignmentList();
    }
  }, [activeView, currentUser, users, isLoadingUsersForAssignment, fetchUsersForAssignmentList]);


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
      case 'my_tasks_view':
        return <MyTasksPage />;
      case 'inbox_view':
        return <InboxPage />;
      case 'reports_view':
        return <ReportsPage />;
      case 'user_logs_view':
        if (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.ADMIN) {
          return <div className="p-6">User Logs (Coming Soon)</div>;
        }
        return <MemberDashboard />; // Fallback if not authorized
      case 'team_management':
        if (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.PROJECT_MANAGER || currentUser.role === UserRole.ADMIN) {
          return <TeamManagementPage />;
        }
        return <MemberDashboard />; 
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
    <div className="h-full w-full flex gap-3 md:gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col gap-3 md:gap-4 min-w-0">
        <Header />
        <div className="flex-1 flex flex-col glass-panel rounded-squircle-lg p-0 overflow-hidden min-h-0">
          {authError && !authError.toLowerCase().includes("rls") && !authError.toLowerCase().includes("policy") && ( 
            <div className={`p-4 m-4 rounded-squircle-md text-sm text-center border ${darkMode ? 'bg-status-error/20 text-red-300 border-status-error/40' : 'bg-status-error/10 text-red-700 border-status-error/30'}`}>
                <strong>Authentication Issue:</strong> {authError}
            </div>
          )}
          {error && (
            <div className={`p-4 m-4 rounded-squircle-md text-sm text-center border ${darkMode ? 'bg-status-error/20 text-red-300 border-status-error/40' : 'bg-status-error/10 text-red-700 border-status-error/30'}`}>
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
    const hash = window.location.hash;
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
  } = useAppStore();


  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash || '/';
      setCurrentRoute(newHash === '#/' || newHash === '#' ? '/' : newHash);
    };
    window.addEventListener('hashchange', handleHashChange);

    const browserHash = window.location.hash;
    if ((browserHash === '' || browserHash === '#' || browserHash === '#/') && currentRoute.startsWith('#/app')) {
        setCurrentRoute('/'); 
    } else if (browserHash.startsWith('#/app') && currentRoute === '/') {
        setCurrentRoute('#/app'); 
    }


    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [currentRoute]); 

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
    console.log('[App.tsx AuthEffect] Initializing auth listener.');
    let mounted = true;

    const handleSession = async (session: any) => {
      if (!mounted) return;
      setAuthError(null);

      if (session && session.user) {
        console.log(`[App.tsx AuthEffect] Session and user exist. User ID: ${session.user.id}. Fetching profile.`);
        try {
          const userProfile = await supabaseService.getUserProfile(session.user.id);
          if (userProfile && mounted) {
            console.log(`[App.tsx AuthEffect] Profile fetched: ID ${userProfile.id}`);
            let finalRole: UserRole | undefined = undefined;
            if (userProfile.role) {
              const roleString = String(userProfile.role).toUpperCase();
              if (Object.values(UserRole).includes(roleString as UserRole)) {
                finalRole = roleString as UserRole;
              }
            }
            const appUserPayload: AppUserType = {
              id: userProfile.id,
              supabase_auth_id: session.user.id,
              email: session.user.email || userProfile.email || '', 
              full_name: userProfile.full_name,
              avatar_url: userProfile.avatar_url,
              organization_id: userProfile.organization_id,
              role: finalRole,
            };
            setCurrentUser(appUserPayload);

            if (!window.location.hash.startsWith('#/app')) {
              window.location.hash = '#/app';
            }
          } else if (mounted) {
             setCurrentUser(null);
             setAuthError("Profile not found after authentication. Please sign up or contact support.");
             await supabaseService.signOutUser().catch(e => console.error(e));
          }
        } catch (error: any) {
          if (mounted) {
            console.error("[App.tsx AuthEffect] Error fetching/setting user profile:", error);
            setCurrentUser(null);
            setAuthError(localParseErrorMessage(error, "Failed to load your profile information."));
            await supabaseService.signOutUser().catch(e => console.error(e));
          }
        } finally {
          if (mounted) setAppLoading(false);
        }
      } else {
        if (mounted) {
          console.log("[App.tsx AuthEffect] No session or user. Setting current user to null.");
          setCurrentUser(null);
          setAuthError(null);
          setAppLoading(false);
        }
      }
    };

    const initializeAuth = async () => {
      setAppLoading(true);
      try {
        const { data: { session } } = await supabaseService.getSession();
        await handleSession(session);
      } catch (e) {
        console.error("Failed to get initial session", e);
        if (mounted) setAppLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabaseService.onAuthStateChange(
      async (_event, session) => {
        if (_event === 'INITIAL_SESSION') return;
        console.log(`[App.tsx AuthEffect] onAuthStateChange triggered. Event: ${_event}`);
        await handleSession(session);
      }
    );

    return () => {
      mounted = false;
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
          console.log('New notification received:', payload.new);
          // Only add if it's not already in the store (to avoid duplicates if we also emitted locally)
          // We can just add it, but let's make sure it's mapped correctly
          addNotification(payload.new as any);
        })
        .subscribe();

      if (currentUser.organization_id) {
        console.log(`[App.tsx DataFetchEffect] User ${currentUser.id} belongs to Org ${currentUser.organization_id}. Triggering fetchUsersForAssignmentList.`);
        fetchUsersForAssignmentList().catch(e => console.error("[App.tsx DataFetchEffect] Error during fetchUsersForAssignmentList:", e));
        if (projectsError === "You can create personal projects or join an organization to see shared projects.") {
             setProjectsError(null);
         }
      } else {
        console.log(`[App.tsx DataFetchEffect] User ${currentUser.id} has NO Org ID. Clearing org-specific user list.`);
        setUsers([]);
        setUsersForAssignmentError("Join an organization to collaborate with team members.");
         if (projectsError === "You are not part of an organization. Join or create one to see projects.") {
             setProjectsError("You can create personal projects or join an organization to see shared projects.");
         }
      }
      if (authError === "You are not part of an organization. Join or create one to see projects.") {
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
      if (currentRoute.startsWith('#/app') && activeView !== 'overview') {
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
    activeView, setActiveView, authError, setAuthError, projectsError, currentRoute, addNotification
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
    console.log("[App.tsx Render] App is loading and on an app route. Showing GlobalSpinner.");
    return <GlobalSpinner />;
  }

  if (!isAppRoute) {
    console.log(`[App.tsx Render] Current route "${currentRoute}" is not an app route. Showing LandingPage.`);
    return <LandingPage />;
  }

  if (!currentUser) {
    console.log("[App.tsx Render] On app route but no current user. Showing AuthPage.");
    return <AuthPage />;
  }

  console.log(`[App.tsx Render] User ${currentUser.id} (Org: ${currentUser.organization_id}, Role: ${currentUser.role}) is authenticated and on app route. Showing MainAppLayout. ActiveView: ${activeView}`);
  return (
    <div className="h-screen w-screen overflow-hidden p-2 md:p-3 animate-fadeIn"> {/* Adjusted padding */}
       <MainAppLayout />
    </div>
  );
}

export default App;
