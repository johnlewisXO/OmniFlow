import React from 'react';
import { ICON_MAP } from '../../constants';

interface QuickUtilitiesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export const QuickUtilitiesDrawer: React.FC<QuickUtilitiesDrawerProps> = ({
  isOpen,
  onClose,
  darkMode,
}) => {
  if (!isOpen) return null;

  const utilities = [
    {
      id: 'split',
      icon: '◫',
      title: 'Split-Screen Workspace',
      desc: 'Dual-pane side-by-side multitasking with synced context.',
      shortcut: '⌘\\',
      color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      action: () => {
        window.dispatchEvent(new CustomEvent('omni_toggle_split_pane'));
        onClose();
      },
    },
    {
      id: 'huddle',
      icon: '🎧',
      title: 'Ambient Team Huddle',
      desc: 'Drop-in background voice room & instant screen broadcasting.',
      shortcut: 'Voice',
      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      action: () => {
        window.dispatchEvent(new CustomEvent('omni_toggle_ambient_huddle'));
        onClose();
      },
    },
    {
      id: 'graph',
      icon: '🕸️',
      title: 'Knowledge Backlinks & Graph',
      desc: 'Interactive 2D graph of task dependencies, wikis & doc relations.',
      shortcut: 'Graph',
      color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      action: () => {
        window.dispatchEvent(new CustomEvent('omni_toggle_knowledge_graph'));
        onClose();
      },
    },
    {
      id: 'scratchpad',
      icon: '📓',
      title: 'Personal Scratchpad',
      desc: 'Private draft canvas for rapid code snippets & markdown notes.',
      shortcut: '⌘J',
      color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      action: () => {
        window.dispatchEvent(new CustomEvent('omni_toggle_scratchpad'));
        onClose();
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        className={`relative w-full max-w-sm h-full shadow-2xl p-6 flex flex-col justify-between border-l z-10 transition-transform ${
          darkMode
            ? 'bg-neutral-950/95 border-white/10 text-slate-100'
            : 'bg-white/95 border-slate-200 text-slate-800'
        }`}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <ICON_MAP.Squares2X2Icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Quick Utilities</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Multitasking & workspace tools
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
              title="Close utilities drawer"
            >
              <ICON_MAP.XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Tools Grid */}
          <div className="space-y-3">
            {utilities.map(util => (
              <button
                key={util.id}
                type="button"
                onClick={util.action}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 group ${
                  darkMode
                    ? 'bg-neutral-900/80 hover:bg-neutral-800/90 border-white/10 hover:border-indigo-500/40'
                    : 'bg-slate-50/80 hover:bg-white border-slate-200/80 hover:border-indigo-300 shadow-2xs hover:shadow-xs'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 ${util.color}`}
                >
                  {util.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold truncate group-hover:text-indigo-400 transition-colors">
                      {util.title}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border shrink-0 ${
                        darkMode
                          ? 'bg-neutral-950 border-white/10 text-slate-400'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {util.shortcut}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {util.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Tip: Press <kbd className="font-mono font-bold text-indigo-400">⌘K</kbd> anytime to launch tools via Command Palette.
          </p>
        </div>
      </div>
    </div>
  );
};
