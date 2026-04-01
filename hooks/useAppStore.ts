

import { useState, useCallback, useEffect } from 'react';
import { AppStore, Task, Project, User, TaskStatus, TaskPriority, UserRole, Organization, ActiveView, OrganizationCheckState, Notification } from '../types';
import { ICON_MAP } from '../constants';
import supabaseService from '../services/supabaseService';
import { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';
import { isBefore, isToday, startOfDay, parseISO } from 'date-fns';

// --- NO MOCK DATA ---

interface StoreState {
  darkMode: boolean;
  users: User[];
  projects: Project[];
  tasks: Task[];
  currentUser: User | null;
  authLoading: boolean;
  authError: string | null;
  appLoading: boolean;
  activeProject: Project | null;
  activeView: ActiveView;

  isModalOpen: boolean; // Create Task Modal
  parentTaskIdForNewTask: string | null;

  isViewTaskModalOpen: boolean; 
  taskToView: Task | null;      

  isEditTaskModalOpen: boolean; 
  taskToEdit: Task | null;      

  isCreateProjectModalOpen: boolean;
  isLoadingCreateProject: boolean;
  createProjectError: string | null;

  isLoading: boolean;
  error: string | null;
  suggestedTaskTitles: string[];

  isLoadingProjects: boolean;
  isLoadingTasks: boolean;
  isLoadingUsersForAssignment: boolean;
  projectsError: string | null;
  tasksError: string | null;
  usersForAssignmentError: string | null;

  organizationCheck: OrganizationCheckState;
  highlightedProjectId: string | null;
  highlightedTaskId: string | null;

  // Team Management
  isUpdatingUserRole: boolean;
  updateUserRoleError: string | null;
  isDeletingUser: string | null; // ID of user being deleted
  deleteUserError: string | null;

  // Password Update
  isPasswordUpdateModalOpen: boolean;

  notifications: Notification[];
}

const _darkMode = typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false;
const _notifications = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('notifications') || '[]') : [];
const _activeView = typeof window !== 'undefined' ? (localStorage.getItem('activeView') as ActiveView || 'overview') : 'overview';
const _activeProjectId = typeof window !== 'undefined' ? localStorage.getItem('activeProjectId') : null;

const initialStoreStateValues: StoreState = {
  darkMode: _darkMode,
  users: [],
  currentUser: null,
  projects: [],
  tasks: [],
  myTasks: [],
  activeProject: null, // We'll set this after projects fetch
  activeView: _activeView,
  isModalOpen: false, 
  parentTaskIdForNewTask: null,
  isViewTaskModalOpen: false, 
  taskToView: null,          
  isEditTaskModalOpen: false, 
  taskToEdit: null,          
  isCreateProjectModalOpen: false,
  isLoadingCreateProject: false,
  createProjectError: null,
  isLoading: false,
  error: null,
  suggestedTaskTitles: [],
  authLoading: false,
  authError: null,
  appLoading: true,

  isLoadingProjects: true,
  isLoadingTasks: true, // Will be set to false if no active project
  isLoadingUsersForAssignment: true,
  projectsError: null,
  tasksError: null,
  usersForAssignmentError: null,
  organizationCheck: { loading: false, exists: null, orgId: undefined, orgSlug: undefined, error: undefined },
  highlightedProjectId: null,
  highlightedTaskId: null,

  // Team Management
  isUpdatingUserRole: false,
  updateUserRoleError: null,
  isDeletingUser: null,
  deleteUserError: null,

  // Password Update
  isPasswordUpdateModalOpen: false,

  notifications: _notifications,
};

const parseErrorMessage = (error: any, defaultMessage: string = "An unexpected error occurred."): string => {
  if (!error) return defaultMessage;

  let potentialMessages: string[] = [];
  let extractedMessage: string | null = null;

  if (typeof error === 'string' && error.trim()) {
    potentialMessages.push(error.trim());
  }

  if (error.message && typeof error.message === 'string' && error.message.trim()) {
    potentialMessages.push(error.message.trim());
  }

  if ((error as PostgrestError).details && typeof (error as PostgrestError).details === 'string' && (error as PostgrestError).details.trim()) {
    potentialMessages.push((error as PostgrestError).details.trim());
  }
  if ((error as PostgrestError).hint && typeof (error as PostgrestError).hint === 'string' && (error as PostgrestError).hint.trim()) {
    potentialMessages.push((error as PostgrestError).hint.trim());
  }

  if (error.error_description && typeof error.error_description === 'string' && error.error_description.trim()) {
    potentialMessages.push(error.error_description.trim());
  }

  if (error.msg && typeof error.msg === 'string' && error.msg.trim()) {
    potentialMessages.push(error.msg.trim());
  }

  // Attempt to parse JSON from messages, as Supabase sometimes nests errors
  for (const msg of potentialMessages) {
    if (msg) {
      try {
        const parsedJson = JSON.parse(msg);
        if (parsedJson.message && typeof parsedJson.message === 'string' && parsedJson.message.trim()) {
          extractedMessage = parsedJson.message.trim();
          break;
        }
        if (parsedJson.msg && typeof parsedJson.msg === 'string' && parsedJson.msg.trim()) { 
            extractedMessage = parsedJson.msg.trim();
            break;
        }
        if (typeof parsedJson === 'string' && parsedJson.trim()) { 
          extractedMessage = parsedJson.trim();
          break;
        }
      } catch (e) {
        
        if (!msg.toLowerCase().includes('[object object]') && msg !== '{}') {
          extractedMessage = msg;
          break; 
        }
      }
    }
  }
  
  if (extractedMessage) {
    if (extractedMessage.toLowerCase().includes("load failed") || extractedMessage.toLowerCase().includes("failed to fetch")) {
      return `${extractedMessage}. Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.`;
    }
    if (extractedMessage.toLowerCase().includes("recursion") || extractedMessage.toLowerCase().includes("rls") || extractedMessage.toLowerCase().includes("policy")) {
      return `A backend data policy error occurred (RLS). Please check policy configuration. Details: ${extractedMessage.substring(0, 150)}...`;
    }
    return extractedMessage;
  }

  if (error.toString && typeof error.toString === 'function') {
    const errStr = error.toString();
    if (errStr && !errStr.toLowerCase().includes('[object object]') && errStr.trim() !== '' && errStr.trim() !== '{}') {
      return errStr.substring(0, 250); 
    }
  }
  
  if (potentialMessages.some(m => m && (m.toLowerCase().includes("load failed") || m.toLowerCase().includes("failed to fetch")))) {
    return "A network error occurred. Please check your internet connection. The service may be temporarily unavailable.";
  }
  if (potentialMessages.some(m => m && m.toLowerCase().includes("invalid login credentials"))) {
    return "Sign in failed: Invalid login credentials. Please check your email and password, or use the 'Forgot Password?' link.";
  }
  if (error.status || error.code) {
     return `An error occurred (Status: ${error.status || 'N/A'}, Code: ${error.code || 'N/A'}). Please try again.`;
  }

  return defaultMessage;
};


const appActionsCreator = (
  updateState: (updater: (s: StoreState) => StoreState) => void,
  get: () => StoreState
) => {
  const selfActions = {
    emitEvent: (eventType: string, payload: any) => {
      selfActions.handleEvent(eventType, payload);
    },
    handleEvent: (eventType: string, payload: any) => {
      const { currentUser } = get();
      if (!currentUser) return;

      let notification: Omit<Notification, 'id' | 'created_at' | 'read'> | null = null;

      switch (eventType) {
        case 'TASK_CREATED':
          notification = {
            type: eventType,
            title: 'New Task Created',
            message: `Task "${payload.task.title}" was created in project.`,
            entity_type: 'task',
            entity_id: payload.task.id,
            metadata: { actor_id: currentUser.id },
            user_id: payload.task.assignee_id || currentUser.id, // Notify assignee or self
          };
          break;
        case 'TASK_ASSIGNED':
          notification = {
            type: eventType,
            title: 'Task Assigned',
            message: `You were assigned to task "${payload.task.title}".`,
            entity_type: 'task',
            entity_id: payload.task.id,
            metadata: { actor_id: currentUser.id },
            user_id: payload.task.assignee_id,
          };
          break;
        case 'TASK_UPDATED':
          notification = {
            type: eventType,
            title: 'Task Updated',
            message: `Task "${payload.task.title}" was updated.`,
            entity_type: 'task',
            entity_id: payload.task.id,
            metadata: { actor_id: currentUser.id },
            user_id: payload.task.assignee_id || currentUser.id,
          };
          break;
        case 'TASK_STATUS_UPDATED':
          notification = {
            type: eventType,
            title: 'Task Status Updated',
            message: `Task "${payload.task.title}" status changed to ${payload.task.status}.`,
            entity_type: 'task',
            entity_id: payload.task.id,
            metadata: { actor_id: currentUser.id },
            user_id: payload.task.assignee_id || currentUser.id,
          };
          break;
        case 'PROJECT_CREATED':
          notification = {
            type: eventType,
            title: 'Project Created',
            message: `Project "${payload.project.name}" was created.`,
            entity_type: 'project',
            entity_id: payload.project.id,
            metadata: { actor_id: currentUser.id },
            user_id: currentUser.id,
          };
          break;
        case 'TASK_DUE_SOON':
          notification = {
            type: eventType,
            title: 'Task Due Soon',
            message: `Task "${payload.task.title}" is due today.`,
            entity_type: 'task',
            entity_id: payload.task.id,
            metadata: { actor_id: currentUser.id },
            user_id: payload.task.assignee_id || currentUser.id,
          };
          break;
        case 'TASK_OVERDUE':
          notification = {
            type: eventType,
            title: 'Task Overdue',
            message: `Task "${payload.task.title}" is overdue.`,
            entity_type: 'task',
            entity_id: payload.task.id,
            metadata: { actor_id: currentUser.id },
            user_id: payload.task.assignee_id || currentUser.id,
          };
          break;
        case 'TASK_DELETED':
          notification = {
            type: eventType,
            title: 'Task Deleted',
            message: `Task "${payload.task.title}" was deleted.`,
            entity_type: 'task',
            entity_id: payload.task.id,
            metadata: { actor_id: currentUser.id },
            user_id: payload.task.assignee_id || currentUser.id,
          };
          break;
        case 'USER_ROLE_UPDATED':
          notification = {
            type: eventType,
            title: 'Role Updated',
            message: `Your role has been updated to ${payload.newRole}.`,
            entity_type: 'user',
            entity_id: payload.userId,
            metadata: { actor_id: currentUser.id },
            user_id: payload.userId,
          };
          break;
        case 'USER_REMOVED_FROM_ORG':
          notification = {
            type: eventType,
            title: 'Removed from Organization',
            message: `You have been removed from the organization.`,
            entity_type: 'user',
            entity_id: payload.userId,
            metadata: { actor_id: currentUser.id },
            user_id: payload.userId,
          };
          break;
        default:
          break;
      }

      if (notification) {
        selfActions.addNotification(notification);
      }
    },
    addNotification: (notification: Partial<Notification> & Omit<Notification, 'id' | 'created_at' | 'read'>) => {
      const newNotification: Notification = {
        ...notification,
        id: notification.id || crypto.randomUUID(),
        created_at: notification.created_at || new Date().toISOString(),
        read: notification.read || false,
      };
      
      // Try to insert into Supabase if it doesn't have an ID yet (meaning it's local)
      if (!notification.id) {
        supabaseService.insertNotification(newNotification).catch(e => console.error(e));
      }

      // Only add to local state if it belongs to the current user
      const { currentUser } = get();
      if (currentUser && newNotification.user_id === currentUser.id) {
        updateState(s => {
          // Check if it already exists
          if (s.notifications.some(n => n.id === newNotification.id)) {
            return s;
          }
          const newNotifications = [newNotification, ...s.notifications];
          if (typeof window !== 'undefined') {
            localStorage.setItem('notifications', JSON.stringify(newNotifications));
          }
          return { ...s, notifications: newNotifications };
        });
      }
    },
    markNotificationAsRead: (id: string) => {
      updateState(s => {
        const newNotifications = s.notifications.map(n => n.id === id ? { ...n, read: true } : n);
        if (typeof window !== 'undefined') {
          localStorage.setItem('notifications', JSON.stringify(newNotifications));
        }
        return { ...s, notifications: newNotifications };
      });
    },
    markAllNotificationsAsRead: () => {
      updateState(s => {
        const newNotifications = s.notifications.map(n => ({ ...n, read: true }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('notifications', JSON.stringify(newNotifications));
        }
        return { ...s, notifications: newNotifications };
      });
    },
    clearNotifications: () => {
      updateState(s => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('notifications');
        }
        return { ...s, notifications: [] };
      });
    },
    fetchProjects: async () => {
      const currentUser = get().currentUser;
      if (!currentUser) {
        updateState(s => ({ ...s, projects: [], isLoadingProjects: false, projectsError: "Not logged in." }));
        return;
      }
      updateState(s => ({ ...s, isLoadingProjects: true, projectsError: null }));
      try {
        const projectsPromise = supabaseService.getProjects();
        const timeoutPromise = new Promise<Project[]>((_, reject) => 
          setTimeout(() => reject(new Error("Projects fetch timeout")), 10000)
        );
        const projects = await Promise.race([projectsPromise, timeoutPromise]);
        
        // Restore active project if it exists in the fetched projects
        const savedProjectId = typeof window !== 'undefined' ? localStorage.getItem('activeProjectId') : null;
        let restoredProject = null;
        if (savedProjectId) {
          restoredProject = projects.find(p => p.id === savedProjectId) || null;
          if (!restoredProject && typeof window !== 'undefined') {
            localStorage.removeItem('activeProjectId');
          }
        }

        const currentActiveProject = get().activeProject;
        updateState(s => ({ 
          ...s, 
          projects, 
          isLoadingProjects: false,
          activeProject: restoredProject || s.activeProject
        }));

        if (restoredProject) {
          selfActions.fetchTasksForProject(restoredProject.id);
        } else if (!currentActiveProject) {
          updateState(s => ({ ...s, isLoadingTasks: false }));
        }
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Failed to fetch projects.');
        updateState(s => ({ ...s, isLoadingProjects: false, projectsError: message, projects: [] }));
      }
    },
    fetchTasksForProject: async (projectId: string) => {
        if (!get().currentUser) {
            updateState(s => ({ ...s, tasks: [], isLoadingTasks: false, tasksError: "Not logged in." }));
            return;
        }
        if (!projectId) {
            updateState(s => ({ ...s, tasks: [], isLoadingTasks: false, tasksError: "No project ID provided." }));
            return;
        }
        updateState(s => ({ ...s, isLoadingTasks: true, tasksError: null }));
        try {
          const tasksPromise = supabaseService.getTasksByProjectId(projectId);
          const timeoutPromise = new Promise<Task[]>((_, reject) => 
            setTimeout(() => reject(new Error("Tasks fetch timeout")), 10000)
          );
          const newTasksForProject = await Promise.race([tasksPromise, timeoutPromise]);
          const otherTasks = get().tasks.filter(t => t.projectId !== projectId);
          updateState(s => ({ ...s, tasks: [...otherTasks, ...newTasksForProject], isLoadingTasks: false }));
        } catch (error: any) {
          const message = parseErrorMessage(error, `Failed to fetch tasks for project ${projectId}.`);
          updateState(s => ({ ...s, isLoadingTasks: false, tasksError: message }));
        }
    },
    fetchMyTasks: async () => {
      const { currentUser, notifications } = get();
      if (!currentUser) return;
      updateState(s => ({ ...s, isLoadingTasks: true, tasksError: null }));
      try {
        const tasksPromise = supabaseService.getMyTasks();
        const timeoutPromise = new Promise<Task[]>((_, reject) => 
          setTimeout(() => reject(new Error("My tasks fetch timeout")), 10000)
        );
        const myTasks = await Promise.race([tasksPromise, timeoutPromise]);
        
        // Check for due tasks
        const today = startOfDay(new Date());
        myTasks.forEach(task => {
          if (task.status === TaskStatus.DONE || !task.dueDate) return;
          const dueDate = startOfDay(parseISO(task.dueDate));
          
          if (isBefore(dueDate, today)) {
            // Check if we already notified about this task being overdue
            const alreadyNotified = notifications.some(n => n.entity_id === task.id && n.type === 'TASK_OVERDUE');
            if (!alreadyNotified) {
              selfActions.emitEvent('TASK_OVERDUE', { task });
            }
          } else if (isToday(dueDate)) {
            // Check if we already notified about this task being due today
            const alreadyNotified = notifications.some(n => n.entity_id === task.id && n.type === 'TASK_DUE_SOON');
            if (!alreadyNotified) {
              selfActions.emitEvent('TASK_DUE_SOON', { task });
            }
          }
        });

        updateState(s => ({ ...s, myTasks, isLoadingTasks: false }));
      } catch (error: any) {
        console.error("Failed to fetch my tasks:", error);
        updateState(s => ({ ...s, isLoadingTasks: false, tasksError: parseErrorMessage(error, "Failed to fetch my tasks.") }));
      }
    },
    fetchNotifications: async () => {
      try {
        const dbNotifications = await supabaseService.getNotifications();
        updateState(s => {
          // Merge dbNotifications with local notifications
          const merged = [...dbNotifications];
          s.notifications.forEach(ln => {
            if (!merged.some(dn => dn.id === ln.id)) {
              merged.push(ln);
            }
          });
          // Sort by created_at desc
          merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('notifications', JSON.stringify(merged));
          }
          return { ...s, notifications: merged };
        });
      } catch (error: any) {
        console.error("Failed to fetch notifications:", error);
      }
    },
    setActiveProject: (projectId: string | null) => {
      if (typeof window !== 'undefined') {
        if (projectId) {
          localStorage.setItem('activeProjectId', projectId);
        } else {
          localStorage.removeItem('activeProjectId');
        }
      }
      
      if (projectId) {
        const project = get().projects.find(p => p.id === projectId) || null;
        updateState(s => ({
          ...s,
          activeProject: project,
          tasks: [], 
          suggestedTaskTitles: [],
          tasksError: null,
          activeView: 'kanban'
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeView', 'kanban');
        }
        if (project) {
          selfActions.fetchTasksForProject(project.id);
        } else {
           console.warn(`setActiveProject: Project with ID ${projectId} not found in local store. May need to fetch projects again. Tasks for this project will still be fetched if the ID is valid.`);
           selfActions.fetchTasksForProject(projectId); 
           updateState(s => ({ ...s, activeView: 'kanban', tasksError: null })); 
        }
      } else {
        updateState(s => ({
          ...s,
          activeProject: null,
          tasks: [], 
          tasksError: null,
          suggestedTaskTitles: [],
          activeView: 'overview' 
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeView', 'overview');
        }
      }
    },
    fetchUsersForAssignmentList: async () => { 
        const currentUser = get().currentUser;
        if (!currentUser || !currentUser.organization_id) {
            updateState(s => ({ ...s, users: [], isLoadingUsersForAssignment: false, usersForAssignmentError: currentUser ? "User not part of an organization to list members." : "Not logged in." }));
            return;
        }
        console.log(`[useAppStore] fetchUsersForAssignmentList: Fetching users for org ${currentUser.organization_id}`);
        updateState(s => ({ ...s, isLoadingUsersForAssignment: true, usersForAssignmentError: null }));
        try {
          const usersPromise = supabaseService.getUsersByOrganizationId(currentUser.organization_id);
          const timeoutPromise = new Promise<AppUserType[]>((_, reject) => 
            setTimeout(() => reject(new Error("Users fetch timeout")), 10000)
          );
          const fetchedUsers = await Promise.race([usersPromise, timeoutPromise]);
          console.log(`[useAppStore] fetchUsersForAssignmentList: Fetched ${fetchedUsers.length} users. First user (if any):`, fetchedUsers[0]);
          updateState(s => ({ ...s, users: fetchedUsers, isLoadingUsersForAssignment: false }));
        } catch (error: any) {
          const message = parseErrorMessage(error, 'Failed to fetch users for organization.');
          console.error(`[useAppStore] fetchUsersForAssignmentList: Error - ${message}`);
          updateState(s => ({ ...s, isLoadingUsersForAssignment: false, usersForAssignmentError: message, users: [] }));
        }
      },
  };

  const _updateTaskAction = async (taskId: string, updates: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'creator_id' | 'projectId'>>) => {
    const activeProjectId = get().activeProject?.id;
    if (!activeProjectId) {
        updateState(s => ({ ...s, tasksError: "Cannot update task: No active project.", isLoadingTasks: false }));
        return;
    }
    
    try {
        await supabaseService.updateTask(taskId, updates);
        
        if (!(updates.hasOwnProperty('position') && updates.hasOwnProperty('status'))) { 
             await selfActions.fetchTasksForProject(activeProjectId);
        }
    } catch (error: any) {
        const message = parseErrorMessage(error, `Failed to update task ${taskId}.`);
        updateState(s => ({ ...s, tasksError: message }));
        if (activeProjectId) await selfActions.fetchTasksForProject(activeProjectId);
    }
  };

  Object.assign(selfActions, {
    toggleDarkMode: () => updateState(s => ({ ...s, darkMode: !s.darkMode })),
    setActiveView: (view: ActiveView) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeView', view);
        }
        updateState(s => ({ ...s, activeView: view }));
        const currentStore = get();
        if (view === 'team_management' && currentStore.currentUser?.organization_id && currentStore.users.length === 0 && !currentStore.isLoadingUsersForAssignment) {
            selfActions.fetchUsersForAssignmentList();
        }
        if (view === 'user_logs_view' && currentStore.currentUser?.organization_id && (currentStore.currentUser.role === UserRole.ADMIN || currentStore.currentUser.role === UserRole.OWNER)) {
            // Future: Fetch initial logs if needed, for now it's a placeholder page.
        }
    },
    signUp: async (email: string, password: string, fullName: string, organizationName?: string, role?: UserRole) => {
      updateState(s => ({ ...s, authLoading: true, authError: null }));
      try {
        const result = await supabaseService.signUpUser(email, password, fullName, organizationName, role);
        if (result && result.profile) {
             console.log("[useAppStore signUp] Supabase signUpUser successful, profile returned:", result.profile);
        } else {
            console.warn("[useAppStore signUp] signUpUser completed but didn't return a profile as expected.");
        }
        updateState(s => ({ ...s, authLoading: false }));
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Sign up failed. Please check your details and try again.');
        updateState(s => ({ ...s, authLoading: false, authError: message, currentUser: null })); 
        throw error;
      }
    },
    joinOrCreateOrganization: async (organizationName: string, role?: UserRole) => {
      const { currentUser } = get();
      if (!currentUser) return;
      
      updateState(s => ({ ...s, authLoading: true, authError: null }));
      try {
        const updatedProfile = await supabaseService.joinOrCreateOrganizationForUser(currentUser.id, organizationName, role);
        updateState(s => ({ ...s, currentUser: updatedProfile, authLoading: false }));
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Failed to join or create organization.');
        updateState(s => ({ ...s, authLoading: false, authError: message }));
        throw error;
      }
    },
    signIn: async (email: string, password: string) => {
      updateState(s => ({ ...s, authLoading: true, authError: null }));
      try {
        await supabaseService.signInUser(email, password);
        updateState(s => ({ ...s, authLoading: false }));
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Sign in failed. Please check your credentials and connection.');
        updateState(s => ({ ...s, authLoading: false, authError: message, currentUser: null }));
        throw error;
      }
    },
    signOut: async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('activeView');
        localStorage.removeItem('activeProjectId');
      }
      updateState(s => ({ ...s, authLoading: true, authError: null, activeProject: null, projects: [], tasks: [], users: [], activeView: 'overview', currentUser: null }));
      try {
        await supabaseService.signOutUser();
        updateState(s => ({ ...s, authLoading: false }));
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Sign out failed.');
        updateState(s => ({ ...s, authLoading: false, authError: message }));
        throw error;
      }
    },
    setCurrentUser: (user: User | null) => {
      const currentActiveProject = get().activeProject;
      let nextActiveView = get().activeView;
      let nextActiveProject = currentActiveProject;

      if (!user) {
        nextActiveView = 'overview'; 
        nextActiveProject = null;
      } else {
        if (currentActiveProject && currentActiveProject.organization_id && currentActiveProject.organization_id !== user.organization_id) {
          nextActiveProject = null;
        } else if (currentActiveProject && !currentActiveProject.organization_id && currentActiveProject.owner_id !== user.id) {
          nextActiveProject = null;
        }
        if (!nextActiveProject && !['kanban', 'overview', 'projects_overview', 'my_tasks_view', 'inbox_view', 'reports_view', 'team_management', 'admin_settings', 'user_logs_view', 'profile_settings'].includes(nextActiveView)) {
           nextActiveView = 'overview';
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('activeView', nextActiveView);
        if (nextActiveProject) {
          localStorage.setItem('activeProjectId', nextActiveProject.id);
        } else if (!user || (currentActiveProject && currentActiveProject.organization_id && currentActiveProject.organization_id !== user.organization_id) || (currentActiveProject && !currentActiveProject.organization_id && currentActiveProject.owner_id !== user.id)) {
          localStorage.removeItem('activeProjectId');
        }
      }

      updateState(s => ({
        ...s,
        currentUser: user,
        activeProject: nextActiveProject,
        activeView: nextActiveView,
        projects: (!user || (nextActiveProject && nextActiveProject.organization_id && nextActiveProject.organization_id !== user.organization_id)) ? [] : s.projects,
        tasks: (!user || !nextActiveProject) ? [] : s.tasks,
        users: (!user || !user.organization_id) ? [] : s.users, 
      }));
    },
    setAuthLoading: (loading: boolean) => updateState(s => ({ ...s, authLoading: loading })),
    setAuthError: (error: string | null) => updateState(s => ({ ...s, authError: error })),
    setAppLoading: (loading: boolean) => updateState(s => ({...s, appLoading: loading})),

    fetchProjects: selfActions.fetchProjects,
    fetchTasksForProject: selfActions.fetchTasksForProject,
    fetchAllTasksForAllProjects: async () => {
      const { currentUser, projects: currentProjects, isLoadingTasks } = get();
      if (!currentUser) return;
      if (isLoadingTasks) return; 

      updateState(s => ({ ...s, isLoadingTasks: true, tasksError: null }));
      let allTasks: Task[] = [];
      let anyError = null;
      try {
        for (const project of currentProjects) {
          try {
            const projectTasks = await supabaseService.getTasksByProjectId(project.id);
            allTasks = allTasks.concat(projectTasks);
          } catch (error) {
            console.error(`Error fetching tasks for project ${project.id} in fetchAllTasksForAllProjects:`, error);
            anyError = error; 
          }
        }
        const uniqueTasks = Array.from(new Map(allTasks.map(task => [task.id, task])).values());
        updateState(s => ({ ...s, tasks: uniqueTasks, isLoadingTasks: false, tasksError: anyError ? parseErrorMessage(anyError, 'Failed to fetch some project tasks.') : null }));
      } catch (error: any) { 
        updateState(s => ({ ...s, isLoadingTasks: false, tasksError: parseErrorMessage(error, 'Failed to fetch all tasks.') }));
      }
    },
    fetchUsersForAssignmentList: selfActions.fetchUsersForAssignmentList,

    setActiveProject: selfActions.setActiveProject,
    createTask: async (taskData: Omit<Task, 'id' | 'position' | 'created_at' | 'updated_at' | 'creator_id'>) => {
      const { currentUser, activeProject } = get();
      if (!currentUser || !activeProject) {
        const message = "Cannot create task: No active user or project selected.";
        updateState(s => ({...s, error: message, isLoading: false}));
        return null;
      }
      updateState(s => ({ ...s, isLoading: true, error: null }));
      try {
        const createdTask = await supabaseService.createTask(taskData);
        await selfActions.fetchTasksForProject(activeProject.id); 
        selfActions.emitEvent('TASK_CREATED', { task: createdTask });
        updateState(s => ({ ...s, isLoading: false, isModalOpen: false, suggestedTaskTitles: [], parentTaskIdForNewTask: null }));
        return createdTask;
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Failed to create task.');
        updateState(s => ({ ...s, isLoading: false, error: message }));
        throw error;
      }
    },
    updateTask: async (taskId: string, updates: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'creator_id' | 'projectId'>>) => {
        const { activeProject } = get();
        if (!activeProject) {
          updateState(s => ({ ...s, tasksError: "Cannot update task: No active project." }));
          return;
        }
        const originalTasks = get().tasks;
        const originalTask = originalTasks.find(t => t.id === taskId);
        const updatedTasksOptimistic = originalTasks.map(t => 
            t.id === taskId ? { ...t, ...updates } : t
        );
        const currentTaskToView = get().taskToView;
        const updatedTaskToView = currentTaskToView?.id === taskId ? { ...currentTaskToView, ...updates } : currentTaskToView;
        
        updateState(s => ({ 
            ...s, 
            tasks: updatedTasksOptimistic, 
            taskToView: updatedTaskToView,
            isLoadingTasks: true, 
            tasksError: null, 
            isEditTaskModalOpen: false, 
            taskToEdit: null 
        }));

        try {
            await supabaseService.updateTask(taskId, updates);
            await selfActions.fetchTasksForProject(activeProject.id); 
            if (originalTask) {
              const updatedTask = { ...originalTask, ...updates };
              selfActions.emitEvent('TASK_UPDATED', { task: updatedTask });
              
              if (updates.assignee_id && updates.assignee_id !== originalTask.assignee_id) {
                selfActions.emitEvent('TASK_ASSIGNED', { task: updatedTask });
              }
              if (updates.status && updates.status !== originalTask.status) {
                selfActions.emitEvent('TASK_STATUS_UPDATED', { task: updatedTask });
              }
            }
             updateState(s => ({ ...s, isLoadingTasks: false }));
        } catch (error: any) {
            const message = parseErrorMessage(error, `Failed to update task ${taskId}. Reverting.`);
            updateState(s => ({ ...s, tasks: originalTasks, isLoadingTasks: false, tasksError: message }));
        }
    },
    deleteTask: async (taskId: string) => {
      const { activeProject, tasks: currentTasks } = get();
      if (!activeProject) {
        updateState(s => ({ ...s, tasksError: "Cannot delete task: No active project." }));
        return;
      }
      const tasksAfterDelete = currentTasks.filter(t => t.id !== taskId);
      const taskToDelete = currentTasks.find(t => t.id === taskId);
      updateState(s => ({ ...s, tasks: tasksAfterDelete, isLoadingTasks: true, tasksError: null }));
      try {
        await supabaseService.deleteTask(taskId);
        await selfActions.fetchTasksForProject(activeProject.id); 
        if (taskToDelete) {
          selfActions.emitEvent('TASK_DELETED', { task: taskToDelete });
        }
        updateState(s => ({ ...s, isLoadingTasks: false }));
      } catch (error: any) {
        const message = parseErrorMessage(error, `Failed to delete task ${taskId}. Reverting.`);
        updateState(s => ({ ...s, tasks: currentTasks, isLoadingTasks: false, tasksError: message }));
      }
    },
    getTasksByProjectIdAndStatus: (projectId: string, status: TaskStatus): Task[] => {
      return get().tasks
        .filter(task => task.projectId === projectId && task.status === status && !task.parent_task_id)
        .sort((a, b) => a.position - b.position);
    },
    moveTask: async (
      draggedTaskId: string,
      originalStatus: TaskStatus,
      _originalVisualIndex: number, 
      newStatus: TaskStatus,
      newVisualIndexInColumn: number
    ) => {
      const currentTasks = [...get().tasks];
      const activeProjectId = get().activeProject?.id;

      if (!activeProjectId) {
        updateState(s => ({ ...s, tasksError: "Cannot move task: No active project." }));
        return;
      }

      let draggedTask = currentTasks.find(t => t.id === draggedTaskId);
      if (!draggedTask) {
        updateState(s => ({ ...s, tasksError: "Dragged task not found." }));
        return;
      }

      let tempTasks = currentTasks.map(t => ({ ...t }));
      
      tempTasks = tempTasks.filter(t => t.id !== draggedTaskId);
      
      draggedTask = { ...draggedTask, status: newStatus };

      let tasksInNewStatusColumn = tempTasks
        .filter(t => t.projectId === activeProjectId && t.status === newStatus)
        .sort((a, b) => a.position - b.position);

      tasksInNewStatusColumn.splice(newVisualIndexInColumn, 0, draggedTask);
      tasksInNewStatusColumn.forEach((task, index) => {
        task.position = index;
      });

      let tasksInOldStatusColumn: Task[] = [];
      if (originalStatus !== newStatus) {
        tasksInOldStatusColumn = tempTasks
          .filter(t => t.projectId === activeProjectId && t.status === originalStatus)
          .sort((a, b) => a.position - b.position);
        tasksInOldStatusColumn.forEach((task, index) => {
          task.position = index;
        });
      }

      const finalOptimisticTasks = tempTasks
        .filter(t => t.projectId !== activeProjectId || (t.status !== newStatus && t.status !== originalStatus)) 
        .concat(tasksInNewStatusColumn)
        .concat(originalStatus !== newStatus ? tasksInOldStatusColumn : []);

      updateState(s => ({ ...s, tasks: finalOptimisticTasks, tasksError: null }));

      const tasksToUpdateOnBackend: { id: string; status: TaskStatus; position: number }[] = [];
      
      tasksInNewStatusColumn.forEach(task => {
        tasksToUpdateOnBackend.push({ id: task.id, status: task.status, position: task.position });
      });

      if (originalStatus !== newStatus) {
        tasksInOldStatusColumn.forEach(task => {
          if (!tasksToUpdateOnBackend.find(u => u.id === task.id)) {
            tasksToUpdateOnBackend.push({ id: task.id, status: task.status, position: task.position });
          }
        });
      }
      
      console.log('[moveTask] Tasks to update on backend:', tasksToUpdateOnBackend);

      try {
        const updatePromises = tasksToUpdateOnBackend.map(taskUpdate =>
          supabaseService.updateTask(taskUpdate.id, { status: taskUpdate.status, position: taskUpdate.position })
        );
        await Promise.all(updatePromises);
        
        if (originalStatus !== newStatus) {
          selfActions.emitEvent('TASK_STATUS_UPDATED', { task: draggedTask });
        }
        
        updateState(s => ({ ...s, isLoadingTasks: false }));

      } catch (error: any) {
        const message = parseErrorMessage(error, "Failed to sync task move with the server. Reverting.");
        updateState(s => ({ ...s, tasks: currentTasks, tasksError: message, isLoadingTasks: false })); 
      }
    },

    openModal: async (parentTaskId?: string) => {
        const { activeProject, currentUser } = get();
        if (!activeProject || !currentUser) return;
        updateState(s => ({ ...s, isLoading: true }));
        try {
            const draftTask = await selfActions.createTask({
                title: "New Task",
                projectId: activeProject.id,
                status: TaskStatus.TODO,
                priority: TaskPriority.MEDIUM,
                assignee_id: currentUser.id,
                parent_task_id: parentTaskId || undefined,
            });
            if (draftTask) {
                updateState(s => ({ ...s, isLoading: false, taskToView: draftTask, isViewTaskModalOpen: true }));
            } else {
                updateState(s => ({ ...s, isLoading: false }));
            }
        } catch (error: any) {
            updateState(s => ({ ...s, isLoading: false, error: parseErrorMessage(error, "Failed to create draft task.") }));
        }
    },
    closeModal: () => updateState(s => ({ ...s, isModalOpen: false, suggestedTaskTitles: [], error: null, parentTaskIdForNewTask: null })),

    openViewTaskModal: (taskId: string) => {
        const task = get().tasks.find(t => t.id === taskId);
        if (task) {
            updateState(s => ({ ...s, taskToView: task, isViewTaskModalOpen: true }));
        } else {
            console.warn(`Task with ID ${taskId} not found to open view modal.`);
            updateState(s => ({ ...s, tasksError: `Task details for ID ${taskId} could not be loaded.`}));
        }
    },
    closeViewTaskModal: () => updateState(s => ({ ...s, taskToView: null, isViewTaskModalOpen: false })),

    openEditTaskModal: (taskId: string) => {
      const task = get().tasks.find(t => t.id === taskId);
      if (task) {
          updateState(s => ({ ...s, taskToEdit: task, isEditTaskModalOpen: true, error: null, suggestedTaskTitles: [] }));
      } else {
          console.warn(`Task with ID ${taskId} not found to open edit modal.`);
          updateState(s => ({ ...s, error: `Task details for ID ${taskId} could not be loaded for editing.`}));
      }
    },
    closeEditTaskModal: () => updateState(s => ({ ...s, taskToEdit: null, isEditTaskModalOpen: false, error: null, suggestedTaskTitles: [] })),


    openCreateProjectModal: () => updateState(s => ({ ...s, isCreateProjectModalOpen: true, createProjectError: null })),
    closeCreateProjectModal: () => updateState(s => ({ ...s, isCreateProjectModalOpen: false, createProjectError: null })),

    createProject: async (projectData: Pick<Project, 'name' | 'description'>): Promise<Project | void> => {
      const entryTimeCurrentUser = get().currentUser; 
      if (!entryTimeCurrentUser || !entryTimeCurrentUser.id) {
        const message = `User not logged in or ID missing. User ID: ${entryTimeCurrentUser?.id}`;
        updateState(s => ({ ...s, createProjectError: message, isLoadingCreateProject: false }));
        return;
      }

      updateState(s => ({ ...s, isLoadingCreateProject: true, createProjectError: null }));

      try {
        const projectOrganizationId = entryTimeCurrentUser.organization_id || undefined; 
        const projectPayload = {
          name: projectData.name,
          description: projectData.description,
          owner_id: entryTimeCurrentUser.id,
          organization_id: projectOrganizationId,
          progress: 0,
        };
        const newProjectFromService = await supabaseService.createProject(projectPayload);
        
        await selfActions.fetchProjects(); 

        let projectToActivate = get().projects.find(p => p.id === newProjectFromService?.id);
        
        if (!projectToActivate && newProjectFromService) {
            projectToActivate = newProjectFromService;
        }

        updateState(s => ({
          ...s,
          isLoadingCreateProject: false,
          isCreateProjectModalOpen: false,
        }));
        
        if (newProjectFromService) {
          selfActions.emitEvent('PROJECT_CREATED', { project: newProjectFromService });
        }

        if (projectToActivate) {
          selfActions.setActiveProject(projectToActivate.id); 
        } else {
            selfActions.setActiveProject(null); 
        }
        return projectToActivate; 
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Failed to create project.');
        updateState(s => ({ ...s, isLoadingCreateProject: false, createProjectError: message }));
      }
    },

    setIsLoading: (loading: boolean) => updateState(s => ({ ...s, isLoading: loading })),
    setError: (error: string | null) => updateState(s => ({ ...s, error: error })),

    setSuggestedTaskTitles: (titles: string[]) => updateState(s => ({ ...s, suggestedTaskTitles: titles })),
    setOrganizationCheck: (checkState: Partial<OrganizationCheckState>) => {
      updateState(s => ({ ...s, organizationCheck: { ...s.organizationCheck, ...checkState }}));
    },
    setHighlightedProjectId: (id: string | null) => updateState(s => ({ ...s, highlightedProjectId: id })),
    setHighlightedTaskId: (id: string | null) => updateState(s => ({ ...s, highlightedTaskId: id })),
    setProjectsError: (error: string | null) => updateState(s => ({
      ...s,
      projectsError: error,
      isLoadingProjects: false,
      projects: error ? [] : s.projects 
    })),
    setUsersForAssignmentError: (error: string | null) => updateState(s => ({
      ...s,
      usersForAssignmentError: error,
      isLoadingUsersForAssignment: false,
      users: error ? [] : s.users 
    })),
    setProjects: (projectsToSet: Project[]) => updateState(s => ({ 
      ...s,
      projects: projectsToSet,
      isLoadingProjects: false, 
      projectsError: null
    })),
    setUsers: (usersToSet: User[]) => updateState(s => ({ 
      ...s,
      users: usersToSet,
      isLoadingUsersForAssignment: false, 
      usersForAssignmentError: null
    })),
    setTasks: (tasksToSet: Task[]) => updateState(s => ({ 
      ...s,
      tasks: tasksToSet,
      isLoadingTasks: false, 
      tasksError: null
    })),
    setTasksError: (error: string | null) => updateState(s => ({
      ...s,
      tasksError: error,
      isLoadingTasks: false,
      tasks: error ? [] : s.tasks 
    })),
    updateUserRoleInOrganization: async (userId: string, newRole: UserRole) => {
      const { currentUser } = get();
      console.log(`[useAppStore] updateUserRoleInOrganization: Initiated for user ${userId} to role ${newRole} by ${currentUser?.id} in org ${currentUser?.organization_id}`);
      if (!currentUser || !currentUser.organization_id) {
        const errorMsg = "Not authorized or not in an organization.";
        console.warn(`[useAppStore] updateUserRoleInOrganization: Auth check failed - ${errorMsg}`);
        updateState(s => ({ ...s, updateUserRoleError: errorMsg, isUpdatingUserRole: false }));
        return;
      }
      if (userId === currentUser.id && newRole !== currentUser.role) {
        const errorMsg = "You cannot change your own role through this interface.";
        console.warn(`[useAppStore] updateUserRoleInOrganization: Self-role change attempt failed - ${errorMsg}`);
        updateState(s => ({ ...s, updateUserRoleError: errorMsg, isUpdatingUserRole: false }));
        return;
      }

      updateState(s => ({ ...s, isUpdatingUserRole: true, updateUserRoleError: null }));
      try {
        console.log(`[useAppStore] updateUserRoleInOrganization: Calling Supabase service for user ${userId}, role ${newRole}, org ${currentUser.organization_id}`);
        await supabaseService.updateUserRole(userId, newRole, currentUser.organization_id);
        console.log(`[useAppStore] updateUserRoleInOrganization: Supabase service call successful for user ${userId}. Fetching updated user list.`);
        await selfActions.fetchUsersForAssignmentList(); // This will log internal details
        updateState(s => ({ ...s, isUpdatingUserRole: false }));
        console.log(`[useAppStore] updateUserRoleInOrganization: User list refreshed. Update complete for user ${userId}. Current users in store:`, get().users);
        
        // Emit event for notification
        get().emitEvent('USER_ROLE_UPDATED', { userId, newRole });
      } catch (error: any) {
        const message = parseErrorMessage(error, `Failed to update role for user ${userId}.`);
        console.error(`[useAppStore] updateUserRoleInOrganization: Error for user ${userId} - ${message}`, error);
        updateState(s => ({ ...s, isUpdatingUserRole: false, updateUserRoleError: message }));
      }
    },
    deleteUserFromOrganization: async (userId: string) => {
      const { currentUser } = get();
      console.log(`[useAppStore] deleteUserFromOrganization: Initiated for user ${userId} by ${currentUser?.id} in org ${currentUser?.organization_id}`);
      if (!currentUser || !currentUser.organization_id) {
        const errorMsg = "Not authorized or not in an organization.";
        console.warn(`[useAppStore] deleteUserFromOrganization: Auth check failed - ${errorMsg}`);
        updateState(s => ({ ...s, deleteUserError: errorMsg, isDeletingUser: null }));
        return;
      }
      if (userId === currentUser.id) {
        const errorMsg = "You cannot remove yourself from the organization through this interface.";
        console.warn(`[useAppStore] deleteUserFromOrganization: Self-removal attempt failed - ${errorMsg}`);
        updateState(s => ({ ...s, deleteUserError: errorMsg, isDeletingUser: null }));
        return;
      }

      updateState(s => ({ ...s, isDeletingUser: userId, deleteUserError: null }));
      try {
        console.log(`[useAppStore] deleteUserFromOrganization: Calling Supabase service for user ${userId}, org ${currentUser.organization_id}`);
        await supabaseService.removeUserFromOrganization(userId, currentUser.organization_id);
        console.log(`[useAppStore] deleteUserFromOrganization: Supabase service call successful for user ${userId}. Fetching updated user list.`);
        await selfActions.fetchUsersForAssignmentList(); // This will log internal details
        updateState(s => ({ ...s, isDeletingUser: null }));
        console.log(`[useAppStore] deleteUserFromOrganization: User list refreshed. Deletion complete for user ${userId}. Current users in store:`, get().users);
        
        // Emit event for notification
        get().emitEvent('USER_REMOVED_FROM_ORG', { userId });
      } catch (error: any) {
        const message = parseErrorMessage(error, `Failed to remove user ${userId} from organization.`);
        console.error(`[useAppStore] deleteUserFromOrganization: Error for user ${userId} - ${message}`, error);
        updateState(s => ({ ...s, isDeletingUser: null, deleteUserError: message }));
      }
    },

    // Password Update Actions
    openPasswordUpdateModal: () => updateState(s => ({ ...s, isPasswordUpdateModalOpen: true })),
    closePasswordUpdateModal: () => updateState(s => ({ ...s, isPasswordUpdateModalOpen: false, authError: null })),
    updatePassword: async (password: string) => {
      updateState(s => ({ ...s, authLoading: true, authError: null }));
      try {
        await supabaseService.updateUserPassword(password);
        updateState(s => ({ ...s, authLoading: false }));
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Failed to update password.');
        updateState(s => ({ ...s, authLoading: false, authError: message }));
        throw error;
      }
    },
  });

  return selfActions;
};

type AppStoreHookType = StoreState & ReturnType<typeof appActionsCreator>;

interface UseAppStoreHook extends Function {
  getState: () => StoreState;
}


const createAppStoreHook = <TState extends StoreState, TActionsCreator extends (updateState: (updater: (s: TState) => TState) => void, get: () => TState) => any>(
  initialStateValues: TState,
  actionsCreatorFunc: TActionsCreator
): (() => TState & ReturnType<TActionsCreator>) & { getState: () => TState } => {
  let state = initialStateValues;
  const listeners = new Set<() => void>();

  const setState = (updater: (s: TState) => TState) => {
    const oldDarkMode = state.darkMode;
    state = updater(state);

    if (typeof window !== 'undefined' && state.darkMode !== oldDarkMode) {
      document.documentElement.classList.toggle('dark', state.darkMode);
      localStorage.setItem('theme', state.darkMode ? 'dark' : 'light');
    }
    listeners.forEach(listener => listener());
  };

  const getState = () => state;
  const actions = actionsCreatorFunc(setState, getState);

  if (typeof window !== 'undefined' && initialStateValues.darkMode) {
    document.documentElement.classList.add('dark');
  }

  const useHook = (): TState & ReturnType<TActionsCreator> => {
    const [localState, setLocalState] = useState(getState());

    useEffect(() => {
      const listener = () => setLocalState(getState());
      listeners.add(listener);
      
      if (typeof window !== 'undefined') {
        document.documentElement.classList.toggle('dark', getState().darkMode);
      }
      
      setLocalState(getState()); 
      return () => {
        listeners.delete(listener);
      };
    }, []); 

    const { currentUser, activeProject, appLoading: storeAppLoading, highlightedProjectId, highlightedTaskId } = localState;

    useEffect(() => {
      let projectTimeoutId: ReturnType<typeof setTimeout> | null = null;
      if (highlightedProjectId) {
        projectTimeoutId = setTimeout(() => {
          actions.setHighlightedProjectId(null);
        }, 3000);
      }
      return () => {
        if (projectTimeoutId) clearTimeout(projectTimeoutId);
      };
    }, [highlightedProjectId, actions]);

    useEffect(() => {
      let taskTimeoutId: ReturnType<typeof setTimeout> | null = null;
      if (highlightedTaskId) {
        taskTimeoutId = setTimeout(() => {
          actions.setHighlightedTaskId(null);
        }, 3000);
      }
      return () => {
        if (taskTimeoutId) clearTimeout(taskTimeoutId);
      };
    }, [highlightedTaskId, actions]);


    return { ...localState, ...actions };
  };

  (useHook as any).getState = getState;

  return useHook as (() => TState & ReturnType<TActionsCreator>) & { getState: () => TState };
};

export const useAppStore = createAppStoreHook(initialStoreStateValues, appActionsCreator);