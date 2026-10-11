







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

export const normalizeUserRole = (rawRole?: string | UserRole | null): UserRole => {
  if (!rawRole) return UserRole.MEMBER;
  const upper = String(rawRole).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (upper === 'OWNER') return UserRole.OWNER;
  if (upper === 'ADMIN' || upper === 'ADMINISTRATOR') return UserRole.ADMIN;
  if (upper === 'PROJECT_MANAGER' || upper === 'PM' || upper === 'MANAGER') return UserRole.PROJECT_MANAGER;
  if (upper === 'CLIENT_VIEWER' || upper === 'VIEWER' || upper === 'CLIENT' || upper === 'GUEST') return UserRole.CLIENT_VIEWER;
  return UserRole.MEMBER;
};

export type WorkspaceAccentId = 'violet' | 'cyan' | 'emerald' | 'coral' | 'amber' | 'cobalt';

export interface WorkspaceAccentPreset {
  id: WorkspaceAccentId;
  name: string;
  tagline: string;
  lightHex: string;
  darkHex: string;
  gradientStart: string;
  gradientEnd: string;
  primaryHslLight: string;
  primaryHslDark: string;
  primaryRgbLight: string;
  primaryRgbDark: string;
  swatchClass: string;
}

export const WORKSPACE_ACCENT_PRESETS: WorkspaceAccentPreset[] = [
  {
    id: 'violet',
    name: 'Electric Violet',
    tagline: 'Signature studio purple',
    lightHex: '#6957FF',
    darkHex: '#857CFF',
    gradientStart: '#7C6BFF',
    gradientEnd: '#5B4AEE',
    primaryHslLight: '245 100% 67%',
    primaryHslDark: '244 100% 74%',
    primaryRgbLight: '105, 87, 255',
    primaryRgbDark: '133, 124, 255',
    swatchClass: 'from-violet-500 to-indigo-600',
  },
  {
    id: 'cyan',
    name: 'Ocean Cyan',
    tagline: 'Crisp aqua & sky glow',
    lightHex: '#0284C7',
    darkHex: '#38BDF8',
    gradientStart: '#06B6D4',
    gradientEnd: '#0284C7',
    primaryHslLight: '199 96% 40%',
    primaryHslDark: '199 95% 60%',
    primaryRgbLight: '2, 132, 199',
    primaryRgbDark: '56, 189, 248',
    swatchClass: 'from-cyan-400 to-sky-600',
  },
  {
    id: 'emerald',
    name: 'Emerald Mint',
    tagline: 'Vibrant forest & mint',
    lightHex: '#059669',
    darkHex: '#34D399',
    gradientStart: '#10B981',
    gradientEnd: '#059669',
    primaryHslLight: '160 84% 35%',
    primaryHslDark: '158 64% 52%',
    primaryRgbLight: '5, 150, 105',
    primaryRgbDark: '52, 211, 153',
    swatchClass: 'from-emerald-400 to-teal-600',
  },
  {
    id: 'coral',
    name: 'Sunset Coral',
    tagline: 'Warm rose & crimson energy',
    lightHex: '#E11D48',
    darkHex: '#FB7185',
    gradientStart: '#F43F5E',
    gradientEnd: '#E11D48',
    primaryHslLight: '347 77% 50%',
    primaryHslDark: '351 95% 71%',
    primaryRgbLight: '225, 29, 72',
    primaryRgbDark: '251, 113, 133',
    swatchClass: 'from-rose-400 to-pink-600',
  },
  {
    id: 'amber',
    name: 'Amber Gold',
    tagline: 'Solar gold & warm honey',
    lightHex: '#D97706',
    darkHex: '#FBBF24',
    gradientStart: '#F59E0B',
    gradientEnd: '#D97706',
    primaryHslLight: '32 95% 44%',
    primaryHslDark: '43 96% 56%',
    primaryRgbLight: '217, 119, 6',
    primaryRgbDark: '251, 191, 36',
    swatchClass: 'from-amber-400 to-orange-600',
  },
  {
    id: 'cobalt',
    name: 'Cobalt Blue',
    tagline: 'Executive sapphire blue',
    lightHex: '#2563EB',
    darkHex: '#60A5FA',
    gradientStart: '#3B82F6',
    gradientEnd: '#1D4ED8',
    primaryHslLight: '221 83% 53%',
    primaryHslDark: '213 94% 68%',
    primaryRgbLight: '37, 99, 235',
    primaryRgbDark: '96, 165, 250',
    swatchClass: 'from-blue-500 to-indigo-700',
  },
];

export interface UserProfilePreferences {
  jobTitle?: string;
  department?: string;
  phone?: string;
  location?: string;
  timezone?: string;
  bio?: string;
  skills?: string[];
  githubUrl?: string;
  linkedinUrl?: string;
  weeklyCapacityHours?: number;
  maxStoryPointsPerSprint?: number;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workingDays?: string[];
  defaultLandingView?: ActiveView;
  compactDensity?: boolean;
  accentColor?: WorkspaceAccentId;
  themeMode?: 'light' | 'dark';
  emailDigestFrequency?: 'instant' | 'daily' | 'weekly' | 'off';
  notifyOnTaskAssigned?: boolean;
  notifyOnMentions?: boolean;
  notifyOnSprintEvents?: boolean;
  notifyOnDirectMessages?: boolean;
  soundAlertsEnabled?: boolean;
  aiAutoEstimateEffort?: boolean;
  aiProactiveRiskAlerts?: boolean;
  aiWritingTone?: 'concise' | 'executive' | 'technical' | 'friendly';
  twoFactorEnabled?: boolean;
  sessionTimeoutMinutes?: number;
}

export interface User {
  id: string; // This is the user_profiles.id (UUID), should match supabase_auth_id
  supabase_auth_id: string; // This is the auth.users.id (UUID)
  email: string;
  full_name?: string;
  avatar_url?: string;
  organization_id?: string;
  role?: UserRole;
  department?: string;
  job_title?: string;
  weekly_capacity_hours?: number;
  status_state?: 'active' | 'suspended' | 'invited';
  preferences?: UserProfilePreferences;
  created_at?: string;
  updated_at?: string;
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

export interface OrganizationJoinRequest {
  id: string;
  organization_id: string;
  organization_name: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  requester_avatar?: string;
  requested_role: UserRole;
  approved_role?: UserRole;
  message?: string;
  status: 'pending' | 'approved' | 'declined';
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
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

export type AppUserType = User;

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  status: 'planned' | 'active' | 'completed';
  startDate?: string;
  endDate?: string;
  created_at?: string;
}

export interface UserPresence {
  userId: string;
  sessionId?: string;
  organizationId?: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  currentTaskId?: string;
  currentProjectId?: string;
  currentView?: string;
  isEditing?: boolean;
  editingField?: string;
  isTypingComment?: boolean;
  statusAction?: string;
  availabilityStatus?: 'available' | 'away' | 'busy';
  isTabFocused?: boolean;
  tabHiddenSince?: string;
  lastInteractionAt?: string;
  lastActive: string;
  color: string;
  lastSeenLocally?: number;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface TaskChecklistItem {
  id: string;
  text?: string;
  title?: string;
  completed: boolean;
  created_at?: string;
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
  tags?: string[];
  story_points?: number;
  sprintId?: string | null;
  blockedBy?: string[];
  blocks?: string[];
  checklist?: TaskChecklistItem[];
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
  | 'kanban'
  | 'overview'
  | 'admin_settings'
  | 'my_tasks'
  | 'user_management'
  | 'project_list'
  | 'projects_overview'
  | 'projects_overview_view'
  | 'project_detail_view'
  | 'my_tasks_view'
  | 'sprints_view'
  | 'team_chat_view'
  | 'inbox_view'
  | 'reports_view'
  | 'team_management'
  | 'team_management_view'
  | 'user_logs_view'
  | 'profile_settings'
  | 'task_automations'
  | 'task_automations_view'
  | 'ai_copilot_view'
  | 'calendar_view'
  | 'docs_wiki_view'
  | 'okrs_goals_view'
  | 'triage_intake_view'
  | 'workload_capacity_view'
  | 'whiteboard_view';

export type WhiteboardNodeType =
  | 'frame'
  | 'sticky'
  | 'rectangle'
  | 'diamond'
  | 'circle'
  | 'text'
  | 'doc_card';

export interface WhiteboardNode {
  id: string;
  type: WhiteboardNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  content: string;
  color: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  mentionTag?: string;
  votes?: number;
  reactions?: Record<string, number>;
  linkedTaskId?: string;
  linkedDocId?: string;
  updatedAt: number;
}

export interface WhiteboardConnector {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
  label?: string;
  color: string;
  style?: 'solid' | 'dashed';
}

export interface WhiteboardStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  authorName?: string;
}

export interface WhiteboardCommentReply {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

export interface WhiteboardCommentThread {
  id: string;
  x: number;
  y: number;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  color?: string;
  resolved?: boolean;
  createdAt: string;
  replies: WhiteboardCommentReply[];
}

export interface WhiteboardPage {
  id: string;
  name: string;
  nodes: WhiteboardNode[];
  connectors: WhiteboardConnector[];
  strokes: WhiteboardStroke[];
  comments?: WhiteboardCommentThread[];
}

export interface WhiteboardVersionSnapshot {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  authorName: string;
  nodes: WhiteboardNode[];
  connectors: WhiteboardConnector[];
  strokes: WhiteboardStroke[];
  comments?: WhiteboardCommentThread[];
}

export interface WhiteboardBoard {
  id: string;
  name: string;
  projectId?: string;
  organizationId?: string;
  version?: number;
  updatedBy?: string;
  nodes: WhiteboardNode[];
  connectors: WhiteboardConnector[];
  strokes: WhiteboardStroke[];
  comments?: WhiteboardCommentThread[];
  pages?: WhiteboardPage[];
  activePageId?: string;
  history?: WhiteboardVersionSnapshot[];
  updatedAt: string;
}

export interface WhiteboardCursor {
  userId: string;
  userName: string;
  userAvatar?: string;
  color: string;
  x: number;
  y: number;
  activeTool?: string;
  selectedNodeId?: string | null;
  cursorChat?: string;
  emote?: string;
  zoom?: number;
  panX?: number;
  panY?: number;
  boardId: string;
  updatedAt: number;
}

export interface ActiveTaskTimer {
  taskId: string;
  taskTitle: string;
  projectId?: string;
  startedAt: number; // timestamp ms when last resumed
  accumulatedSeconds: number;
  isRunning: boolean;
}

export interface UndoActionEntry {
  id: string;
  label: string;
  createdAt: number;
  revert: () => Promise<void>;
}

export interface ProjectDocSpecItem {
  id: string;
  text: string;
  completed: boolean;
  convertedTaskId?: string;
  priority?: TaskPriority;
}

export interface ProjectDoc {
  id: string;
  title: string;
  category: 'prd' | 'architecture' | 'release_notes' | 'post_mortem' | 'runbook';
  projectId?: string;
  organizationId?: string;
  authorId: string;
  authorName: string;
  summary: string;
  content: string;
  specChecklist: ProjectDocSpecItem[];
  linkedTaskIds: string[];
  updatedAt: string;
}

export interface OKRKeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: '%' | 'pts' | 'tasks' | 'ms' | 'users';
  linkedProjectId?: string;
  linkedSprintId?: string;
  linkedTag?: string;
  autoRollupFromProject?: boolean;
}

export interface OKRObjective {
  id: string;
  title: string;
  quarter: string;
  ownerId: string;
  ownerName: string;
  department: string;
  status: 'on_track' | 'at_risk' | 'off_track' | 'completed';
  description: string;
  keyResults: OKRKeyResult[];
  updatedAt: string;
}

export interface TriageIntakeItem {
  id: string;
  title: string;
  description: string;
  category: 'bug' | 'feature_request' | 'security' | 'performance' | 'customer_escalation';
  severity: TaskPriority;
  reporterName: string;
  reporterEmail: string;
  environment?: string;
  stepsToReproduce?: string;
  targetProjectId?: string;
  targetSprintId?: string;
  suggestedAssigneeId?: string;
  status: 'pending_triage' | 'accepted' | 'declined' | 'duplicate';
  promotedTaskId?: string;
  createdAt: string;
}

export type CalendarEventCategory =
  | 'sprint_planning'
  | 'sprint_retro'
  | 'project_update'
  | 'daily_standup'
  | 'one_on_one'
  | 'team_workshop';

export type RsvpStatus = 'going' | 'maybe' | 'declined' | 'pending';

export interface CalendarAttendee {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role?: UserRole;
  rsvp: RsvpStatus;
  rsvpNote?: string;
  respondedAt?: string;
}

export interface MeetingAgendaItem {
  id: string;
  title: string;
  durationMinutes: number;
  completed: boolean;
  presenterId?: string;
  presenterName?: string;
  linkedTaskId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  category: CalendarEventCategory;
  startTime: string;
  endTime: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  organizerAvatar?: string;
  organizationId?: string;
  projectId?: string;
  sprintId?: string;
  channelId?: string;
  directUserId?: string;
  meetingCode: string;
  attendees: CalendarAttendee[];
  agenda: MeetingAgendaItem[];
  prepNotes?: string;
  linkedTaskIds?: string[];
  recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly';
  created_at: string;
}

export interface VideoCallParticipant {
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: UserRole;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  joinedAt: string;
  connectionState: 'connected' | 'ringing' | 'invited' | 'declined' | 'left';
  backgroundMode?: 'none' | 'blur' | 'studio' | 'midnight';
}

export interface VideoCallSession {
  id: string;
  meetingCode: string;
  title: string;
  type: 'direct' | 'channel' | 'scheduled';
  channelId?: string;
  directUserId?: string;
  calendarEventId?: string;
  projectId?: string;
  sprintId?: string;
  hostId: string;
  hostName: string;
  organizationId?: string;
  startedAt: string;
  participants: VideoCallParticipant[];
  sharedNotes: string;
  actionItems: {
    id: string;
    text: string;
    assigneeId?: string;
    assigneeName?: string;
    completed: boolean;
    convertedTaskId?: string;
  }[];
  chatMessages: {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    text: string;
    timestamp: string;
  }[];
  transcript: {
    id: string;
    speakerName: string;
    text: string;
    timestamp: string;
  }[];
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  sender_role?: string;
  channel_id?: string;
  recipient_id?: string;
  content: string;
  is_encrypted?: boolean;
  encrypted_payload?: string;
  iv?: string;
  key_fingerprint?: string;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  attachments?: { name: string; url: string; type: string; size?: number; durationSec?: number }[];
  created_at: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  department?: string;
  projectId?: string;
  membersCount?: number;
  memberIds?: string[];
}

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
  type?: string;
  toastType?: 'success' | 'error' | 'warning' | 'info';
  content?: string;
  reference_id?: string;
  reference_parent_id?: string;
  is_read?: boolean;
  entity_type?: 'task' | 'project' | 'user' | 'system' | 'chat';
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
  accentColor: WorkspaceAccentId;
  setAccentColor: (accent: WorkspaceAccentId) => void;

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

  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (isOpen: boolean) => void;
  toggleMobileSidebar: () => void;

  signUp: (email: string, password: string, fullName: string, organizationName?: string, role?: UserRole) => Promise<{ profile?: User; requiresEmailConfirmation?: boolean; smtpFallbackUsed?: boolean; smtpErrorMessage?: string } | void>;
  joinOrCreateOrganization: (organizationName: string, role?: UserRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  setAppLoading: (loading: boolean) => void;

  activeProject: Project | null;
  setActiveProject: (projectOrId: string | Project | null) => void;

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
  openCreateTaskModal: (parentTaskId?: string) => Promise<void>;
  closeModal: () => void;

  isViewTaskModalOpen: boolean; 
  taskToView: Task | null;      
  openViewTaskModal: (taskIdOrTask: string | Task, navigateToProject?: boolean) => void; 
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

  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

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
  addToast: (
    title: string,
    message: string,
    toastType?: 'success' | 'error' | 'warning' | 'info',
    navTarget?: { entity_type?: 'task' | 'project' | 'user' | 'system' | 'chat'; entity_id?: string; reference_id?: string; metadata?: Record<string, any> }
  ) => void;
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

  // Agile Sprints
  sprints: Sprint[];
  activeSprintId: string | null;
  setActiveSprintId: (sprintId: string | null) => void;
  createSprint: (sprintData: Omit<Sprint, 'id' | 'created_at'>) => Promise<Sprint>;
  updateSprint: (sprintId: string, updates: Partial<Sprint>) => Promise<void>;
  deleteSprint: (sprintId: string) => Promise<void>;
  startSprint: (sprintId: string) => Promise<void>;
  completeSprint: (sprintId: string) => Promise<void>;
  assignTaskToSprint: (taskId: string, sprintId: string | null) => Promise<void>;

  // Presence
  presences: UserPresence[];
  updateUserPresence: (
    taskId?: string,
    view?: string,
    flags?: { isEditing?: boolean; editingField?: string; isTypingComment?: boolean; statusAction?: string; projectId?: string; clearTask?: boolean }
  ) => void;
  removeUserPresence: (userId: string) => void;

  // Shortcuts Modal
  isShortcutsModalOpen: boolean;
  openShortcutsModal: () => void;
  closeShortcutsModal: () => void;
  toggleShortcutsModal: () => void;

  // Webhooks & Integrations
  webhooks: WebhookConfig[];
  saveWebhook: (webhook: WebhookConfig) => void;
  deleteWebhook: (id: string) => void;
  triggerWebhook: (event: string, payload: any) => Promise<void>;

  // Live Active-Task Focus Timer & Worklog
  activeTimer: ActiveTaskTimer | null;
  startTaskTimer: (task: Task) => void;
  pauseTaskTimer: () => void;
  resumeTaskTimer: () => void;
  stopAndLogTaskTimer: () => Promise<void>;

  // 1-Click Undo Stack & Bulk Task Operations
  lastUndoAction: UndoActionEntry | null;
  triggerUndo: () => Promise<void>;
  bulkUpdateTasks: (taskIds: string[], updates: Partial<Task>) => Promise<void>;
  bulkDeleteTasks: (taskIds: string[]) => Promise<void>;
}