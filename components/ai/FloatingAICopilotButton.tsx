import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { AIBotFace, AIPlatformGuideModal } from './AIBotFace';

export const FloatingAICopilotButton: React.FC = () => {
  const { openCommandPalette, setActiveView, activeView } = useAppStore();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  if (activeView === 'ai_copilot_view' || activeView === 'team_chat_view') {
    return <AIPlatformGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />;
  }

  return (
    <>
      <div className="fixed right-5 bottom-16 lg:bottom-5 z-30 flex items-center gap-1.5">
        <div className="editorial-popover flex items-center gap-1 p-1 rounded-full">
          <button
            type="button"
            onClick={() => setActiveView('ai_copilot_view')}
            title="Open AI Studio"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
          >
            <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
            <span>AI Studio</span>
          </button>

          <button
            type="button"
            onClick={openCommandPalette}
            title="Command Palette (⌘K)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <AIBotFace mood="idle" size="xs" />
            <span>Ask</span>
            <kbd className="font-mono text-[10px] opacity-70">⌘K</kbd>
          </button>
        </div>
      </div>

      <AIPlatformGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  );
};
