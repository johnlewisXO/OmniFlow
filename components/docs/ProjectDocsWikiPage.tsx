import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ProjectDoc, ProjectDocSpecItem, TaskPriority, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { HairlineCard, PageHeader, SegmentedTabs } from '../shared/EditorialUI';
import soundService from '../../services/soundService';
import { WhiteboardStudioPage } from '../whiteboard/WhiteboardStudioPage';

const DOCS_STORAGE_KEY = 'omni_flow_project_docs_v1';

const DEFAULT_DOCS: ProjectDoc[] = [
  {
    id: 'doc-prd-realtime-engine',
    title: 'PRD: Real-Time Collaboration & Multi-Role Bento Architecture',
    category: 'prd',
    authorId: 'system',
    authorName: 'Architecture & PM Team',
    summary: 'Product requirements and acceptance criteria for sub-100ms presence sync, custom workspace color accents, and role-tailored bento views.',
    content: `## 1. Executive Summary
Omni Flow empowers distributed engineering and product teams to plan sprints, triage customer requests, and ship high-velocity releases without context switching.

## 2. Core User Flows & Non-Functional Targets
- **Sub-100ms Presence Broadcast**: Every task card and inspector drawer reflects active viewers, editors, and commenters in real time.
- **Role-Adaptive Dashboards**: Executive Owners, Admins, Project Managers, and Individual Contributors see prioritized KPIs at the top of their canvas.
- **Zero-Friction Spec-to-Task Execution**: Convert any specification requirement below directly into an actionable sprint ticket.`,
    specChecklist: [
      {
        id: 'spec-1',
        text: 'Implement WebSocket & BroadcastChannel fallback for instant task status transitions',
        completed: true,
        priority: TaskPriority.HIGH,
      },
      {
        id: 'spec-2',
        text: 'Add 6 curated workspace color accents with automatic session persistence',
        completed: true,
        priority: TaskPriority.MEDIUM,
      },
      {
        id: 'spec-3',
        text: 'Audit API rate-limiting headers and webhook retry backoff on task.updated events',
        completed: false,
        priority: TaskPriority.CRITICAL,
      },
      {
        id: 'spec-4',
        text: 'Design end-to-end automated regression suite for mobile & tablet 2x2 Kanban grid',
        completed: false,
        priority: TaskPriority.HIGH,
      },
    ],
    linkedTaskIds: [],
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'doc-arch-automation-pipeline',
    title: 'Architecture Spec: Event-Driven Task Automation & Trigger Engine',
    category: 'architecture',
    authorId: 'system',
    authorName: 'Lead Systems Architect',
    summary: 'Technical specification for deterministic trigger evaluation, loop-guard deduplication, and automated QA review checklists.',
    content: `## 1. Trigger Pipeline Design
Whenever \`createTask\`, \`updateTask\`, or \`moveTask\` mutates state in \`useAppStore\`, the engine evaluates all enabled \`AutomationRule\` records against the before/after task snapshot.

## 2. Loop Prevention & Idempotency
- **3-Second Cooldown Guard**: Prevents recursive rule cascades when an action mutates the same task.
- **Supabase Audit Persistence**: Every rule execution writes a structured comment into \`task_comments\` and appends an execution log entry.`,
    specChecklist: [
      {
        id: 'spec-arch-1',
        text: 'Verify QA checklist injection when tasks enter In Review status',
        completed: true,
        priority: TaskPriority.HIGH,
      },
      {
        id: 'spec-arch-2',
        text: 'Add Slack & Discord webhook payload formatter for critical priority escalations',
        completed: false,
        priority: TaskPriority.MEDIUM,
      },
      {
        id: 'spec-arch-3',
        text: 'Benchmark batch task mutation latency for 50+ concurrent selected tickets',
        completed: false,
        priority: TaskPriority.HIGH,
      },
    ],
    linkedTaskIds: [],
    updatedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: 'doc-release-notes-q4',
    title: 'Release Notes: v2.4 Sprint Velocity & Power-User System Flows',
    category: 'release_notes',
    authorId: 'system',
    authorName: 'Release Engineering',
    summary: 'Changelog covering Multi-Select Bulk Action Bar, 1-Click Undo Toast Recovery, OKR Rollups, and Live Focus Timer.',
    content: `## What's New in v2.4
- **Multi-Select Bulk Operations**: Select multiple tasks across Kanban Board or List View to batch-update status, priority, assignee, or sprint.
- **1-Click Undo Toast Recovery**: Instantly revert accidental task moves, status edits, or bulk updates straight from the notification toast.
- **Live Active-Task Focus Timer**: Track deep-work sessions in the header bar with automatic worklog recording.`,
    specChecklist: [
      {
        id: 'spec-rel-1',
        text: 'Publish customer-facing changelog and notify organization admins',
        completed: false,
        priority: TaskPriority.MEDIUM,
      },
      {
        id: 'spec-rel-2',
        text: 'Verify keyboard navigation hotkeys (J/K, 1-4 priority, S status) across browsers',
        completed: false,
        priority: TaskPriority.HIGH,
      },
    ],
    linkedTaskIds: [],
    updatedAt: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
  },
];

const CATEGORY_META: Record<ProjectDoc['category'], { label: string }> = {
  prd: { label: 'PRD / Spec' },
  architecture: { label: 'Architecture' },
  release_notes: { label: 'Release Notes' },
  post_mortem: { label: 'Post-Mortem' },
  runbook: { label: 'Runbook' },
};

export const ProjectDocsWikiPage: React.FC = () => {
  const {
    darkMode,
    projects,
    activeProject,
    setActiveProject,
    tasks,
    currentUser,
    createTask,
    openViewTaskModal,
    addToast,
  } = useAppStore();

  const [docs, setDocs] = useState<ProjectDoc[]>(() => {
    try {
      const raw = localStorage.getItem(DOCS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_DOCS;
  });

  const [selectedDocId, setSelectedDocId] = useState<string>(() => docs[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [newSpecText, setNewSpecText] = useState('');
  const [newSpecPriority, setNewSpecPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [convertingSpecId, setConvertingSpecId] = useState<string | null>(null);
  const [showEmbeddedWhiteboard, setShowEmbeddedWhiteboard] = useState<boolean>(false);
  const [targetProjectId, setTargetProjectId] = useState<string>(activeProject?.id || projects[0]?.id || '');

  useEffect(() => {
    if (activeProject?.id && !targetProjectId) {
      setTargetProjectId(activeProject.id);
    } else if (!targetProjectId && projects.length > 0) {
      setTargetProjectId(projects[0].id);
    }
  }, [activeProject?.id, projects, targetProjectId]);

  const saveDocs = (updated: ProjectDoc[]) => {
    setDocs(updated);
    try {
      localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      if (filterCategory !== 'all' && doc.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchSummary = doc.summary.toLowerCase().includes(q);
        const matchContent = doc.content.toLowerCase().includes(q);
        if (!matchTitle && !matchSummary && !matchContent) return false;
      }
      return true;
    });
  }, [docs, filterCategory, searchQuery]);

  const activeDoc = useMemo(
    () => docs.find(d => d.id === selectedDocId) || filteredDocs[0] || null,
    [docs, selectedDocId, filteredDocs]
  );

  const handleCreateNewDoc = (templateCategory: ProjectDoc['category'] = 'prd') => {
    const newDoc: ProjectDoc = {
      id: `doc-${Date.now()}`,
      title:
        templateCategory === 'prd'
          ? 'Untitled Product Requirements Spec'
          : templateCategory === 'architecture'
          ? 'Untitled Architecture RFC'
          : templateCategory === 'release_notes'
          ? 'Sprint Release Notes'
          : 'Operational Runbook & Post-Mortem',
      category: templateCategory,
      projectId: targetProjectId || activeProject?.id,
      organizationId: currentUser?.organization_id,
      authorId: currentUser?.id || 'system',
      authorName: currentUser?.full_name || currentUser?.email || 'Workspace Member',
      summary: 'Document summary, goals, and key stakeholder alignment.',
      content: `## 1. Context & Problem Statement\nDescribe the core user problem and measurable business outcomes.\n\n## 2. Proposed Architecture & UX Flow\nOutline technical components, edge cases, and rollout milestones.`,
      specChecklist: [
        {
          id: `spec-${Date.now()}-1`,
          text: 'Define acceptance criteria and ship initial prototype',
          completed: false,
          priority: TaskPriority.HIGH,
        },
      ],
      linkedTaskIds: [],
      updatedAt: new Date().toISOString(),
    };
    const next = [newDoc, ...docs];
    saveDocs(next);
    setSelectedDocId(newDoc.id);
    setIsEditingDoc(true);
    soundService.play('task_create');
    addToast('Document Created', `Created "${newDoc.title}" in Project Wiki.`, 'success');
  };

  const handleUpdateActiveDoc = (updates: Partial<ProjectDoc>) => {
    if (!activeDoc) return;
    const updated = docs.map(d =>
      d.id === activeDoc.id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
    );
    saveDocs(updated);
  };

  const handleAddSpecItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc || !newSpecText.trim()) return;
    const item: ProjectDocSpecItem = {
      id: `spec-${Date.now()}`,
      text: newSpecText.trim(),
      completed: false,
      priority: newSpecPriority,
    };
    handleUpdateActiveDoc({
      specChecklist: [...activeDoc.specChecklist, item],
    });
    setNewSpecText('');
    soundService.play('click_soft');
  };

  const handleToggleSpecItem = (specId: string) => {
    if (!activeDoc) return;
    const nextList = activeDoc.specChecklist.map(item =>
      item.id === specId ? { ...item, completed: !item.completed } : item
    );
    handleUpdateActiveDoc({ specChecklist: nextList });
    soundService.play('click_soft');
  };

  const handleConvertSpecToTask = async (specItem: ProjectDocSpecItem) => {
    if (!activeDoc) return;
    const chosenProject =
      projects.find(p => p.id === (targetProjectId || activeDoc.projectId || activeProject?.id)) ||
      activeProject ||
      projects[0];

    if (!chosenProject) {
      addToast('Project Required', 'Please create or select a project first to convert spec items into tasks.', 'warning');
      return;
    }

    setConvertingSpecId(specItem.id);
    try {
      if (!activeProject || activeProject.id !== chosenProject.id) {
        setActiveProject(chosenProject);
      }

      const created = await createTask({
        title: specItem.text,
        description: `Converted from Spec Document: **${activeDoc.title}**\n\n> ${activeDoc.summary}`,
        projectId: chosenProject.id,
        status: specItem.completed ? TaskStatus.DONE : TaskStatus.TODO,
        priority: specItem.priority || TaskPriority.MEDIUM,
        assignee_id: currentUser?.id,
        tags: ['spec-converted', activeDoc.category],
      });

      if (created && created.id) {
        const updatedChecklist = activeDoc.specChecklist.map(item =>
          item.id === specItem.id ? { ...item, convertedTaskId: created.id } : item
        );
        const updatedLinked = Array.from(new Set([...(activeDoc.linkedTaskIds || []), created.id]));
        handleUpdateActiveDoc({
          specChecklist: updatedChecklist,
          linkedTaskIds: updatedLinked,
        });
        addToast(
          'Converted to Kanban Task',
          `"${specItem.text}" is now live in ${chosenProject.name}.`,
          'success',
          { entity_type: 'task', entity_id: created.id }
        );
      }
    } catch (err) {
      console.error('Error converting spec item to task:', err);
    } finally {
      setConvertingSpecId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto w-full">
      <PageHeader
        eyebrow="Knowledge Base & Specifications"
        title="Project Docs, PRDs & Architecture Wiki"
        subtitle="Write collaborative specifications and convert action items into live Kanban tasks in one click."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => handleCreateNewDoc('architecture')}>
              + Architecture RFC
            </Button>
            <Button variant="lime" size="sm" onClick={() => handleCreateNewDoc('prd')}>
              <ICON_MAP.PlusIcon className="w-4 h-4" />
              <span>New PRD / Spec</span>
            </Button>
          </>
        }
      />

      {/* Main 2-Column Split: Left Document Tree + Right Spec Editor & Task Converter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
        {/* Left Rail: Search, Filter & Document Tree (4 cols) */}
        <HairlineCard padding="sm" className="lg:col-span-4 flex flex-col gap-3">
          <div className="relative">
            <ICON_MAP.SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search specs, PRDs, runbooks..."
              className="w-full !pl-10 !pr-4 !py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-xs outline-none focus:border-[var(--border-strong)]"
            />
          </div>

          <SegmentedTabs
            size="sm"
            value={filterCategory}
            onChange={setFilterCategory}
            options={[
              { id: 'all', label: 'All Docs' },
              { id: 'prd', label: 'PRDs' },
              { id: 'architecture', label: 'Architecture' },
              { id: 'release_notes', label: 'Releases' },
              { id: 'runbook', label: 'Runbooks' },
            ]}
          />

          <div className="flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {filteredDocs.map(doc => {
              const isSelected = activeDoc?.id === doc.id;
              const catInfo = CATEGORY_META[doc.category] || CATEGORY_META.prd;
              const convertedCount = doc.specChecklist.filter(s => s.convertedTaskId).length;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    setSelectedDocId(doc.id);
                    setIsEditingDoc(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--bg-sage)] border-[var(--border-strong)] shadow-2xs'
                      : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:bg-[var(--bg-surface-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-[var(--accent-text)]">
                      {catInfo.label}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                      {doc.specChecklist.length} items · {convertedCount} linked
                    </span>
                  </div>
                  <h3 className="text-sm font-bold leading-snug line-clamp-1 text-[var(--text-primary)]">
                    {doc.title}
                  </h3>
                  <p className="text-xs mt-1 line-clamp-2 text-[var(--text-secondary)]">
                    {doc.summary}
                  </p>
                </button>
              );
            })}
          </div>
        </HairlineCard>

        {/* Right Canvas: Active Document Viewer / Editor + Spec-to-Task Converter (8 cols) */}
        <HairlineCard padding="lg" className="lg:col-span-8 flex flex-col gap-5">
          {activeDoc ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[var(--border-hairline)]">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1.5">
                    <span className="font-semibold text-[var(--accent-text)]">
                      {CATEGORY_META[activeDoc.category]?.label}
                    </span>
                    <span>·</span>
                    <span>By {activeDoc.authorName}</span>
                    <span>·</span>
                    <span className="tabular-nums font-mono">
                      Updated {new Date(activeDoc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {isEditingDoc ? (
                    <input
                      type="text"
                      value={activeDoc.title}
                      onChange={e => handleUpdateActiveDoc({ title: e.target.value })}
                      className="w-full text-lg sm:text-xl font-bold px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                    />
                  ) : (
                    <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                      {activeDoc.title}
                    </h2>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {projects.length > 0 && (
                    <select
                      value={targetProjectId}
                      onChange={e => setTargetProjectId(e.target.value)}
                      className="px-3 py-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-xs font-semibold outline-none cursor-pointer"
                      title="Target project for task conversion"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          Target: {p.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <Button
                    variant={isEditingDoc ? 'lime' : 'outline'}
                    size="sm"
                    onClick={() => setIsEditingDoc(prev => !prev)}
                  >
                    <ICON_MAP.PencilIcon className="w-3.5 h-3.5" />
                    <span>{isEditingDoc ? 'Done Editing' : 'Edit Spec'}</span>
                  </Button>
                </div>
              </div>

              {/* Spec Body */}
              <div className="space-y-3">
                {isEditingDoc ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                        Executive Summary
                      </label>
                      <input
                        type="text"
                        value={activeDoc.summary}
                        onChange={e => handleUpdateActiveDoc({ summary: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-xs outline-none focus:border-[var(--border-strong)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                        Specification Markdown Content
                      </label>
                      <textarea
                        rows={7}
                        value={activeDoc.content}
                        onChange={e => handleUpdateActiveDoc({ content: e.target.value })}
                        className="w-full p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-xs font-mono leading-relaxed outline-none focus:border-[var(--border-strong)]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] space-y-2 text-xs sm:text-sm leading-relaxed whitespace-pre-line text-[var(--text-secondary)]">
                    <p className="font-semibold text-[var(--text-primary)]">{activeDoc.summary}</p>
                    <div className="pt-2 border-t border-[var(--border-hairline)]">
                      {activeDoc.content}
                    </div>
                  </div>
                )}
              </div>

              {/* Linked Interactive Project Whiteboard Canvas */}
              <div className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sage)] flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ICON_MAP.SparklesIcon className="w-4 h-4 text-[var(--accent-text)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Linked Architecture & Brainstorm Whiteboard
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      · Live multi-user canvas synced with this project
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="lime"
                      size="sm"
                      onClick={() => setShowEmbeddedWhiteboard(prev => !prev)}
                    >
                      {showEmbeddedWhiteboard ? 'Hide Inline Canvas' : 'Embed Live Canvas'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => useAppStore.getState().setActiveView('whiteboard_view')}
                    >
                      Full Screen ↗
                    </Button>
                  </div>
                </div>

                {showEmbeddedWhiteboard && (
                  <div className="h-[460px] w-full rounded-2xl overflow-hidden border border-[var(--border-hairline)] flex flex-col">
                    <WhiteboardStudioPage
                      compactMode
                      projectIdOverride={targetProjectId || activeProject?.id}
                      onCloseCompact={() => setShowEmbeddedWhiteboard(false)}
                    />
                  </div>
                )}
              </div>

              {/* Actionable Spec Requirements -> 1-Click Convert to Kanban Task */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--text-primary)]">
                      <ICON_MAP.ClipboardDocumentListIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                      <span>Actionable Spec Requirements & Task Conversion</span>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Convert any specification requirement directly into a tracked Kanban task on your project board.
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                    {activeDoc.specChecklist.filter(i => i.completed).length}/{activeDoc.specChecklist.length} completed
                  </span>
                </div>

                <div className="space-y-2">
                  {activeDoc.specChecklist.map(spec => {
                    const linkedTask = spec.convertedTaskId
                      ? tasks.find(t => t.id === spec.convertedTaskId)
                      : undefined;

                    return (
                      <div
                        key={spec.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] hover:border-[var(--border-strong)] transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={spec.completed}
                            onChange={() => handleToggleSpecItem(spec.id)}
                            className="w-4 h-4 rounded accent-[var(--accent-cta)] cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs sm:text-sm font-medium ${
                                spec.completed
                                  ? 'line-through text-[var(--text-muted)]'
                                  : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {spec.text}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted)]">
                              <span>Priority: {spec.priority || 'Medium'}</span>
                              {linkedTask && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    Synced Status: {String(linkedTask.status).replace(/_/g, ' ')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {spec.convertedTaskId ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openViewTaskModal(spec.convertedTaskId!)}
                            >
                              <ICON_MAP.CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Open Task →</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={convertingSpecId === spec.id}
                              onClick={() => handleConvertSpecToTask(spec)}
                            >
                              <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                              <span>{convertingSpecId === spec.id ? 'Creating...' : 'Convert to Task'}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add New Spec Requirement Form */}
                <form onSubmit={handleAddSpecItem} className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newSpecText}
                    onChange={e => setNewSpecText(e.target.value)}
                    placeholder="Add a specification requirement or acceptance item..."
                    className="flex-1 px-3.5 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-xs outline-none focus:border-[var(--border-strong)]"
                  />
                  <select
                    value={newSpecPriority}
                    onChange={e => setNewSpecPriority(e.target.value as TaskPriority)}
                    className="px-3 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value={TaskPriority.CRITICAL}>Critical</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.LOW}>Low</option>
                  </select>
                  <Button type="submit" variant="lime" size="sm">
                    Add Item
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <ICON_MAP.DocumentTextIcon className="w-12 h-12 text-[var(--text-muted)] mb-3" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">No Specification Selected</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
                Choose a document from the left sidebar or create a new PRD.
              </p>
              <Button variant="lime" size="sm" onClick={() => handleCreateNewDoc('prd')}>
                Create First Spec
              </Button>
            </div>
          )}
        </HairlineCard>
      </div>
    </div>
  );
};
