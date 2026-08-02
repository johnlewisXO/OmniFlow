







export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done'
}

export enum UserRole {
  OWNER = 'OWNER', // Manages organization, billing, highest level permissions
  ADMIN = 'ADMIN', // Can manage users, projects, settings within an organization
  PROJECT_MANAGER = 'PROJECT_MANAGER', // Manages specific projects and their teams
  MEMBER = 'MEMBER', // Regular user, contributes to tasks
  CLIENT_VIEWER = 'CLIENT_VIEWER' // View-only access, typically for external stakeholders
}

export interface User {
  id: string; // This is the user_profiles.id (UUID), should match supabase_auth_id
  supabase_auth_id: string; // This is the auth.users.id (UUID)
  email: string;
  full_name?: string;
  avatar_url?: string;
  organization_id?: string;
  role?: UserRole;
}

export interface AuditLog {
  id: string;
  organization_id?: string;
  actor_id: string;
  actor_name?: string;
  actor_email?: string;
  action: string; // e.g., 'role_changed', 'project_created', 'task_created', 'user_invited', 'user_removed'
  target_type: 'user' | 'project' | 'task' | 'organization' | 'invitation';
  target_id?: string;
  target_name?: string;
  details?: string | Record<string, any>;
  created_at: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  organization_name?: string;
  invited_by: string;
  inviter_name?: string;
  email?: string;
  role: UserRole;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at?: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: User; // Joined user data
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  signedUrl?: string;
  file_type?: string;
  file_size?: number;
  created_at: string;
  user?: User; // Joined user data
}

export interface TaskCollaborator {
  task_id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  created_at: string;
  user?: User; // Joined user data
}

export interface TaskActivityLog {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
  user?: User; // Joined user data
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignee_id?: string; 
  dueDate?: string;
  due_date?: string;
  projectId: string;
  organization_id?: string;
  position: number;
  creator_id?: string; // Ensured creator_id is present
  parent_task_id?: string;
  created_at?: string;
  updated_at?: string;
  
  // New fields for advanced task view
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  collaborators?: TaskCollaborator[];
  subtasks?: Task[];
  activity_logs?: TaskActivityLog[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'on hold' | 'completed';
  progress?: number;
  owner_id?: string;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

export type ActiveView =
  'kanban' |
  'overview' |
  'admin_settings' |
  'my_tasks' | 
  'user_management' | 
  'project_list' | 
  'projects_overview' | 
  'my_tasks_view' |     
  'inbox_view' |        
  'reports_view' |
  'team_management' |
  'user_logs_view' |
  'profile_settings' |
  'task_automations';

export type AutomationTriggerType =
  | 'status_change'
  | 'priority_change'
  | 'assignee_change'
  | 'task_created'
  | 'due_date_approaching'
  | 'subtasks_completed';

export type AutomationActionType =
  | 'assign_user'
  | 'set_status'
  | 'set_priority'
  | 'add_comment'
  | 'send_notification'
  | 'add_tag';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  triggerEvent: AutomationTriggerType;
  triggerConditionValue: string; // e.g. TaskStatus.REVIEW or TaskPriority.CRITICAL
  actionType: AutomationActionType;
  actionTargetValue: string; // User ID, Priority, Status, Comment text, etc.
  enabled: boolean;
  createdAt: string;
  executionCount?: number;
  lastRunAt?: string;
}

export interface AutomationLog {
  id: string;
  ruleId: string;
  ruleName: string;
  taskId: string;
  taskTitle: string;
  triggerEvent: string;
  actionTaken: string;
  status: 'success' | 'failed';
  timestamp: string;
  details?: string;
}      

export interface OrganizationCheckState {
  loading: boolean;
  exists: boolean | null;
  orgId?: string;
  orgSlug?: string;
  error?: string | null;
}

export interface Notification {
  id: string;
  user_id?: string;
  sender_id?: string;
  actor_id?: string;
  type: string;
  toastType?: 'success' | 'error' | 'warning' | 'info';
  content?: string;
  reference_id?: string;
  reference_parent_id?: string;
  is_read?: boolean;
  entity_type?: 'task' | 'project' | 'user' | 'system';
  entity_id?: string;
  title?: string;
  message?: string;
  metadata?: Record<string, any>;
  read?: boolean;
  created_at?: string;
}

export interface AppStore {
  darkMode: boolean;
  toggleDarkMode: () => void;

  users: User[];
  projects: Project[];
  tasks: Task[];
  myTasks: Task[];

  currentUser: User | null;
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  fetchCurrentOrganization: () => Promise<void>;
  authLoading: boolean;
  authError: string | null;
  appLoading: boolean;

  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  signUp: (email: string, password: string, fullName: string, organizationName?: string, role?: UserRole) => Promise<void>;
  joinOrCreateOrganization: (organizationName: string, role?: UserRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  setAppLoading: (loading: boolean) => void;

  activeProject: Project | null;
  setActiveProject: (projectId: string | null) => void;

  createTask: (taskData: Omit<Task, 'id' | 'position' | 'created_at' | 'updated_at' | 'creator_id'>) => Promise<Task | null | void>;
  updateTask: (taskId: string, updates: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'creator_id' | 'projectId'>>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  getTasksByProjectIdAndStatus: (projectId: string, status: TaskStatus) => Task[];
  moveTask: (
    draggedTaskId: string,
    originalStatus: TaskStatus,
    originalIndexInColumn: number, 
    newStatus: TaskStatus,
    newVisualIndexInColumn: number 
  ) => Promise<void>;


  fetchProjects: () => Promise<void>;
  fetchTasksForProject: (projectId: string) => Promise<void>;
  fetchUsersForAssignmentList: () => Promise<void>; // Used for assignees and now team management
  fetchAllTasksForAllProjects: () => Promise<void>; // For My Tasks view
  fetchMyTasks: () => Promise<void>;
  fetchNotifications: () => Promise<void>;

  isLoadingProjects: boolean;
  isLoadingTasks: boolean;
  isLoadingUsersForAssignment: boolean;

  projectsError: string | null;
  tasksError: string | null;
  usersForAssignmentError: string | null;

  isModalOpen: boolean; // Create Task Modal
  parentTaskIdForNewTask: string | null;
  openModal: (parentTaskId?: string) => Promise<void>;
  closeModal: () => void;

  isViewTaskModalOpen: boolean; 
  taskToView: Task | null;      
  openViewTaskModal: (taskId: string, navigateToProject?: boolean) => void; 
  closeViewTaskModal: () => void;    

  isEditTaskModalOpen: boolean; 
  taskToEdit: Task | null;      
  openEditTaskModal: (taskId: string) => void; 
  closeEditTaskModal: () => void;   


  isCreateProjectModalOpen: boolean;
  openCreateProjectModal: () => void;
  closeCreateProjectModal: () => void;
  createProject: (projectData: Pick<Project, 'name' | 'description'>) => Promise<Project | void>;
  isLoadingCreateProject: boolean;
  createProjectError: string | null;

  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  suggestedTaskTitles: string[];
  setSuggestedTaskTitles: (titles: string[]) => void;

  organizationCheck: OrganizationCheckState;
  setOrganizationCheck: (checkState: Partial<OrganizationCheckState>) => void;

  highlightedProjectId: string | null;
  setHighlightedProjectId: (id: string | null) => void;
  highlightedTaskId: string | null;
  setHighlightedTaskId: (id: string | null) => void;

  setProjectsError: (error: string | null) => void;
  setUsersForAssignmentError: (error: string | null) => void;
  setProjects: (projects: Project[]) => void;
  setUsers: (users: User[]) => void;
  setTasks: (tasks: Task[]) => void;
  setTasksError: (error: string | null) => void;

  // Team Management specific
  updateUserRoleInOrganization: (userId: string, newRole: UserRole) => Promise<void>;
  isUpdatingUserRole: boolean;
  updateUserRoleError: string | null;

  deleteUserFromOrganization: (userId: string) => Promise<void>;
  isDeletingUser: string | null; // Stores ID of user being deleted
  deleteUserError: string | null;

  notifications: Notification[];
  addToast: (title: string, message: string, toastType?: 'success' | 'error' | 'warning' | 'info') => void;
  addNotification: (notification: Partial<Notification> & Omit<Notification, 'id' | 'created_at' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  emitEvent: (eventType: string, payload: any) => void;
  handleEvent: (eventType: string, payload: any) => void;

  // Password Update
  isPasswordUpdateModalOpen: boolean;
  openPasswordUpdateModal: () => void;
  closePasswordUpdateModal: () => void;
  updatePassword: (password: string) => Promise<void>;
}