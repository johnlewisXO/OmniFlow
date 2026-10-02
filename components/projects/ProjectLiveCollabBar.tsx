import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button';
import { UserPresence } from '../../types';

export const ProjectLiveCollabBar: React.FC = () => {
  const { activeProject, presences, currentUser, users, tasks, notifications, addToast } = useAppStore();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Active collaborators currently in this project or general view
  const activeCollabs = useMemo(() => {
    return presences.filter(p => p.userId !== currentUser?.id);
  }, [presences, currentUser]);

  // Recent interaction events on this project from notifications/activity
  const recentEvents = useMemo(() => {
    return notifications
      .filter(n => n.entity_type === 'task' || n.type?.startsWith('TASK_') || n.type?.startsWith('SPRINT_'))
      .slice(0, 4);
  }, [notifications]);

  const handleCopyUrl = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      addToast('URL Copied', 'App link copied to clipboard! Paste into a second tab or incognito window.', 'success');
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleSimulateTeammate = () => {
    const { updateUserPresence } = useAppStore.getState();
    const targetTask = tasks[0];
    setIsSimulating(true);

    // Simulate another collaborator joining and viewing
    const simCollab: UserPresence = {
      userId: 'sim_alex_carter_99',
      userName: 'Alex Carter (Lead Arch)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      currentTaskId: targetTask?.id,
      currentView: 'kanban',
      isEditing: false,
      editingField: undefined,
      isTypingComment: true,
      lastActive: new Date().toISOString(),
      color: '#ec4899',
    };

    useAppStore.setState(s => ({
      presences: [...s.presences.filter(p => p.userId !== simCollab.userId), simCollab]
    }));

    addToast(
      'Teammate Joined',
      `Alex Carter is now live on ${activeProject?.name || 'project'} viewing "${targetTask?.title || 'task'}"!`,
      'info'
    );

    // Broadcast across any open tabs
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('omni_collab_sync');
        bc.postMessage({ type: 'PRESENCE_BROADCAST', presence: simCollab });
        bc.close();
      } catch (e) {}
    }

    setTimeout(() => {
      setIsSimulating(false);
    }, 1200);
  };

  const handleResetSimulation = () => {
    useAppStore.setState(s => ({
      presences: s.presences.filter(p => !p.userId.startsWith('sim_'))
    }));
    addToast('Simulation Cleared', 'Simulated collaborators removed.', 'info');
  };

  if (!activeProject) return null;

  const totalActiveInProject = activeCollabs.length + 1;

  return (
    <>
      <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/95 via-indigo-950/90 to-slate-900/95 text-white border border-indigo-500/30 shadow-lg shadow-indigo-950/40 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 transition-all">
        
        {/* Subtle decorative glowing corner accent */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 relative z-10">
          {/* Left: Active Collaborators Radar & Badges */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 whitespace-nowrap flex items-center gap-1.5">
                  Live Collab Radar
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    {totalActiveInProject} online
                  </span>
                </span>
              </div>
            </div>

            <div className="h-4 w-px bg-white/10 hidden sm:block" />

            {/* Active Collaborator Avatars & Live Status Badges */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
              {activeCollabs.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
                  <span>Only you currently active on {activeProject.name}.</span>
                  <button
                    onClick={handleSimulateTeammate}
                    className="text-indigo-400 hover:text-indigo-200 underline font-medium text-[11px] cursor-pointer ml-1"
                  >
                    Simulate a teammate
                  </button>
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5 items-center">
                    {activeCollabs.slice(0, 5).map(collab => (
                      <div
                        key={collab.userId}
                        style={{ borderColor: collab.color || '#6366f1' }}
                        className="w-6 h-6 rounded-full border-2 ring-1 ring-black flex items-center justify-center text-[9px] font-black text-white overflow-hidden shadow-xs hover:scale-110 transition-transform cursor-pointer"
                        title={`${collab.userName} - ${collab.isEditing ? 'Currently Editing' : (collab.isTypingComment ? 'Typing Comment' : 'Viewing Board')}`}
                      >
                        {collab.userAvatar ? (
                          <img src={collab.userAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          collab.userName.charAt(0).toUpperCase()
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Status Badges for Active Collaborators */}
                  {activeCollabs.slice(0, 2).map(c => {
                    const viewingTask = c.currentTaskId ? tasks.find(t => t.id === c.currentTaskId) : null;
                    return (
                      <span
                        key={c.userId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 border border-white/15 text-indigo-200 shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-bold text-white">{c.userName.split(' ')[0]}</span>
                        {c.isEditing ? (
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            <ICON_MAP.PencilIcon className="w-2.5 h-2.5" />
                            editing {c.editingField || 'task'}
                          </span>
                        ) : c.isTypingComment ? (
                          <span className="text-purple-300 font-bold flex items-center gap-1">
                            <ICON_MAP.ChatBubbleLeftIcon className="w-2.5 h-2.5" />
                            typing comment...
                          </span>
                        ) : viewingTask ? (
                          <span className="truncate max-w-[130px] opacity-90">
                            viewing {viewingTask.title}
                          </span>
                        ) : (
                          <span className="opacity-80">viewing board</span>
                        )}
                      </span>
                    );
                  })}

                  {activeCollabs.length > 2 && (
                    <span className="text-[10px] font-bold text-slate-400">
                      +{activeCollabs.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Interaction Ticker & Verification / Testing Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {recentEvents.length > 0 && (
              <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">
                <ICON_MAP.BoltIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-bounce" />
                <span className="truncate max-w-[200px]">
                  {recentEvents[0].message || recentEvents[0].title}
                </span>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/70 to-purple-600/70 hover:from-indigo-600 hover:to-purple-600 border border-indigo-400/40 text-white text-[11px] font-bold shadow-xs hover:shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer"
              title="How to test real-time collaboration with two tabs or simulations"
            >
              <span>🧪 How to Test Real-Time</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Testing Helper Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <ICON_MAP.BoltIcon className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Real-Time Collaboration Verification Hub
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-indigo-900 dark:text-indigo-200">
                    ⚡ Quick Testing Options:
                  </p>
                  <button
                    onClick={handleCopyUrl}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
                  >
                    {copiedUrl ? '✓ Copied!' : '📋 Copy App URL'}
                  </button>
                </div>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  You can verify realtime in <strong>two browser tabs/windows side-by-side</strong> or trigger an instant <strong>1-Click simulation</strong> right now:
                </p>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={handleSimulateTeammate}
                    disabled={isSimulating}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <span>⚡ Simulate Colleague Activity</span>
                  </button>
                  <button
                    onClick={handleResetSimulation}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-[11px] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p><strong>Open Window A & Window B side-by-side:</strong> Open the app URL in a second browser tab or private/incognito window.</p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p><strong>Blinking Eye Live Viewer Badge:</strong> Click on any Task Card in Window A to open its modal. In Window B, look at the task card on the board — it immediately displays the glowing <strong>pulsating blinking eye circle</strong> with viewer avatars & count.</p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p><strong>Live Typing & Comments:</strong> In Window A, type into the comments box. Window B immediately shows the <em>"typing comment..."</em> status in the Live Collab Radar and on the task card.</p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <p><strong>Sprint Planning & Drag-and-Drop:</strong> Move a backlog item to Active Sprint or change task status column. Window B instantly reflects the movement without refreshing.</p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                  <p><strong>Teams Chat:</strong> Switch to Teams Chat in the side menu. Messages, typing status, and emoji reactions broadcast in real time across clients.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
              <Button variant="primary" size="sm" onClick={() => setShowGuideModal(false)}>
                Got it, start testing!
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
