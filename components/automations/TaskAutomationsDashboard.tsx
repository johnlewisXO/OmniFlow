import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { TaskStatus, TaskPriority, AutomationRule, AutomationLog, AutomationTriggerType, AutomationActionType } from '../../types';
import { Button } from '../shared/Button';
import { 
  getStoredRules, 
  saveStoredRules, 
  getStoredLogs, 
  addAutomationLog, 
  DEFAULT_PRESET_RULES,
  processTaskAutomationRules
} from '../../services/automationEngine';

export const TaskAutomationsDashboard: React.FC = () => {
  const { users, tasks, darkMode, addToast, updateTask } = useAppStore();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'builder' | 'logs' | 'templates'>('rules');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrigger, setFilterTrigger] = useState<string>('all');

  // New Rule Builder Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerType>('status_change');
  const [triggerConditionValue, setTriggerConditionValue] = useState<string>(TaskStatus.REVIEW);
  const [actionType, setActionType] = useState<AutomationActionType>('assign_user');
  const [actionTargetValue, setActionTargetValue] = useState<string>('');

  const BoltIcon = ICON_MAP.BoltIcon || ICON_MAP.CogIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const ArrowPathIcon = ICON_MAP.ArrowPathIcon;

  useEffect(() => {
    setRules(getStoredRules());
    setLogs(getStoredLogs());
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const total = rules.length;
    const active = rules.filter((r) => r.enabled).length;
    const totalRuns = rules.reduce((acc, r) => acc + (r.executionCount || 0), 0);
    const successfulRuns = logs.filter((l) => l.status === 'success').length;
    const successRate = logs.length > 0 ? Math.round((successfulRuns / logs.length) * 100) : 100;

    return { total, active, totalRuns, successRate, logCount: logs.length };
  }, [rules, logs]);

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRules(updated);
    saveStoredRules(updated);
    addToast('Rule Updated', 'Automation rule state toggled', 'info');
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveStoredRules(updated);
    addToast('Rule Deleted', 'Automation rule removed', 'error');
  };

  const handleInstallTemplate = (template: AutomationRule) => {
    const newRule: AutomationRule = {
      ...template,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      actionTargetValue: template.actionType === 'assign_user' ? (users[0]?.id || '') : template.actionTargetValue,
      createdAt: new Date().toISOString(),
      executionCount: 0,
      lastRunAt: undefined
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    saveStoredRules(updated);
    addToast('Template Installed', `Added rule "${template.name}"`, 'success');
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const newRule: AutomationRule = {
      id: `rule-${Date.now()}`,
      name: ruleName.trim(),
      description: ruleDescription.trim() || 'Custom trigger rule',
      triggerEvent,
      triggerConditionValue,
      actionType,
      actionTargetValue: actionTargetValue || (users[0]?.id || ''),
      enabled: true,
      createdAt: new Date().toISOString(),
      executionCount: 0
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    saveStoredRules(updated);

    // Reset Form
    setRuleName('');
    setRuleDescription('');
    setActiveTab('rules');
    addToast('Rule Created', `Successfully created automation "${newRule.name}"`, 'success');
  };

  const handleTestRunRule = async (rule: AutomationRule) => {
    if (tasks.length === 0) {
      addToast('No Tasks Available', 'Create a task first to test this automation rule.', 'warning');
      return;
    }

    const testTask = tasks[0];
    const logEntry = addAutomationLog({
      ruleId: rule.id,
      ruleName: rule.name,
      taskId: testTask.id,
      taskTitle: testTask.title,
      triggerEvent: `Manual Test Run (${rule.triggerEvent})`,
      actionTaken: `Executed action ${rule.actionType} (${rule.actionTargetValue})`,
      status: 'success',
      details: 'Simulated manual test run successfully.'
    });

    setLogs(getStoredLogs());
    addToast('Test Run Complete', `Simulated rule "${rule.name}" on task "${testTask.title}"`, 'success');
  };

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !(r.description || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterTrigger !== 'all' && r.triggerEvent !== filterTrigger) {
        return false;
      }
      return true;
    });
  }, [rules, searchQuery, filterTrigger]);

  return (
    <div className={`flex-1 flex flex-col h-full p-4 md:p-6 overflow-y-auto scrollbar-thin space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accent/20 text-accent">
              <BoltIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Task Triggers & Rules Engine</h1>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Automate assignments, status updates, priority escalations, and notification flows.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setLogs(getStoredLogs())}>
            <ArrowPathIcon className="w-4 h-4 mr-1.5" />
            Refresh Engine
          </Button>
          <Button size="sm" onClick={() => setActiveTab('builder')}>
            <PlusIcon className="w-4 h-4 mr-1.5" />
            Create Trigger Rule
          </Button>
        </div>
      </div>

      {/* KPI Metrics Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border shadow-xs ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Configured Rules</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{stats.total}</span>
            <span className="text-xs font-semibold text-emerald-500">{stats.active} Active</span>
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Executions</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-accent">{stats.totalRuns}</span>
            <span className="text-xs text-slate-400">runs</span>
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Execution Success Rate</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-emerald-500">{stats.successRate}%</span>
            <span className="text-xs text-slate-400">verified</span>
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Audit Activity Logs</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-purple-500">{stats.logCount}</span>
            <span className="text-xs text-slate-400">entries</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={`flex border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'rules'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Active Rules ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'builder'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Rule Builder & Custom Actions
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'templates'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Preset Automation Library
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'logs'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Execution History Logs ({logs.length})
        </button>
      </div>

      {/* Tab Content: Active Rules List */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <ICON_MAP.MagnifyingGlassIcon className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                placeholder="Search trigger rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
                className={`w-full py-2 rounded-lg border text-xs font-medium outline-hidden transition-all ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-accent' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-accent'
                }`}
              />
            </div>

            <select
              value={filterTrigger}
              onChange={(e) => setFilterTrigger(e.target.value)}
              className={`text-xs rounded-lg px-3 py-1.5 border font-semibold ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <option value="all">All Trigger Events</option>
              <option value="status_change">Status Change</option>
              <option value="priority_change">Priority Change</option>
              <option value="assignee_change">Assignee Change</option>
              <option value="task_created">Task Created</option>
            </select>
          </div>

          {/* Rules Cards */}
          <div className="grid grid-cols-1 gap-3">
            {filteredRules.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed rounded-2xl text-slate-400">
                No matching automation rules found. Click "Create Trigger Rule" to build one!
              </div>
            ) : (
              filteredRules.map((rule) => {
                const targetUser = users.find((u) => u.id === rule.actionTargetValue);
                return (
                  <div
                    key={rule.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    } ${!rule.enabled ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id)}
                        className="mt-1 w-4 h-4 rounded text-accent focus:ring-accent cursor-pointer"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{rule.name}</h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              rule.enabled
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-500/15 text-slate-500'
                            }`}
                          >
                            {rule.enabled ? 'Active' : 'Disabled'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-accent/10 text-accent">
                            {rule.triggerEvent.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        {rule.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{rule.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          <span>
                            When condition:{' '}
                            <strong className="text-accent">{rule.triggerConditionValue}</strong>
                          </span>
                          <span>→</span>
                          <span>
                            Then action:{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {rule.actionType === 'assign_user'
                                ? `Assign to ${targetUser?.full_name || targetUser?.email || 'User'}`
                                : rule.actionType === 'set_priority'
                                ? `Set priority to ${rule.actionTargetValue}`
                                : rule.actionType === 'set_status'
                                ? `Set status to ${rule.actionTargetValue}`
                                : `Action: ${rule.actionTargetValue}`}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleTestRunRule(rule)}>
                        Test Run
                      </Button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
        </div>
      )}

      {/* Tab Content: Rule Builder */}
      {activeTab === 'builder' && (
        <form
          onSubmit={handleCreateRule}
          className={`p-6 rounded-2xl border space-y-5 max-w-3xl ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Custom Automation Rule Builder</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configure trigger events, matching rules, and automatic execution targets.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rule Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Escalate Critical Bugs to Lead Engineer"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-sm font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <input
                type="text"
                placeholder="Short explanation of when and why this rule triggers..."
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-sm font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">When (Trigger Event)</label>
                <select
                  value={triggerEvent}
                  onChange={(e) => {
                    const evt = e.target.value as AutomationTriggerType;
                    setTriggerEvent(evt);
                    setTriggerConditionValue(evt === 'status_change' ? TaskStatus.REVIEW : TaskPriority.CRITICAL);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-sm font-semibold ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="status_change">Task Status Changes To...</option>
                  <option value="priority_change">Task Priority Changes To...</option>
                  <option value="assignee_change">Task Assignee Is Updated</option>
                  <option value="task_created">New Task Is Created</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Trigger Condition Value</label>
                {triggerEvent === 'status_change' ? (
                  <select
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-sm font-semibold ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={TaskStatus.TODO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.REVIEW}>Review</option>
                    <option value={TaskStatus.DONE}>Done</option>
                  </select>
                ) : triggerEvent === 'priority_change' ? (
                  <select
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-sm font-semibold ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={TaskPriority.LOW}>Low Priority</option>
                    <option value={TaskPriority.MEDIUM}>Medium Priority</option>
                    <option value={TaskPriority.HIGH}>High Priority</option>
                    <option value={TaskPriority.CRITICAL}>Critical Priority</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    placeholder="Condition rule value"
                    className={`w-full p-2.5 rounded-xl border text-sm font-medium ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Then (Action)</label>
                <select
                  value={actionType}
                  onChange={(e) => {
                    const act = e.target.value as AutomationActionType;
                    setActionType(act);
                    if (act === 'assign_user') setActionTargetValue(users[0]?.id || '');
                    else if (act === 'set_priority') setActionTargetValue(TaskPriority.HIGH);
                    else if (act === 'set_status') setActionTargetValue(TaskStatus.IN_PROGRESS);
                    else setActionTargetValue('Automated rule trigger executed.');
                  }}
                  className={`w-full p-2.5 rounded-xl border text-sm font-semibold ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="assign_user">Automatically Assign User</option>
                  <option value="set_priority">Set Task Priority</option>
                  <option value="set_status">Set Task Status</option>
                  <option value="add_comment">Add System Verification Comment</option>
                  <option value="send_notification">Trigger High Priority Notification Toast</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Action Parameter</label>
                {actionType === 'assign_user' ? (
                  <select
                    value={actionTargetValue}
                    onChange={(e) => setActionTargetValue(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-sm font-semibold ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
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
                    className={`w-full p-2.5 rounded-xl border text-sm font-semibold ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
                    className={`w-full p-2.5 rounded-xl border text-sm font-semibold ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={TaskStatus.TODO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.REVIEW}>Review</option>
                    <option value={TaskStatus.DONE}>Done</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={actionTargetValue}
                    onChange={(e) => setActionTargetValue(e.target.value)}
                    placeholder="Notification message or comment text"
                    className={`w-full p-2.5 rounded-xl border text-sm font-medium ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setActiveTab('rules')}>
              Cancel
            </Button>
            <Button type="submit">
              Save Automation Rule
            </Button>
          </div>
        </form>
      )}

      {/* Tab Content: Preset Automation Library */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click "Install Rule" on any pre-built template to immediately add it to your project workflow.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEFAULT_PRESET_RULES.map((preset) => (
              <div
                key={preset.id}
                className={`p-5 rounded-xl border flex flex-col justify-between gap-3 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{preset.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/10 text-accent">
                      {preset.triggerEvent.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{preset.description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Action: <strong className="text-slate-800 dark:text-slate-200">{preset.actionType}</strong>
                  </span>
                  <Button size="sm" onClick={() => handleInstallTemplate(preset)}>
                    Install Rule
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Execution History Logs */}
      {activeTab === 'logs' && (
        <div className={`rounded-xl border shadow-xs overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-4 border-b flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rule Execution History</h3>
            <span className="text-xs text-slate-400">{logs.length} Logged Runs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                <tr>
                  <th className="p-3 font-semibold">Timestamp</th>
                  <th className="p-3 font-semibold">Rule Name</th>
                  <th className="p-3 font-semibold">Target Task</th>
                  <th className="p-3 font-semibold">Trigger Event</th>
                  <th className="p-3 font-semibold">Action Taken</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                      No automation logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{log.ruleName}</td>
                      <td className="p-3 font-medium text-accent truncate max-w-[150px]">{log.taskTitle}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{log.triggerEvent}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{log.actionTaken}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'success'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/15 text-red-600 dark:text-red-400'
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
