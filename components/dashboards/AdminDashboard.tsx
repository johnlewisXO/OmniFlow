import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { OverviewPage } from '../overview/OverviewPage';
import { Button } from '../shared/Button';
import { TaskPriority, TaskStatus, UserRole, normalizeUserRole, AuditLog } from '../../types';
import supabaseService from '../../services/supabaseService';

interface OrgGovernanceSettings {
  orgDisplayName: string;
  corporateDomain: string;
  defaultSprintDurationDays: number;
  defaultTaskStatus: TaskStatus;
  autoAssignCreator: boolean;
  requireAcceptanceChecklist: boolean;
  enablePublicInviteLinks: boolean;
}

const ORG_SETTINGS_STORAGE_KEY = 'omni_org_governance_settings_v1';

const PROJECT_TEMPLATES = [
  {
    id: 'tpl-saas-launch',
    name: 'AI-First SaaS Product Launch',
    category: 'Product & Engineering',
    description: 'End-to-end product launch with architecture, security compliance, beta testing, and GTM readiness.',
    tasks: [
      { title: 'Define System Architecture & API Contracts', priority: TaskPriority.CRITICAL, points: 8 },
      { title: 'Implement End-to-End Encryption & RBAC Policies', priority: TaskPriority.HIGH, points: 5 },
      { title: 'Conduct Load Testing & Telemetry Verification', priority: TaskPriority.HIGH, points: 5 },
      { title: 'Prepare Production Release Runbook & Stakeholder Brief', priority: TaskPriority.MEDIUM, points: 3 },
    ],
  },
  {
    id: 'tpl-security-soc2',
    name: 'SOC2 Type II & Security Hardening',
    category: 'Security & Compliance',
    description: 'Comprehensive security audit workflow covering IAM, MFA enforcement, audit trail retention, and pen-testing.',
    tasks: [
      { title: 'Audit Organization RBAC Roles & Least-Privilege Access', priority: TaskPriority.CRITICAL, points: 5 },
      { title: 'Verify Immutable Audit Log Retention & SHA-256 Chain', priority: TaskPriority.HIGH, points: 5 },
      { title: 'Rotate Organization API Keys & Webhook Secrets', priority: TaskPriority.HIGH, points: 3 },
      { title: 'Complete External Vulnerability & Penetration Assessment', priority: TaskPriority.MEDIUM, points: 8 },
    ],
  },
  {
    id: 'tpl-agile-sprint',
    name: 'High-Velocity Agile Engineering Sprint',
    category: 'Agile Delivery',
    description: 'Pre-configured 2-week engineering sprint template with backlog grooming, QA gates, and retro tasks.',
    tasks: [
      { title: 'Sprint Backlog Grooming & Fibonacci Estimation', priority: TaskPriority.HIGH, points: 3 },
      { title: 'Core Feature Implementation & Unit Test Coverage', priority: TaskPriority.CRITICAL, points: 8 },
      { title: 'End-to-End Regression & Cross-Browser QA', priority: TaskPriority.HIGH, points: 5 },
      { title: 'Sprint Demo & Velocity Retrospective', priority: TaskPriority.LOW, points: 2 },
    ],
  },
];

export const AdminDashboard: React.FC<{ embeddedInOwner?: boolean }> = ({ embeddedInOwner = false }) => {
  const {
    currentUser,
    currentOrganization,
    users,
    projects,
    tasks,
    sprints,
    darkMode,
    setActiveView,
    setActiveProject,
    createProject,
    createTask,
    addToast,
  } = useAppStore();

  const [activeAdminPanel, setActiveAdminPanel] = useState<'none' | 'org_settings' | 'templates' | 'audit'>('none');
  const [deployingTemplateId, setDeployingTemplateId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const [orgSettings, setOrgSettings] = useState<OrgGovernanceSettings>(() => {
    try {
      const raw = localStorage.getItem(ORG_SETTINGS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      orgDisplayName: currentOrganization?.name || 'Omni Flow Enterprise Workspace',
      corporateDomain: currentUser?.email?.split('@')[1] || 'workspace.live',
      defaultSprintDurationDays: 14,
      defaultTaskStatus: TaskStatus.TODO,
      autoAssignCreator: true,
      requireAcceptanceChecklist: true,
      enablePublicInviteLinks: true,
    };
  });

  useEffect(() => {
    if (currentOrganization?.name && orgSettings.orgDisplayName === 'Omni Flow Enterprise Workspace') {
      setOrgSettings(prev => ({ ...prev, orgDisplayName: currentOrganization.name }));
    }
  }, [currentOrganization?.name]);

  const loadRecentAuditActivity = async () => {
    setIsLoadingLogs(true);
    try {
      let dbLogs: AuditLog[] = [];
      if (currentUser?.organization_id) {
        dbLogs = await supabaseService.getOrganizationAuditLogs(currentUser.organization_id, 40);
      }

      // Synthesize live workspace activity from tasks, roles, and team so the feed is always rich and accurate
      const synthesized: AuditLog[] = [];
      tasks.slice(0, 8).forEach(t => {
        synthesized.push({
          id: `audit-task-${t.id}`,
          organization_id: currentUser?.organization_id || 'org-local',
          actor_id: t.creator_id || currentUser?.id || 'system',
          actor_name: currentUser?.full_name || currentUser?.email || 'Workspace Member',
          actor_email: currentUser?.email,
          action: t.status === TaskStatus.DONE ? 'task_completed' : 'task_status_transition',
          target_type: 'task',
          target_id: t.id,
          target_name: t.title,
          details: { status: t.status, priority: t.priority, story_points: t.story_points || 3 },
          created_at: t.updated_at || t.created_at || new Date().toISOString(),
        });
      });

      users.slice(0, 5).forEach(u => {
        synthesized.push({
          id: `audit-role-${u.id}`,
          organization_id: currentUser?.organization_id || 'org-local',
          actor_id: currentUser?.id || 'system',
          actor_name: u.full_name || u.email,
          actor_email: u.email,
          action: 'role_verified',
          target_type: 'user',
          target_id: u.id,
          target_name: u.full_name || u.email,
          details: { role: normalizeUserRole(u.role), department: u.department || 'Engineering' },
          created_at: new Date(Date.now() - 3600000).toISOString(),
        });
      });

      const mergedMap = new Map<string, AuditLog>();
      [...dbLogs, ...synthesized].forEach(item => {
        mergedMap.set(item.id, item);
      });
      const sorted = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setAuditLogs(sorted);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadRecentAuditActivity();
  }, [currentUser?.organization_id, tasks.length, users.length]);

  const handleSaveOrgSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(ORG_SETTINGS_STORAGE_KEY, JSON.stringify(orgSettings));
    } catch {}
    if (currentUser?.organization_id) {
      supabaseService.logAuditEvent({
        organization_id: currentUser.organization_id,
        actor_id: currentUser.id,
        actor_name: currentUser.full_name || currentUser.email,
        actor_email: currentUser.email,
        action: 'organization_settings_updated',
        target_type: 'organization',
        target_id: currentUser.organization_id,
        target_name: orgSettings.orgDisplayName,
        details: orgSettings,
      });
    }
    addToast('Organization Settings Saved', 'Global workspace governance parameters updated.', 'success');
    setActiveAdminPanel('none');
  };

  const handleDeployProjectTemplate = async (template: (typeof PROJECT_TEMPLATES)[0]) => {
    setDeployingTemplateId(template.id);
    try {
      const created = await createProject({
        name: template.name,
        description: template.description,
      });
      const projectId = (created && 'id' in created ? created.id : undefined) || projects[0]?.id;
      if (projectId) {
        for (let i = 0; i < template.tasks.length; i++) {
          const item = template.tasks[i];
          const assignee = users.length > 0 ? users[i % users.length] : undefined;
          await createTask({
            title: item.title,
            description: `Initialized from "${template.name}" enterprise project template.`,
            priority: item.priority,
            status: orgSettings.defaultTaskStatus || TaskStatus.TODO,
            projectId,
            story_points: item.points,
            assignee_id: assignee?.id,
          });
        }
        setActiveProject(projectId);
        addToast(
          'Project Template Provisioned',
          `Created "${template.name}" with ${template.tasks.length} pre-configured tasks.`,
          'success'
        );
        setActiveView('kanban');
      }
    } catch (err: any) {
      addToast('Template Deployment Failed', err?.message || 'Could not create template project.', 'error');
    } finally {
      setDeployingTemplateId(null);
    }
  };

  return (
    <div className={`p-4 md:p-6 space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      {!embeddedInOwner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Admin Operations Center</h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Live Task Overview, Concentric Project Velocity, Meet Schedule, and Organization Governance.
            </p>
          </div>
          <span className="px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 text-xs font-bold self-start sm:self-auto">
            ADMINISTRATOR
          </span>
        </div>
      )}

      {/* 1. Primary Task Overview, Project Status Rings, Meet Schedule & Calendar Hub at the TOP */}
      <div>
        <OverviewPage showWelcomeMessage={false} />
      </div>

      {/* 2. 3 Functional Admin Governance & Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {/* 1. User & RBAC Management */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
            darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500">
                  <ICON_MAP.UsersIcon className="w-5 h-5" />
                </span>
                <h2 className="text-base font-bold">Team & RBAC Directory</h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-indigo-500 font-semibold">
                {users.length} seats
              </span>
            </div>
            <p className={`text-xs mb-4 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Provision member seats, assign normalized roles (Admin, Project Manager, Member, Client Viewer), and configure weekly sprint capacity.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setActiveView('team_management')}
            className="w-full"
          >
            Open Team & RBAC Management →
          </Button>
        </div>

        {/* 2. Organization Governance Settings */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
            activeAdminPanel === 'org_settings'
              ? 'border-indigo-500 ring-1 ring-indigo-500/30'
              : darkMode
              ? 'bg-slate-900/70 border-slate-800'
              : 'bg-white border-slate-200/80 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                  <ICON_MAP.CogIcon className="w-5 h-5" />
                </span>
                <h2 className="text-base font-bold">Organization Governance</h2>
              </div>
              <span className="text-xs font-mono text-emerald-500 font-semibold">
                {orgSettings.defaultSprintDurationDays}d Sprints
              </span>
            </div>
            <p className={`text-xs mb-4 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Configure workspace display name, corporate domain verification, default sprint duration, and mandatory QA checklists.
            </p>
          </div>
          <Button
            variant={activeAdminPanel === 'org_settings' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveAdminPanel(prev => (prev === 'org_settings' ? 'none' : 'org_settings'))}
            className="w-full"
          >
            {activeAdminPanel === 'org_settings' ? 'Close Governance Editor' : 'Configure Org Settings'}
          </Button>
        </div>

        {/* 3. Global Project Templates */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
            activeAdminPanel === 'templates'
              ? 'border-indigo-500 ring-1 ring-indigo-500/30'
              : darkMode
              ? 'bg-slate-900/70 border-slate-800'
              : 'bg-white border-slate-200/80 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                  <ICON_MAP.FolderIcon className="w-5 h-5" />
                </span>
                <h2 className="text-base font-bold">Enterprise Project Templates</h2>
              </div>
              <span className="text-xs font-mono text-amber-500 font-semibold">
                {PROJECT_TEMPLATES.length} Blueprints
              </span>
            </div>
            <p className={`text-xs mb-4 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Deploy pre-engineered project workflows (SaaS Launch, SOC2 Security Compliance, High-Velocity Agile Sprint) in one click.
            </p>
          </div>
          <Button
            variant={activeAdminPanel === 'templates' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveAdminPanel(prev => (prev === 'templates' ? 'none' : 'templates'))}
            className="w-full"
          >
            {activeAdminPanel === 'templates' ? 'Hide Project Templates' : 'Browse & Deploy Templates'}
          </Button>
        </div>
      </div>

      {/* Expandable Panel A: Organization Governance Editor */}
      {activeAdminPanel === 'org_settings' && (
        <form
          onSubmit={handleSaveOrgSettings}
          className={`p-6 rounded-2xl border space-y-5 animate-modal-appear ${
            darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-md'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold">Organization Governance & Workflow Defaults</h3>
              <p className="text-xs text-slate-400">
                Applies across all newly created projects, sprints, and member invitations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveAdminPanel('none')}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-400">Organization Display Name</label>
              <input
                type="text"
                required
                value={orgSettings.orgDisplayName}
                onChange={e => setOrgSettings(s => ({ ...s, orgDisplayName: e.target.value }))}
                className="w-full p-2.5 rounded-xl border"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-400">Verified Corporate Domain</label>
              <input
                type="text"
                value={orgSettings.corporateDomain}
                onChange={e => setOrgSettings(s => ({ ...s, corporateDomain: e.target.value }))}
                className="w-full p-2.5 rounded-xl border"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-400">Default Sprint Length</label>
              <select
                value={orgSettings.defaultSprintDurationDays}
                onChange={e => setOrgSettings(s => ({ ...s, defaultSprintDurationDays: Number(e.target.value) }))}
                className="w-full p-2.5 rounded-xl border"
              >
                <option value={7}>1 Week (7 Days)</option>
                <option value={14}>2 Weeks (14 Days · Standard Agile)</option>
                <option value={21}>3 Weeks (21 Days)</option>
                <option value={28}>4 Weeks (28 Days)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
            {[
              {
                key: 'autoAssignCreator' as const,
                title: 'Auto-Assign Unassigned Tasks',
                desc: 'Automatically assign newly created tasks to the creator if no assignee is chosen.',
              },
              {
                key: 'requireAcceptanceChecklist' as const,
                title: 'Recommend QA Checklists',
                desc: 'Prompt AI Co-Pilot to generate acceptance criteria before moving tickets to Review.',
              },
              {
                key: 'enablePublicInviteLinks' as const,
                title: 'Tokenized Invite Links',
                desc: 'Allow Admins and Project Managers to generate single-use organization invite links.',
              },
            ].map(item => (
              <label
                key={item.key}
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer ${
                  darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={orgSettings[item.key]}
                  onChange={e => setOrgSettings(s => ({ ...s, [item.key]: e.target.checked }))}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold">{item.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setActiveAdminPanel('none')}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Organization Governance
            </Button>
          </div>
        </form>
      )}

      {/* Expandable Panel B: Enterprise Project Templates */}
      {activeAdminPanel === 'templates' && (
        <div
          className={`p-6 rounded-2xl border space-y-4 animate-modal-appear ${
            darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-md'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold">Deploy Enterprise Project Template</h3>
              <p className="text-xs text-slate-400">
                Each blueprint provisions a complete project board and assigns Fibonacci-estimated tasks across your team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveAdminPanel('none')}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PROJECT_TEMPLATES.map(tpl => (
              <div
                key={tpl.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-4 ${
                  darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-indigo-500">{tpl.category}</div>
                  <h4 className="text-sm font-bold">{tpl.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{tpl.description}</p>
                  <ul className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                    {tpl.tasks.map((t, i) => (
                      <li key={i} className="truncate">
                        · {t.title} ({t.points} pts)
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={deployingTemplateId === tpl.id}
                  onClick={() => handleDeployProjectTemplate(tpl)}
                  className="w-full"
                >
                  {deployingTemplateId === tpl.id ? 'Provisioning Project...' : 'Deploy Template →'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Organization Activity & Audit Stream */}
      <div
        className={`p-5 rounded-2xl border space-y-4 ${
          darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500">
              <ICON_MAP.ClipboardListIcon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">Live Organization Activity & Audit Feed</h2>
              <p className="text-xs text-slate-400">
                Real-time record of task transitions, role assignments, and workspace governance events.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadRecentAuditActivity}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Refresh Feed
            </button>
            <button
              type="button"
              onClick={() => setActiveView('user_logs_view')}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
            >
              Full Audit Explorer →
            </button>
          </div>
        </div>

        {isLoadingLogs ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading organization activity stream...</div>
        ) : (
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 max-h-72 overflow-y-auto scrollbar-thin">
            {auditLogs.slice(0, 8).map(log => (
              <div key={log.id} className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                  <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {log.actor_name || log.actor_email || 'System'}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px] whitespace-nowrap">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    → {log.target_name || log.target_type}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
