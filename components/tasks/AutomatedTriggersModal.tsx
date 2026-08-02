import React, { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { TaskStatus, TaskPriority, User } from '../../types';
import { ICON_MAP } from '../../constants';

export interface AutomationRule {
  id: string;
  name: string;
  triggerEvent: 'status_change' | 'priority_change';
  triggerConditionValue: string; // e.g., TaskStatus.REVIEW or TaskPriority.CRITICAL
  actionType: 'assign_user' | 'set_priority' | 'add_comment';
  actionTargetValue: string; // User ID, Priority, or Comment text
  enabled: boolean;
  createdAt: string;
}

interface AutomatedTriggersModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  darkMode: boolean;
}

const STORAGE_KEY = 'omni_flow_automation_rules';

export const getStoredAutomationRules = (): AutomationRule[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed parsing automation rules:', e);
  }
  // Default rules if none set
  return [
    {
      id: 'rule-default-1',
      name: 'Auto-assign Reviewer when status moves to In Review',
      triggerEvent: 'status_change',
      triggerConditionValue: TaskStatus.REVIEW,
      actionType: 'assign_user',
      actionTargetValue: '',
      enabled: true,
      createdAt: new Date().toISOString(),
    },
  ];
};

export const saveAutomationRules = (rules: AutomationRule[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    console.error('Failed saving automation rules:', e);
  }
};

export const AutomatedTriggersModal: React.FC<AutomatedTriggersModalProps> = ({
  isOpen,
  onClose,
  users,
  darkMode,
}) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isAddingRule, setIsAddingRule] = useState(false);

  // New Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<'status_change' | 'priority_change'>('status_change');
  const [triggerConditionValue, setTriggerConditionValue] = useState<string>(TaskStatus.REVIEW);
  const [actionType, setActionType] = useState<'assign_user' | 'set_priority' | 'add_comment'>('assign_user');
  const [actionTargetValue, setActionTargetValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setRules(getStoredAutomationRules());
    }
  }, [isOpen]);

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRules(updated);
    saveAutomationRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveAutomationRules(updated);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const newRule: AutomationRule = {
      id: `rule-${Date.now()}`,
      name: ruleName.trim(),
      triggerEvent,
      triggerConditionValue,
      actionType,
      actionTargetValue: actionTargetValue || (users[0]?.id || ''),
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    saveAutomationRules(updated);

    // Reset Form
    setRuleName('');
    setIsAddingRule(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Automated Task Triggers & Rules">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automate task assignments, reviewer workflows, and priority updates when task events occur.
          </p>
          {!isAddingRule && (
            <Button size="sm" onClick={() => setIsAddingRule(true)}>
              <ICON_MAP.PlusIcon className="w-4 h-4 mr-1.5" />
              New Trigger Rule
            </Button>
          )}
        </div>

        {/* Create Rule Form */}
        {isAddingRule && (
          <form onSubmit={handleCreateRule} className={`p-4 rounded-xl border space-y-4 ${darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Create Automation Trigger Rule</h4>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Rule Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Assign Lead Reviewer on In Review"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className={`w-full p-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">When (Trigger Event)</label>
                <select
                  value={triggerEvent}
                  onChange={(e) => {
                    const evt = e.target.value as any;
                    setTriggerEvent(evt);
                    setTriggerConditionValue(evt === 'status_change' ? TaskStatus.REVIEW : TaskPriority.CRITICAL);
                  }}
                  className={`w-full p-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                >
                  <option value="status_change">Task Status Changes To...</option>
                  <option value="priority_change">Task Priority Changes To...</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Condition Value</label>
                {triggerEvent === 'status_change' ? (
                  <select
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  >
                    <option value={TaskStatus.TODO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.REVIEW}>Review</option>
                    <option value={TaskStatus.DONE}>Done</option>
                  </select>
                ) : (
                  <select
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.CRITICAL}>Critical</option>
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Then (Action)</label>
                <select
                  value={actionType}
                  onChange={(e) => {
                    const act = e.target.value as any;
                    setActionType(act);
                    if (act === 'assign_user') setActionTargetValue(users[0]?.id || '');
                    else if (act === 'set_priority') setActionTargetValue(TaskPriority.HIGH);
                    else setActionTargetValue('Automated trigger executed.');
                  }}
                  className={`w-full p-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                >
                  <option value="assign_user">Automatically Assign User</option>
                  <option value="set_priority">Set Task Priority</option>
                  <option value="add_comment">Add System Comment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Action Parameter</label>
                {actionType === 'assign_user' ? (
                  <select
                    value={actionTargetValue}
                    onChange={(e) => setActionTargetValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  >
                    <option value="">Select Assignee</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                ) : actionType === 'set_priority' ? (
                  <select
                    value={actionTargetValue}
                    onChange={(e) => setActionTargetValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.CRITICAL}>Critical</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={actionTargetValue}
                    onChange={(e) => setActionTargetValue(e.target.value)}
                    placeholder="Comment text to post"
                    className={`w-full p-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAddingRule(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit">
                Save Trigger Rule
              </Button>
            </div>
          </form>
        )}

        {/* Existing Rules List */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {rules.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-xl">
              No active trigger rules configured yet.
            </div>
          ) : (
            rules.map((rule) => {
              const targetUser = users.find((u) => u.id === rule.actionTargetValue);
              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'
                  } ${!rule.enabled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="w-4 h-4 rounded text-accent focus:ring-accent cursor-pointer"
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        {rule.name}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${rule.enabled ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/20 text-slate-500'}`}>
                          {rule.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        When {rule.triggerEvent === 'status_change' ? 'status' : 'priority'} is{' '}
                        <strong className="text-slate-700 dark:text-slate-200">{rule.triggerConditionValue}</strong> →{' '}
                        {rule.actionType === 'assign_user'
                          ? `Assign to ${targetUser?.full_name || targetUser?.email || 'User'}`
                          : rule.actionType === 'set_priority'
                          ? `Set priority to ${rule.actionTargetValue}`
                          : `Post comment "${rule.actionTargetValue}"`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Delete Rule"
                  >
                    <ICON_MAP.TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
