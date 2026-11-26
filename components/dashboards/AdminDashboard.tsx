import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Button, IconButton } from '../shared/Button';
import { OrganizationLogoUploader } from '../shared/OrganizationLogoUploader';
import { TaskStatus, normalizeUserRole, normalizeTaskStatus, AuditLog } from '../../types';
import { PROJECT_TEMPLATES, ProjectTemplate } from '../../utils/projectTemplates';
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

  const [activeAdminTab, setActiveAdminTab] = useState<'org_settings' | 'templates' | 'audit'>('org_settings');
  const [deployingTemplateId, setDeployingTemplateId] = useState<string | null>(null);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('all');
  const [customTemplateNames, setCustomTemplateNames] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditCategory, setAuditCategory] = useState<'all' | 'task' | 'user' | 'governance'>('all');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const buildSettingsFromOrg = (): OrgGovernanceSettings => ({
    orgDisplayName: currentOrganization?.name || 'Omni Flow Enterprise Workspace',
    corporateDomain:
      currentOrganization?.corporateDomain ||
      currentOrganization?.domain ||
      currentOrganization?.corporate_domain ||
      currentUser?.email?.split('@')[1] ||
      'workspace.live',
    defaultSprintDurationDays:
      currentOrganization?.defaultSprintDurationDays || currentOrganization?.default_sprint_duration_days || 14,
    defaultTaskStatus: normalizeTaskStatus(currentOrganization?.defaultTaskStatus || TaskStatus.TODO),
    autoAssignCreator: currentOrganization?.autoAssignCreator ?? true,
    requireAcceptanceChecklist: currentOrganization?.requireAcceptanceChecklist ?? true,
    enablePublicInviteLinks: currentOrganization?.enablePublicInviteLinks ?? true,
  });

  const [orgSettings, setOrgSettings] = useState<OrgGovernanceSettings>(() => {
    try {
      const raw = localStorage.getItem(ORG_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          defaultTaskStatus: normalizeTaskStatus(parsed?.defaultTaskStatus),
        };
      }
    } catch {}
    return buildSettingsFromOrg();
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
        defaultTaskStatus: normalizeTaskStatus(currentOrganization.defaultTaskStatus || prev.defaultTaskStatus),
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
        dbLogs = await supabaseService.getOrganizationAuditLogs(currentUser.organization_id, 50);
      }

      const synthesized: AuditLog[] = [];
      tasks.slice(0, 10).forEach(t => {
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

      users.slice(0, 6).forEach(u => {
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

  const handleResetOrgSettings = () => {
    const restored = buildSettingsFromOrg();
    setOrgSettings(restored);
    addToast('Changes Reset', 'Governance fields restored to saved workspace settings.', 'info');
  };

  const handleSaveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedStatus = normalizeTaskStatus(orgSettings.defaultTaskStatus);
    const nextSettings = { ...orgSettings, defaultTaskStatus: normalizedStatus };
    setOrgSettings(nextSettings);

    try {
      localStorage.setItem(ORG_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    } catch {}

    try {
      await updateOrganizationSettings({
        orgDisplayName: nextSettings.orgDisplayName.trim(),
        corporateDomain: (nextSettings.corporateDomain || '').trim(),
        defaultSprintDurationDays: Number(nextSettings.defaultSprintDurationDays) || 14,
        defaultTaskStatus: normalizedStatus,
        autoAssignCreator: nextSettings.autoAssignCreator,
        requireAcceptanceChecklist: nextSettings.requireAcceptanceChecklist,
        enablePublicInviteLinks: nextSettings.enablePublicInviteLinks,
      });

      addToast(
        'Governance Settings Saved',
        `Updated "${nextSettings.orgDisplayName.trim()}" workflow defaults and security rules.`,
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

  const handleDeployProjectTemplate = async (template: ProjectTemplate) => {
    setDeployingTemplateId(template.id);
    const chosenName = (customTemplateNames[template.id] || '').trim() || template.name;
    const defaultStatus = normalizeTaskStatus(orgSettings.defaultTaskStatus || TaskStatus.TODO);

    try {
      const created = await createProject({
        name: chosenName,
        description: template.description,
      });
      const projectId = (created && 'id' in created ? created.id : undefined) || projects[0]?.id;
      if (!projectId) {
        throw new Error('Could not resolve newly created project ID.');
      }

      for (let i = 0; i < template.tasks.length; i++) {
        const item = template.tasks[i];
        const assignee = users.length > 0 ? users[i % users.length] : undefined;
        await createTask({
          title: item.title,
          description: item.description || `Initialized from "${template.name}" project template.`,
          priority: item.priority,
          status: normalizeTaskStatus(item.status || defaultStatus),
          projectId,
          story_points: item.points,
          assignee_id: assignee?.id,
          checklist: (item.checklist || []).map(title => ({
            id: crypto.randomUUID(),
            title,
            completed: false,
            created_at: new Date().toISOString(),
          })),
        });
      }

      setActiveProject(projectId);
      addToast(
        'Template Provisioned',
        `Created "${chosenName}" with ${template.tasks.length} pre-configured tasks.`,
        'success'
      );
      setActiveView('kanban');
    } catch (err: any) {
      addToast('Template Deployment Failed', err?.message || 'Could not create template project.', 'error');
    } finally {
      setDeployingTemplateId(null);
    }
  };

  const templateCategories = useMemo(() => {
    const cats = Array.from(new Set(PROJECT_TEMPLATES.map(t => t.category)));
    return ['all', ...cats];
  }, []);

  const filteredTemplates = useMemo(() => {
    if (templateCategoryFilter === 'all') return PROJECT_TEMPLATES;
    return PROJECT_TEMPLATES.filter(t => t.category === templateCategoryFilter);
  }, [templateCategoryFilter]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditCategory === 'task' && log.target_type !== 'task' && !log.action.includes('task')) {
        return false;
      }
      if (auditCategory === 'user' && log.target_type !== 'user' && !log.action.includes('role') && !log.action.includes('invite')) {
        return false;
      }
      if (
        auditCategory === 'governance' &&
        log.target_type !== 'organization' &&
        !log.action.includes('governance') &&
        !log.action.includes('security') &&
        !log.action.includes('org')
      ) {
        return false;
      }
      if (auditQuery.trim()) {
        const q = auditQuery.toLowerCase();
        return (
          (log.actor_name && log.actor_name.toLowerCase().includes(q)) ||
          (log.actor_email && log.actor_email.toLowerCase().includes(q)) ||
          log.action.toLowerCase().includes(q) ||
          (log.target_name && log.target_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [auditLogs, auditCategory, auditQuery]);

  const handleExportAuditCsv = () => {
    const rows = [
      ['Timestamp', 'Actor', 'Action', 'Target Type', 'Target Name', 'Details'],
      ...filteredAuditLogs.map(log => [
        new Date(log.created_at).toISOString(),
        log.actor_name || log.actor_email || 'System',
        log.action,
        log.target_type,
        log.target_name || log.target_id || '',
        JSON.stringify(log.details || {}),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Audit CSV Exported', `Exported ${filteredAuditLogs.length} audit events.`, 'success');
  };

  return (
    <div className={embeddedInOwner ? 'space-y-5' : 'p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5'}>
      {!embeddedInOwner && (
        <PageHeader
          eyebrow={currentOrganization?.name || 'Administrator'}
          title="Workspace Admin"
          subtitle="Manage workspace defaults, project templates, and team activity."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setActiveView('team_management')}>
                <ICON_MAP.UsersIcon className="w-3.5 h-3.5" />
                Team &amp; Roles ({users.length})
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
              label: 'Team Seats',
              value: users.length,
              sublabel: 'Active members',
              tone: 'default',
              onClick: () => setActiveView('team_management'),
            },
            {
              id: 'sprint-len',
              label: 'Default Sprint Length',
              value: `${orgSettings.defaultSprintDurationDays}d`,
              sublabel: 'Workspace default',
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
              label: 'Activity Events',
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
            { id: 'org_settings', label: 'Settings & Defaults', icon: <ICON_MAP.ShieldCheckIcon className="w-3.5 h-3.5" /> },
            { id: 'templates', label: 'Templates', count: PROJECT_TEMPLATES.length, icon: <ICON_MAP.FolderPlusIcon className="w-3.5 h-3.5" /> },
            { id: 'audit', label: 'Activity Log', count: auditLogs.length, icon: <ICON_MAP.AuditShieldListIcon className="w-3.5 h-3.5" /> },
          ]}
        />

        {embeddedInOwner && (
          <Button variant="outline" size="sm" onClick={() => setActiveView('team_management')}>
            Manage Team &amp; Roles ({users.length} seats) →
          </Button>
        )}
      </div>

      {activeAdminTab === 'org_settings' && (
        <HairlineCard padding="lg">
          <form onSubmit={handleSaveOrgSettings} className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--border-hairline)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Workspace Settings &amp; Defaults
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Set your workspace name, default sprint length, and helpful workflow defaults.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
                <span>{orgSettings.defaultSprintDurationDays}d sprint</span>
                <span>·</span>
                <span className="uppercase">{orgSettings.defaultTaskStatus.replace('_', ' ')} default</span>
              </div>
            </div>

            <OrganizationLogoUploader />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
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
                  <option value={14}>2 Weeks (14 Days · Standard)</option>
                  <option value={21}>3 Weeks (21 Days)</option>
                  <option value={28}>4 Weeks (28 Days)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1.5 text-[var(--text-secondary)]">
                  Default New Task Status
                </label>
                <select
                  value={orgSettings.defaultTaskStatus}
                  onChange={e =>
                    setOrgSettings(s => ({ ...s, defaultTaskStatus: normalizeTaskStatus(e.target.value) }))
                  }
                  className="w-full p-2.5 rounded-xl border text-xs"
                >
                  <option value={TaskStatus.TODO}>To Do</option>
                  <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                  <option value={TaskStatus.REVIEW}>In Review</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
              {[
                {
                  key: 'autoAssignCreator' as const,
                  title: 'Auto-Assign Unassigned Tasks',
                  desc: 'Assign new tasks to the creator when no owner is selected.',
                },
                {
                  key: 'requireAcceptanceChecklist' as const,
                  title: 'Recommend QA Checklists',
                  desc: 'Prompt checklist review before transitioning work to Review.',
                },
                {
                  key: 'enablePublicInviteLinks' as const,
                  title: 'Tokenized Invite Links',
                  desc: 'Allow Admins and PMs to generate single-use invite links.',
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
              <Button variant="outline" size="sm" type="button" onClick={handleResetOrgSettings}>
                Reset
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isUpdatingOrgSettings}>
                {isUpdatingOrgSettings ? 'Saving Settings...' : 'Save Workspace Settings'}
              </Button>
            </div>
          </form>
        </HairlineCard>
      )}

      {activeAdminTab === 'templates' && (
        <HairlineCard padding="lg" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Project Templates</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Start a ready-to-use project board with tasks and checklists in one click.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {templateCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTemplateCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                    templateCategoryFilter === cat
                      ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] shadow-xs'
                      : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                  }`}
                >
                  {cat === 'all' ? 'All Templates' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map(tpl => {
              const totalPoints = tpl.tasks.reduce((sum, t) => sum + t.points, 0);
              return (
                <div
                  key={tpl.id}
                  className="editorial-surface-subtle p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                      <span className="uppercase tracking-wider">{tpl.category}</span>
                      <span className="tabular-nums">
                        {tpl.tasks.length} tasks · {totalPoints} pts · ~{tpl.estimatedDays}d
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">{tpl.name}</h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{tpl.description}</p>
                    <ul className="space-y-1 pt-2 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]">
                      {tpl.tasks.map((t, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span className="truncate">· {t.title}</span>
                          <span className="font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                            {t.points} pts
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
                    <input
                      type="text"
                      value={customTemplateNames[tpl.id] ?? ''}
                      onChange={e =>
                        setCustomTemplateNames(prev => ({ ...prev, [tpl.id]: e.target.value }))
                      }
                      placeholder={`Project name (defaults to "${tpl.name}")`}
                      className="w-full px-3 py-1.5 rounded-xl border text-xs"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={deployingTemplateId === tpl.id}
                      onClick={() => handleDeployProjectTemplate(tpl)}
                      className="w-full"
                    >
                      {deployingTemplateId === tpl.id ? 'Provisioning Board...' : 'Deploy Template →'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </HairlineCard>
      )}

      {activeAdminTab === 'audit' && (
        <HairlineCard padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Workspace Activity & Audit Feed</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Live record of task transitions, role updates, and governance changes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportAuditCsv}>
                <ICON_MAP.ArrowDownTrayIcon className="w-3.5 h-3.5" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={loadRecentAuditActivity}>
                <ICON_MAP.ArrowPathIcon className="w-3.5 h-3.5" />
                Refresh
              </Button>
              <Button variant="primary" size="sm" onClick={() => setActiveView('user_logs_view')}>
                Full Explorer →
              </Button>
            </div>
          </div>

          <div className="px-5 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SegmentedTabs
              size="sm"
              value={auditCategory}
              onChange={setAuditCategory}
              options={[
                { id: 'all', label: 'All' },
                { id: 'task', label: 'Tasks' },
                { id: 'user', label: 'Users & Roles' },
                { id: 'governance', label: 'Governance' },
              ]}
            />
            <div className="relative sm:w-64">
              <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={auditQuery}
                onChange={e => setAuditQuery(e.target.value)}
                placeholder="Filter actor, action, target..."
                className="w-full search-input !pl-9 !pr-7 !py-1.5 text-xs rounded-full"
              />
              {auditQuery && (
                <IconButton
                  variant="ghost"
                  size="xs"
                  onClick={() => setAuditQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label="Clear filter"
                >
                  <ICON_MAP.XMarkIcon className="w-3 h-3" />
                </IconButton>
              )}
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              Loading organization activity stream...
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              No audit events match the active filter.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)] max-h-[420px] overflow-y-auto scrollbar-thin">
              {filteredAuditLogs.slice(0, 25).map(log => {
                const isExpanded = expandedAuditId === log.id;
                return (
                  <div key={log.id} className="hover:bg-[var(--bg-surface-subtle)] transition-colors">
                    <button
                      type="button"
                      onClick={() => setExpandedAuditId(isExpanded ? null : log.id)}
                      className="w-full py-3 px-5 flex items-center justify-between gap-3 text-xs text-left cursor-pointer"
                    >
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
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <ICON_MAP.ChevronDownIcon
                          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-3 pl-10">
                        <pre className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto">
                          {JSON.stringify(
                            {
                              id: log.id,
                              actor_email: log.actor_email || 'system',
                              target_type: log.target_type,
                              target_id: log.target_id,
                              details: log.details || {},
                              created_at: log.created_at,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </HairlineCard>
      )}
    </div>
  );
};
