import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { TeamWorkloadWidget } from './TeamWorkloadWidget';
import { KeyMilestonesWidget } from './KeyMilestonesWidget';
import { AIInsightsEngineWidget } from '../ai/AIInsightsEngineWidget';
import { TasklyBentoWorkspaceHub } from '../dashboards/TasklyBentoWorkspaceHub';
import { ICON_MAP } from '../../constants';
import soundService from '../../services/soundService';

interface OverviewPageProps {
  showWelcomeMessage?: boolean;
}

type OverviewSectionId = 'bento_hub' | 'workload_milestones' | 'ai_insights';

const DEFAULT_SECTIONS: OverviewSectionId[] = [
  'bento_hub',
  'workload_milestones',
  'ai_insights',
];

export const OverviewPage: React.FC<OverviewPageProps> = ({ showWelcomeMessage = true }) => {
  const { currentUser, darkMode, currentOrganization } = useAppStore();
  const SparklesIcon = ICON_MAP.SparklesIcon;
  const GripIcon = ICON_MAP.GripVerticalIcon || ICON_MAP.Bars3Icon;

  const storageKey = `omni_overview_sections_v2_${currentUser?.id || 'guest'}`;
  const [sectionOrder, setSectionOrder] = useState<OverviewSectionId[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as OverviewSectionId[];
          if (Array.isArray(parsed) && parsed.length === DEFAULT_SECTIONS.length) {
            return parsed;
          }
        }
      } catch {}
    }
    return DEFAULT_SECTIONS;
  });

  const [draggedSection, setDraggedSection] = useState<OverviewSectionId | null>(null);
  const [dragOverSection, setDragOverSection] = useState<OverviewSectionId | null>(null);
  const [updatedSection, setUpdatedSection] = useState<OverviewSectionId | null>(null);

  if (!currentUser && showWelcomeMessage) {
    return (
      <div className="p-6 text-center">
        <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Loading user data or not logged in.
        </p>
      </div>
    );
  }

  const handleSectionDragStart = (e: React.DragEvent, id: OverviewSectionId) => {
    // Do not hijack inner bento widget drags
    if (e.dataTransfer.types.includes('text/bento-widget')) return;
    soundService.play('drag_pickup');
    e.dataTransfer.setData('text/overview-section', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSection(id);
  };

  const handleSectionDragOver = (e: React.DragEvent, id: OverviewSectionId) => {
    if (!draggedSection || draggedSection === id) return;
    e.preventDefault();
    if (dragOverSection !== id) {
      setDragOverSection(id);
    }
  };

  const handleSectionDrop = (e: React.DragEvent, targetId: OverviewSectionId) => {
    if (!draggedSection) return;
    e.preventDefault();
    const sourceId =
      (e.dataTransfer.getData('text/overview-section') as OverviewSectionId) || draggedSection;
    setDraggedSection(null);
    setDragOverSection(null);

    if (!sourceId || sourceId === targetId) return;
    const fromIdx = sectionOrder.indexOf(sourceId);
    const toIdx = sectionOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = [...sectionOrder];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setSectionOrder(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
    soundService.play('drag_drop');
    setUpdatedSection(sourceId);
    setTimeout(() => setUpdatedSection(null), 1500);
  };

  const renderSection = (secId: OverviewSectionId) => {
    const isDropTarget = dragOverSection === secId && draggedSection !== secId;
    const isPulsed = updatedSection === secId;

    if (secId === 'bento_hub') {
      return (
        <div
          key={secId}
          onDragOver={e => handleSectionDragOver(e, secId)}
          onDrop={e => handleSectionDrop(e, secId)}
          className={`transition-all rounded-[32px] ${
            isDropTarget ? 'ring-2 ring-indigo-500 bg-indigo-500/5 p-1' : ''
          } ${isPulsed ? 'animate-state-updated' : ''}`}
        >
          <TasklyBentoWorkspaceHub
            roleBadgeLabel={currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'WORKSPACE'}
          />
        </div>
      );
    }

    if (secId === 'workload_milestones') {
      return (
        <div
          key={secId}
          draggable
          onDragStart={e => handleSectionDragStart(e, secId)}
          onDragOver={e => handleSectionDragOver(e, secId)}
          onDrop={e => handleSectionDrop(e, secId)}
          onDragEnd={() => {
            setDraggedSection(null);
            setDragOverSection(null);
          }}
          className={`group relative transition-all rounded-[32px] ${
            isDropTarget ? 'ring-2 ring-indigo-500 bg-indigo-500/5 p-1' : ''
          } ${isPulsed ? 'animate-state-updated' : ''}`}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <GripIcon className="w-3.5 h-3.5 cursor-grab text-slate-400 group-hover:text-indigo-500" />
              Team Capacity &amp; Key Milestones
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-shrink-0">
            <TeamWorkloadWidget />
            <KeyMilestonesWidget />
          </div>
        </div>
      );
    }

    return (
      <div
        key={secId}
        draggable
        onDragStart={e => handleSectionDragStart(e, secId)}
        onDragOver={e => handleSectionDragOver(e, secId)}
        onDrop={e => handleSectionDrop(e, secId)}
        onDragEnd={() => {
          setDraggedSection(null);
          setDragOverSection(null);
        }}
        className={`group relative transition-all rounded-[32px] ${
          isDropTarget ? 'ring-2 ring-indigo-500 bg-indigo-500/5 p-1' : ''
        } ${isPulsed ? 'animate-state-updated' : ''}`}
      >
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <GripIcon className="w-3.5 h-3.5 cursor-grab text-slate-400 group-hover:text-indigo-500" />
            AI Co-Pilot Insights &amp; Risk Radar
          </span>
        </div>
        <AIInsightsEngineWidget />
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col ${
        showWelcomeMessage ? 'p-4 md:p-6' : 'p-0'
      } space-y-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}
    >
      {/* 1. Sleek 32px Welcome Banner */}
      {showWelcomeMessage && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[32px] p-5 sm:p-6 shadow-xl border border-indigo-900/60 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-full bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                  <SparklesIcon className="w-4 h-4 text-amber-300" />
                </span>
                <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                  {currentOrganization?.name || 'Workspace'} · Taskly &amp; Soft Glass Studio
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {currentUser
                  ? `Welcome back, ${currentUser.full_name || currentUser.email}`
                  : 'Workspace Performance'}
              </h1>
              <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
                Real-time concentric velocity rings, live 1080p standup studio, inline team chat, and 1-click task inspection.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-4 py-1.5 rounded-full bg-white/10 text-xs font-semibold text-indigo-200 border border-white/15">
                Role:{' '}
                <span className="text-white font-bold">
                  {currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'MEMBER'}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Customizable Sections (Defaults to Task Overview, Project Status, Meet Schedule & Calendar at the very top) */}
      {sectionOrder.map(secId => renderSection(secId))}
    </div>
  );
};
