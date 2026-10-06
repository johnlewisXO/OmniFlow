

import { useState, useCallback, useEffect } from 'react';
import { AppStore, Task, Project, User, TaskStatus, TaskPriority, UserRole, Organization, ActiveView, OrganizationCheckState, Notification, Sprint, UserPresence, WebhookConfig } from '../types';
import { ICON_MAP } from '../constants';
import supabaseService, { supabase } from '../services/supabaseService';
import collabService from '../services/collabService';
import { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';
import { isBefore, isToday, startOfDay, parseISO } from 'date-fns';

// --- NO MOCK DATA ---

interface StoreState {
  darkMode: boolean;
  users: User[];
  projects: Project[];
  tasks: Task[];
  myTasks: Task[];
  currentUser: User | null;
  currentOrganization: Organization | null;
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

  isCommandPaletteOpen: boolean;
  isMobileSidebarOpen: boolean;

  notifications: Notification[];

  // Agile Sprints
  sprints: Sprint[];
  activeSprintId: string | null;

  // Real-Time Presence
  presences: UserPresence[];

  // Keyboard Shortcuts
  isShortcutsModalOpen: boolean;

  // Webhooks
  webhooks: WebhookConfig[];
}

const _darkMode = typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false;
const _notifications = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('notifications') || '[]') : [];
const _activeView = typeof window !== 'undefined' ? (localStorage.getItem('activeView') as ActiveView || 'overview') : 'overview';
const _activeProjectId = typeof window !== 'undefined' ? localStorage.getItem('activeProjectId') : null;
const _storedSprints = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('omni_sprints') || '[]') : [];
const _storedWebhooks = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('omni_webhooks') || '[]') : [];

const initialStoreStateValues: StoreState = {
  darkMode: _darkMode,
  users: [],
  currentUser: null,
  currentOrganization: null,
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

  isCommandPaletteOpen: false,

  isMobileSidebarOpen: false,

  notifications: _notifications,

  // Agile Sprints
  sprints: _storedSprints,
  activeSprintId: null,

  // Real-Time Presence
  presences: [],

  // Keyboard Shortcuts
  isShortcutsModalOpen: false,

  // Webhooks
  webhooks: _storedWebhooks,
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


// Helper for timeouts that clears the timeout to prevent unhandled rejections
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const appActionsCreator = (
  updateState: (updater: (s: StoreState) => StoreState) => void,
  get: () => AppStore
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
    addToast: (
      title: string,
      message: string,
      toastType: 'success' | 'error' | 'warning' | 'info' = 'info',
      navTarget?: { entity_type?: 'task' | 'project' | 'user' | 'system' | 'chat'; entity_id?: string; reference_id?: string; metadata?: Record<string, any> }
    ) => {
      const { currentUser } = get();
      const id = crypto.randomUUID();
      const toastNotification: Notification = {
        id,
        title,
        message,
        content: message,
        type: navTarget?.entity_type ? `${navTarget.entity_type.toUpperCase()}_UPDATE` : 'SYSTEM_TOAST',
        toastType,
        user_id: currentUser?.id || 'system',
        reference_id: navTarget?.reference_id || navTarget?.entity_id || id,
        entity_type: navTarget?.entity_type,
        entity_id: navTarget?.entity_id,
        metadata: navTarget?.metadata,
        is_read: false,
        read: false,
        created_at: new Date().toISOString()
      };
      
      updateState(s => {
        const newNotifications = [toastNotification, ...s.notifications];
        if (typeof window !== 'undefined') {
          localStorage.setItem('notifications', JSON.stringify(newNotifications.slice(0, 50)));
        }
        return { ...s, notifications: newNotifications };
      });
    },
    setCurrentOrganization: (org: Organization | null) => {
      updateState(s => ({ ...s, currentOrganization: org }));
    },
    fetchCurrentOrganization: async () => {
      const { currentUser } = get();
      if (!currentUser?.organization_id) {
        updateState(s => ({ ...s, currentOrganization: null }));
        return;
      }
      try {
        const org = await supabaseService.getOrganizationById(currentUser.organization_id);
        if (org) {
          updateState(s => ({ ...s, currentOrganization: org }));
        }
      } catch (err) {
        console.warn('[useAppStore] fetchCurrentOrganization failed:', err);
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
      supabaseService.markNotificationAsRead(id).catch(e => console.error(e));
      updateState(s => {
        const newNotifications = s.notifications.map(n => n.id === id ? { ...n, read: true, is_read: true } : n);
        if (typeof window !== 'undefined') {
          localStorage.setItem('notifications', JSON.stringify(newNotifications));
        }
        return { ...s, notifications: newNotifications };
      });
    },
    markAllNotificationsAsRead: () => {
      const { currentUser } = get();
      if (currentUser) {
        supabaseService.markAllNotificationsAsRead(currentUser.id).catch(e => console.error(e));
      }
      updateState(s => {
        const newNotifications = s.notifications.map(n => ({ ...n, read: true, is_read: true }));
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
        const projects = await withTimeout(
          supabaseService.getProjects(),
          10000,
          "Projects fetch timeout"
        );
        
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
          const newTasksForProject = await withTimeout(
            supabaseService.getTasksByProjectId(projectId),
            10000,
            "Tasks fetch timeout"
          );
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
        const myTasks = await withTimeout(
          supabaseService.getMyTasks(),
          10000,
          "My tasks fetch timeout"
        );
        
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
    setActiveProject: (projectOrId: string | Project | null) => {
      const projectId: string | null = (typeof projectOrId === 'object' && projectOrId !== null) 
        ? projectOrId.id 
        : (typeof projectOrId === 'string' ? projectOrId : null);
      if (typeof window !== 'undefined') {
        if (projectId) {
          localStorage.setItem('activeProjectId', projectId);
        } else {
          localStorage.removeItem('activeProjectId');
        }
      }
      
      if (projectId) {
        const project = typeof projectOrId === 'object' && projectOrId !== null 
          ? projectOrId 
          : (get().projects.find(p => p.id === projectId) || null);
        updateState(s => ({
          ...s,
          activeProject: project,
          tasks: [], 
          suggestedTaskTitles: [],
          tasksError: null,
          activeView: 'kanban',
          isMobileSidebarOpen: false
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
        if (!currentUser) {
            updateState(s => ({ ...s, users: [], isLoadingUsersForAssignment: false, usersForAssignmentError: "Not logged in." }));
            return;
        }
        updateState(s => ({ ...s, isLoadingUsersForAssignment: true, usersForAssignmentError: null }));
        try {
          let fetchedUsers: User[] = [];
          if (currentUser.organization_id) {
            try {
              fetchedUsers = await withTimeout(
                supabaseService.getUsersByOrganizationId(currentUser.organization_id),
                10000,
                "Users fetch timeout"
              );
            } catch (orgErr) {
              console.warn('[useAppStore] Org users fetch fallback:', orgErr);
            }
          }

          // Also fetch other user_profiles on the platform so teammates can discover & add each other
          try {
            const { data: allProfiles } = await supabase.from('user_profiles').select('*').limit(50);
            if (Array.isArray(allProfiles)) {
              allProfiles.forEach((p: any) => {
                if (p && p.id && !fetchedUsers.some(u => u.id === p.id)) {
                  fetchedUsers.push(p as User);
                }
              });
            }
          } catch (e) {}

          // Merge any custom added people from localStorage
          if (typeof window !== 'undefined') {
            try {
              const savedCustom = localStorage.getItem('omni_custom_team_members');
              if (savedCustom) {
                const customList: User[] = JSON.parse(savedCustom);
                customList.forEach(cu => {
                  if (cu && cu.id && !fetchedUsers.some(u => u.id === cu.id)) {
                    fetchedUsers.push(cu);
                  }
                });
              }
            } catch (e) {}
          }

          updateState(s => ({ ...s, users: fetchedUsers, isLoadingUsersForAssignment: false }));
        } catch (error: any) {
          const message = parseErrorMessage(error, 'Failed to fetch users for organization.');
          console.error(`[useAppStore] fetchUsersForAssignmentList: Error - ${message}`);
          updateState(s => ({ ...s, isLoadingUsersForAssignment: false, usersForAssignmentError: message }));
        }
      },
  };

  const _updateTaskAction = async (taskId: string, updates: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'creator_id' | 'projectId'>>) => {
    const activeProjectId = get().activeProject?.id;
    const previousTask = get().tasks.find(t => t.id === taskId);
    
    // Apply optimistic update immediately to avoid UI stutter
    updateState(s => {
      const updatedTasks = s.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
      const updatedMyTasks = s.myTasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
      const updatedTaskToView = s.taskToView?.id === taskId ? { ...s.taskToView, ...updates } : s.taskToView;
      return {
        ...s,
        tasks: updatedTasks,
        myTasks: updatedMyTasks,
        taskToView: updatedTaskToView,
        tasksError: null
      };
    });

    try {
        await supabaseService.updateTask(taskId, updates);
        
        // Broadcast change across tabs & Supabase Realtime
        const currentUser = get().currentUser;
        const targetTask = get().tasks.find(t => t.id === taskId) || previousTask;
        if (currentUser && targetTask) {
          collabService.broadcastTaskUpdated({
            taskId,
            taskTitle: targetTask.title,
            updates,
            actor: {
              id: currentUser.id,
              name: currentUser.full_name || currentUser.email,
            }
          });
        }
        if (currentUser && targetTask) {
          const changedKeys = Object.keys(updates);
          let actionLabel = 'task_updated';
          let changeSummary = `Updated ${changedKeys.join(', ')}`;

          if (updates.status && previousTask?.status !== updates.status) {
            actionLabel = 'status_changed';
            changeSummary = `Changed status from ${previousTask?.status || 'Unknown'} to ${updates.status}`;
          } else if (updates.priority && previousTask?.priority !== updates.priority) {
            actionLabel = 'priority_changed';
            changeSummary = `Changed priority from ${previousTask?.priority || 'Normal'} to ${updates.priority}`;
          } else if (updates.assignee_id !== undefined && previousTask?.assignee_id !== updates.assignee_id) {
            actionLabel = 'assignee_changed';
            changeSummary = `Updated assignee`;
          }

          // Insert into task_activity_logs
          try {
            await supabase.from('task_activity_logs').insert({
              task_id: taskId,
              user_id: currentUser.id,
              action: actionLabel,
              details: {
                summary: changeSummary,
                changedKeys,
                updates,
                old_status: previousTask?.status,
                new_status: updates.status,
              }
            });
          } catch (e) {
            // Safe fallback if table has strict schema
          }

          // Add in-app notification to the notifications feed
          const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          updateState(s => ({
            ...s,
            notifications: [
              {
                id: notifId,
                user_id: currentUser.id,
                entity_type: 'task',
                entity_id: taskId,
                type: 'TASK_UPDATED',
                title: targetTask.title,
                message: `${currentUser.full_name || currentUser.email}: ${changeSummary}`,
                content: changeSummary,
                read: false,
                is_read: false,
                created_at: new Date().toISOString(),
              },
              ...s.notifications
            ]
          }));

          // Trigger webhook for automations
          get().triggerWebhook('task.updated', { taskId, updates, previousTask });
        }
    } catch (error: any) {
        const message = parseErrorMessage(error, `Failed to update task ${taskId}.`);
        console.error('Error updating task in backend:', message);
        updateState(s => ({ ...s, tasksError: message }));
        if (activeProjectId) await selfActions.fetchTasksForProject(activeProjectId);
    }
  };

  Object.assign(selfActions, {
    toggleDarkMode: () => updateState(s => ({ ...s, darkMode: !s.darkMode })),
    setIsMobileSidebarOpen: (isOpen: boolean) => updateState(s => ({ ...s, isMobileSidebarOpen: isOpen })),
    toggleMobileSidebar: () => updateState(s => ({ ...s, isMobileSidebarOpen: !s.isMobileSidebarOpen })),
    setActiveView: (view: ActiveView) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeView', view);
        }
        updateState(s => ({ ...s, activeView: view, isMobileSidebarOpen: false }));
        const currentStore = get();
        if (view === 'team_management' && currentStore.currentUser?.organization_id && currentStore.users.length === 0 && !currentStore.isLoadingUsersForAssignment) {
            selfActions.fetchUsersForAssignmentList();
        }
    },
    signUp: async (email: string, password: string, fullName: string, organizationName?: string, role?: UserRole) => {
      updateState(s => ({ ...s, authLoading: true, authError: null }));
      try {
        const result = await supabaseService.signUpUser(email, password, fullName, organizationName, role);
        if (result && result.profile) {
             console.log("[useAppStore signUp] Supabase signUpUser successful, profile returned:", result.profile);
             if (!result.profile.organization_id && typeof window !== 'undefined') {
               sessionStorage.setItem('omni_just_registered', 'true');
             }
             get().setCurrentUser(result.profile);
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
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('omni_just_registered');
          try {
            localStorage.setItem(`omni_user_profile_${updatedProfile.id}`, JSON.stringify(updatedProfile));
          } catch (e) {}
        }
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
      collabService.syncCurrentUser(user);
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

      if (user?.organization_id) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('omni_just_registered');
          try {
            localStorage.setItem(`omni_user_profile_${user.id}`, JSON.stringify(user));
          } catch (e) {}
        }
        setTimeout(() => {
          selfActions.fetchCurrentOrganization();
        }, 0);
      } else {
        updateState(s => ({ ...s, currentOrganization: null }));
      }

      updateState(s => ({
        ...s,
        currentUser: user,
        authLoading: false,
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
        if (createdTask) {
          collabService.broadcastTaskCreated(createdTask, {
            id: currentUser.id,
            name: currentUser.full_name || currentUser.email || 'Teammate'
          });
        }
        updateState(s => ({ ...s, isLoading: false, isModalOpen: false, suggestedTaskTitles: [], parentTaskIdForNewTask: null }));
        return createdTask;
      } catch (error: any) {
        const message = parseErrorMessage(error, 'Failed to create task.');
        updateState(s => ({ ...s, isLoading: false, error: message }));
        throw error;
      }
    },
    updateTask: async (taskId: string, updates: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'creator_id' | 'projectId'>>) => {
        const { activeProject, currentUser } = get();
        const originalTasks = get().tasks;
        const originalMyTasks = get().myTasks;
        const originalTask = originalTasks.find(t => t.id === taskId) || originalMyTasks.find(t => t.id === taskId);
        const updatedTasksOptimistic = originalTasks.map(t => 
            t.id === taskId ? { ...t, ...updates } : t
        );
        const updatedMyTasksOptimistic = originalMyTasks.map(t =>
            t.id === taskId ? { ...t, ...updates } : t
        );
        const currentTaskToView = get().taskToView;
        const updatedTaskToView = currentTaskToView?.id === taskId ? { ...currentTaskToView, ...updates } : currentTaskToView;
        
        updateState(s => ({ 
            ...s, 
            tasks: updatedTasksOptimistic, 
            myTasks: updatedMyTasksOptimistic,
            taskToView: updatedTaskToView,
            isLoadingTasks: true, 
            tasksError: null, 
            isEditTaskModalOpen: false, 
            taskToEdit: null 
        }));

        // Immediately broadcast the task update (status, priority, assignee, title, etc.) in real-time
        if (originalTask || currentTaskToView) {
          const targetTitle = (originalTask?.title || currentTaskToView?.title || 'Task');
          collabService.broadcastTaskUpdated({
            taskId,
            taskTitle: targetTitle,
            updates,
            actor: {
              id: currentUser?.id || 'system',
              name: currentUser?.full_name || currentUser?.email || 'Teammate',
            }
          });
        }

        try {
            await supabaseService.updateTask(taskId, updates);
            if (activeProject?.id) {
              await selfActions.fetchTasksForProject(activeProject.id); 
            }
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
            updateState(s => ({ ...s, tasks: originalTasks, myTasks: originalMyTasks, isLoadingTasks: false, tasksError: message }));
        }
    },
    deleteTask: async (taskId: string) => {
      const { activeProject, tasks: currentTasks, currentUser } = get();
      if (!activeProject) {
        updateState(s => ({ ...s, tasksError: "Cannot delete task: No active project." }));
        return;
      }
      const tasksAfterDelete = currentTasks.filter(t => t.id !== taskId);
      const taskToDelete = currentTasks.find(t => t.id === taskId);
      updateState(s => ({ ...s, tasks: tasksAfterDelete, isLoadingTasks: true, tasksError: null }));
      if (taskToDelete) {
        collabService.broadcastTaskDeleted(taskId, taskToDelete.title, {
          id: currentUser?.id || 'system',
          name: currentUser?.full_name || currentUser?.email || 'Teammate'
        });
      }
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

      const currentTaskToView = get().taskToView;
      const updatedTaskToView = currentTaskToView?.id === draggedTaskId
        ? { ...currentTaskToView, status: newStatus, position: newVisualIndexInColumn }
        : currentTaskToView;

      updateState(s => ({ ...s, tasks: finalOptimisticTasks, taskToView: updatedTaskToView, tasksError: null }));

      // Broadcast task move / status update immediately in real-time
      const curUser = get().currentUser;
      collabService.broadcastTaskUpdated({
        taskId: draggedTaskId,
        taskTitle: draggedTask.title,
        updates: { status: newStatus, position: newVisualIndexInColumn },
        actor: {
          id: curUser?.id || 'system',
          name: curUser?.full_name || curUser?.email || 'Teammate',
        }
      });

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
            const draftTask = await get().createTask({
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
    openCreateTaskModal: async (parentTaskId?: string) => {
        await get().openModal(parentTaskId);
    },
    closeModal: () => updateState(s => ({ ...s, isModalOpen: false, suggestedTaskTitles: [], error: null, parentTaskIdForNewTask: null })),

    openViewTaskModal: async (taskIdOrTask: string | Task, navigateToProject?: boolean) => {
        const resolvedId = typeof taskIdOrTask === 'object' && taskIdOrTask !== null ? taskIdOrTask.id : taskIdOrTask;
        // 1. Search in active project tasks
        let task = typeof taskIdOrTask === 'object' && taskIdOrTask !== null
          ? taskIdOrTask
          : get().tasks.find(t => t.id === resolvedId);
        // 2. Search in user's assigned tasks
        if (!task) {
          task = get().myTasks.find(t => t.id === resolvedId);
        }
        
        // If task found immediately in local store
        if (task) {
            updateState(s => {
              const taskList = s.tasks.some(t => t.id === task!.id) ? s.tasks : [...s.tasks, task!];
              const project = s.projects.find(p => p.id === task!.projectId) || s.activeProject;
              return { 
                ...s, 
                taskToView: task, 
                isViewTaskModalOpen: true, 
                tasks: taskList, 
                tasksError: null,
                activeProject: (navigateToProject && project) ? project : s.activeProject
              };
            });
            get().updateUserPresence(task.id, get().activeView, { isEditing: false, statusAction: 'viewing_task' });
            return;
        }

        // 3. Fallback: Fetch dynamically from Supabase database
        try {
            updateState(s => ({ ...s, isLoadingTasks: true, tasksError: null }));
            const fetchedTask = await supabaseService.getTaskById(resolvedId);
            if (fetchedTask) {
                updateState(s => {
                  const taskList = s.tasks.some(t => t.id === fetchedTask.id) ? s.tasks : [...s.tasks, fetchedTask];
                  const project = s.projects.find(p => p.id === fetchedTask.projectId) || s.activeProject;
                  return {
                    ...s,
                    taskToView: fetchedTask,
                    isViewTaskModalOpen: true,
                    tasks: taskList,
                    isLoadingTasks: false,
                    tasksError: null,
                    activeProject: (navigateToProject && project) ? project : s.activeProject
                  };
                });
                get().updateUserPresence(fetchedTask.id, get().activeView, { isEditing: false, statusAction: 'viewing_task' });
            } else {
                console.warn(`Task with ID ${resolvedId} not found in database or local state.`);
                updateState(s => ({ ...s, isLoadingTasks: false, tasksError: `Task details for ID ${resolvedId} could not be loaded.`}));
            }
        } catch (err: any) {
            console.error(`Error loading task ${resolvedId}:`, err);
            updateState(s => ({ ...s, isLoadingTasks: false, tasksError: `Task details for ID ${resolvedId} could not be loaded.`}));
        }
    },
    closeViewTaskModal: () => {
      updateState(s => ({ ...s, taskToView: null, isViewTaskModalOpen: false }));
      const state = get();
      if (!state.isEditTaskModalOpen) {
        get().updateUserPresence(undefined, state.activeView, { clearTask: true, isEditing: false, isTypingComment: false });
      }
    },

    openEditTaskModal: async (taskId: string) => {
      let task = get().tasks.find(t => t.id === taskId);
      if (!task) {
        task = get().myTasks.find(t => t.id === taskId);
      }
      if (task) {
          updateState(s => ({ ...s, taskToEdit: task, isEditTaskModalOpen: true, error: null, suggestedTaskTitles: [] }));
          get().updateUserPresence(task.id, get().activeView, { isEditing: true, editingField: 'details', statusAction: 'editing_task' });
          return;
      }
      try {
          const fetchedTask = await supabaseService.getTaskById(taskId);
          if (fetchedTask) {
              updateState(s => {
                const taskList = s.tasks.some(t => t.id === fetchedTask.id) ? s.tasks : [...s.tasks, fetchedTask];
                return {
                  ...s,
                  taskToEdit: fetchedTask,
                  isEditTaskModalOpen: true,
                  tasks: taskList,
                  error: null,
                  suggestedTaskTitles: []
                };
              });
              get().updateUserPresence(fetchedTask.id, get().activeView, { isEditing: true, editingField: 'details', statusAction: 'editing_task' });
          } else {
              console.warn(`Task with ID ${taskId} not found to open edit modal.`);
              updateState(s => ({ ...s, error: `Task details for ID ${taskId} could not be loaded for editing.`}));
          }
      } catch (err: any) {
          console.error(`Error loading task for edit ${taskId}:`, err);
          updateState(s => ({ ...s, error: `Task details for ID ${taskId} could not be loaded for editing.`}));
      }
    },
    closeEditTaskModal: () => {
      updateState(s => ({ ...s, taskToEdit: null, isEditTaskModalOpen: false, error: null, suggestedTaskTitles: [] }));
      const state = get();
      if (state.isViewTaskModalOpen && state.taskToView) {
        state.updateUserPresence(state.taskToView.id, state.activeView, { isEditing: false });
      } else {
        state.updateUserPresence(undefined, state.activeView, { clearTask: true, isEditing: false });
      }
    },


    openCreateProjectModal: () => updateState(s => ({ ...s, isCreateProjectModalOpen: true, createProjectError: null })),
    closeCreateProjectModal: () => updateState(s => ({ ...s, isCreateProjectModalOpen: false, createProjectError: null })),

    openCommandPalette: () => updateState(s => ({ ...s, isCommandPaletteOpen: true })),
    closeCommandPalette: () => updateState(s => ({ ...s, isCommandPaletteOpen: false })),
    toggleCommandPalette: () => updateState(s => ({ ...s, isCommandPaletteOpen: !s.isCommandPaletteOpen })),

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

    // Agile Sprints Actions
    setActiveSprintId: (sprintId: string | null) => updateState(s => ({ ...s, activeSprintId: sprintId })),
    createSprint: async (sprintData: Omit<Sprint, 'id' | 'created_at'>) => {
      const newSprint: Sprint = {
        ...sprintData,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      updateState(s => {
        const updated = [...s.sprints, newSprint];
        if (typeof window !== 'undefined') {
          localStorage.setItem('omni_sprints', JSON.stringify(updated));
        }
        return { ...s, sprints: updated };
      });

      get().addToast('Sprint Created', `Sprint "${newSprint.name}" has been created.`, 'success');
      get().triggerWebhook('sprint.created', { sprint: newSprint });
      return newSprint;
    },
    updateSprint: async (sprintId: string, updates: Partial<Sprint>) => {
      updateState(s => {
        const updated = s.sprints.map(sp => sp.id === sprintId ? { ...sp, ...updates } : sp);
        if (typeof window !== 'undefined') {
          localStorage.setItem('omni_sprints', JSON.stringify(updated));
        }
        return { ...s, sprints: updated };
      });
      get().addToast('Sprint Updated', 'Sprint details have been saved.', 'info');
    },
    deleteSprint: async (sprintId: string) => {
      updateState(s => {
        const updated = s.sprints.filter(sp => sp.id !== sprintId);
        // Unassign tasks from this sprint
        const updatedTasks = s.tasks.map(t => t.sprintId === sprintId ? { ...t, sprintId: null } : t);
        if (typeof window !== 'undefined') {
          localStorage.setItem('omni_sprints', JSON.stringify(updated));
        }
        return {
          ...s,
          sprints: updated,
          tasks: updatedTasks,
          activeSprintId: s.activeSprintId === sprintId ? null : s.activeSprintId,
        };
      });
      get().addToast('Sprint Removed', 'Sprint was deleted and associated tasks returned to backlog.', 'info');
    },
    startSprint: async (sprintId: string) => {
      const sprint = get().sprints.find(sp => sp.id === sprintId);
      if (!sprint) return;

      updateState(s => {
        // Mark all other sprints in project as not active if only 1 can be active
        const updated = s.sprints.map(sp => {
          if (sp.id === sprintId) return { ...sp, status: 'active' as const, startDate: sp.startDate || new Date().toISOString() };
          if (sp.projectId === sprint.projectId && sp.status === 'active') return { ...sp, status: 'planned' as const };
          return sp;
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('omni_sprints', JSON.stringify(updated));
        }
        return { ...s, sprints: updated, activeSprintId: sprintId };
      });

      get().addToast('Sprint Started', `Sprint "${sprint.name}" is now Active.`, 'success');
      get().triggerWebhook('sprint.started', { sprint });
    },
    completeSprint: async (sprintId: string) => {
      const sprint = get().sprints.find(sp => sp.id === sprintId);
      if (!sprint) return;

      updateState(s => {
        const updated = s.sprints.map(sp => sp.id === sprintId ? { ...sp, status: 'completed' as const, endDate: new Date().toISOString() } : sp);
        if (typeof window !== 'undefined') {
          localStorage.setItem('omni_sprints', JSON.stringify(updated));
        }
        return { ...s, sprints: updated, activeSprintId: s.activeSprintId === sprintId ? null : s.activeSprintId };
      });

      get().addToast('Sprint Completed', `Sprint "${sprint.name}" has been marked as Completed!`, 'success');
      get().triggerWebhook('sprint.completed', { sprint });
    },
    assignTaskToSprint: async (taskId: string, sprintId: string | null) => {
      const targetSprint = sprintId ? get().sprints.find(sp => sp.id === sprintId) : null;
      const currentTask = get().tasks.find(t => t.id === taskId);
      
      // Optimistic update
      updateState(s => {
        const updatedTasks = s.tasks.map(t => t.id === taskId ? { ...t, sprintId } : t);
        const updatedMyTasks = s.myTasks.map(t => t.id === taskId ? { ...t, sprintId } : t);
        const updatedTaskToView = s.taskToView?.id === taskId ? { ...s.taskToView, sprintId } : s.taskToView;
        return { ...s, tasks: updatedTasks, myTasks: updatedMyTasks, taskToView: updatedTaskToView };
      });

      try {
        await get().updateTask(taskId, { sprintId } as any);
        
        const sprintName = targetSprint?.name || 'Backlog';
        get().addToast(
          'Sprint Updated',
          sprintId ? `Task moved to "${sprintName}".` : 'Task moved back to Product Backlog.',
          'success'
        );

        // Record Activity Log
        const currentUser = get().currentUser;
        if (currentUser && currentTask) {
          try {
            await supabase.from('task_activity_logs').insert({
              task_id: taskId,
              user_id: currentUser.id,
              action: sprintId ? 'sprint_assigned' : 'sprint_unassigned',
              details: { sprint_id: sprintId, sprint_name: sprintName }
            });
          } catch (e) {}

          if (currentUser.organization_id) {
            supabaseService.logAuditEvent({
              organization_id: currentUser.organization_id,
              actor_id: currentUser.id,
              actor_name: currentUser.full_name || currentUser.email,
              actor_email: currentUser.email,
              action: sprintId ? 'task_sprint_assigned' : 'task_sprint_unassigned',
              target_type: 'task',
              target_id: taskId,
              target_name: currentTask.title,
              details: { sprint_id: sprintId, sprint_name: sprintName }
            }).catch(e => console.warn(e));
          }
        }

        // Webhook trigger
        get().triggerWebhook('task.sprint_changed', { taskId, sprintId, sprintName });

        // Broadcast to other tabs
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('omni_collab_sync');
            bc.postMessage({ type: 'TASK_SPRINT_ASSIGNED', taskId, sprintId });
            bc.close();
          } catch (e) {}
        }
      } catch (err: any) {
        console.error('Error assigning task to sprint:', err);
      }
    },

    // Presence Tracking
    updateUserPresence: (
      taskId?: string,
      view?: string,
      flags?: {
        isEditing?: boolean;
        editingField?: string;
        isTypingComment?: boolean;
        statusAction?: string;
        availabilityStatus?: 'available' | 'away' | 'busy';
        projectId?: string;
        clearTask?: boolean;
      }
    ) => {
      const state = get();
      const curUser = state.currentUser;
      if (curUser && !collabService.getCurrentUser()) {
        collabService.syncCurrentUser(curUser);
      }
      const activeTaskId = flags?.clearTask
        ? undefined
        : (taskId !== undefined
            ? taskId
            : (state.isViewTaskModalOpen && state.taskToView
                ? state.taskToView.id
                : (state.isEditTaskModalOpen && state.taskToEdit ? state.taskToEdit.id : undefined)));
      const activeProject = state.activeProject;
      collabService.updatePresence(activeTaskId, view || state.activeView, {
        ...flags,
        projectId: flags?.projectId || activeProject?.id
      });
    },

    removeUserPresence: (userId: string) => {
      updateState(s => ({
        ...s,
        presences: s.presences.filter(p => p.userId !== userId)
      }));
    },

    // Keyboard Shortcuts Modal
    openShortcutsModal: () => updateState(s => ({ ...s, isShortcutsModalOpen: true })),
    closeShortcutsModal: () => updateState(s => ({ ...s, isShortcutsModalOpen: false })),
    toggleShortcutsModal: () => updateState(s => ({ ...s, isShortcutsModalOpen: !s.isShortcutsModalOpen })),

    // Webhooks & Integrations
    saveWebhook: (webhook: WebhookConfig) => {
      updateState(s => {
        const index = s.webhooks.findIndex(w => w.id === webhook.id);
        let updated: WebhookConfig[];
        if (index >= 0) {
          updated = [...s.webhooks];
          updated[index] = webhook;
        } else {
          updated = [...s.webhooks, webhook];
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('omni_webhooks', JSON.stringify(updated));
        }
        return { ...s, webhooks: updated };
      });
      get().addToast('Webhook Saved', `Webhook "${webhook.name}" is ${webhook.active ? 'active' : 'disabled'}.`, 'success');
    },
    deleteWebhook: (id: string) => {
      updateState(s => {
        const updated = s.webhooks.filter(w => w.id !== id);
        if (typeof window !== 'undefined') {
          localStorage.setItem('omni_webhooks', JSON.stringify(updated));
        }
        return { ...s, webhooks: updated };
      });
      get().addToast('Webhook Removed', 'Webhook integration removed.', 'info');
    },
    triggerWebhook: async (event: string, payload: any) => {
      const activeHooks = get().webhooks.filter(w => w.active && (w.events.includes(event) || w.events.includes('*')));
      if (activeHooks.length === 0) return;

      console.log(`[Webhooks] Triggering ${activeHooks.length} webhook(s) for event: ${event}`, payload);
      for (const hook of activeHooks) {
        try {
          if (hook.url.startsWith('http')) {
            // Attempt dispatch (guarded with catch for network or mock endpoints)
            fetch(hook.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event,
                timestamp: new Date().toISOString(),
                payload,
              }),
            }).catch(e => console.warn(`Webhook error sending to ${hook.url}:`, e));
          }
        } catch (e) {
          console.warn(`Webhook execution error for ${hook.name}:`, e);
        }
      }
    },
  });

  return selfActions;
};

type AppStoreHookType = StoreState & ReturnType<typeof appActionsCreator>;

interface UseAppStoreHook extends Function {
  getState: () => StoreState;
}


const createAppStoreHook = <TState extends StoreState, TActionsCreator extends (updateState: (updater: (s: TState) => TState) => void, get: () => TState & ReturnType<TActionsCreator>) => any>(
  initialStateValues: TState,
  actionsCreatorFunc: TActionsCreator
): (() => TState & ReturnType<TActionsCreator>) & { getState: () => TState & ReturnType<TActionsCreator> } => {
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

  const getPureState = () => state;
  const getCombinedState = () => ({ ...state, ...actions });
  const actions = actionsCreatorFunc(setState, getCombinedState as any);

  if (typeof window !== 'undefined' && initialStateValues.darkMode) {
    document.documentElement.classList.add('dark');
  }

  // Real-time Presence sync across the entire platform
  collabService.onPresencesChange((presences) => {
    setState(s => ({ ...s, presences }));
  });

  // Cross-client / Cross-tab real-time event subscriptions
  if (typeof window !== 'undefined') {
    // 1. Task comment notifications and mentions
    window.addEventListener('omni_remote_comment_notification', ((e: CustomEvent) => {
      const payload = e.detail;
      if (!payload) return;
      const curUser = getPureState().currentUser;
      if (!curUser) return;
      if (payload.sender?.id === curUser.id) return;

      const commentText = (payload.comment?.content || '').toLowerCase();
      const myName = (curUser.full_name || '').toLowerCase();
      const myFirstName = myName ? myName.split(' ')[0] : '';
      const myEmailName = (curUser.email || '').split('@')[0].toLowerCase();

      const isMentioned =
        payload.mentionedUserIds?.includes(curUser.id) ||
        (myName && commentText.includes(`@${myName}`)) ||
        (myFirstName && commentText.includes(`@${myFirstName}`)) ||
        (myEmailName && commentText.includes(`@${myEmailName}`));

      const isAssignee = payload.assigneeId === curUser.id;
      const isViewingTask = getPureState().taskToView?.id === payload.taskId;

      if (isMentioned) {
        actions.addToast(
          `Mentioned by ${payload.sender?.name || 'Teammate'}`,
          `In "${payload.taskTitle}": ${payload.comment?.content?.slice(0, 90) || ''}`,
          'info',
          { entity_type: 'task', entity_id: payload.taskId, reference_id: payload.taskId, metadata: { commentId: payload.comment?.id, isComment: true } }
        );
      } else if (isAssignee || isViewingTask) {
        actions.addToast(
          `New comment on "${payload.taskTitle}"`,
          `${payload.sender?.name || 'Teammate'}: ${payload.comment?.content?.slice(0, 90) || ''}`,
          'info',
          { entity_type: 'task', entity_id: payload.taskId, reference_id: payload.taskId, metadata: { commentId: payload.comment?.id, isComment: true } }
        );
      }
    }) as EventListener);

    // 2. Chat notifications
    window.addEventListener('omni_remote_chat_notification', ((e: CustomEvent) => {
      const message = e.detail;
      if (!message) return;
      const curUser = getPureState().currentUser;
      if (!curUser) return;

      if (message.recipient_id === curUser.id) {
        actions.addToast(
          `💬 ${message.sender_name || 'Teammate'}`,
          message.content?.slice(0, 90) || 'Sent you a message',
          'info',
          { entity_type: 'chat', entity_id: message.sender_id, reference_id: message.sender_id }
        );
      }
    }) as EventListener);

    // 3. Task updates
    window.addEventListener('omni_remote_task_updated', ((e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || !payload.taskId) return;
      const curUser = getPureState().currentUser;
      const existingTask = getPureState().tasks.find(t => t.id === payload.taskId);
      const prevStatus = existingTask?.status;
      const safeUpdates = { ...(payload.updates || {}) };
      if (safeUpdates.priority) {
        const lower = String(safeUpdates.priority).toLowerCase();
        if (lower === 'low') safeUpdates.priority = TaskPriority.LOW;
        else if (lower === 'medium') safeUpdates.priority = TaskPriority.MEDIUM;
        else if (lower === 'high') safeUpdates.priority = TaskPriority.HIGH;
        else if (lower === 'critical' || lower === 'urgent') safeUpdates.priority = TaskPriority.CRITICAL;
      }
      
      setState(s => {
        const updatedTasks = s.tasks.map(t => t.id === payload.taskId ? { ...t, ...safeUpdates } : t);
        const updatedMyTasks = s.myTasks.map(t => t.id === payload.taskId ? { ...t, ...safeUpdates } : t);
        const updatedToView = s.taskToView?.id === payload.taskId ? { ...s.taskToView, ...safeUpdates } : s.taskToView;
        return {
          ...s,
          tasks: updatedTasks,
          myTasks: updatedMyTasks,
          taskToView: updatedToView,
          highlightedTaskId: payload.taskId,
        };
      });

      if (payload.actor?.id && payload.actor.id !== 'remote' && payload.actor.id !== curUser?.id) {
        const actorName = payload.actor.name || 'Teammate';
        const taskTitle = payload.taskTitle || existingTask?.title || 'Task';
        if (payload.updates?.status && payload.updates.status !== prevStatus) {
          const prettyStatus = String(payload.updates.status).replace(/_/g, ' ').toUpperCase();
          actions.addToast(
            `⚡ Status Updated by ${actorName}`,
            `"${taskTitle}" moved to ${prettyStatus}`,
            'info',
            { entity_type: 'task', entity_id: payload.taskId, reference_id: payload.taskId }
          );
        } else {
          const changedFields = Object.keys(payload.updates || {}).filter(k => k !== 'position' && k !== 'updated_at');
          if (changedFields.length > 0) {
            actions.addToast(
              `⚡ Task Updated by ${actorName}`,
              `Updated ${changedFields.join(', ')} on "${taskTitle}"`,
              'info',
              { entity_type: 'task', entity_id: payload.taskId, reference_id: payload.taskId }
            );
          }
        }
      }
    }) as EventListener);

    // 4. Remote Task Created & Deleted
    window.addEventListener('omni_remote_task_created', ((e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || !payload.task) return;
      const curUser = getPureState().currentUser;
      setState(s => {
        if (s.tasks.some(t => t.id === payload.task.id)) return s;
        return {
          ...s,
          tasks: [...s.tasks, payload.task],
          highlightedTaskId: payload.task.id,
        };
      });
      if (payload.actor?.id && payload.actor.id !== curUser?.id) {
        actions.addToast(
          `⚡ New Task by ${payload.actor.name || 'Teammate'}`,
          `Created "${payload.task.title}"`,
          'info',
          { entity_type: 'task', entity_id: payload.task.id, reference_id: payload.task.id }
        );
      }
    }) as EventListener);

    window.addEventListener('omni_remote_task_deleted', ((e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || !payload.taskId) return;
      const curUser = getPureState().currentUser;
      setState(s => ({
        ...s,
        tasks: s.tasks.filter(t => t.id !== payload.taskId),
        myTasks: s.myTasks.filter(t => t.id !== payload.taskId),
        isViewTaskModalOpen: s.taskToView?.id === payload.taskId ? false : s.isViewTaskModalOpen,
        taskToView: s.taskToView?.id === payload.taskId ? null : s.taskToView,
      }));
      if (payload.actor?.id && payload.actor.id !== curUser?.id) {
        actions.addToast(
          `Task Deleted by ${payload.actor.name || 'Teammate'}`,
          `Removed "${payload.taskTitle || 'Task'}"`,
          'warning'
        );
      }
    }) as EventListener);

    // 5. Remote User Availability Status Changed
    window.addEventListener('omni_remote_user_status_changed', ((e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || !payload.userId) return;
      const curUser = getPureState().currentUser;
      if (curUser && payload.userId === curUser.id) return;
      const statusLabel =
        payload.availabilityStatus === 'available'
          ? 'Available 🟢'
          : payload.availabilityStatus === 'away'
            ? 'Away 🟡'
            : 'Busy / DND 🔴';
      actions.addToast(
        `⚡ ${payload.userName || 'Teammate'} updated status`,
        `Now ${statusLabel}`,
        'info',
        { entity_type: 'chat', entity_id: payload.userId, reference_id: payload.userId }
      );
    }) as EventListener);
  }

  const useHook = (): TState & ReturnType<TActionsCreator> => {
    const [localState, setLocalState] = useState(getPureState());

    useEffect(() => {
      const listener = () => setLocalState(getPureState());
      listeners.add(listener);
      
      if (typeof window !== 'undefined') {
        document.documentElement.classList.toggle('dark', getPureState().darkMode);
      }
      
      setLocalState(getPureState()); 
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

  (useHook as any).getState = getCombinedState;

  return useHook as (() => TState & ReturnType<TActionsCreator>) & { getState: () => TState & ReturnType<TActionsCreator> };
};

export const useAppStore: (() => AppStore) & { getState: () => AppStore } = createAppStoreHook(initialStoreStateValues, appActionsCreator) as any;