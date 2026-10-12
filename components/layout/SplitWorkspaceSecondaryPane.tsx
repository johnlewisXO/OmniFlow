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
    <div className="w-1/2 h-full border-l-2 border-indigo-500/30 dark:border-indigo-500/40 bg-white dark:bg-[#0B0F17] flex flex-col overflow-hidden shrink-0">
      {/* Compact Split-Pane Switcher Header */}
      <div className="h-10 px-3 bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider">
            Split Pane
          </span>
          <select
            value={secondaryModule}
            onChange={e => setSecondaryModule(e.target.value as SecondaryModuleId)}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
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
          className="px-2 py-0.5 rounded-lg text-xs font-bold text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition"
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
