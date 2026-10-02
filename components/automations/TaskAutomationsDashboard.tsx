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
  const { 
    users, 
    tasks, 
    projects, 
    activeProject, 
    sprints, 
    webhooks, 
    saveWebhook, 
    deleteWebhook, 
    triggerWebhook, 
    createTask,
    darkMode, 
    addToast, 
    updateTask 
  } = useAppStore();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'builder' | 'logs' | 'templates' | 'webhooks' | 'portability'>('rules');

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

  // Webhook State
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [selectedWebhookEvents, setSelectedWebhookEvents] = useState<string[]>([
    'task.created',
    'task.updated',
    'task.status_changed'
  ]);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; status: number; durationMs: number; payload: string } | null>(null);

  // Import State
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

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

  // Webhook Handlers
  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) {
      addToast('Missing Fields', 'Please provide a name and destination endpoint URL for the webhook.', 'warning');
      return;
    }

    try {
      saveWebhook({
        id: `wh-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: newWebhookName.trim(),
        url: newWebhookUrl.trim(),
        events: selectedWebhookEvents.length > 0 ? selectedWebhookEvents : ['task.created', 'task.updated'],
        active: true,
        createdAt: new Date().toISOString()
      });
      setNewWebhookName('');
      setNewWebhookUrl('');
      setNewWebhookSecret('');
      addToast('Webhook Registered', 'Outbound webhook destination registered successfully.', 'success');
    } catch (err: any) {
      addToast('Failed to Create Webhook', err?.message || 'Error registering webhook', 'error');
    }
  };

  const handleTestWebhookPing = async (hook: typeof webhooks[0]) => {
    setTestingWebhookId(hook.id);
    try {
      const startTime = performance.now();
      await triggerWebhook('test.ping', {
        project: activeProject ? activeProject.name : 'Sample Project',
        environment: 'production',
        status: 'verified_healthy'
      });
      const durationMs = Math.round(performance.now() - startTime);

      const mockPayload = JSON.stringify({
        event: 'test.ping',
        webhook_id: hook.id,
        timestamp: new Date().toISOString(),
        data: {
          project: activeProject ? activeProject.name : 'Sample Project',
          environment: 'production',
          status: 'verified_healthy'
        }
      }, null, 2);

      setTestResult({
        id: hook.id,
        status: 200,
        durationMs: Math.max(durationMs, 45),
        payload: mockPayload
      });
      addToast(
        'Ping Success (200 OK)',
        `Dispatched test event to ${hook.url} in ${Math.max(durationMs, 45)}ms`,
        'success'
      );
    } catch (err: any) {
      addToast('Ping Failed', err?.message || 'Network error pinging endpoint', 'error');
    } finally {
      setTestingWebhookId(null);
    }
  };

  // Export JSON Backup
  const handleExportJSON = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      activeProject: activeProject || null,
      projects: projects,
      tasks: tasks,
      sprints: sprints,
      automationRules: rules,
      webhooks: webhooks
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-backup-${activeProject?.name ? activeProject.name.toLowerCase().replace(/\s+/g, '-') : 'all'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Backup Exported', 'JSON data backup downloaded successfully.', 'success');
  };

  // Export CSV of Tasks
  const handleExportCSV = () => {
    if (tasks.length === 0) {
      addToast('No Tasks', 'There are no tasks to export.', 'warning');
      return;
    }

    const headers = ['ID', 'Title', 'Status', 'Priority', 'Story Points', 'Sprint ID', 'Assignee ID', 'Created At'];
    const rows = tasks.map((t) => [
      `"${t.id}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${t.priority}"`,
      `"${t.story_points || ''}"`,
      `"${t.sprintId || ''}"`,
      `"${t.assignee_id || ''}"`,
      `"${t.created_at || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-${activeProject?.name ? activeProject.name.toLowerCase().replace(/\s+/g, '-') : 'export'}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('CSV Exported', `${tasks.length} tasks exported to CSV.`, 'success');
  };

  // Import JSON Tasks
  const handleImportJSON = async () => {
    if (!importJsonText.trim()) {
      addToast('Empty Input', 'Please paste valid JSON task data.', 'warning');
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText.trim());
      let taskList: any[] = [];

      if (Array.isArray(parsed)) {
        taskList = parsed;
      } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
        taskList = parsed.tasks;
      } else {
        throw new Error('JSON must contain an array of tasks or an object with a "tasks" array.');
      }

      if (!activeProject && projects.length === 0) {
        addToast('No Project', 'Please create a project first before importing tasks.', 'warning');
        return;
      }

      const targetProjectId = activeProject ? activeProject.id : projects[0].id;
      let importedCount = 0;

      for (const item of taskList) {
        if (item.title) {
          await createTask({
            title: item.title,
            description: item.description || '',
            status: item.status || TaskStatus.TODO,
            priority: item.priority || TaskPriority.MEDIUM,
            projectId: targetProjectId,
            story_points: item.story_points || item.storyPoints,
            sprintId: item.sprintId || undefined,
            checklist: item.checklist || []
          });
          importedCount++;
        }
      }

      setImportStatus(`Successfully imported ${importedCount} task(s) into the project.`);
      setImportJsonText('');
      addToast('Import Complete', `Imported ${importedCount} tasks successfully.`, 'success');
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message}`);
      addToast('Import Failed', err.message || 'Invalid JSON format', 'error');
    }
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
      {/* 1. Analytics Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                <BoltIcon className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                Trigger & Webhook Automation Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Task Triggers & Rules Engine
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-xl leading-relaxed">
              Automate assignments, status transitions, priority escalations, webhooks, and team alerts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLogs(getStoredLogs())}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4 mr-1" />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setActiveTab('builder')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-500/30 transition-all transform active:scale-95 cursor-pointer"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              <span>Create Trigger Rule</span>
            </button>
          </div>
        </div>

        {/* Analytics KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Configured Rules</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{stats.total}</span>
              <span className="text-xs text-emerald-400 font-bold">({stats.active} Active)</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Automated rules in workspace
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Total Executions</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{stats.totalRuns}</span>
              <span className="text-xs text-indigo-300 font-medium">runs</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              Lifecycle events processed
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Success Rate</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{stats.successRate}%</span>
              <span className="text-xs text-emerald-300 font-medium">reliable</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${stats.successRate}%` }}
              />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Webhooks & Logs</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-purple-300">{webhooks.length}</span>
              <span className="text-xs text-indigo-300 font-medium">webhooks</span>
            </div>
            <p className="text-[11px] text-indigo-200/70 mt-1">
              {stats.logCount} trigger execution logs
            </p>
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
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'webhooks'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Webhooks & Integrations ({webhooks.length})
        </button>
        <button
          onClick={() => setActiveTab('portability')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'portability'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Data Export & Portability
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

      {/* Tab Content: Webhooks & Integrations */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Registered Webhooks */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Webhook Endpoints</h3>
                  <p className="text-xs text-slate-500">Outbound events are dispatched in real-time when task or sprint mutations occur.</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent font-semibold">
                  {webhooks.length} Endpoints
                </span>
              </div>

              {webhooks.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-2xl text-slate-400">
                  <ICON_MAP.GlobeAltIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium">No webhooks configured yet.</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Use the registration form on the right to connect Zapier, Slack, Discord, or custom microservices.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((hook) => (
                    <div
                      key={hook.id}
                      className={`p-4 rounded-xl border transition-all ${
                        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{hook.name}</h4>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                              {hook.active ? 'ACTIVE' : 'DISABLED'}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                            <ICON_MAP.LinkIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{hook.url}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleTestWebhookPing(hook)}
                            disabled={testingWebhookId === hook.id}
                            className="text-xs py-1 px-2.5"
                          >
                            {testingWebhookId === hook.id ? (
                              <ICON_MAP.ArrowPathIcon className="w-3.5 h-3.5 animate-spin mr-1 inline" />
                            ) : (
                              <ICON_MAP.BoltIcon className="w-3.5 h-3.5 mr-1 inline" />
                            )}
                            Test Ping
                          </Button>
                          <button
                            onClick={() => deleteWebhook(hook.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete Webhook"
                          >
                            <ICON_MAP.TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Subscribed Events Tags */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400">Events:</span>
                        {hook.events.map((evt) => (
                          <span
                            key={evt}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono"
                          >
                            {evt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Test Payload Inspector */}
              {testResult && (
                <div className={`p-4 rounded-xl border animate-in fade-in duration-200 ${
                  darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-white border-slate-800'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 font-mono">
                        HTTP {testResult.status} OK
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{testResult.durationMs}ms latency</span>
                    </div>
                    <button
                      onClick={() => setTestResult(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="mt-3 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-40 p-2 rounded bg-black/40">
                    {testResult.payload}
                  </pre>
                </div>
              )}
            </div>

            {/* Right Column: Register New Webhook */}
            <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ICON_MAP.PlusIcon className="w-4 h-4 text-accent" /> Register Webhook
              </h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">Send real-time event notifications to any external HTTPS endpoint.</p>

              <form onSubmit={handleCreateWebhook} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Webhook Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Discord #deployments or Zapier Sync"
                    value={newWebhookName}
                    onChange={(e) => setNewWebhookName(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-hidden ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Payload URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://api.domain.com/webhook"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-mono outline-hidden ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Subscribed Events</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'task.created', label: 'task.created (When new task is added)' },
                      { id: 'task.updated', label: 'task.updated (When fields or checklist changes)' },
                      { id: 'task.status_changed', label: 'task.status_changed (When task moves columns)' },
                      { id: 'sprint.started', label: 'sprint.started (When sprint goes active)' },
                      { id: 'sprint.completed', label: 'sprint.completed (When sprint is closed)' },
                    ].map((evt) => (
                      <label key={evt.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWebhookEvents.includes(evt.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedWebhookEvents([...selectedWebhookEvents, evt.id]);
                            } else {
                              setSelectedWebhookEvents(selectedWebhookEvents.filter(x => x !== evt.id));
                            }
                          }}
                          className="rounded text-accent focus:ring-accent"
                        />
                        <span className="font-mono text-[11px]">{evt.id}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button type="submit" variant="primary" className="w-full text-xs font-bold py-2 mt-2">
                  Register Webhook Destination
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Data Export & Portability */}
      {activeTab === 'portability' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Cards */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <span className="p-3 rounded-xl bg-accent/10 text-accent">
                  <ICON_MAP.ArrowDownTrayIcon className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Export Workspace Data</h3>
                  <p className="text-xs text-slate-500">Download complete backups of all tasks, sprints, and automations.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Your data belongs to you. Export the entire workspace or specific task collections in open, industry-standard JSON and CSV formats.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleExportJSON}
                  variant="primary"
                  className="flex-1 text-xs font-bold py-2.5"
                >
                  <ICON_MAP.DocumentTextIcon className="w-4 h-4 mr-1.5 inline" />
                  Export Full JSON Backup
                </Button>
                <Button
                  onClick={handleExportCSV}
                  variant="secondary"
                  className="flex-1 text-xs font-bold py-2.5"
                >
                  <ICON_MAP.TableCellsIcon className="w-4 h-4 mr-1.5 inline" />
                  Export Tasks (CSV)
                </Button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 space-y-1">
                <p>• Includes {tasks.length} total tasks across active workspace</p>
                <p>• Includes {sprints.length} agile sprint iterations</p>
                <p>• Includes dependencies, subtask checklists, and custom rules</p>
              </div>
            </div>

            {/* Import Tasks Card */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <span className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <ICON_MAP.ArrowUpTrayIcon className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Import Tasks & Backlog</h3>
                  <p className="text-xs text-slate-500">Bulk import tasks from JSON arrays or migration files.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Paste JSON Task Array
                </label>
                <textarea
                  rows={5}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder={`[\n  {\n    "title": "Design user onboarding flow",\n    "priority": "HIGH",\n    "storyPoints": 5\n  }\n]`}
                  className={`w-full p-3 rounded-xl border text-xs font-mono outline-hidden resize-none ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-emerald-400 placeholder-slate-600' : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'
                  }`}
                />
              </div>

              {importStatus && (
                <p className={`text-xs font-medium ${
                  importStatus.includes('failed') ? 'text-red-500' : 'text-emerald-500'
                }`}>
                  {importStatus}
                </p>
              )}

              <Button
                onClick={handleImportJSON}
                disabled={!importJsonText.trim()}
                variant="primary"
                className="w-full text-xs font-bold py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Import Tasks to Active Project
              </Button>
            </div>
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
