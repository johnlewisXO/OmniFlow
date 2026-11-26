import { Notification } from '../types';

const LOW_PRIORITY_KEYWORDS = [
  'accent',
  'palette',
  'theme',
  'dark mode',
  'light mode',
  'ambient',
  'intensity',
  'sound',
  'audio alert',
  'appearance',
  'compact density',
  'availability',
  'status updated to',
  'visual environment',
  'ui preference',
  'glass',
];

const PRIORITY_TYPE_PREFIXES = [
  'TASK_',
  'PROJECT_',
  'ADMIN_',
  'OWNER_',
  'ROLE_',
  'GOVERNANCE_',
  'BILLING_',
  'SECURITY_',
  'AUDIT_',
  'INVITE',
  'JOIN_REQUEST',
  'SPRINT_',
  'MENTION',
  'COMMENT',
  'ASSIGN',
  'OVERDUE',
  'BLOCKER',
  'DEADLINE',
  'CHAT',
  'MEETING',
];

const ADMIN_OWNER_KEYWORDS = [
  'owner',
  'admin',
  'role',
  'permission',
  'rbac',
  'governance',
  'billing',
  'plan',
  'seat',
  'sso',
  'api key',
  'security',
  'mfa',
  'audit',
  'invite',
  'join request',
  'organization',
  'policy',
  'template',
];

/**
 * Classifies notifications so only actionable work, collaboration, and admin/owner
 * updates surface in Priority Inbox & Header Bell Popover.
 * Cosmetic preference changes (accent, theme, ambient intensity, sound settings) are non-priority.
 */
export const isPriorityNotification = (n: Notification): boolean => {
  const typeStr = String(n.type || '').toUpperCase();
  const titleStr = String(n.title || '').toLowerCase();
  const msgStr = String(n.message || n.content || '').toLowerCase();
  const combined = `${typeStr.toLowerCase()} ${titleStr} ${msgStr}`;

  // Explicit low-priority UI/setting noise check
  if (
    typeStr.includes('PREFERENCE') ||
    typeStr.includes('THEME') ||
    typeStr.includes('ACCENT') ||
    typeStr.includes('PALETTE') ||
    typeStr.includes('SETTING_MINOR')
  ) {
    return false;
  }

  if (LOW_PRIORITY_KEYWORDS.some(kw => combined.includes(kw))) {
    // Unless it's explicitly an admin security/governance policy change
    const isGovernance = ADMIN_OWNER_KEYWORDS.some(kw => combined.includes(kw));
    if (!isGovernance) return false;
  }

  if (PRIORITY_TYPE_PREFIXES.some(prefix => typeStr.startsWith(prefix) || typeStr.includes(prefix))) {
    return true;
  }

  const entityType = String(n.entity_type || '').toLowerCase();
  if (
    ['task', 'project', 'user', 'organization', 'invitation', 'chat', 'sprint', 'calendar'].includes(entityType)
  ) {
    return true;
  }

  if (ADMIN_OWNER_KEYWORDS.some(kw => combined.includes(kw))) {
    return true;
  }

  return true;
};

export const getNotificationCategoryMeta = (
  n: Notification
): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'lime' } => {
  const typeStr = String(n.type || '').toUpperCase();
  const titleStr = String(n.title || '').toLowerCase();
  const msgStr = String(n.message || n.content || '').toLowerCase();
  const combined = `${titleStr} ${msgStr}`;

  if (typeStr === 'MENTION' || titleStr.includes('mention')) {
    return { label: 'Mention', tone: 'lime' };
  }
  if (typeStr.includes('OVERDUE') || typeStr.includes('CRITICAL') || typeStr.includes('BLOCKED')) {
    return { label: 'Urgent', tone: 'danger' };
  }
  if (
    ADMIN_OWNER_KEYWORDS.some(kw => combined.includes(kw)) ||
    typeStr.includes('ROLE') ||
    typeStr.includes('INVITE') ||
    typeStr.includes('ADMIN') ||
    typeStr.includes('OWNER') ||
    typeStr.includes('SECURITY')
  ) {
    return { label: 'Admin', tone: 'warning' };
  }
  if (n.entity_type === 'chat' || typeStr.includes('CHAT') || (n.title || '').startsWith('💬')) {
    return { label: 'Chat', tone: 'success' };
  }
  if (n.entity_type === 'task' || typeStr.startsWith('TASK_') || typeStr.includes('COMMENT')) {
    return { label: 'Task', tone: 'neutral' };
  }
  if (n.entity_type === 'project' || typeStr.includes('PROJECT')) {
    return { label: 'Project', tone: 'success' };
  }
  if (typeStr.includes('SPRINT') || titleStr.includes('sprint')) {
    return { label: 'Sprint', tone: 'warning' };
  }
  if (n.entity_type === 'calendar' || typeStr.includes('CALENDAR')) {
    return { label: 'Calendar', tone: 'success' };
  }
  return { label: 'System', tone: 'neutral' };
};
