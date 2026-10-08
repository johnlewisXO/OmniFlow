import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import geminiService from '../../services/geminiService';
import { AIBotFace, AIPlatformGuideModal } from './AIBotFace';

type DockPosition = 'bottom-right' | 'bottom-left';

export const FloatingAICopilotButton: React.FC = () => {
  const {
    projects,
    tasks,
    sprints,
    users,
    openCommandPalette,
    setActiveView,
    activeView,
    darkMode,
  } = useAppStore();

  const [isCompactScroll, setIsCompactScroll] = useState(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('omni_ai_fab_minimized') === 'true';
    } catch {
      return false;
    }
  });
  const [dockSide, setDockSide] = useState<DockPosition>(() => {
    try {
      return (localStorage.getItem('omni_ai_fab_dock') as DockPosition) || 'bottom-right';
    } catch {
      return 'bottom-right';
    }
  });
  const [isHovered, setIsHovered] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const report = React.useMemo(() => {
    return geminiService.computeWorkspaceInsights(projects, tasks, sprints, users);
  }, [projects, tasks, sprints, users]);

  const criticalCount = report.insights.filter(i => i.severity === 'critical').length;

  // Automatically compact the floating button when scrolling down inside any scrollable panel
  // so it never obstructs Save buttons or form actions at the bottom of pages.
  useEffect(() => {
    const handleScrollCapture = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.scrollTop !== 'number') return;
      const scrollTop = target.scrollTop;
      const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (scrollTop > 80 || distanceFromBottom < 140) {
        setIsCompactScroll(true);
      } else {
        setIsCompactScroll(false);
      }
    };

    const handleOpenTour = () => setIsGuideOpen(true);

    window.addEventListener('scroll', handleScrollCapture, true);
    window.addEventListener('omni_open_ai_guide', handleOpenTour);
    window.addEventListener('omni_open_ai_platform_guide', handleOpenTour);
    return () => {
      window.removeEventListener('scroll', handleScrollCapture, true);
      window.removeEventListener('omni_open_ai_guide', handleOpenTour);
      window.removeEventListener('omni_open_ai_platform_guide', handleOpenTour);
    };
  }, []);

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isMinimized;
    setIsMinimized(next);
    try {
      localStorage.setItem('omni_ai_fab_minimized', String(next));
    } catch {}
  };

  const toggleDockSide = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next: DockPosition = dockSide === 'bottom-right' ? 'bottom-left' : 'bottom-right';
    setDockSide(next);
    try {
      localStorage.setItem('omni_ai_fab_dock', next);
    } catch {}
  };

  const showExpandedControls = !isMinimized && (isHovered || (!isCompactScroll && activeView !== 'profile_settings'));

  const positionClasses =
    dockSide === 'bottom-left'
      ? 'left-3 sm:left-5 bottom-3 sm:bottom-4'
      : 'right-3 sm:right-5 bottom-3 sm:bottom-4';

  return (
    <>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed ${positionClasses} z-30 flex items-center gap-1.5 pointer-events-none transition-all duration-300 ease-out`}
      >
        {/* Minimized / Ultra-Compact Edge Orb */}
        {isMinimized ? (
          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsMinimized(false);
                try {
                  localStorage.setItem('omni_ai_fab_minimized', 'false');
                } catch {}
              }}
              title="Expand Omni AI Co-Pilot"
              className={`group flex items-center gap-1.5 p-1.5 rounded-2xl border shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-105 cursor-pointer ${
                darkMode
                  ? 'bg-slate-900/90 border-indigo-500/40 text-white'
                  : 'bg-white/90 border-indigo-200 text-slate-900'
              }`}
            >
              <AIBotFace mood="idle" size="sm" />
              <span className="hidden group-hover:inline-block text-[11px] font-semibold pr-1.5 text-indigo-500">
                AI Co-Pilot
              </span>
            </button>
          </div>
        ) : (
          <div
            className={`pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl border backdrop-blur-xl shadow-xl transition-all duration-300 ${
              darkMode
                ? 'bg-slate-900/90 border-slate-700/80 shadow-black/40'
                : 'bg-white/90 border-slate-200/90 shadow-slate-900/10'
            } ${isCompactScroll && !isHovered ? 'opacity-85 scale-95' : 'opacity-100 scale-100'}`}
          >
            {/* Dock Side & Minimize Micro Controls */}
            {showExpandedControls && (
              <div className="hidden sm:flex items-center gap-0.5 pl-1 pr-0.5 border-r border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={toggleDockSide}
                  title={dockSide === 'bottom-right' ? 'Move AI dock to bottom-left' : 'Move AI dock to bottom-right'}
                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-[10px] font-mono"
                >
                  {dockSide === 'bottom-right' ? '⇄L' : 'R⇄'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  title="Interactive AI Platform Guide & Walkthrough"
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Guide
                </button>
              </div>
            )}

            {/* Health & AI PM Studio Quick Button */}
            {showExpandedControls && activeView !== 'ai_copilot_view' && (
              <button
                type="button"
                onClick={() => setActiveView('ai_copilot_view')}
                title="Open AI Project Manager Studio"
                className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                  darkMode
                    ? 'hover:bg-slate-800 text-slate-200'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    criticalCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                <span className="font-mono tabular-nums">{report.healthScore}%</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="text-indigo-600 dark:text-indigo-400">AI Studio</span>
              </button>
            )}

            {/* Main AI Bot Face + Command Trigger */}
            <button
              type="button"
              onClick={openCommandPalette}
              title="Open AI Command Centre (Ctrl+K / Cmd+K)"
              className="group inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <AIBotFace mood={isHovered ? 'happy' : 'idle'} size="xs" />
              <span className={`${showExpandedControls ? 'inline' : 'hidden sm:inline'} whitespace-nowrap`}>
                AI Co-Pilot
              </span>
              {showExpandedControls && (
                <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-indigo-700/80 text-indigo-100 rounded">
                  ⌘K
                </kbd>
              )}
            </button>

            {/* Minimize to non-obstructive orb */}
            <button
              type="button"
              onClick={toggleMinimize}
              title="Minimize AI button to compact orb"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Minimize AI Co-Pilot button"
            >
              <ICON_MAP.ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <AIPlatformGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  );
};
