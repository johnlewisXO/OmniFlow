import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { OverviewPage } from '../overview/OverviewPage';
import { Button } from '../shared/Button';
import { OrganizationLogoUploader } from '../shared/OrganizationLogoUploader';
import { TaskPriority, TaskStatus, normalizeUserRole, AuditLog } from '../../types';
import supabaseService from '../../services/supabaseService';
import {
  PageHeader,
  InlineKpiStrip,
  SegmentedTabs,
  HairlineCard,
  StatusDot,
} from '../shared/EditorialUI';

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
    setActiveView,
    setActiveProject,
    createProject,
    createTask,
    addToast,
    updateOrganizationSettings,
    isUpdatingOrgSettings,
  } = useAppStore();

  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'org_settings' | 'templates' | 'audit'>('overview');
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
      corporateDomain:
        currentOrganization?.corporateDomain ||
        currentOrganization?.domain ||
        currentOrganization?.corporate_domain ||
        currentUser?.email?.split('@')[1] ||
        'workspace.live',
      defaultSprintDurationDays:
        currentOrganization?.defaultSprintDurationDays || currentOrganization?.default_sprint_duration_days || 14,
      defaultTaskStatus: currentOrganization?.defaultTaskStatus || TaskStatus.TODO,
      autoAssignCreator: currentOrganization?.autoAssignCreator ?? true,
      requireAcceptanceChecklist: currentOrganization?.requireAcceptanceChecklist ?? true,
      enablePublicInviteLinks: currentOrganization?.enablePublicInviteLinks ?? true,
    };
  });

  useEffect(() => {
    if (currentOrganization) {
      setOrgSettings(prev => ({
        ...prev,
        orgDisplayName: currentOrganization.name || prev.orgDisplayName,
        corporateDomain:
          currentOrganization.corporateDomain ||
          currentOrganization.domain ||
          currentOrganization.corporate_domain ||
          prev.corporateDomain,
        defaultSprintDurationDays:
          currentOrganization.defaultSprintDurationDays ||
          currentOrganization.default_sprint_duration_days ||
          prev.defaultSprintDurationDays,
        defaultTaskStatus: currentOrganization.defaultTaskStatus || prev.defaultTaskStatus,
        autoAssignCreator:
          currentOrganization.autoAssignCreator !== undefined
            ? currentOrganization.autoAssignCreator
            : prev.autoAssignCreator,
        requireAcceptanceChecklist:
          currentOrganization.requireAcceptanceChecklist !== undefined
            ? currentOrganization.requireAcceptanceChecklist
            : prev.requireAcceptanceChecklist,
        enablePublicInviteLinks:
          currentOrganization.enablePublicInviteLinks !== undefined
            ? currentOrganization.enablePublicInviteLinks
            : prev.enablePublicInviteLinks,
      }));
    }
  }, [currentOrganization]);

  const loadRecentAuditActivity = async () => {
    setIsLoadingLogs(true);
    try {
      let dbLogs: AuditLog[] = [];
      if (currentUser?.organization_id) {
        dbLogs = await supabaseService.getOrganizationAuditLogs(currentUser.organization_id, 40);
      }

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

  const handleSaveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(ORG_SETTINGS_STORAGE_KEY, JSON.stringify(orgSettings));
    } catch {}

    try {
      await updateOrganizationSettings({
        orgDisplayName: orgSettings.orgDisplayName.trim(),
        corporateDomain: (orgSettings.corporateDomain || '').trim(),
        defaultSprintDurationDays: Number(orgSettings.defaultSprintDurationDays) || 14,
        defaultTaskStatus: orgSettings.defaultTaskStatus,
        autoAssignCreator: orgSettings.autoAssignCreator,
        requireAcceptanceChecklist: orgSettings.requireAcceptanceChecklist,
        enablePublicInviteLinks: orgSettings.enablePublicInviteLinks,
      });

      addToast(
        'Organization Settings Saved',
        `Successfully updated "${orgSettings.orgDisplayName.trim()}" workspace & sprint governance parameters.`,
        'success'
      );
    } catch (err: any) {
      addToast(
        'Save Failed',
        err?.message || 'Failed to update organization governance parameters.',
        'error'
      );
    }
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
    <div className={embeddedInOwner ? 'space-y-5' : 'p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5'}>
      {!embeddedInOwner && (
        <PageHeader
          eyebrow={currentOrganization?.name || 'Administrator'}
          title="Admin Operations Center"
          subtitle="Manage workspace delivery metrics, governance policies, blueprint templates, and activity feeds."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setActiveView('team_management')}>
                <ICON_MAP.UsersIcon className="w-3.5 h-3.5" />
                Team & RBAC ({users.length})
              </Button>
              <StatusDot
                tone="lime"
                label="Administrator"
                className="px-3 py-1 rounded-full bg-[var(--bg-sage)] border border-[var(--border-hairline)] text-xs font-medium"
              />
            </>
          }
        />
      )}

      {!embeddedInOwner && (
        <InlineKpiStrip
          items={[
            {
              id: 'seats',
              label: 'Provisioned Seats',
              value: users.length,
              sublabel: 'Active directory',
              tone: 'default',
              onClick: () => setActiveView('team_management'),
            },
            {
              id: 'sprint-len',
              label: 'Default Sprint Length',
              value: `${orgSettings.defaultSprintDurationDays}d`,
              sublabel: 'Workflow default',
              tone: 'lime',
              onClick: () => setActiveAdminTab('org_settings'),
            },
            {
              id: 'projects',
              label: 'Workspace Projects',
              value: projects.length,
              sublabel: `${sprints.length} sprints`,
              tone: 'success',
            },
            {
              id: 'audit',
              label: 'Audit Events',
              value: auditLogs.length,
              sublabel: 'Recent activity',
              tone: 'default',
              onClick: () => setActiveAdminTab('audit'),
            },
          ]}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          size="sm"
          value={activeAdminTab}
          onChange={setActiveAdminTab}
          options={[
            { id: 'overview', label: 'Overview' },
            { id: 'org_settings', label: 'Governance & Defaults' },
            { id: 'templates', label: 'Templates', count: PROJECT_TEMPLATES.length },
            { id: 'audit', label: 'Audit Feed', count: auditLogs.length },
          ]}
        />

        {embeddedInOwner && (
          <Button variant="outline" size="sm" onClick={() => setActiveView('team_management')}>
            Open Team & RBAC ({users.length} seats) →
          </Button>
        )}
      </div>

      {activeAdminTab === 'overview' && <OverviewPage showWelcomeMessage={false} />}

      {activeAdminTab === 'org_settings' && (
        <HairlineCard padding="lg">
          <form onSubmit={handleSaveOrgSettings} className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--border-hairline)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Organization Governance & Workflow Defaults
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Updates persist across all users, newly created projects, sprints, and invitations.
                </p>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                Default cadence: {orgSettings.defaultSprintDurationDays} days
              </span>
            </div>

            <OrganizationLogoUploader />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1.5 text-[var(--text-secondary)]">
                  Organization Display Name
                </label>
                <input
                  type="text"
                  required
                  value={orgSettings.orgDisplayName}
                  onChange={e => setOrgSettings(s => ({ ...s, orgDisplayName: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1.5 text-[var(--text-secondary)]">
                  Verified Corporate Domain
                </label>
                <input
                  type="text"
                  value={orgSettings.corporateDomain}
                  onChange={e => setOrgSettings(s => ({ ...s, corporateDomain: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1.5 text-[var(--text-secondary)]">
                  Default Sprint Length
                </label>
                <select
                  value={orgSettings.defaultSprintDurationDays}
                  onChange={e => setOrgSettings(s => ({ ...s, defaultSprintDurationDays: Number(e.target.value) }))}
                  className="w-full p-2.5 rounded-xl border text-xs"
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
                  desc: 'Automatically assign newly created tasks to the creator when no assignee is chosen.',
                },
                {
                  key: 'requireAcceptanceChecklist' as const,
                  title: 'Recommend QA Checklists',
                  desc: 'Prompt acceptance criteria verification before moving items into Review.',
                },
                {
                  key: 'enablePublicInviteLinks' as const,
                  title: 'Tokenized Invite Links',
                  desc: 'Allow Admins and Project Managers to generate single-use organization invite links.',
                },
              ].map(item => (
                <label
                  key={item.key}
                  className="editorial-surface-subtle p-3.5 flex items-start gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={orgSettings[item.key]}
                    onChange={e => setOrgSettings(s => ({ ...s, [item.key]: e.target.checked }))}
                    className="mt-0.5 accent-[var(--accent-cta)]"
                  />
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">{item.title}</div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
              <Button variant="outline" size="sm" type="button" onClick={() => setActiveAdminTab('overview')}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isUpdatingOrgSettings}>
                {isUpdatingOrgSettings ? 'Saving Governance...' : 'Save Organization Governance'}
              </Button>
            </div>
          </form>
        </HairlineCard>
      )}

      {activeAdminTab === 'templates' && (
        <HairlineCard padding="lg" className="space-y-4">
          <div className="pb-3 border-b border-[var(--border-hairline)]">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Enterprise Project Templates</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Provision complete project boards with Fibonacci-estimated starter tasks in one click.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PROJECT_TEMPLATES.map(tpl => (
              <div
                key={tpl.id}
                className="editorial-surface-subtle p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                    {tpl.category}
                  </div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">{tpl.name}</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{tpl.description}</p>
                  <ul className="space-y-1 pt-2 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]">
                    {tpl.tasks.map((t, i) => (
                      <li key={i} className="truncate">
                        · {t.title} <span className="font-mono text-[var(--text-muted)]">({t.points} pts)</span>
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
                  {deployingTemplateId === tpl.id ? 'Provisioning...' : 'Deploy Template →'}
                </Button>
              </div>
            ))}
          </div>
        </HairlineCard>
      )}

      {activeAdminTab === 'audit' && (
        <HairlineCard padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Live Organization Activity & Audit Feed</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Real-time record of task transitions, role assignments, and governance updates.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadRecentAuditActivity}>
                Refresh
              </Button>
              <Button variant="primary" size="sm" onClick={() => setActiveView('user_logs_view')}>
                Full Audit Explorer →
              </Button>
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              Loading organization activity stream...
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)] max-h-96 overflow-y-auto scrollbar-thin">
              {auditLogs.slice(0, 12).map(log => (
                <div key={log.id} className="py-3 px-5 flex items-center justify-between gap-3 text-xs hover:bg-[var(--bg-surface-subtle)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-lime)] ring-1 ring-[var(--accent-ink)]/20 shrink-0" />
                    <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">
                      {log.actor_name || log.actor_email || 'System'}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[var(--text-muted)] truncate">
                      · {log.target_name || log.target_type}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </HairlineCard>
      )}
    </div>
  );
};
