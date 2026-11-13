import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import {
  ActiveView,
  SavedFilterPreset,
  ScratchpadNote,
  TaskPriority,
  TaskStatus,
} from '../../types';

const NOTES_KEY = 'omni_scratchpad_notes_v1';
const FILTERS_KEY = 'omni_saved_filter_presets_v1';

const DEFAULT_NOTES: ScratchpadNote[] = [
  {
    id: 'note-1',
    title: 'Sprint 14 Standup & Architecture Notes',
    content:
      '- Verify Critical Path dependencies on Gantt Roadmap\n- Review Safari GPU compositing clip in Async Clips Studio\n- Finalize v2.6.0 public release notes in Client Portal',
    color: 'amber',
    pinned: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'note-2',
    title: 'Quick Ideas & Follow-ups',
    content:
      '- Add automated Slack/Webhook node in Visual Workflow Studio\n- Schedule Q4 capacity calibration with design team',
    color: 'indigo',
    pinned: false,
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_PRESETS: SavedFilterPreset[] = [
  {
    id: 'preset-urgent-blockers',
    name: 'Urgent & High-Priority Blockers',
    icon: '🔥',
    color: 'rose',
    targetView: 'kanban',
    priorityFilter: TaskPriority.CRITICAL,
    onlyBlocked: true,
  },
  {
    id: 'preset-gantt-crit',
    name: 'Gantt Critical Path & Milestones',
    icon: '🗓️',
    color: 'indigo',
    targetView: 'gantt_roadmap_view',
  },
  {
    id: 'preset-review-queue',
    name: 'Tasks Ready for Code/Spec Review',
    icon: '👀',
    color: 'amber',
    targetView: 'my_tasks_view',
    statusFilter: TaskStatus.REVIEW,
  },
  {
    id: 'preset-async-clips',
    name: 'Async Video Walkthroughs & Bug Clips',
    icon: '🎬',
    color: 'emerald',
    targetView: 'async_clips_view',
  },
  {
    id: 'preset-client-portal',
    name: 'Top Upvoted Customer Feature Requests',
    icon: '🌐',
    color: 'cyan',
    targetView: 'client_portal_view',
  },
];

export const PersonalScratchpadDrawer: React.FC = () => {
  const { activeProject, projects, createTask, setActiveView, addToast } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scratchpad' | 'filters'>('scratchpad');

  const [notes, setNotes] = useState<ScratchpadNote[]>(() => {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_NOTES;
  });

  const [presets, setPresets] = useState<SavedFilterPreset[]>(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_PRESETS;
  });

  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || '');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetTarget, setNewPresetTarget] = useState<ActiveView>('kanban');

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch {}
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(presets));
    } catch {}
  }, [presets]);

  useEffect(() => {
    const onToggle = () => setIsOpen(v => !v);
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen(v => !v);
      }
    };
    window.addEventListener('omni_toggle_scratchpad', onToggle);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('omni_toggle_scratchpad', onToggle);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!isOpen) return null;

  const activeNote = notes.find(n => n.id === selectedNoteId) || notes[0];

  const handleAddNote = () => {
    const created: ScratchpadNote = {
      id: `note-${Date.now()}`,
      title: 'Untitled Scratchpad Note',
      content: '- Capture quick thoughts, meeting action items, or code snippets...',
      color: 'indigo',
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [created, ...prev]);
    setSelectedNoteId(created.id);
  };

  const handleConvertNoteToTask = async (lineText?: string) => {
    if (!activeNote) return;
    const rawLine =
      lineText ||
      activeNote.content
        .split('\n')
        .map(l => l.replace(/^[-*•]\s*/, '').trim())
        .find(Boolean) ||
      activeNote.title;

    const targetProjectId = activeProject?.id || projects[0]?.id || 'default-project';
    try {
      await createTask({
        title: rawLine,
        description: `Converted from Personal Scratchpad note: "${activeNote.title}"`,
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
        projectId: targetProjectId,
      });
      addToast('Converted to Kanban Task', `"${rawLine}" added to your project board`, 'success');
    } catch {
      addToast('Error', 'Could not convert note to task', 'error');
    }
  };

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    const p: SavedFilterPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      icon: '⚡',
      color: 'indigo',
      targetView: newPresetTarget,
    };
    setPresets(prev => [p, ...prev]);
    setNewPresetName('');
    addToast('Saved Filter View Created', `"${p.name}" pinned to your quick views`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-[var(--bg-surface)] border-l border-[var(--border-hairline)] shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="px-4 py-3.5 border-b border-[var(--border-hairline)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📓</span>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Personal Scratchpad & Saved Views
              </h2>
              <p className="text-[10px] text-[var(--text-muted)]">
                Hotkey: Cmd/Ctrl + J • Instant notes & 1-click view filters
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-4 pt-3 flex gap-2 border-b border-[var(--border-hairline)] pb-3 bg-[var(--bg-surface-subtle)]">
          <button
            onClick={() => setActiveTab('scratchpad')}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'scratchpad'
                ? 'bg-[#191B17] text-white dark:bg-[#CCF048] dark:text-[#131511] shadow-xs'
                : 'bg-[var(--bg-sage)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            📝 Scratchpad ({notes.length})
          </button>
          <button
            onClick={() => setActiveTab('filters')}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'filters'
                ? 'bg-[#191B17] text-white dark:bg-[#CCF048] dark:text-[#131511] shadow-xs'
                : 'bg-[var(--bg-sage)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            🔖 Saved Filter Views ({presets.length})
          </button>
        </div>

        {/* Body */}
        {activeTab === 'scratchpad' ? (
          <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {notes.map(n => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNoteId(n.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold truncate max-w-[150px] border transition cursor-pointer ${
                    activeNote?.id === n.id
                      ? 'bg-[var(--bg-sage)] border-[var(--border-strong)] text-[#4E6126] dark:text-[#CCF048]'
                      : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {n.title}
                </button>
              ))}
              <button
                onClick={handleAddNote}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--accent-lime)] text-[var(--accent-ink)] hover:bg-[var(--accent-lime-hover)] shrink-0 cursor-pointer"
              >
                + Note
              </button>
            </div>

            {activeNote && (
              <>
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={e => {
                    const val = e.target.value;
                    setNotes(prev =>
                      prev.map(n => (n.id === activeNote.id ? { ...n, title: val } : n))
                    );
                  }}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
                <textarea
                  value={activeNote.content}
                  onChange={e => {
                    const val = e.target.value;
                    setNotes(prev =>
                      prev.map(n =>
                        n.id === activeNote.id
                          ? { ...n, content: val, updatedAt: new Date().toISOString() }
                          : n
                      )
                    );
                  }}
                  className="flex-1 p-3 text-xs font-mono leading-relaxed rounded-xl bg-[var(--bg-sage)]/50 border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none resize-none"
                />

                {/* Bullet Lines Quick-Convert to Task */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      1-Click Action Item → Task
                    </span>
                    <button
                      onClick={() => handleConvertNoteToTask()}
                      className="text-[11px] font-bold text-[#4E6126] dark:text-[#CCF048] hover:underline cursor-pointer"
                    >
                      + Convert Top Line to Task
                    </button>
                  </div>
                  <div className="max-h-28 overflow-y-auto scrollbar-thin space-y-1">
                    {activeNote.content
                      .split('\n')
                      .map(l => l.replace(/^[-*•]\s*/, '').trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <div
                          key={i}
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-[var(--text-primary)]">{line}</span>
                          <button
                            onClick={() => handleConvertNoteToTask(line)}
                            className="px-2 py-0.5 rounded-full bg-[var(--bg-sage)] text-[#4E6126] dark:text-[#CCF048] text-[10px] font-bold shrink-0 hover:bg-[var(--accent-lime)] hover:text-[var(--accent-ink)] transition-colors cursor-pointer"
                          >
                            + Task
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
            <form onSubmit={handleCreatePreset} className="p-3 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] space-y-2">
              <div className="text-xs font-bold text-[var(--text-primary)]">Save New Custom Filter View</div>
              <input
                type="text"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                placeholder="View name (e.g., Q4 Release Blockers)..."
                className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newPresetTarget}
                  onChange={e => setNewPresetTarget(e.target.value as ActiveView)}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  <option value="kanban">Kanban Board</option>
                  <option value="gantt_roadmap_view">Gantt Timeline Roadmap</option>
                  <option value="my_tasks_view">My Tasks List</option>
                  <option value="triage_intake_view">Triage Queue</option>
                  <option value="async_clips_view">Async Video Clips</option>
                  <option value="client_portal_view">Client Portal & Changelog</option>
                </select>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[var(--accent-ink)] cursor-pointer"
                >
                  Save View
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setActiveView(preset.targetView);
                    setIsOpen(false);
                    addToast('Saved Filter Applied', `Switched to "${preset.name}"`, 'info');
                  }}
                  className="w-full p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{preset.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase font-mono">
                        Target: {preset.targetView.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[#4E6126] dark:text-[#CCF048] font-bold">Launch →</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalScratchpadDrawer;
