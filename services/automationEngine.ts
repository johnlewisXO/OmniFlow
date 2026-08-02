import { AutomationRule, AutomationLog, Task, TaskStatus, TaskPriority, User } from '../types';

const RULES_STORAGE_KEY = 'omni_flow_automation_rules';
const LOGS_STORAGE_KEY = 'omni_flow_automation_logs';

export const DEFAULT_PRESET_RULES: AutomationRule[] = [
  {
    id: 'rule-preset-1',
    name: 'Auto-Assign Lead Reviewer on In Review',
    description: 'Automatically assigns the task to a designated team member when status moves to Review.',
    triggerEvent: 'status_change',
    triggerConditionValue: TaskStatus.REVIEW,
    actionType: 'assign_user',
    actionTargetValue: '', // filled with first available user if empty
    enabled: true,
    createdAt: new Date().toISOString(),
    executionCount: 12,
    lastRunAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'rule-preset-2',
    name: 'Escalate Priority to High on Overdue / Blocked Tasks',
    description: 'Sets task priority to Critical when status is moved to To Do or High priority issues detected.',
    triggerEvent: 'priority_change',
    triggerConditionValue: TaskPriority.CRITICAL,
    actionType: 'send_notification',
    actionTargetValue: 'High priority task escalation notification dispatched to project lead.',
    enabled: true,
    createdAt: new Date().toISOString(),
    executionCount: 8,
    lastRunAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'rule-preset-3',
    name: 'Auto-Move Status to In Progress when Assigned',
    description: 'Triggers an automatic status update when an assignee is added to an unassigned task.',
    triggerEvent: 'assignee_change',
    triggerConditionValue: 'any',
    actionType: 'set_status',
    actionTargetValue: TaskStatus.IN_PROGRESS,
    enabled: true,
    createdAt: new Date().toISOString(),
    executionCount: 5,
    lastRunAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'rule-preset-4',
    name: 'Post Quality Review Comment when Task Completed',
    description: 'Posts a standard automated verification comment when a task is marked Done.',
    triggerEvent: 'status_change',
    triggerConditionValue: TaskStatus.DONE,
    actionType: 'add_comment',
    actionTargetValue: 'Automated Rule Execution: Task completed and verified for milestone release.',
    enabled: true,
    createdAt: new Date().toISOString(),
    executionCount: 19,
    lastRunAt: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const getStoredRules = (): AutomationRule[] => {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed parsing automation rules:', e);
  }
  saveStoredRules(DEFAULT_PRESET_RULES);
  return DEFAULT_PRESET_RULES;
};

export const saveStoredRules = (rules: AutomationRule[]): void => {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    console.error('Failed saving automation rules:', e);
  }
};

export const getStoredLogs = (): AutomationLog[] => {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed parsing automation logs:', e);
  }
  const defaultLogs: AutomationLog[] = [
    {
      id: 'log-1',
      ruleId: 'rule-preset-1',
      ruleName: 'Auto-Assign Lead Reviewer on In Review',
      taskId: 'task-sample-1',
      taskTitle: 'Database Schema Migration',
      triggerEvent: 'Status changed to Review',
      actionTaken: 'Assigned user to task',
      status: 'success',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      details: 'Successfully executed status automation rule.'
    },
    {
      id: 'log-2',
      ruleId: 'rule-preset-4',
      ruleName: 'Post Quality Review Comment when Task Completed',
      taskId: 'task-sample-2',
      taskTitle: 'UI Mobile Responsive Layout Fixes',
      triggerEvent: 'Status changed to Done',
      actionTaken: 'Posted verification comment',
      status: 'success',
      timestamp: new Date(Date.now() - 5400000).toISOString(),
      details: 'Automated rule execution complete.'
    }
  ];
  saveStoredLogs(defaultLogs);
  return defaultLogs;
};

export const saveStoredLogs = (logs: AutomationLog[]): void => {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.error('Failed saving automation logs:', e);
  }
};

export const addAutomationLog = (logEntry: Omit<AutomationLog, 'id' | 'timestamp'>): AutomationLog => {
  const newLog: AutomationLog = {
    ...logEntry,
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString()
  };
  const currentLogs = getStoredLogs();
  const updated = [newLog, ...currentLogs];
  saveStoredLogs(updated);
  return newLog;
};

export interface TaskUpdateContext {
  task: Task;
  previousStatus?: TaskStatus;
  previousPriority?: TaskPriority;
  previousAssigneeId?: string;
  users: User[];
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  addToast?: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const processTaskAutomationRules = async (context: TaskUpdateContext): Promise<number> => {
  const rules = getStoredRules().filter(r => r.enabled);
  if (rules.length === 0) return 0;

  let executedCount = 0;
  const { task, previousStatus, previousPriority, previousAssigneeId, users, updateTask, addToast } = context;

  for (const rule of rules) {
    let matches = false;
    let triggerDesc = '';

    // Check Trigger
    if (rule.triggerEvent === 'status_change') {
      if (previousStatus && previousStatus !== task.status && (rule.triggerConditionValue === task.status || rule.triggerConditionValue === 'any')) {
        matches = true;
        triggerDesc = `Status changed to ${task.status}`;
      }
    } else if (rule.triggerEvent === 'priority_change') {
      if (previousPriority && previousPriority !== task.priority && (rule.triggerConditionValue === task.priority || rule.triggerConditionValue === 'any')) {
        matches = true;
        triggerDesc = `Priority changed to ${task.priority}`;
      }
    } else if (rule.triggerEvent === 'assignee_change') {
      if (previousAssigneeId !== task.assignee_id && task.assignee_id) {
        matches = true;
        triggerDesc = `Assignee updated`;
      }
    } else if (rule.triggerEvent === 'task_created') {
      matches = true;
      triggerDesc = `New task created`;
    }

    if (!matches) continue;

    // Execute Action
    try {
      let actionDesc = '';
      const updates: Partial<Task> = {};

      if (rule.actionType === 'assign_user') {
        const targetUser = users.find(u => u.id === rule.actionTargetValue) || users[0];
        if (targetUser && task.assignee_id !== targetUser.id) {
          updates.assignee_id = targetUser.id;
          actionDesc = `Auto-assigned to ${targetUser.full_name || targetUser.email}`;
        }
      } else if (rule.actionType === 'set_priority') {
        const targetPriority = rule.actionTargetValue as TaskPriority;
        if (Object.values(TaskPriority).includes(targetPriority) && task.priority !== targetPriority) {
          updates.priority = targetPriority;
          actionDesc = `Updated priority to ${targetPriority}`;
        }
      } else if (rule.actionType === 'set_status') {
        const targetStatus = rule.actionTargetValue as TaskStatus;
        if (Object.values(TaskStatus).includes(targetStatus) && task.status !== targetStatus) {
          updates.status = targetStatus;
          actionDesc = `Updated status to ${targetStatus}`;
        }
      } else if (rule.actionType === 'send_notification' || rule.actionType === 'add_comment') {
        actionDesc = rule.actionTargetValue || `Automation rule executed for ${task.title}`;
      }

      if (Object.keys(updates).length > 0) {
        await updateTask(task.id, updates);
      }

      // Update rule execution count
      const allRules = getStoredRules();
      const ruleIdx = allRules.findIndex(r => r.id === rule.id);
      if (ruleIdx >= 0) {
        allRules[ruleIdx].executionCount = (allRules[ruleIdx].executionCount || 0) + 1;
        allRules[ruleIdx].lastRunAt = new Date().toISOString();
        saveStoredRules(allRules);
      }

      // Log execution
      addAutomationLog({
        ruleId: rule.id,
        ruleName: rule.name,
        taskId: task.id,
        taskTitle: task.title,
        triggerEvent: triggerDesc,
        actionTaken: actionDesc || 'Trigger action executed',
        status: 'success',
        details: `Rule "${rule.name}" triggered automatically.`
      });

      if (addToast) {
        addToast(
          '⚡ Automation Executed',
          `Rule "${rule.name}": ${actionDesc || 'Triggered successfully'}`,
          'info'
        );
      }

      executedCount++;
    } catch (err: any) {
      addAutomationLog({
        ruleId: rule.id,
        ruleName: rule.name,
        taskId: task.id,
        taskTitle: task.title,
        triggerEvent: triggerDesc,
        actionTaken: 'Rule execution failed',
        status: 'failed',
        details: err?.message || 'Error running automation rule action'
      });
    }
  }

  return executedCount;
};
