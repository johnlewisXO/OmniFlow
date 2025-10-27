







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

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignee_id?: string; 
  dueDate?: string;
  projectId: string;
  position: number;
  creator_id?: string; // Ensured creator_id is present
  parent_task_id?: string;
  created_at?: string;
  updated_at?: string;
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
  'user_logs_view';      

export interface OrganizationCheckState {
  loading: boolean;
  exists: boolean | null;
  orgId?: string;
  orgSlug?: string;
  error?: string | null;
}

export interface AppStore {
  darkMode: boolean;
  toggleDarkMode: () => void;

  users: User[];
  projects: Project[];
  tasks: Task[];

  currentUser: User | null;
  authLoading: boolean;
  authError: string | null;
  appLoading: boolean;

  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  signUp: (email: string, password: string, fullName: string, organizationName?: string, role?: UserRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  setAppLoading: (loading: boolean) => void;

  activeProject: Project | null;
  setActiveProject: (projectId: string | null) => void;

  createTask: (taskData: Omit<Task, 'id' | 'position' | 'created_at' | 'updated_at' | 'creator_id'>) => Promise<void>;
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

  isLoadingProjects: boolean;
  isLoadingTasks: boolean;
  isLoadingUsersForAssignment: boolean;

  projectsError: string | null;
  tasksError: string | null;
  usersForAssignmentError: string | null;

  isModalOpen: boolean; // Create Task Modal
  openModal: () => void;
  closeModal: () => void;

  isViewTaskModalOpen: boolean; 
  taskToView: Task | null;      
  openViewTaskModal: (taskId: string) => void; 
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

  // Password Update
  isPasswordUpdateModalOpen: boolean;
  openPasswordUpdateModal: () => void;
  closePasswordUpdateModal: () => void;
  updatePassword: (password: string) => Promise<void>;
}