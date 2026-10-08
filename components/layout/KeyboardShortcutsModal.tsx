import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { useAnimatedMount } from '../shared/Modal';

export const KeyboardShortcutsModal: React.FC = () => {
  const { isShortcutsModalOpen, closeShortcutsModal } = useAppStore();
  const { shouldRender, isClosing } = useAnimatedMount(isShortcutsModalOpen, 190);

  if (!shouldRender) return null;

  const shortcutSections = [
    {
      title: 'General & Navigation',
      shortcuts: [
        { keys: ['Cmd', 'K'], label: 'Open Command Palette' },
        { keys: ['/'], label: 'Quick Focus Search' },
        { keys: ['?'], label: 'Open Keyboard Shortcuts' },
        { keys: ['Esc'], label: 'Close Active Modal / Dropdown' },
      ],
    },
    {
      title: 'Task Actions',
      shortcuts: [
        { keys: ['C'], label: 'Create New Task' },
        { keys: ['J', 'or', '↓'], label: 'Navigate Down / Next Task' },
        { keys: ['K', 'or', '↑'], label: 'Navigate Up / Prev Task' },
        { keys: ['Enter'], label: 'Open Selected Task Details' },
        { keys: ['X'], label: 'Toggle Task Completion (Done)' },
        { keys: ['E'], label: 'Edit Selected Task' },
      ],
    },
    {
      title: 'View Switcher',
      shortcuts: [
        { keys: ['G', 'O'], label: 'Go to Overview' },
        { keys: ['G', 'B'], label: 'Go to Kanban Board' },
        { keys: ['G', 'S'], label: 'Go to Sprint Planning' },
        { keys: ['G', 'M'], label: 'Go to My Tasks' },
        { keys: ['G', 'R'], label: 'Go to Reports' },
      ],
    },
  ];

  return (
    <div
      onClick={closeShortcutsModal}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100 animate-fadeIn'
      }`}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-xl w-full p-6 space-y-5 ${
          isClosing ? 'animate-modal-disappear' : 'animate-modal-appear'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
              <ICON_MAP.KeyboardIcon className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Keyboard Shortcuts
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Speed up your daily workflow with Linear-style hotkeys.
              </p>
            </div>
          </div>

          <button
            onClick={closeShortcutsModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ICON_MAP.XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {shortcutSections.map((section, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {section.shortcuts.map((sc, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {sc.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {sc.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold font-mono shadow-2xs ${
                            k === 'or'
                              ? 'bg-transparent text-slate-400 text-[10px] shadow-none'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700/60">
          Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[10px]">?</kbd> anywhere to toggle this cheat sheet.
        </div>
      </div>
    </div>
  );
};
