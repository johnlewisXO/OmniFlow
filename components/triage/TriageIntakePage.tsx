import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { TriageIntakeItem, TaskPriority, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { HairlineCard, PageHeader, SegmentedTabs } from '../shared/EditorialUI';
import soundService from '../../services/soundService';

const TRIAGE_STORAGE_KEY = 'omni_flow_triage_intake_v1';

const DEFAULT_TRIAGE_ITEMS: TriageIntakeItem[] = [
  {
    id: 'triage-1',
    title: 'Safari iOS: Kanban drag-and-drop touch ghost offsets when zoomed in',
    description: 'Customer reported that dragging a card on iPad Safari while pinch-zoomed shifts the drag preview by 40px.',
    category: 'bug',
    severity: TaskPriority.HIGH,
    reporterName: 'Elena Rostova (Enterprise Customer)',
    reporterEmail: 'elena@acme-corp.io',
    environment: 'iPadOS 18.1 · Safari Mobile',
    stepsToReproduce: '1. Open Kanban Board on iPad\n2. Pinch-zoom 125%\n3. Long-press and drag a task card across columns',
    status: 'pending_triage',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'triage-2',
    title: 'Add CSV & JSON Export for Sprint Burndown Velocity Reports',
    description: 'Finance and PMO leads requested a 1-click CSV export of completed story points per sprint for quarterly audits.',
    category: 'feature_request',
    severity: TaskPriority.MEDIUM,
    reporterName: 'Marcus Vance (VP Operations)',
    reporterEmail: 'mvance@globaltech.com',
    environment: 'Web Desktop · Reports Module',
    status: 'pending_triage',
    createdAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
  },
  {
    id: 'triage-3',
    title: 'Webhook signature HMAC header validation timeout on slow endpoints',
    description: 'External webhook receivers taking longer than 4.5s should be retried asynchronously without blocking the UI thread.',
    category: 'performance',
    severity: TaskPriority.CRITICAL,
    reporterName: 'DevSecOps Monitor',
    reporterEmail: 'secops@omniflow.internal',
    environment: 'Production EU-West · Webhook Worker',
    status: 'pending_triage',
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
];

export const TriageIntakePage: React.FC = () => {
  const {
    darkMode,
    projects,
    activeProject,
    setActiveProject,
    users,
    currentUser,
    createTask,
    openViewTaskModal,
    addToast,
  } = useAppStore();

  const [items, setItems] = useState<TriageIntakeItem[]>(() => {
    try {
      const raw = localStorage.getItem(TRIAGE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_TRIAGE_ITEMS;
  });

  const [activeTab, setActiveTab] = useState<'queue' | 'intake_form'>('queue');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending_triage' | 'accepted' | 'declined'>('pending_triage');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject?.id || projects[0]?.id || '');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(currentUser?.id || '');
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Intake Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<TriageIntakeItem['category']>('bug');
  const [formSeverity, setFormSeverity] = useState<TaskPriority>(TaskPriority.HIGH);
  const [formDescription, setFormDescription] = useState('');
  const [formEnvironment, setFormEnvironment] = useState('Production Web · Chrome 130');
  const [formSteps, setFormSteps] = useState('');

  useEffect(() => {
    if (activeProject?.id && !selectedProjectId) {
      setSelectedProjectId(activeProject.id);
    } else if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [activeProject?.id, projects, selectedProjectId]);

  const saveItems = (updated: TriageIntakeItem[]) => {
    setItems(updated);
    try {
      localStorage.setItem(TRIAGE_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => (filterStatus === 'all' ? true : item.status === filterStatus));
  }, [items, filterStatus]);

  const pendingCount = useMemo(
    () => items.filter(i => i.status === 'pending_triage').length,
    [items]
  );

  const handleSubmitIntakeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    const newItem: TriageIntakeItem = {
      id: `triage-${Date.now()}`,
      title: formTitle.trim(),
      description: formDescription.trim() || 'Submitted via Workspace Intake Portal.',
      category: formCategory,
      severity: formSeverity,
      reporterName: currentUser?.full_name || currentUser?.email || 'External Reporter',
      reporterEmail: currentUser?.email || 'intake@omniflow.app',
      environment: formEnvironment.trim(),
      stepsToReproduce: formSteps.trim() || undefined,
      status: 'pending_triage',
      createdAt: new Date().toISOString(),
    };
    saveItems([newItem, ...items]);
    setFormTitle('');
    setFormDescription('');
    setFormSteps('');
    setActiveTab('queue');
    setFilterStatus('pending_triage');
    soundService.play('task_create');
    addToast('Intake Request Submitted', `"${newItem.title}" is now in the Triage Queue.`, 'success');
  };

  const handlePromoteToSprintBoard = async (item: TriageIntakeItem) => {
    const targetProj =
      projects.find(p => p.id === (selectedProjectId || activeProject?.id)) ||
      activeProject ||
      projects[0];

    if (!targetProj) {
      addToast('Select a Project First', 'Create or select a project to route triage items into a board.', 'warning');
      return;
    }

    setPromotingId(item.id);
    try {
      if (!activeProject || activeProject.id !== targetProj.id) {
        setActiveProject(targetProj);
      }

      const fullDesc = [
        `### Triage Intake Report (${item.category.replace(/_/g, ' ').toUpperCase()})`,
        `**Reporter:** ${item.reporterName} (${item.reporterEmail})`,
        item.environment ? `**Environment:** ${item.environment}` : '',
        '',
        item.description,
        item.stepsToReproduce ? `\n**Steps to Reproduce:**\n${item.stepsToReproduce}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const created = await createTask({
        title: item.title,
        description: fullDesc,
        projectId: targetProj.id,
        status: TaskStatus.TODO,
        priority: item.severity,
        assignee_id: selectedAssigneeId || currentUser?.id,
        tags: ['triage-accepted', item.category],
      });

      if (created && created.id) {
        const updated = items.map(i =>
          i.id === item.id ? { ...i, status: 'accepted' as const, promotedTaskId: created.id } : i
        );
        saveItems(updated);
        addToast(
          'Accepted into Project Board',
          `"${item.title}" was routed to ${targetProj.name}.`,
          'success',
          { entity_type: 'task', entity_id: created.id }
        );
      }
    } catch (err) {
      console.error('Failed to promote triage item:', err);
    } finally {
      setPromotingId(null);
    }
  };

  const handleDeclineItem = (id: string) => {
    const updated = items.map(i => (i.id === id ? { ...i, status: 'declined' as const } : i));
    saveItems(updated);
    soundService.play('click_soft');
    addToast('Triage Item Declined', 'Marked intake submission as declined.', 'info');
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto w-full">
      <PageHeader
        eyebrow="Customer & Engineering Intake"
        title="Triage Queue & Bug / Feature Intake"
        subtitle="Inspect incoming bug reports and feature requests before accepting them into active sprint boards."
        actions={
          <SegmentedTabs
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { id: 'queue', label: 'Triage Queue', count: pendingCount },
              { id: 'intake_form', label: '+ Submit Intake Form' },
            ]}
          />
        }
      />

      {activeTab === 'intake_form' ? (
        <HairlineCard padding="lg" className="max-w-3xl mx-auto w-full">
          <form onSubmit={handleSubmitIntakeForm} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Submit Structured Bug / Feature Intake Report
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                New submissions enter the Triage Queue for engineering and product review before sprint assignment.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Summary / Issue Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g., SSO SAML login redirect loops on custom subdomain"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-xs outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Request Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as TriageIntakeItem['category'])}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-xs outline-none cursor-pointer"
                  >
                    <option value="bug">Bug Report</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="customer_escalation">Customer Escalation</option>
                    <option value="performance">Performance Issue</option>
                    <option value="security">Security Advisory</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Severity / Priority
                  </label>
                  <select
                    value={formSeverity}
                    onChange={e => setFormSeverity(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-xs outline-none cursor-pointer"
                  >
                    <option value={TaskPriority.CRITICAL}>Critical (P0)</option>
                    <option value={TaskPriority.HIGH}>High (P1)</option>
                    <option value={TaskPriority.MEDIUM}>Medium (P2)</option>
                    <option value={TaskPriority.LOW}>Low (P3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Environment / Device
                  </label>
                  <input
                    type="text"
                    value={formEnvironment}
                    onChange={e => setFormEnvironment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-xs outline-none focus:border-[var(--border-strong)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Detailed Description & Impact
                </label>
                <textarea
                  rows={4}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Describe expected vs. actual behavior or customer business impact..."
                  className="w-full p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-xs outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Steps to Reproduce (Optional)
                </label>
                <textarea
                  rows={3}
                  value={formSteps}
                  onChange={e => setFormSteps(e.target.value)}
                  placeholder="1. Navigate to...\n2. Click on..."
                  className="w-full p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-xs font-mono outline-none focus:border-[var(--border-strong)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('queue')}>
                Cancel
              </Button>
              <Button type="submit" variant="lime" size="sm">
                Submit to Triage Queue
              </Button>
            </div>
          </form>
        </HairlineCard>
      ) : (
        <>
          {/* Filter & Routing Target Bar */}
          <HairlineCard padding="sm" className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs
              size="sm"
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { id: 'pending_triage', label: 'Pending Triage', count: pendingCount },
                { id: 'accepted', label: 'Accepted into Board' },
                { id: 'declined', label: 'Declined' },
                { id: 'all', label: 'All Submissions' },
              ]}
            />

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[var(--text-muted)] font-medium">Route Accepted To:</span>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="px-3 py-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-semibold outline-none cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    Project: {p.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedAssigneeId}
                onChange={e => setSelectedAssigneeId(e.target.value)}
                className="px-3 py-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-semibold outline-none cursor-pointer"
              >
                <option value="">Assign Owner (Optional)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    Owner: {u.full_name || u.email}
                  </option>
                ))}
              </select>
            </div>
          </HairlineCard>

          {/* Triage Items List */}
          <div className="space-y-3">
            {filteredItems.map(item => (
              <HairlineCard
                key={item.id}
                padding="md"
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-[var(--border-strong)] transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] flex-wrap">
                    <span className="font-semibold uppercase tracking-wider text-[#4E6126] dark:text-[#CCF048]">
                      {item.category.replace(/_/g, ' ')}
                    </span>
                    <span>·</span>
                    <span
                      className={`font-semibold ${
                        item.severity === TaskPriority.CRITICAL
                          ? 'text-rose-600 dark:text-rose-400'
                          : item.severity === TaskPriority.HIGH
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {item.severity} Severity
                    </span>
                    <span>·</span>
                    <span>Reported by {item.reporterName}</span>
                    {item.environment && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[11px]">{item.environment}</span>
                      </>
                    )}
                  </div>

                  <h3 className="text-base font-bold leading-snug text-[var(--text-primary)]">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                  {item.stepsToReproduce && (
                    <pre className="mt-2 p-2.5 rounded-xl text-[11px] font-mono whitespace-pre-wrap bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)]">
                      {item.stepsToReproduce}
                    </pre>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'accepted' && item.promotedTaskId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openViewTaskModal(item.promotedTaskId!)}
                    >
                      <ICON_MAP.CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Inspect Board Task →</span>
                    </Button>
                  ) : item.status === 'declined' ? (
                    <span className="text-xs font-semibold text-[var(--text-muted)] px-3 py-1.5">
                      Declined
                    </span>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeclineItem(item.id)}
                      >
                        Decline
                      </Button>
                      <Button
                        variant="lime"
                        size="sm"
                        disabled={promotingId === item.id}
                        onClick={() => handlePromoteToSprintBoard(item)}
                      >
                        <ICON_MAP.RocketLaunchIcon className="w-4 h-4" />
                        <span>{promotingId === item.id ? 'Routing...' : 'Accept & Route to Board'}</span>
                      </Button>
                    </>
                  )}
                </div>
              </HairlineCard>
            ))}

            {filteredItems.length === 0 && (
              <HairlineCard className="text-center py-12 border-dashed">
                <ICON_MAP.CheckCircleIcon className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Triage Queue Clear</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  All incoming customer and engineering submissions have been triaged.
                </p>
              </HairlineCard>
            )}
          </div>
        </>
      )}
    </div>
  );
};
