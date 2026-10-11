import {
  Task,
  TaskStatus,
  TaskPriority,
  User,
  UserRole,
  normalizeUserRole,
  AutomationRule,
  AutomationLog,
} from '../types';
import supabaseService, { supabase } from './supabaseService';
import soundService from './soundService';

const STORAGE_KEY = 'omni_task_automation_rules_v1';
const LOGS_STORAGE_KEY = 'omni_task_automation_logs_v1';

// Deduplication map so a single transition doesn't double-trigger within 2.5 seconds
const recentExecutionGuard = new Map<string, number>();

export const DEFAULT_PRESET_RULES: AutomationRule[] = [
  {
    id: 'preset-review-assign',
    name: 'Auto-Assign Lead Reviewer on In Review',
    description: 'When a task moves to In Review, automatically assign the primary reviewer, post a review handoff comment, and notify the team',
    triggerEvent: 'status_change',
    triggerConditionValue: TaskStatus.REVIEW,
    actionType: 'assign_user',
    actionTargetValue: '', // Dynamically resolves to Lead/Admin/PM or primary reviewer
    enabled: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    executionCount: 4,
  },
  {
    id: 'preset-due-soon-priority',
    name: 'Escalate Priority When Due Within 24h',
    description: 'When a task is in To Do or In Progress and due within 24 hours (or overdue), automatically escalate priority to High',
    triggerEvent: 'due_date_approaching',
    triggerConditionValue: '24h',
    actionType: 'set_priority',
    actionTargetValue: TaskPriority.HIGH,
    enabled: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    executionCount: 2,
  },
  {
    id: 'preset-done-celebrate',
    name: 'Celebrate & Timestamp Completed Tasks',
    description: 'When a task moves to Done, append completion verification timestamp, post a verification comment, and unblock dependent tasks',
    triggerEvent: 'status_change',
    triggerConditionValue: TaskStatus.DONE,
    actionType: 'add_comment',
    actionTargetValue: '✅ Task verified and completed via automated workflow.',
    enabled: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    executionCount: 7,
  },
  {
    id: 'preset-review-comment-log',
    name: 'Post Quality Review Checklist on In Review',
    description: 'When a task moves to In Review, post a structured QA review checklist comment and attach verification items',
    triggerEvent: 'status_change',
    triggerConditionValue: TaskStatus.REVIEW,
    actionType: 'add_comment',
    actionTargetValue: '🔍 Ready for Peer & QA Review: Please verify acceptance criteria, edge cases, and regression tests.',
    enabled: false,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    executionCount: 0,
  },
  {
    id: 'preset-critical-alert',
    name: 'Immediate Alert on Critical Priority',
    description: 'When a task priority is set to Critical, dispatch an urgent workspace alert and post an escalation note',
    triggerEvent: 'priority_change',
    triggerConditionValue: TaskPriority.CRITICAL,
    actionType: 'send_notification',
    actionTargetValue: '🚨 Critical priority escalation: Immediate engineering triage required.',
    enabled: false,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    executionCount: 0,
  },
];

const notifyRulesUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('omni_automation_rules_updated'));
  }
};

export const getStoredRules = (): AutomationRule[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PRESET_RULES));
      return DEFAULT_PRESET_RULES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PRESET_RULES;

    // Normalize legacy preset-due-soon-priority if it had triggerEvent: 'status_change'
    let migrated = false;
    const normalized = parsed.map((rule: AutomationRule) => {
      if (rule.id === 'preset-due-soon-priority' && rule.triggerEvent === 'status_change' && rule.triggerConditionValue === TaskStatus.TODO) {
        migrated = true;
        return {
          ...rule,
          triggerEvent: 'due_date_approaching' as const,
          triggerConditionValue: '24h',
          description: 'When a task is in To Do or In Progress and due within 24 hours (or overdue), automatically escalate priority to High',
        };
      }
      return rule;
    });
    if (migrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return DEFAULT_PRESET_RULES;
  }
};

export const saveStoredRules = (rules: AutomationRule[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    notifyRulesUpdated();
  } catch (e) {
    console.error('Failed to save automation rules:', e);
  }
};

export const getStoredLogs = (): AutomationLog[] => {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addAutomationLog = (log: Omit<AutomationLog, 'id' | 'timestamp'>): AutomationLog => {
  const newLog: AutomationLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  try {
    const existing = getStoredLogs();
    const updated = [newLog, ...existing].slice(0, 100);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updated));
    notifyRulesUpdated();
  } catch (e) {
    console.error('Failed to save automation log:', e);
  }
  return newLog;
};

export const isTaskDueWithin24HoursOrOverdue = (task: Task): boolean => {
  const rawDue = task.dueDate || task.due_date;
  if (!rawDue) return false;
  if (task.status === TaskStatus.DONE) return false;
  const dueTime = new Date(rawDue).getTime();
  if (Number.isNaN(dueTime)) return false;
  const now = Date.now();
  const hoursUntilDue = (dueTime - now) / (1000 * 60 * 60);
  // True if overdue or due within the next 28 hours (covers "today" and "tomorrow" date pickers)
  return hoursUntilDue <= 28;
};

const postAutomatedTaskComment = async (
  taskId: string,
  actorUser: User | null | undefined,
  content: string
): Promise<void> => {
  const authorId = actorUser?.id;
  if (!authorId || !taskId) return;

  try {
    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: authorId,
        content,
      })
      .select('*, user:user_profiles(*)')
      .single();

    if (!error && data) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('omni_task_comment_added', {
            detail: { taskId, comment: data },
          })
        );
      }
      return;
    }
  } catch {}

  // Fallback synthetic comment event so UI always reflects it immediately
  if (typeof window !== 'undefined') {
    const fallbackComment = {
      id: `auto-comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      task_id: taskId,
      user_id: authorId,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: actorUser,
    };
    window.dispatchEvent(
      new CustomEvent('omni_task_comment_added', {
        detail: { taskId, comment: fallbackComment },
      })
    );
  }
};

const selectLeadReviewer = (users: User[], currentAssigneeId?: string, currentUser?: User | null): User | undefined => {
  if (!users || users.length === 0) return currentUser || undefined;
  // Prefer an Owner, Admin, or Project Manager who is not the current assignee
  const leadCandidates = users.filter(u => {
    const r = normalizeUserRole(u.role);
    return r === UserRole.OWNER || r === UserRole.ADMIN || r === UserRole.PROJECT_MANAGER;
  });

  const differentLead = leadCandidates.find(u => u.id !== currentAssigneeId);
  if (differentLead) return differentLead;

  const differentAny = users.find(u => u.id !== currentAssigneeId);
  if (differentAny) return differentAny;

  return leadCandidates[0] || users[0] || currentUser || undefined;
};

/**
 * Evaluates and executes enabled automation rules when a task is created, updated, or moved.
 */
export const processTaskAutomationRules = async (
  previousTask: Task | null | undefined,
  updatedTask: Task,
  context: {
    users: User[];
    currentUser?: User | null;
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<any>;
    addToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error', navTarget?: any) => void;
    addNotification?: (notification: any) => void;
    isTaskCreated?: boolean;
    isManualTest?: boolean;
  }
): Promise<void> => {
  const rules = getStoredRules();
  const enabledRules = rules.filter(r => r.enabled || context.isManualTest);
  if (enabledRules.length === 0) return;

  let rulesModified = false;
  const updatesToApply: Partial<Task> = {};
  const actorUser = context.currentUser || context.users[0] || null;

  for (const rule of enabledRules) {
    let triggered = false;
    let triggerDescription = '';

    if (context.isManualTest) {
      triggered = true;
      triggerDescription = `Manual Test Run (${rule.triggerEvent})`;
    } else if (rule.triggerEvent === 'task_created' && context.isTaskCreated) {
      if (
        !rule.triggerConditionValue ||
        rule.triggerConditionValue === 'any' ||
        updatedTask.status === rule.triggerConditionValue ||
        updatedTask.priority === rule.triggerConditionValue
      ) {
        triggered = true;
        triggerDescription = `Task Created ("${updatedTask.title}")`;
      }
    } else if (rule.triggerEvent === 'status_change') {
      const statusChanged =
        (previousTask && previousTask.status !== updatedTask.status) ||
        (context.isTaskCreated && updatedTask.status === rule.triggerConditionValue);

      if (statusChanged && updatedTask.status === rule.triggerConditionValue) {
        // Special check if a custom status_change rule is specifically the legacy due-soon rule
        if (rule.id === 'preset-due-soon-priority') {
          if (isTaskDueWithin24HoursOrOverdue(updatedTask)) {
            triggered = true;
            triggerDescription = `Task in To Do & due within 24h`;
          }
        } else {
          triggered = true;
          triggerDescription = `Status changed to "${updatedTask.status.replace('_', ' ').toUpperCase()}"`;
        }
      }
    } else if (rule.triggerEvent === 'priority_change') {
      const priorityChanged =
        (previousTask && previousTask.priority !== updatedTask.priority) ||
        (context.isTaskCreated && updatedTask.priority === rule.triggerConditionValue);

      if (priorityChanged && updatedTask.priority === rule.triggerConditionValue) {
        triggered = true;
        triggerDescription = `Priority set to "${updatedTask.priority}"`;
      }
    } else if (rule.triggerEvent === 'assignee_change') {
      const assigneeChanged =
        (previousTask && previousTask.assignee_id !== updatedTask.assignee_id) ||
        (context.isTaskCreated && Boolean(updatedTask.assignee_id));

      if (
        assigneeChanged &&
        (!rule.triggerConditionValue ||
          rule.triggerConditionValue === 'any' ||
          updatedTask.assignee_id === rule.triggerConditionValue)
      ) {
        triggered = true;
        triggerDescription = `Assignee updated`;
      }
    } else if (rule.triggerEvent === 'due_date_approaching') {
      const prevDue = previousTask?.dueDate || previousTask?.due_date;
      const newDue = updatedTask.dueDate || updatedTask.due_date;
      const dueChangedOrCreated = context.isTaskCreated || prevDue !== newDue || previousTask?.status !== updatedTask.status;

      if (
        dueChangedOrCreated &&
        updatedTask.status !== TaskStatus.DONE &&
        isTaskDueWithin24HoursOrOverdue(updatedTask) &&
        updatedTask.priority !== TaskPriority.CRITICAL &&
        updatedTask.priority !== (rule.actionTargetValue || TaskPriority.HIGH)
      ) {
        triggered = true;
        triggerDescription = `Task due within 24h (${newDue})`;
      }
    } else if (rule.triggerEvent === 'subtasks_completed') {
      const checklist = updatedTask.checklist || [];
      const prevChecklist = previousTask?.checklist || [];
      const allDoneNow = checklist.length > 0 && checklist.every(item => item.completed);
      const wasAllDoneBefore = prevChecklist.length > 0 && prevChecklist.every(item => item.completed);
      if (allDoneNow && !wasAllDoneBefore) {
        triggered = true;
        triggerDescription = `All ${checklist.length} checklist items completed`;
      }
    }

    if (!triggered) continue;

    // Deduplication check so the same rule doesn't fire twice for the same task within 3 seconds
    const dedupKey = `${rule.id}:${updatedTask.id}:${rule.triggerEvent}:${updatedTask.status}:${updatedTask.priority}`;
    const lastFired = recentExecutionGuard.get(dedupKey) || 0;
    if (!context.isManualTest && Date.now() - lastFired < 3000) {
      continue;
    }
    recentExecutionGuard.set(dedupKey, Date.now());

    let actionSummary = '';

    // 1. ACTION: ASSIGN USER
    if (rule.actionType === 'assign_user') {
      let targetUser: User | undefined;
      if (rule.actionTargetValue) {
        targetUser = context.users.find(u => u.id === rule.actionTargetValue);
      }
      if (!targetUser) {
        targetUser = selectLeadReviewer(context.users, updatedTask.assignee_id, context.currentUser);
      }

      if (targetUser) {
        const reviewerName = targetUser.full_name || targetUser.email;
        updatesToApply.assignee_id = targetUser.id;
        actionSummary = `Assigned reviewer ${reviewerName}`;

        await postAutomatedTaskComment(
          updatedTask.id,
          actorUser,
          `⚡ **[Automation: ${rule.name}]** Assigned to **${reviewerName}** for review verification.`
        );

        soundService.playNotification();
        context.addToast(
          `⚡ Automation: ${rule.name}`,
          `Task "${updatedTask.title}" assigned to ${reviewerName}`,
          'info',
          { entity_type: 'task', entity_id: updatedTask.id }
        );

        if (context.addNotification) {
          context.addNotification({
            user_id: targetUser.id,
            type: 'TASK_ASSIGNED',
            title: `⚡ Automated Assignment: ${rule.name}`,
            message: `You were automatically assigned to "${updatedTask.title}" (${triggerDescription}).`,
            entity_type: 'task',
            entity_id: updatedTask.id,
          });
        }
      }
    }
    // 2. ACTION: SET PRIORITY
    else if (rule.actionType === 'set_priority') {
      const targetPriority = (rule.actionTargetValue as TaskPriority) || TaskPriority.HIGH;
      updatesToApply.priority = targetPriority;
      actionSummary = `Escalated priority to ${targetPriority}`;

      await postAutomatedTaskComment(
        updatedTask.id,
        actorUser,
        `⚡ **[Automation: ${rule.name}]** Priority automatically escalated to **${targetPriority}** (${triggerDescription}).`
      );

      soundService.playNotification();
      context.addToast(
        `⚡ Automation: ${rule.name}`,
        `"${updatedTask.title}" priority escalated to ${targetPriority}`,
        'warning',
        { entity_type: 'task', entity_id: updatedTask.id }
      );
    }
    // 3. ACTION: SET STATUS
    else if (rule.actionType === 'set_status') {
      const targetStatus = (rule.actionTargetValue as TaskStatus) || TaskStatus.IN_PROGRESS;
      updatesToApply.status = targetStatus;
      actionSummary = `Moved status to ${targetStatus.replace('_', ' ').toUpperCase()}`;

      await postAutomatedTaskComment(
        updatedTask.id,
        actorUser,
        `⚡ **[Automation: ${rule.name}]** Status automatically transitioned to **${targetStatus.replace('_', ' ').toUpperCase()}**.`
      );

      soundService.playTaskComplete();
      context.addToast(
        `⚡ Automation: ${rule.name}`,
        `"${updatedTask.title}" moved to ${targetStatus.replace('_', ' ').toUpperCase()}`,
        'success',
        { entity_type: 'task', entity_id: updatedTask.id }
      );
    }
    // 4. ACTION: ADD COMMENT / VERIFICATION STAMP / QA CHECKLIST
    else if (rule.actionType === 'add_comment') {
      const stampText = rule.actionTargetValue || 'Automated workflow verification completed.';
      const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const commentBody = `⚡ **[Automation: ${rule.name}]** (${timeFormatted})\n${stampText}`;

      await postAutomatedTaskComment(updatedTask.id, actorUser, commentBody);

      // If this is the QA Review Checklist preset, also ensure the task has QA verification checklist items
      if (rule.id === 'preset-review-comment-log' || stampText.toLowerCase().includes('review')) {
        const existingChecklist = updatedTask.checklist || [];
        const hasQaItem = existingChecklist.some(i =>
          (i.text || i.title || '').toLowerCase().includes('qa') ||
          (i.text || i.title || '').toLowerCase().includes('acceptance criteria')
        );
        if (!hasQaItem) {
          updatesToApply.checklist = [
            ...existingChecklist,
            {
              id: `qa-check-1-${Date.now()}`,
              text: 'Verify acceptance criteria & edge cases',
              completed: false,
            },
            {
              id: `qa-check-2-${Date.now()}`,
              text: 'Confirm regression & responsive layout checks',
              completed: false,
            },
          ];
        }
      }

      // Also append a clean verification stamp to description if moving to Done
      if (updatedTask.status === TaskStatus.DONE) {
        const currentDesc = updatedTask.description || '';
        const stampLine = `\n\n---\n*${stampText} (${timeFormatted})*`;
        if (!currentDesc.includes(stampText)) {
          updatesToApply.description = `${currentDesc}${stampLine}`.trim();
        }
      }

      actionSummary = `Posted automated comment: "${stampText.slice(0, 48)}..."`;
      soundService.playSuccess();
      context.addToast(
        `⚡ Automation: ${rule.name}`,
        `${stampText} on "${updatedTask.title}"`,
        'success',
        { entity_type: 'task', entity_id: updatedTask.id }
      );
    }
    // 5. ACTION: SEND NOTIFICATION
    else if (rule.actionType === 'send_notification') {
      const msg = rule.actionTargetValue || `Automated alert triggered for "${updatedTask.title}"`;
      actionSummary = `Dispatched alert: "${msg.slice(0, 48)}"`;

      await postAutomatedTaskComment(
        updatedTask.id,
        actorUser,
        `⚡ **[Automation Alert: ${rule.name}]** ${msg}`
      );

      soundService.playNotification();
      context.addToast(`⚡ ${rule.name}`, `${updatedTask.title}: ${msg}`, 'warning', {
        entity_type: 'task',
        entity_id: updatedTask.id,
      });

      if (context.addNotification && actorUser) {
        context.addNotification({
          user_id: updatedTask.assignee_id || actorUser.id,
          type: 'TASK_UPDATED',
          title: `⚡ ${rule.name}`,
          message: `${updatedTask.title}: ${msg}`,
          entity_type: 'task',
          entity_id: updatedTask.id,
        });
      }
    }

    if (actionSummary) {
      rule.executionCount = (rule.executionCount || 0) + 1;
      rule.lastRunAt = new Date().toISOString();
      rulesModified = true;

      addAutomationLog({
        ruleId: rule.id,
        ruleName: rule.name,
        taskId: updatedTask.id,
        taskTitle: updatedTask.title,
        triggerEvent: triggerDescription,
        actionTaken: actionSummary,
        status: 'success',
      });
    }
  }

  if (rulesModified) {
    saveStoredRules(rules);
  }

  if (Object.keys(updatesToApply).length > 0) {
    try {
      await context.updateTask(updatedTask.id, updatesToApply);
    } catch (err) {
      console.error('Failed to apply automated task updates:', err);
    }
  }
};
