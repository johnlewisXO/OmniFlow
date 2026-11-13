import React, { useState } from 'react';
import { WhiteboardStudioPage } from '../whiteboard/WhiteboardStudioPage';
import { ProjectDocsWikiPage } from '../docs/ProjectDocsWikiPage';
import { GanttRoadmapPage } from '../roadmap/GanttRoadmapPage';
import { AsyncClipsStudioPage } from '../clips/AsyncClipsStudioPage';
import { ClientPortalChangelogPage } from '../portal/ClientPortalChangelogPage';

interface SplitWorkspaceSecondaryPaneProps {
  onClose: () => void;
}

type SecondaryModuleId =
  | 'docs_wiki_view'
  | 'whiteboard_view'
  | 'gantt_roadmap_view'
  | 'async_clips_view'
  | 'client_portal_view';

export const SplitWorkspaceSecondaryPane: React.FC<SplitWorkspaceSecondaryPaneProps> = ({
  onClose,
}) => {
  const [secondaryModule, setSecondaryModule] =
    useState<SecondaryModuleId>('whiteboard_view');

  return (
    <div className="w-1/2 h-full border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col overflow-hidden shrink-0">
      {/* Compact Split-Pane Switcher Header */}
      <div className="h-10 px-3 bg-[var(--bg-sage)] border-b border-[var(--border-hairline)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-[#191B17] text-[#CCF048] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Split Pane
          </span>
          <select
            value={secondaryModule}
            onChange={e => setSecondaryModule(e.target.value as SecondaryModuleId)}
            className="px-2.5 py-1 text-xs font-bold rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
          >
            <option value="whiteboard_view">🎨 Collaborative Whiteboard Studio</option>
            <option value="docs_wiki_view">📄 Project Docs & Spec Wiki</option>
            <option value="gantt_roadmap_view">🗓️ Gantt Timeline & Critical Path</option>
            <option value="async_clips_view">🎬 Async Screen & Camera Clips</option>
            <option value="client_portal_view">🌐 Client Portal & Changelog</option>
          </select>
        </div>

        <button
          onClick={onClose}
          title="Close Split-Screen Pane"
          className="px-2.5 py-1 rounded-full text-xs font-bold text-[var(--text-secondary)] hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
        >
          ✕ Close Split
        </button>
      </div>

      {/* Embedded Live Module */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {secondaryModule === 'whiteboard_view' && <WhiteboardStudioPage compactMode />}
        {secondaryModule === 'docs_wiki_view' && <ProjectDocsWikiPage />}
        {secondaryModule === 'gantt_roadmap_view' && <GanttRoadmapPage />}
        {secondaryModule === 'async_clips_view' && <AsyncClipsStudioPage />}
        {secondaryModule === 'client_portal_view' && <ClientPortalChangelogPage />}
      </div>
    </div>
  );
};

export default SplitWorkspaceSecondaryPane;
