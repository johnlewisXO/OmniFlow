

import React, { useEffect, useCallback, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';
import { EditTaskModal } from './components/tasks/EditTaskModal'; 
import { CreateProjectModal } from './components/projects/CreateProjectModal';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from './hooks/useAppStore';
import supabaseService from './services/supabaseService';
import { AuthPage } from './components/auth/AuthPage';
import { User as AppUserType, Project, UserRole, ActiveView } from './types';

// Import Role Specific Dashboards
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { ProjectManagerDashboard } from './components/dashboards/ProjectManagerDashboard';
import { MemberDashboard } from './components/dashboards/MemberDashboard';
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
import { UserLogsPage } from './components/logs/UserLogsPage';

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
    isLoadingUsersForAssignment
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
               style={{backgroundColor: 'var(--panel-background)'}} /* Ensure glass panel style */
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
          return <UserLogsPage />;
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
          {renderContentByView()}
        </div>
      </div>
      <CreateTaskModal />
      <EditTaskModal /> 
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={closeCreateProjectModal}
        onCreateProject={handleCreateProjectSubmit}
        isLoading={isLoadingCreateProject}
        error={createProjectError}
      />
    </div>
  );
};

const GlobalSpinner: React.FC = () => (
  <div className="global-spinner-overlay">
    <div className="global-spinner"></div>
  </div>
);

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
    fetchUsersForAssignmentList,
    activeProject, setActiveProject,
    projects, setProjects, 
    projectsError, 
    activeView, setActiveView,
    users, setUsers,
    tasks, setTasks,
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
    setAppLoading(true);

    const { data: authListener } = supabaseService.onAuthStateChange(
      async (_event, session) => {
        console.log(`[App.tsx AuthEffect] onAuthStateChange triggered. Event: ${_event}, Session: ${session ? `Exists (User ID: ${session.user?.id})` : 'Null'}`);
        setAuthError(null);

        if (session && session.user) {
          console.log(`[App.tsx AuthEffect] Session and user exist. User ID: ${session.user.id}. Fetching profile.`);
          try {
            const userProfile = await supabaseService.getUserProfile(session.user.id);
            if (userProfile) {
              console.log(`[App.tsx AuthEffect] Profile fetched: ID ${userProfile.id}, Email: ${userProfile.email}, OrgID: ${userProfile.organization_id}, Role: ${userProfile.role}`);
              let finalRole: UserRole | undefined = undefined;
              if (userProfile.role) {
                const roleString = String(userProfile.role).toUpperCase();
                if (Object.values(UserRole).includes(roleString as UserRole)) {
                  finalRole = roleString as UserRole;
                } else {
                    console.warn(`[App.tsx AuthEffect] Invalid role '${userProfile.role}' received for user ${userProfile.id}.`);
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
              console.log(`[App.tsx AuthEffect] Calling setCurrentUser with payload:`, JSON.stringify(appUserPayload));
              setCurrentUser(appUserPayload);

              if (!currentRoute.startsWith('#/app')) {
                console.log(`[App.tsx AuthEffect] User authenticated, current route is "${currentRoute}". Redirecting to #/app.`);
                window.location.hash = '#/app';
              }
            } else {
               console.warn(`[App.tsx AuthEffect] Profile not found for user ID: ${session.user.id}. Setting current user to null.`);
               setCurrentUser(null);
               setAuthError("Profile not found after authentication. Please sign up or contact support.");
               await supabaseService.signOutUser().catch(e => console.error("[App.tsx AuthEffect] Sign out error after profile not found:", e));
            }
          } catch (error: any) {
            console.error("[App.tsx AuthEffect] Error fetching/setting user profile:", error);
            setCurrentUser(null);
            setAuthError(localParseErrorMessage(error, "Failed to load your profile information."));
            await supabaseService.signOutUser().catch(e => console.error("[App.tsx AuthEffect] Sign out error after profile fetch exception:", e));
          } finally {
            console.log("[App.tsx AuthEffect] Finished processing session/user block. Setting appLoading to false.");
            setAppLoading(false);
          }
        } else {
          console.log("[App.tsx AuthEffect] No session or user. Setting current user to null.");
          setCurrentUser(null);
          setAuthError(null);
          console.log("[App.tsx AuthEffect] Finished processing no session block. Setting appLoading to false.");
          setAppLoading(false);
        }
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        console.log("[App.tsx AuthEffect] Unsubscribing from auth listener.");
        authListener.subscription.unsubscribe();
      }
    };
  }, [setCurrentUser, setAppLoading, setAuthError, currentRoute]);


  useEffect(() => {
    const latestStoreState = useAppStore.getState();
    const currentUserID = latestStoreState.currentUser?.id;
    const currentOrgID = latestStoreState.currentUser?.organization_id;
    const currentAppLoadingState = latestStoreState.appLoading;

    console.log(`[App.tsx DataFetchEffect] Evaluating. AppLoading: ${currentAppLoadingState}, UserID: ${currentUserID}, UserRole: ${latestStoreState.currentUser?.role}, OrgID: ${currentOrgID}`);

    if (currentAppLoadingState) {
      console.log("[App.tsx DataFetchEffect] App is loading, deferring data fetch.");
      return;
    }

    if (currentUserID) {
      console.log(`[App.tsx DataFetchEffect] User ${currentUserID} (Org: ${currentOrgID || 'N/A'}) exists. Triggering fetchProjects.`);
      fetchProjects().catch(e => console.error("[App.tsx DataFetchEffect] Error during fetchProjects:", e));

      if (currentOrgID) {
        console.log(`[App.tsx DataFetchEffect] User ${currentUserID} belongs to Org ${currentOrgID}. Triggering fetchUsersForAssignmentList.`);
        fetchUsersForAssignmentList().catch(e => console.error("[App.tsx DataFetchEffect] Error during fetchUsersForAssignmentList:", e));
        if (latestStoreState.projectsError === "You can create personal projects or join an organization to see shared projects.") {
             setProjectsError(null);
         }
      } else {
        console.log(`[App.tsx DataFetchEffect] User ${currentUserID} has NO Org ID. Clearing org-specific user list.`);
        setUsers([]);
        setUsersForAssignmentError("Join an organization to collaborate with team members.");
         if (latestStoreState.projectsError === "You are not part of an organization. Join or create one to see projects.") {
             setProjectsError("You can create personal projects or join an organization to see shared projects.");
         }
      }
      if (latestStoreState.authError === "You are not part of an organization. Join or create one to see projects.") {
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
      if (currentRoute.startsWith('#/app') && latestStoreState.activeView !== 'overview') {
           console.log(`[App.tsx DataFetchEffect] No user, on app route, not on overview. Setting activeView to 'overview'.`);
           setActiveView('overview');
      }
    }
  }, [
    currentUser?.id, currentUser?.organization_id, appLoading, 
    fetchProjects, fetchUsersForAssignmentList,
    setProjects, setUsers, setTasks, setActiveProject,
    setProjectsError, setUsersForAssignmentError, setTasksError,
    activeView, setActiveView, authError, setAuthError, projectsError, currentRoute
  ]);

   useEffect(() => {
    if (appLoading || !currentUser) return;

    if (activeView === 'kanban' && !activeProject) {
      console.log("[App.tsx ViewConsistencyEffect] Active view is 'kanban' but no active project. Setting view to 'projects_overview'.");
      setActiveView('projects_overview');
    }
  }, [currentUser, projects, activeProject, activeView, setActiveProject, setActiveView, appLoading]);


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
