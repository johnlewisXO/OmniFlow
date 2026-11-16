import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICON_MAP } from '../../constants';
import { useAppStore } from '../../hooks/useAppStore';
import { TaskStatus } from '../../types';
import { GLASS_SPRING } from './LiquidGlass';
import { Button, IconButton } from './Button';

interface QuickUtilitiesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export const QuickUtilitiesDrawer: React.FC<QuickUtilitiesDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    tasks,
    activeTimer,
    startTaskTimer,
    pauseTaskTimer,
    resumeTaskTimer,
    stopAndLogTaskTimer,
    setActiveView,
    openCommandPalette,
    currentUser,
  } = useAppStore();

  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [scratchpad, setScratchpad] = useState(() => {
    try {
      return localStorage.getItem(`omni_quick_note_${currentUser?.id || 'guest'}`) || '';
    } catch {
      return '';
    }
  });
  const [timerTick, setTimerTick] = useState(0);

  useEffect(() => {
    if (!activeTimer?.isRunning) return;
    const t = setInterval(() => setTimerTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [activeTimer?.isRunning]);

  useEffect(() => {
    try {
      localStorage.setItem(`omni_quick_note_${currentUser?.id || 'guest'}`, scratchpad);
    } catch {}
  }, [scratchpad, currentUser?.id]);

  const drawerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>('button, select, textarea, input')?.focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  const openTasks = tasks.filter(t => t.status !== TaskStatus.DONE).slice(0, 20);
  const liveSeconds = activeTimer
    ? (activeTimer.accumulatedSeconds || 0) +
      (activeTimer.isRunning ? Math.max(0, Math.floor((Date.now() - activeTimer.startedAt) / 1000)) : 0)
    : 0;
  const hrs = String(Math.floor(liveSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((liveSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(liveSeconds % 60).padStart(2, '0');

  const utilities = [
    {
      id: 'ai_copilot',
      title: 'AI Co-Pilot & Executive Brief',
      desc: 'Generate sprint risk briefs, decompose epics, and review health insights.',
      shortcut: 'AI',
      action: () => {
        setActiveView('ai_copilot_view');
        onClose();
      },
    },
    {
      id: 'split',
      title: 'Split-Screen Workspace',
      desc: 'Dual-pane multitasking with synced context.',
      shortcut: '⌘\\',
      action: () => {
        window.dispatchEvent(new CustomEvent('omni_toggle_split_pane'));
        onClose();
      },
    },
    {
      id: 'huddle',
      title: 'Ambient Team Huddle',
      desc: 'Drop-in background voice room & screen sync.',
      shortcut: 'Voice',
      action: () => {
        window.dispatchEvent(new CustomEvent('omni_toggle_ambient_huddle'));
        onClose();
      },
    },
    {
      id: 'graph',
      title: 'Knowledge Backlinks Graph',
      desc: 'Explore task, spec, and wiki dependency links.',
      shortcut: 'Graph',
      action: () => {
        window.dispatchEvent(new CustomEvent('omni_toggle_knowledge_graph'));
        onClose();
      },
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="utilities-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={GLASS_SPRING.scrim}
          className="fixed inset-0 z-50 flex justify-end p-0 sm:p-3 bg-black/40 backdrop-blur-[5px]"
          onClick={onClose}
        >
          <motion.aside
            ref={drawerRef}
            key="utilities-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Quick Utilities"
            initial={{ opacity: 0, x: 44 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 36 }}
            transition={GLASS_SPRING.spatial}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm h-full liquid-glass-overlay sm:rounded-[24px] p-5 flex flex-col justify-between z-10 overflow-y-auto scrollbar-thin"
          >
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-[var(--border-hairline)]/80">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Quick Utilities</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Focus timer, scratchpad &amp; secondary tools
                  </p>
                </div>
                <IconButton
                  variant="glass"
                  size="sm"
                  onClick={onClose}
                  aria-label="Close utilities drawer"
                >
                  <ICON_MAP.XMarkIcon className="w-4 h-4" />
                </IconButton>
              </div>

              {/* Progressive Disclosure: Focus Timer */}
              <div className="editorial-surface-subtle p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Focus Timer
                  </span>
                  <span className="font-mono text-base font-bold tabular-nums text-[var(--text-primary)]">
                    {hrs}:{mins}:{secs}
                  </span>
                </div>

                {activeTimer ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {activeTimer.taskTitle}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (activeTimer.isRunning ? pauseTaskTimer() : resumeTaskTimer())}
                        className="flex-1"
                      >
                        {activeTimer.isRunning ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        variant="lime"
                        size="sm"
                        onClick={stopAndLogTaskTimer}
                        className="flex-1"
                      >
                        Stop &amp; Log
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTaskId}
                      onChange={e => setSelectedTaskId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs"
                    >
                      <option value="">Select task to track...</option>
                      {openTasks.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!selectedTaskId}
                      onClick={() => {
                        const task = openTasks.find(t => t.id === selectedTaskId);
                        if (task) startTaskTimer(task);
                      }}
                      className="shrink-0"
                    >
                      Start
                    </Button>
                  </div>
                )}
              </div>

              {/* Progressive Disclosure: Quick Scratchpad */}
              <div className="editorial-surface-subtle p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Scratchpad Notes
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">Auto-saved</span>
                </div>
                <textarea
                  value={scratchpad}
                  onChange={e => setScratchpad(e.target.value)}
                  rows={4}
                  placeholder="Jot down sprint notes, blockers, or standup thoughts..."
                  className="w-full p-2.5 text-xs resize-none"
                />
              </div>

              {/* Secondary Workspace Utilities */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
                  Workspace Tools
                </p>
                {utilities.map(util => (
                  <motion.button
                    key={util.id}
                    type="button"
                    whileTap={{ scale: 0.975 }}
                    whileHover={{ y: -1 }}
                    transition={GLASS_SPRING.micro}
                    onClick={util.action}
                    className="w-full text-left p-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]/80 hover:bg-[var(--bg-sage)]/85 transition-colors cursor-pointer flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {util.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {util.desc}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface)]/80 border border-[var(--border-hairline)] text-[var(--text-muted)] shrink-0">
                      {util.shortcut}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-[var(--border-hairline)]/80 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Command Palette</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openCommandPalette();
                }}
                className="font-mono font-semibold text-[var(--text-primary)] hover:underline cursor-pointer"
              >
                Open ⌘K
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
