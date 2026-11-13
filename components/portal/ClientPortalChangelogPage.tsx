import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import {
  ClientFeatureRequest,
  ReleaseChangelogEntry,
  TaskPriority,
  TaskStatus,
} from '../../types';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { HairlineCard, PageHeader, SegmentedTabs } from '../shared/EditorialUI';

const PORTAL_STORAGE_KEY = 'omni_client_portal_requests_v1';
const CHANGELOG_STORAGE_KEY = 'omni_release_changelog_v1';

const INITIAL_REQUESTS: ClientFeatureRequest[] = [
  {
    id: 'req-1',
    title: 'Bi-Directional Jira & GitHub Issue PR Sync',
    description:
      'Automatically transition task status to Review when a linked GitHub Pull Request is opened, and close when merged to main.',
    category: 'integration',
    status: 'in_progress',
    votes: 48,
    voterIds: ['u-1', 'u-2'],
    requesterName: 'Hannah Abbott',
    requesterOrg: 'Stripe Enterprise Ops',
    impactScore: 'critical',
    commentsCount: 14,
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'req-2',
    title: 'Custom SLA Escalation PagerDuty & Slack Webhooks',
    description:
      'Allow enterprise teams to configure custom response-time SLAs on Triage queue items with automatic webhook alerts.',
    category: 'feature',
    status: 'planned',
    votes: 37,
    voterIds: ['u-3'],
    requesterName: 'Marcus Vance',
    requesterOrg: 'Vercel Cloud Partner',
    impactScore: 'high',
    commentsCount: 9,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'req-3',
    title: 'Interactive Gantt Critical-Path PDF & Executive Deck Export',
    description:
      'One-click export of multi-project Gantt timelines with dependency chains for quarterly board meetings.',
    category: 'ux',
    status: 'under_review',
    votes: 29,
    voterIds: [],
    requesterName: 'Sophia Lin',
    requesterOrg: 'Linear Migration Cohort',
    impactScore: 'high',
    commentsCount: 6,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'req-4',
    title: 'FigJam-Style Collaborative Whiteboard in Live Video Calls',
    description:
      'Co-draw architecture diagrams and sticky notes with live cursors directly inside active team video calls.',
    category: 'feature',
    status: 'shipped',
    votes: 64,
    voterIds: ['u-1', 'u-2', 'u-3'],
    requesterName: 'Alex Rivera',
    requesterOrg: 'Internal Core Team',
    impactScore: 'critical',
    commentsCount: 21,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];

const INITIAL_CHANGELOGS: ReleaseChangelogEntry[] = [
  {
    id: 'rel-2.6.0',
    version: 'v2.6.0',
    title: 'Gantt Critical Path Engine, Async Video Clips & Split-Screen Multitasking',
    summary:
      'Our biggest spatial workspace update yet: schedule complex dependencies on the interactive Gantt timeline, record Loom-style screen + camera updates, and multitask side-by-side.',
    releaseDate: new Date().toISOString().split('T')[0],
    authorName: 'Alex Rivera',
    published: true,
    features: [
      'Interactive Gantt Timeline & Dependency Roadmap with drag-to-reschedule bars and Critical Path highlighting.',
      'Async Screen & Camera Clips Studio with timestamped comment pins and 1-click task extraction.',
      'Split-Screen Dual-Pane Workspace & Persistent Ambient Voice Huddle Bar.',
    ],
    improvements: [
      'Authoritative Supabase Storage + Peer-to-Peer late-joiner state handshake for Whiteboard Studio.',
      'Visual Node-Graph Canvas inside Workflow Automations with live dry-run latency telemetry.',
    ],
    fixes: [
      'Resolved high-DPI canvas pan/zoom coordinate offset when nested inside Video Call split stage.',
    ],
    linkedTaskIds: [],
  },
  {
    id: 'rel-2.5.0',
    version: 'v2.5.0',
    title: 'FigJam Collaborative Whiteboard, OKR Rollups & Triage Queue',
    summary:
      'Brought visual brainstorming, strategic OKR progress tracking, and structured bug/feature intake into a unified workspace.',
    releaseDate: new Date(Date.now() - 86400000 * 9).toISOString().split('T')[0],
    authorName: 'Elena Rostova',
    published: true,
    features: [
      'Infinite Collaborative Whiteboard with tactile dock, stamp wheel, and live cursor chat.',
      'Project Docs & Spec Wiki with 1-click text selection to Kanban task conversion.',
    ],
    improvements: [
      'Reorderable Sidebar with collapsible groups, pinned favorites, and real-time pulse badges.',
    ],
    fixes: ['Fixed CSV/XLS export encoding for multi-project cycle time reports.'],
    linkedTaskIds: [],
  },
];

export const ClientPortalChangelogPage: React.FC = () => {
  const { currentUser, tasks, activeProject, projects, createTask, addToast, openViewTaskModal } =
    useAppStore();

  const [activeTab, setActiveTab] = useState<'voting' | 'roadmap_columns' | 'changelog'>('voting');
  const [isPublicPreview, setIsPublicPreview] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [requests, setRequests] = useState<ClientFeatureRequest[]>(() => {
    try {
      const raw = localStorage.getItem(PORTAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_REQUESTS;
  });

  const [changelogs, setChangelogs] = useState<ReleaseChangelogEntry[]>(() => {
    try {
      const raw = localStorage.getItem(CHANGELOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_CHANGELOGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify(requests));
    } catch {}
  }, [requests]);

  useEffect(() => {
    try {
      localStorage.setItem(CHANGELOG_STORAGE_KEY, JSON.stringify(changelogs));
    } catch {}
  }, [changelogs]);

  // New Feature Request Modal state
  const [newReqTitle, setNewReqTitle] = useState('');
  const [newReqDesc, setNewReqDesc] = useState('');
  const [newReqOrg, setNewReqOrg] = useState('');
  const [newReqCategory, setNewReqCategory] =
    useState<ClientFeatureRequest['category']>('feature');
  const [newReqImpact, setNewReqImpact] =
    useState<ClientFeatureRequest['impactScore']>('high');

  const filteredRequests = useMemo(() => {
    return [...requests]
      .filter(r => (statusFilter === 'all' ? true : r.status === statusFilter))
      .sort((a, b) => b.votes - a.votes);
  }, [requests, statusFilter]);

  const handleToggleVote = (reqId: string) => {
    const uid = currentUser?.id || 'guest-voter';
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;
        const hasVoted = r.voterIds.includes(uid);
        return {
          ...r,
          votes: hasVoted ? r.votes - 1 : r.votes + 1,
          voterIds: hasVoted ? r.voterIds.filter(id => id !== uid) : [...r.voterIds, uid],
        };
      })
    );
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReqTitle.trim()) return;
    const item: ClientFeatureRequest = {
      id: `req-${Date.now()}`,
      title: newReqTitle.trim(),
      description:
        newReqDesc.trim() ||
        'Submitted via External Stakeholder Portal for product roadmap prioritization.',
      category: newReqCategory,
      status: 'under_review',
      votes: 1,
      voterIds: [currentUser?.id || 'me'],
      requesterName: currentUser?.name || 'External Partner',
      requesterOrg: newReqOrg.trim() || 'Enterprise Customer',
      impactScore: newReqImpact,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
    };
    setRequests(prev => [item, ...prev]);
    setNewReqTitle('');
    setNewReqDesc('');
    setNewReqOrg('');
    addToast('Feature Request Submitted', `"${item.title}" is now live for voting`, 'success');
  };

  const handlePromoteToTask = async (req: ClientFeatureRequest) => {
    const targetProjectId = activeProject?.id || projects[0]?.id || 'default-project';
    try {
      const created = await createTask({
        title: `[Customer Portal] ${req.title}`,
        description: `${req.description}\n\nRequested by: ${req.requesterName} (${req.requesterOrg}) • ${req.votes} Votes`,
        priority: req.impactScore === 'critical' ? TaskPriority.CRITICAL : TaskPriority.HIGH,
        status: TaskStatus.TODO,
        projectId: targetProjectId,
      });
      setRequests(prev =>
        prev.map(r =>
          r.id === req.id
            ? { ...r, status: 'planned', linkedTaskId: (created as any)?.id || 'linked' }
            : r
        )
      );
      addToast('Promoted to Engineering Task', `"${req.title}" added to Kanban Board`, 'success');
    } catch {
      addToast('Error', 'Could not promote request to task', 'error');
    }
  };

  const handleAutoGenerateChangelogFromDoneTasks = () => {
    const doneTasks = tasks.filter(t => t.status === TaskStatus.DONE).slice(0, 6);
    const nextPatch = changelogs.length + 5;
    const version = `v2.${nextPatch}.0`;

    const features =
      doneTasks.length > 0
        ? doneTasks.map(t => `${t.title} (${t.priority} Priority)`)
        : [
            'Shipped real-time stakeholder portal sync & automated sprint release notes.',
            'Enhanced multi-project Gantt timeline critical path solver.',
          ];

    const newEntry: ReleaseChangelogEntry = {
      id: `rel-${Date.now()}`,
      version,
      title: `${activeProject?.name || 'Workspace'} Sprint Release ${version}`,
      summary: `Automated release notes compiled from ${doneTasks.length || 2} completed engineering tasks and stakeholder roadmap items.`,
      releaseDate: new Date().toISOString().split('T')[0],
      authorName: currentUser?.full_name || currentUser?.email || 'Release Bot',
      published: true,
      features,
      improvements: [
        'Reduced initial bundle load and optimized real-time presence channel multiplexing.',
      ],
      fixes: ['Resolved edge-case timezone formatting in exported sprint velocity reports.'],
      linkedTaskIds: doneTasks.map(t => t.id),
    };

    setChangelogs(prev => [newEntry, ...prev]);
    setActiveTab('changelog');
    addToast(
      `Published Release ${version}`,
      `Compiled ${features.length} completed tasks into public changelog`,
      'success'
    );
  };

  const statusBadgeStyle = (st: ClientFeatureRequest['status']) => {
    switch (st) {
      case 'shipped':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'in_progress':
        return 'bg-[var(--accent-lime)]/25 text-[#4E6126] dark:text-[#CCF048] border-[#97B832]/40';
      case 'planned':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      default:
        return 'bg-[var(--bg-sage)] text-[var(--text-secondary)] border-[var(--border-hairline)]';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto w-full">
      <PageHeader
        eyebrow={isPublicPreview ? 'External Stakeholder View' : 'Internal PM Console'}
        title="Client Portal, Feature Voting & Changelog"
        subtitle="Collect external roadmap votes, promote high-impact requests, and publish release notes."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <SegmentedTabs
              size="sm"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { id: 'voting', label: 'Feature Voting' },
                { id: 'roadmap_columns', label: 'Public Roadmap' },
                { id: 'changelog', label: 'Release Notes', count: changelogs.length },
              ]}
            />
            <Button
              variant={isPublicPreview ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIsPublicPreview(v => !v)}
            >
              {isPublicPreview ? 'Viewing as Client' : 'Stakeholder Preview'}
            </Button>
            {!isPublicPreview && (
              <Button variant="lime" size="sm" onClick={handleAutoGenerateChangelogFromDoneTasks}>
                <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
                <span>Auto-Compile Notes</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Main Content Area */}
      <div className="flex-1">
        {activeTab === 'voting' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 4 cols: Submit Customer Feature Request */}
            <div className="lg:col-span-4">
              <HairlineCard padding="md" className="sticky top-2">
                <form onSubmit={handleSubmitRequest} className="space-y-3">
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    Submit Feature Request
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Customers and stakeholders can propose and upvote roadmap capabilities.
                  </p>

                  <input
                    type="text"
                    value={newReqTitle}
                    onChange={e => setNewReqTitle(e.target.value)}
                    placeholder="Feature title (e.g., SSO SAML 2.0 Enforcement)..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)]"
                  />
                  <input
                    type="text"
                    value={newReqOrg}
                    onChange={e => setNewReqOrg(e.target.value)}
                    placeholder="Customer / Organization Name..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newReqCategory}
                      onChange={e => setNewReqCategory(e.target.value as any)}
                      className="px-2.5 py-2 text-xs rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] outline-none cursor-pointer"
                    >
                      <option value="feature">Core Feature</option>
                      <option value="integration">Integration</option>
                      <option value="performance">Performance</option>
                      <option value="ux">UI / UX</option>
                    </select>
                    <select
                      value={newReqImpact}
                      onChange={e => setNewReqImpact(e.target.value as any)}
                      className="px-2.5 py-2 text-xs rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] outline-none cursor-pointer"
                    >
                      <option value="high">High Impact</option>
                      <option value="critical">Critical Blocker</option>
                      <option value="medium">Nice to Have</option>
                    </select>
                  </div>
                  <textarea
                    value={newReqDesc}
                    onChange={e => setNewReqDesc(e.target.value)}
                    rows={3}
                    placeholder="Describe the workflow problem and business impact..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)]"
                  />
                  <Button type="submit" variant="lime" size="sm" className="w-full">
                    + Submit to Voting Board
                  </Button>
                </form>
              </HairlineCard>
            </div>

            {/* Right 8 cols: Ranked Feature Voting Feed */}
            <div className="lg:col-span-8 space-y-3">
              <div className="flex items-center justify-between">
                <SegmentedTabs
                  size="sm"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { id: 'all', label: 'All' },
                    { id: 'under_review', label: 'Under Review' },
                    { id: 'planned', label: 'Planned' },
                    { id: 'in_progress', label: 'In Progress' },
                    { id: 'shipped', label: 'Shipped' },
                  ]}
                />
              </div>

              {filteredRequests.map(req => {
                const hasVoted = req.voterIds.includes(currentUser?.id || 'guest-voter');
                return (
                  <HairlineCard
                    key={req.id}
                    padding="md"
                    className="flex items-start gap-4 hover:border-[var(--border-strong)] transition-colors"
                  >
                    {/* Upvote Counter Button */}
                    <button
                      onClick={() => handleToggleVote(req.id)}
                      className={`w-14 h-16 rounded-xl border flex flex-col items-center justify-center shrink-0 transition cursor-pointer ${
                        hasVoted
                          ? 'bg-[var(--accent-lime)]/25 border-[#97B832] text-[#4E6126] dark:text-[#CCF048] font-bold'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <span className="text-xs">▲</span>
                      <span className="text-sm font-mono font-bold tabular-nums">{req.votes}</span>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${statusBadgeStyle(
                            req.status
                          )}`}
                        >
                          {req.status.replace('_', ' ')}
                        </span>
                        <span className="font-semibold uppercase text-[var(--text-muted)]">
                          {req.category}
                        </span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <span className="text-[var(--text-muted)]">
                          {req.requesterOrg} · {req.requesterName}
                        </span>
                      </div>

                      <h3 className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                        {req.title}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                        {req.description}
                      </p>

                      {!isPublicPreview && (
                        <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-[var(--border-hairline)]">
                          <div className="flex items-center gap-2">
                            <select
                              value={req.status}
                              onChange={e => {
                                const val = e.target.value as ClientFeatureRequest['status'];
                                setRequests(prev =>
                                  prev.map(r => (r.id === req.id ? { ...r, status: val } : r))
                                );
                              }}
                              className="px-2.5 py-1 text-[11px] rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] outline-none cursor-pointer"
                            >
                              <option value="under_review">Under Review</option>
                              <option value="planned">Planned</option>
                              <option value="in_progress">In Progress</option>
                              <option value="shipped">Shipped</option>
                            </select>
                          </div>

                          <Button
                            variant={req.linkedTaskId ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => handlePromoteToTask(req)}
                          >
                            {req.linkedTaskId ? 'Linked to Task' : 'Promote to Engineering Task'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </HairlineCard>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'roadmap_columns' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(
              [
                { id: 'under_review', label: 'Under Review' },
                { id: 'planned', label: 'Planned' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'shipped', label: 'Shipped' },
              ] as const
            ).map(col => {
              const items = requests.filter(r => r.status === col.id);
              return (
                <HairlineCard key={col.id} padding="sm" className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-1 py-1.5 border-b border-[var(--border-hairline)]">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{col.label}</span>
                    <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                      {items.length}
                    </span>
                  </div>
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                        <span>{item.requesterOrg}</span>
                        <span className="font-mono font-bold text-[#4E6126] dark:text-[#CCF048]">
                          ▲ {item.votes}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </HairlineCard>
              );
            })}
          </div>
        )}

        {activeTab === 'changelog' && (
          <div className="max-w-4xl mx-auto space-y-5">
            {changelogs.map(entry => (
              <HairlineCard key={entry.id} padding="lg" className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-full bg-[#191B17] dark:bg-[#CCF048] text-white dark:text-[#131511] text-xs font-mono font-bold">
                      {entry.version}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">{entry.releaseDate}</span>
                    <span className="text-xs text-[var(--text-secondary)]">by {entry.authorName}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Published Release
                  </span>
                </div>

                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    {entry.title}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                    {entry.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-[var(--bg-sage)] border border-[var(--border-hairline)] space-y-1.5">
                    <div className="text-xs font-bold text-[#4E6126] dark:text-[#CCF048]">
                      New Features
                    </div>
                    <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
                      {entry.features.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 space-y-1.5">
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Improvements
                    </div>
                    <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
                      {entry.improvements.map((imp, i) => (
                        <li key={i}>{imp}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/20 space-y-1.5">
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Bug Fixes
                    </div>
                    <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
                      {entry.fixes.map((fix, i) => (
                        <li key={i}>{fix}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </HairlineCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientPortalChangelogPage;
