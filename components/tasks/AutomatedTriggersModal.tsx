import React, { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import {
  TaskStatus,
  TaskPriority,
  User,
  AutomationRule,
  AutomationLog,
  AutomationTriggerType,
  AutomationActionType,
} from '../../types';
import { ICON_MAP } from '../../constants';
import {
  getStoredRules,
  saveStoredRules,
  getStoredLogs,
  DEFAULT_PRESET_RULES,
  processTaskAutomationRules,
} from '../../services/automationEngine';
import { useAppStore } from '../../hooks/useAppStore';

interface AutomatedTriggersModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  darkMode: boolean;
}

export const getStoredAutomationRules = getStoredRules;
export const saveAutomationRules = saveStoredRules;

export const AutomatedTriggersModal: React.FC<AutomatedTriggersModalProps> = ({
  isOpen,
  onClose,
  users,
  darkMode,
}) => {
  const { tasks, updateTask, addToast, addNotification, currentUser } = useAppStore();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'presets' | 'logs'>('rules');
  const [isAddingRule, setIsAddingRule] = useState(false);

  // New Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerType>('status_change');
  const [triggerConditionValue, setTriggerConditionValue] = useState<string>(TaskStatus.REVIEW);
  const [actionType, setActionType] = useState<AutomationActionType>('assign_user');
  const [actionTargetValue, setActionTargetValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const sync = () => {
        setRules(getStoredRules());
        setLogs(getStoredLogs());
      };
      sync();
      window.addEventListener('omni_automation_rules_updated', sync);
      return () => window.removeEventListener('omni_automation_rules_updated', sync);
    }
  }, [isOpen]);

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRules(updated);
    saveStoredRules(updated);
    const toggled = updated.find((r) => r.id === id);
    if (toggled) {
      addToast(
        toggled.enabled ? 'Automation Rule Enabled' : 'Automation Rule Paused',
        `"${toggled.name}" is now ${toggled.enabled ? 'active' : 'paused'}.`,
        toggled.enabled ? 'success' : 'info'
      );
    }
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveStoredRules(updated);
    addToast('Rule Removed', 'Automation trigger rule removed.', 'info');
  };

  const handleInstallPreset = (preset: AutomationRule) => {
    const existing = rules.find((r) => r.id === preset.id || r.name === preset.name);
    if (existing) {
      const updated = rules.map((r) => (r.id === existing.id ? { ...r, enabled: true } : r));
      setRules(updated);
      saveStoredRules(updated);
      setActiveTab('rules');
      addToast('Preset Enabled', `"${preset.name}" is now enabled and active.`, 'success');
      return;
    }

    const newRule: AutomationRule = {
      ...preset,
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      enabled: true,
      createdAt: new Date().toISOString(),
      executionCount: 0,
    };
    const updated = [newRule, ...rules];
    setRules(updated);
    saveStoredRules(updated);
    setActiveTab('rules');
    addToast('Preset Installed', `"${preset.name}" added and enabled.`, 'success');
  };

  const handleTestRunRule = async (rule: AutomationRule) => {
    if (tasks.length === 0) {
      addToast('No Tasks Available', 'Create a task in this project first to test the rule.', 'warning');
      return;
    }
    const targetTask = tasks[0];
    await processTaskAutomationRules(targetTask, targetTask, {
      users,
      currentUser,
      updateTask,
      addToast,
      addNotification,
      isManualTest: true,
    });
    setRules(getStoredRules());
    setLogs(getStoredLogs());
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const newRule: AutomationRule = {
      id: `rule-${Date.now()}`,
      name: ruleName.trim(),
      description: `When ${triggerEvent.replace(/_/g, ' ')} matches "${triggerConditionValue}", execute ${actionType.replace(/_/g, ' ')}.`,
      triggerEvent,
      triggerConditionValue,
      actionType,
      actionTargetValue: actionTargetValue || (actionType === 'assign_user' ? users[0]?.id || '' : ''),
      enabled: true,
      createdAt: new Date().toISOString(),
      executionCount: 0,
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    saveStoredRules(updated);
    addToast('Automation Rule Created', `"${newRule.name}" is now active.`, 'success');

    setRuleName('');
    setIsAddingRule(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Automated Task Triggers & Rules">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Active Rules ({rules.filter((r) => r.enabled).length}/{rules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'presets'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Presets ({DEFAULT_PRESET_RULES.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Execution Logs ({logs.length})
            </button>
          </div>

          {!isAddingRule && activeTab === 'rules' && (
            <Button size="sm" onClick={() => setIsAddingRule(true)}>
              <ICON_MAP.PlusIcon className="w-4 h-4 mr-1.5" />
              New Trigger Rule
            </Button>
          )}
        </div>

        {/* Create Rule Form */}
        {isAddingRule && activeTab === 'rules' && (
          <form
            onSubmit={handleCreateRule}
            className={`p-4 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Create Automation Trigger Rule</h4>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Rule Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Assign Lead Reviewer on In Review"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className={`w-full p-2.5 rounded-lg border text-sm ${
                  darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  When (Trigger Event)
                </label>
                <select
                  value={triggerEvent}
                  onChange={(e) => {
                    const evt = e.target.value as AutomationTriggerType;
                    setTriggerEvent(evt);
                    if (evt === 'status_change') setTriggerConditionValue(TaskStatus.REVIEW);
                    else if (evt === 'priority_change') setTriggerConditionValue(TaskPriority.CRITICAL);
                    else if (evt === 'due_date_approaching') setTriggerConditionValue('24h');
                    else setTriggerConditionValue('any');
                  }}
                  className={`w-full p-2.5 rounded-lg border text-sm ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                  }`}
                >
                  <option value="status_change">Task Status Changes To...</option>
                  <option value="priority_change">Task Priority Changes To...</option>
                  <option value="due_date_approaching">Task Due Within 24h / Overdue</option>
                  <option value="subtasks_completed">All Subtask Checklist Items Completed</option>
                  <option value="task_created">New Task Created</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Condition Value
                </label>
                {triggerEvent === 'status_change' ? (
                  <select
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                    }`}
                  >
                    <option value={TaskStatus.TODO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.REVIEW}>In Review</option>
                    <option value={TaskStatus.DONE}>Done</option>
                  </select>
                ) : triggerEvent === 'priority_change' ? (
                  <select
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                    }`}
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.CRITICAL}>Critical</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Then (Action)
                </label>
                <select
                  value={actionType}
                  onChange={(e) => {
                    const act = e.target.value as AutomationActionType;
                    setActionType(act);
                    if (act === 'assign_user') setActionTargetValue(users[0]?.id || '');
                    else if (act === 'set_priority') setActionTargetValue(TaskPriority.HIGH);
                    else if (act === 'set_status') setActionTargetValue(TaskStatus.IN_PROGRESS);
                    else setActionTargetValue('Automated workflow verification completed.');
                  }}
                  className={`w-full p-2.5 rounded-lg border text-sm ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                  }`}
                >
                  <option value="assign_user">Automatically Assign User</option>
                  <option value="set_priority">Set Task Priority</option>
                  <option value="set_status">Set Task Status</option>
                  <option value="add_comment">Post Verification / QA Comment</option>
                  <option value="send_notification">Send High-Priority Alert</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Action Parameter
                </label>
                {actionType === 'assign_user' ? (
                  <select
                    value={actionTargetValue}
                    onChange={(e) => setActionTargetValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                    }`}
                  >
                    <option value="">Auto-Select Lead Reviewer</option>
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
                    className={`w-full p-2.5 rounded-lg border text-sm ${
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                    }`}
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.CRITICAL}>Critical</option>
                  </select>
                ) : actionType === 'set_status' ? (
                  <select
                    value={actionTargetValue}
                    onChange={(e) => setActionTargetValue(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm ${
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                    }`}
                  >
                    <option value={TaskStatus.TODO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.REVIEW}>In Review</option>
                    <option value={TaskStatus.DONE}>Done</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={actionTargetValue}
                    onChange={(e) => setActionTargetValue(e.target.value)}
                    placeholder="Comment or alert text"
                    className={`w-full p-2.5 rounded-lg border text-sm ${
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddingRule(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit">
                Save Trigger Rule
              </Button>
            </div>
          </form>
        )}

        {/* Active Rules List */}
        {activeTab === 'rules' && (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {rules.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed rounded-xl text-slate-400 text-sm">
                No automation rules configured. Enable a preset or click "New Trigger Rule".
              </div>
            ) : (
              rules.map((rule) => {
                const targetUser = users.find((u) => u.id === rule.actionTargetValue);
                return (
                  <div
                    key={rule.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      darkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-white border-slate-200 shadow-2xs'
                    } ${!rule.enabled ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id)}
                        className="mt-1 rounded text-accent focus:ring-accent cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{rule.name}</p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              rule.enabled
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-slate-500/15 text-slate-400'
                            }`}
                          >
                            {rule.enabled ? 'Active' : 'Paused'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
                            Ran {rule.executionCount || 0}x
                          </span>
                        </div>
                        {rule.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rule.description}</p>
                        )}
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          When <span className="font-semibold text-accent">{rule.triggerEvent.replace(/_/g, ' ')}</span> ={' '}
                          <span className="font-semibold">{rule.triggerConditionValue}</span> →{' '}
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {rule.actionType === 'assign_user'
                              ? `Assign to ${targetUser?.full_name || targetUser?.email || 'Lead Reviewer'}`
                              : rule.actionType === 'set_priority'
                              ? `Set Priority to ${rule.actionTargetValue}`
                              : rule.actionType === 'set_status'
                              ? `Move Status to ${rule.actionTargetValue}`
                              : `Post "${rule.actionTargetValue.slice(0, 40)}"`}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTestRunRule(rule)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                        title="Execute this rule immediately on a task"
                      >
                        ⚡ Test Run
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete Rule"
                      >
                        <ICON_MAP.TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Presets Library Tab */}
        {activeTab === 'presets' && (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {DEFAULT_PRESET_RULES.map((preset) => {
              const isInstalled = rules.some((r) => r.id === preset.id && r.enabled);
              return (
                <div
                  key={preset.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    darkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{preset.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 uppercase">
                        {preset.triggerEvent.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{preset.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isInstalled ? 'secondary' : 'primary'}
                    onClick={() => handleInstallPreset(preset)}
                  >
                    {isInstalled ? '✓ Active' : 'Enable Preset'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Execution Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed rounded-xl text-slate-400 text-xs">
                No automation triggers have fired yet. Move a task to In Review or Done, or click "⚡ Test Run" on any rule!
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    darkMode ? 'bg-slate-800/40 border-slate-700/70' : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">
                        SUCCESS
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{log.ruleName}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-semibold text-indigo-400">{log.taskTitle}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {log.triggerEvent} → <span className="text-slate-700 dark:text-slate-200 font-medium">{log.actionTaken}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
