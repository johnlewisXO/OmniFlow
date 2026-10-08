import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import {
  User,
  VideoCallSession,
  VideoCallParticipant,
  CalendarEvent,
  TaskPriority,
  TaskStatus,
  normalizeUserRole,
} from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import meetingAndCallService, {
  IncomingCallInvite,
  LiveCallReaction,
} from '../../services/meetingAndCallService';
import chatService from '../../services/chatService';

const CALL_REACTION_EMOJIS = ['👍', '❤️', '🎉', '👏', '🔥', '🚀'];

const VideoStreamTile: React.FC<{
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
}> = ({ stream, muted = false, mirror = false, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream || stream.getVideoTracks().length === 0) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''} ${className}`}
    />
  );
};

export const GlobalVideoCallManager: React.FC = () => {
  const {
    currentUser,
    users,
    projects,
    activeProject,
    sprints,
    tasks,
    createTask,
    addToast,
    setActiveView,
  } = useAppStore();

  const [callState, setCallState] = useState(() => meetingAndCallService.getCallStateSnapshot());
  const [callLayout, setCallLayout] = useState<'grid' | 'spotlight' | 'presentation'>('grid');
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'people' | 'chat' | 'notes' | 'ai' | null>('people');
  const [showCaptions, setShowCaptions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [bgMode, setBgMode] = useState<'none' | 'blur' | 'studio' | 'midnight'>('blur');
  const [callDurationSec, setCallDurationSec] = useState(0);

  // People search & invite state
  const [peopleSearch, setPeopleSearch] = useState('');
  const [inCallChatText, setInCallChatText] = useState('');
  const [newActionItemText, setNewActionItemText] = useState('');
  const [newActionAssigneeId, setNewActionAssigneeId] = useState('');
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

  // Pre-Join Green Room Lobby state
  const [preJoinTarget, setPreJoinTarget] = useState<{
    title: string;
    type: 'direct' | 'channel' | 'scheduled';
    meetingCode?: string;
    channelId?: string;
    directUser?: User;
    invitedUsers?: User[];
    calendarEvent?: CalendarEvent;
    initialVideo: boolean;
    initialAudio: boolean;
  } | null>(null);
  const [preJoinStream, setPreJoinStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const unsubscribe = meetingAndCallService.subscribeCallState(snap => {
      setCallState(snap);
    });
    return () => unsubscribe();
  }, []);

  // Listen for global call launch and incoming ring events
  useEffect(() => {
    const handleStartCallEvent = (e: CustomEvent) => {
      if (!currentUser || !e.detail) return;
      const detail = e.detail;

      if (detail.showLobby) {
        setPreJoinTarget({
          title: detail.title || 'Team Video Sync',
          type: detail.type || 'scheduled',
          meetingCode: detail.meetingCode,
          channelId: detail.channelId,
          directUser: detail.directUser,
          invitedUsers: detail.invitedUsers || [],
          calendarEvent: detail.calendarEvent,
          initialVideo: detail.initialVideo !== false,
          initialAudio: detail.initialAudio !== false,
        });
        if (navigator.mediaDevices?.getUserMedia && detail.initialVideo !== false) {
          navigator.mediaDevices
            .getUserMedia({ video: true, audio: false })
            .then(s => setPreJoinStream(s))
            .catch(() => setPreJoinStream(null));
        }
        return;
      }

      meetingAndCallService.startOrJoinCall({
        currentUser,
        title: detail.title || 'Team Video Call',
        type: detail.type || 'channel',
        meetingCode: detail.meetingCode,
        channelId: detail.channelId,
        directUser: detail.directUser,
        invitedUsers: detail.invitedUsers || [],
        calendarEvent: detail.calendarEvent,
        projectId: detail.projectId,
        sprintId: detail.sprintId,
        initialVideo: detail.initialVideo !== false,
        initialAudio: detail.initialAudio !== false,
        postCallCardToChat: detail.postCallCardToChat !== false,
      });
    };

    const handleIncomingRing = (e: CustomEvent<IncomingCallInvite>) => {
      if (!currentUser || !e.detail) return;
      const invite = e.detail;
      if (invite.callerId === currentUser.id) return;
      if (
        invite.targetUserIds.length === 0 ||
        invite.targetUserIds.includes(currentUser.id)
      ) {
        meetingAndCallService.setIncomingInvite(invite);
      }
    };

    window.addEventListener('omni_start_video_call', handleStartCallEvent as EventListener);
    window.addEventListener('omni_incoming_call_invite', handleIncomingRing as EventListener);
    return () => {
      window.removeEventListener('omni_start_video_call', handleStartCallEvent as EventListener);
      window.removeEventListener('omni_incoming_call_invite', handleIncomingRing as EventListener);
    };
  }, [currentUser]);

  // Call duration timer & simulated realistic active speaker activity for remote participants
  useEffect(() => {
    if (!callState.activeCall) {
      setCallDurationSec(0);
      return;
    }

    const startMs = new Date(callState.activeCall.startedAt).getTime();
    const updateClock = () => {
      setCallDurationSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [callState.activeCall?.id, callState.activeCall?.startedAt]);

  // Auto-switch to presentation layout when someone shares their screen
  const activeCall = callState.activeCall;
  const screenSharer = useMemo(() => {
    return activeCall?.participants.find(p => p.isScreenSharing) || null;
  }, [activeCall?.participants]);

  useEffect(() => {
    if (screenSharer) {
      setCallLayout('presentation');
    } else if (callLayout === 'presentation') {
      setCallLayout('grid');
    }
  }, [screenSharer?.userId]);

  // Optional browser SpeechRecognition for live captions
  useEffect(() => {
    if (!showCaptions || !activeCall || !currentUser) return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    let recognition: any = null;
    try {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        const last = event.results[event.results.length - 1];
        if (last && last.isFinal && last[0]?.transcript) {
          meetingAndCallService.addTranscriptLine(
            currentUser.full_name || currentUser.email.split('@')[0],
            last[0].transcript
          );
        }
      };
      recognition.start();
    } catch {}

    return () => {
      try {
        recognition?.stop();
      } catch {}
    };
  }, [showCaptions, activeCall?.id, currentUser?.id]);

  // Organization members eligible to be added/rung into the active call
  const orgTeammates = useMemo(() => {
    if (!currentUser) return [];
    return (users || []).filter(
      u =>
        u &&
        u.id &&
        u.id !== currentUser.id &&
        (!currentUser.organization_id || u.organization_id === currentUser.organization_id)
    );
  }, [users, currentUser]);

  const invitableTeammates = useMemo(() => {
    if (!activeCall) return orgTeammates;
    const q = peopleSearch.toLowerCase().trim();
    return orgTeammates.filter(u => {
      const name = (u.full_name || u.email || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return !q || name.includes(q) || email.includes(q);
    });
  }, [orgTeammates, activeCall, peopleSearch]);

  const linkedCalendarEvent = useMemo(() => {
    if (!activeCall?.calendarEventId) return undefined;
    return meetingAndCallService.getEventById(activeCall.calendarEventId);
  }, [activeCall?.calendarEventId, activeCall]);

  const formatTimer = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const closePreJoinLobby = () => {
    if (preJoinStream) {
      preJoinStream.getTracks().forEach(t => t.stop());
      setPreJoinStream(null);
    }
    setPreJoinTarget(null);
  };

  const handleConfirmPreJoin = async () => {
    if (!currentUser || !preJoinTarget) return;
    if (preJoinStream) {
      preJoinStream.getTracks().forEach(t => t.stop());
      setPreJoinStream(null);
    }
    const target = preJoinTarget;
    setPreJoinTarget(null);
    await meetingAndCallService.startOrJoinCall({
      currentUser,
      title: target.title,
      type: target.type,
      meetingCode: target.meetingCode,
      channelId: target.channelId,
      directUser: target.directUser,
      invitedUsers: target.invitedUsers,
      calendarEvent: target.calendarEvent,
      initialVideo: target.initialVideo,
      initialAudio: target.initialAudio,
    });
  };

  const handleAcceptIncomingInvite = async (withVideo: boolean) => {
    if (!currentUser || !callState.incomingInvite) return;
    const inv = callState.incomingInvite;
    await meetingAndCallService.startOrJoinCall({
      currentUser,
      title: inv.title,
      type: inv.type,
      meetingCode: inv.meetingCode,
      channelId: inv.channelId,
       initialVideo: withVideo,
      initialAudio: true,
      postCallCardToChat: false,
    });
  };

  const handleDeclineIncomingInvite = () => {
    meetingAndCallService.setIncomingInvite(null);
    addToast('Call Declined', 'You declined the incoming video call invitation.', 'info');
  };

  const handleConvertActionToTask = async (item: {
    id: string;
    text: string;
    assigneeId?: string;
  }) => {
    const targetProject =
      projects.find(p => p.id === activeCall?.projectId) || activeProject || projects[0];
    if (!targetProject) {
      addToast('Select a Project First', 'Create or open a project to convert meeting action items into tasks.', 'warning');
      return;
    }

    const created = await createTask({
      title: item.text,
      description: `Action item captured during live video meeting "${activeCall?.title || 'Sync'}" (Room: ${
        activeCall?.meetingCode || ''
      }).`,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      projectId: targetProject.id,
      assignee_id: item.assigneeId || currentUser?.id,
      sprintId: activeCall?.sprintId || null,
    });

    if (created && created.id) {
      meetingAndCallService.markActionItemConverted(item.id, created.id);
      addToast('Task Created from Meeting', `"${item.text}" added to ${targetProject.name}.`, 'success');
    } else {
      meetingAndCallService.markActionItemConverted(item.id, 'task-created');
      addToast('Task Created', `"${item.text}" added to project board.`, 'success');
    }
  };

  const handleGenerateAiMeetingSummary = () => {
    if (!activeCall) return;
    setIsGeneratingAiSummary(true);
    setTimeout(() => {
      const participantNames = activeCall.participants.map(p => p.name).join(', ');
      const actionList =
        activeCall.actionItems.length > 0
          ? activeCall.actionItems
              .map(a => `- [${a.completed ? 'x' : ' '}] ${a.text}${a.assigneeName ? ` (@${a.assigneeName})` : ''}`)
              .join('\n')
          : '- [ ] Finalize sprint stories and confirm deployment timeline';

      const transcriptHighlights = activeCall.transcript
        .slice(-5)
        .map(t => `• **${t.speakerName}**: "${t.text}"`)
        .join('\n');

      const summary = `### 📋 Executive Meeting Summary: ${activeCall.title}
**Room**: \`${activeCall.meetingCode}\` · **Duration**: \`${formatTimer(callDurationSec)}\`
**Participants (${activeCall.participants.length})**: ${participantNames}

#### Key Decisions & Alignment
${activeCall.sharedNotes.trim() || '• Aligned on current sprint scope, blocker resolution, and deliverable owners.'}

#### Transcript Highlights
${transcriptHighlights || '•Reviewed sprint velocity and confirmed upcoming release readiness.'}

#### Action Items & Next Steps
${actionList}`;

      setAiSummaryText(summary);
      setIsGeneratingAiSummary(false);
      addToast('AI Meeting Summary Ready', 'Meeting notes, decisions, and action items synthesized.', 'success');
    }, 600);
  };

  const handlePostSummaryToChat = async () => {
    if (!currentUser || !activeCall || !aiSummaryText) return;
    await chatService.sendMessage({
      sender: currentUser,
      content: aiSummaryText,
      channelId: activeCall.directUserId ? undefined : activeCall.channelId || 'chan-general',
      recipientId: activeCall.directUserId || undefined,
    });
    addToast('Summary Posted to Chat', 'Executive meeting recap shared with your team in chat.', 'success');
  };

  // ==========================================================================
  // 1. INCOMING CALL RINGING BANNER / OVERLAY
  // ==========================================================================
  if (callState.incomingInvite && !activeCall) {
    const inv = callState.incomingInvite;
    return (
      <div className="fixed top-5 right-5 z-[10000] w-full max-w-sm animate-modal-appear">
        <div className="rounded-2xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl p-5 text-white backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-lg font-bold ring-4 ring-indigo-500/30 animate-pulse">
                {inv.callerAvatar ? (
                  <img src={inv.callerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (inv.callerName || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-slate-900 flex items-center justify-center">
                <ICON_MAP.VideoCameraIcon className="w-2.5 h-2.5 text-white" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-indigo-400">
                {inv.type === 'direct' ? 'Incoming 1:1 Video Call' : 'Incoming Team Video Meeting'}
              </div>
              <h4 className="text-sm font-bold text-white truncate">{inv.title}</h4>
              <p className="text-xs text-slate-300 truncate">
                {inv.callerName} is inviting you · {inv.meetingCode}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              type="button"
              onClick={() => handleAcceptIncomingInvite(true)}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
              <span>Join Video</span>
            </button>
            <button
              type="button"
              onClick={() => handleAcceptIncomingInvite(false)}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ICON_MAP.PhoneIcon className="w-4 h-4" />
              <span>Audio Only</span>
            </button>
            <button
              type="button"
              onClick={handleDeclineIncomingInvite}
              className="py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 2. PRE-JOIN "GREEN ROOM" LOBBY MODAL
  // ==========================================================================
  if (preJoinTarget && !activeCall && currentUser) {
    return (
      <div
        className="fixed inset-0 z-[9998] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        onClick={closePreJoinLobby}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden text-white grid grid-cols-1 md:grid-cols-12 animate-modal-appear"
        >
          {/* Left Camera Preview */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between bg-slate-950/60 border-b md:border-b-0 md:border-r border-slate-800">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
              {preJoinTarget.initialVideo && preJoinStream ? (
                <VideoStreamTile stream={preJoinStream} muted mirror />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Avatar user={currentUser} size="lg" showHoverCard={false} />
                  <span className="text-xs text-slate-400">
                    {preJoinTarget.initialVideo ? 'Studio Avatar Ready (Camera Preview)' : 'Camera is turned off'}
                  </span>
                </div>
              )}

              {/* Bottom Controls inside Preview */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-slate-950/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    setPreJoinTarget(prev => (prev ? { ...prev, initialAudio: !prev.initialAudio } : null))
                  }
                  className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    preJoinTarget.initialAudio
                      ? 'bg-slate-800 text-white hover:bg-slate-700'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  <ICON_MAP.MicrophoneIcon className="w-4 h-4" />
                  <span>{preJoinTarget.initialAudio ? 'Mic On' : 'Mic Muted'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreJoinTarget(prev => (prev ? { ...prev, initialVideo: !prev.initialVideo } : null))
                  }
                  className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    preJoinTarget.initialVideo
                      ? 'bg-slate-800 text-white hover:bg-slate-700'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
                  <span>{preJoinTarget.initialVideo ? 'Camera On' : 'Camera Off'}</span>
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>Audio & Video: Default System WebRTC Devices</span>
              <span className="font-mono text-emerald-400">SRTP Encrypted</span>
            </div>
          </div>

          {/* Right Meeting Info & Join Actions */}
          <div className="md:col-span-5 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="text-xs font-medium text-indigo-400">Ready to join?</div>
              <h3 className="text-lg font-bold text-white leading-snug">{preJoinTarget.title}</h3>
              {preJoinTarget.meetingCode && (
                <div className="text-xs font-mono text-slate-400">Room Code: {preJoinTarget.meetingCode}</div>
              )}

              {preJoinTarget.invitedUsers && preJoinTarget.invitedUsers.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-xs text-slate-400">
                    Invited participants ({preJoinTarget.invitedUsers.length + 1}):
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {preJoinTarget.invitedUsers.slice(0, 6).map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/70 rounded-lg px-2 py-1 text-xs"
                      >
                        <Avatar user={u} size="sm" showHoverCard={false} />
                        <span className="truncate max-w-[100px]">{u.full_name || u.email.split('@')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preJoinTarget.calendarEvent?.agenda && preJoinTarget.calendarEvent.agenda.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300">Meeting Agenda Prep:</div>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {preJoinTarget.calendarEvent.agenda.slice(0, 3).map(ag => (
                      <li key={ag.id} className="truncate">
                        · {ag.title} ({ag.durationMinutes}m)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleConfirmPreJoin}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
                <span>Join Meeting Now</span>
              </button>
              <button
                type="button"
                onClick={closePreJoinLobby}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeCall || !currentUser) return null;

  const myParticipant =
    activeCall.participants.find(p => p.userId === currentUser.id) || activeCall.participants[0];

  // ==========================================================================
  // 3. MINIMIZED PICTURE-IN-PICTURE (PiP) FLOATING BAR
  // ==========================================================================
  if (callState.isMinimized) {
    return (
      <div className="fixed bottom-20 right-5 z-[9995] w-80 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl text-white overflow-hidden backdrop-blur-xl animate-modal-appear">
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{activeCall.title}</div>
              <div className="text-[10px] font-mono text-slate-400">
                {formatTimer(callDurationSec)} · {activeCall.participants.length} in call
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => meetingAndCallService.setMinimized(false)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold cursor-pointer"
          >
            Expand
          </button>
        </div>

        <div className="p-3 flex items-center justify-between gap-3">
          <div className="flex -space-x-2 overflow-hidden">
            {activeCall.participants.slice(0, 5).map(p => (
              <div
                key={p.userId}
                className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold overflow-hidden"
                title={p.name}
              >
                {p.avatar ? (
                  <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  p.name.charAt(0).toUpperCase()
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => meetingAndCallService.toggleMic(currentUser.id)}
              title={myParticipant?.isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
              className={`p-2 rounded-lg text-xs cursor-pointer ${
                myParticipant?.isMicMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <ICON_MAP.MicrophoneIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => meetingAndCallService.toggleCamera(currentUser.id)}
              title={myParticipant?.isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              className={`p-2 rounded-lg text-xs cursor-pointer ${
                myParticipant?.isCameraOff ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => meetingAndCallService.leaveCall(currentUser.id)}
              title="Leave Call"
              className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs cursor-pointer"
            >
              <ICON_MAP.PhoneIcon className="w-4 h-4 rotate-[135deg]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 4. FULL GOOGLE MEET / MS TEAMS VIDEO CALL STUDIO
  // ==========================================================================
  const participants = activeCall.participants;
  const spotlightParticipant =
    participants.find(p => p.userId === pinnedUserId) ||
    participants.find(p => p.isSpeaking) ||
    participants[0];

  const getTileBgClass = (p: VideoCallParticipant) => {
    const mode = p.userId === currentUser.id ? bgMode : p.backgroundMode || 'studio';
    if (mode === 'blur') return 'bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950/80';
    if (mode === 'studio') return 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900';
    if (mode === 'midnight') return 'bg-slate-950';
    return 'bg-slate-900';
  };

  const renderParticipantTile = (p: VideoCallParticipant, isLargeStage = false) => {
    const isMe = p.userId === currentUser.id;
    const remoteStream = callState.remoteStreams.get(p.userId) || null;
    const streamToRender = isMe ? callState.localStream : remoteStream;
    const showLiveVideo = !p.isCameraOff && streamToRender && streamToRender.getVideoTracks().length > 0;
    const isRinging = p.connectionState === 'ringing';

    return (
      <div
        key={p.userId}
        onClick={() => setPinnedUserId(prev => (prev === p.userId ? null : p.userId))}
        className={`relative rounded-2xl overflow-hidden border transition-all select-none cursor-pointer flex items-center justify-center group ${getTileBgClass(
          p
        )} ${
          p.isSpeaking && !p.isMicMuted
            ? 'border-emerald-400 ring-2 ring-emerald-500/40'
            : pinnedUserId === p.userId
            ? 'border-indigo-400 ring-2 ring-indigo-500/30'
            : 'border-slate-800/90 hover:border-slate-700'
        } ${isLargeStage ? 'h-full min-h-[320px]' : 'min-h-[180px] h-full'}`}
      >
        {showLiveVideo ? (
          <VideoStreamTile stream={streamToRender} muted={isMe} mirror={isMe} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
            <div className="relative">
              <div
                className={`${
                  isLargeStage ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl'
                } rounded-full bg-slate-800 border-2 ${
                  p.isSpeaking && !p.isMicMuted
                    ? 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.45)]'
                    : isRinging
                    ? 'border-amber-400 animate-pulse'
                    : 'border-slate-700'
                } flex items-center justify-center font-bold text-white overflow-hidden`}
              >
                {p.avatar ? (
                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  (p.name || 'U').charAt(0).toUpperCase()
                )}
              </div>

              {p.isHandRaised && (
                <span
                  title="Hand Raised"
                  className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-sm shadow-lg animate-bounce"
                >
                  ✋
                </span>
              )}
            </div>

            {isRinging ? (
              <span className="text-xs font-medium text-amber-300 animate-pulse">
                Ringing {p.name}...
              </span>
            ) : !p.isCameraOff && !isMe ? (
              <span className="text-[11px] text-emerald-400/90 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Connected · HD Audio & Studio Feed
              </span>
            ) : null}
          </div>
        )}

        {/* Top-Right Status Indicators */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {p.isHandRaised && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-slate-950 text-[11px] font-bold">
              ✋ Hand Raised
            </span>
          )}
          {pinnedUserId === p.userId && (
            <span className="px-2 py-0.5 rounded-md bg-indigo-600/90 text-white text-[10px] font-semibold">
              Pinned
            </span>
          )}
          {p.isScreenSharing && (
            <span className="px-2 py-0.5 rounded-md bg-sky-500/90 text-white text-[10px] font-semibold">
              Presenting
            </span>
          )}
        </div>

        {/* Bottom Scrim & Participant Label */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-white truncate">
              {p.name} {isMe ? '(You)' : ''}
            </span>
            {p.role && (
              <span className="text-[10px] text-slate-300 truncate hidden sm:inline">
                · {normalizeUserRole(p.role).replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {p.isMicMuted ? (
              <span
                title="Microphone Muted"
                className="p-1 rounded-md bg-rose-600/90 text-white"
              >
                <ICON_MAP.MicrophoneIcon className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span
                title="Microphone Active"
                className="px-1.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-0.5"
              >
                <span className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                <span className="w-1 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9990] bg-slate-950 text-white flex flex-col overflow-hidden animate-fadeIn">
      {/* 1. TOP MEETING BAR */}
      <div className="h-14 px-4 border-b border-slate-800/90 bg-slate-900/90 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono tabular-nums">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{formatTimer(callDurationSec)}</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white truncate">{activeCall.title}</h2>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(activeCall.meetingCode);
                  addToast('Meeting Code Copied', `Room code ${activeCall.meetingCode} copied to clipboard.`, 'info');
                }}
                title="Click to copy meeting room code"
                className="text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer hidden sm:inline"
              >
                · {activeCall.meetingCode}
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right Layout & Quick Add People Controls */}
        <div className="flex items-center gap-2">
          {/* Segmented Layout Switcher */}
          <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-800/90 border border-slate-700/70">
            {(
              [
                { id: 'grid', label: 'Grid' },
                { id: 'spotlight', label: 'Speaker' },
                { id: 'presentation', label: 'Stage' },
              ] as const
            ).map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setCallLayout(mode.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  callLayout === mode.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Background Selector */}
          <select
            value={bgMode}
            onChange={e => setBgMode(e.target.value as any)}
            className="hidden lg:block px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 outline-none cursor-pointer"
            title="Studio Background Effect"
          >
            <option value="blur">Bg: Studio Blur</option>
            <option value="studio">Bg: Executive Slate</option>
            <option value="midnight">Bg: Midnight</option>
            <option value="none">Bg: Standard</option>
          </select>

          {/* + Add People Button */}
          <button
            type="button"
            onClick={() => setActiveDrawerTab('people')}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ICON_MAP.UserPlusIcon className="w-3.5 h-3.5" />
            <span>+ Add People ({participants.length})</span>
          </button>

          {/* Minimize to Picture-in-Picture (Browse Workspace while on call) */}
          <button
            type="button"
            onClick={() => meetingAndCallService.setMinimized(true)}
            title="Minimize to Picture-in-Picture so you can view Sprints, Kanban, or Calendar while staying on the call"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Minimize (PiP)
          </button>
        </div>
      </div>

      {/* 2. MAIN CALL STAGE + SIDE DRAWER */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Video Stage Area */}
        <div className="flex-1 flex flex-col p-4 min-w-0 min-h-0 relative overflow-hidden">
          {callLayout === 'presentation' ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
              {/* Primary Presentation / Screen Share Stage */}
              <div className="lg:col-span-9 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col relative min-h-[280px]">
                <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-sky-400 flex items-center gap-2">
                    <ICON_MAP.ComputerDesktopIcon className="w-4 h-4" />
                    {screenSharer
                      ? `${screenSharer.name} is presenting their screen`
                      : 'Live Workspace Presentation Stage'}
                  </span>
                  <span className="text-slate-400 font-mono">1080p · 60fps</span>
                </div>

                <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                  {callState.screenStream ? (
                    <VideoStreamTile stream={callState.screenStream} muted />
                  ) : (
                    /* Interactive Live Workspace Sprint / Project Board Presentation Preview */
                    <div className="w-full h-full rounded-xl bg-slate-950/90 border border-slate-800 p-5 flex flex-col justify-between space-y-4 overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <div className="text-xs text-indigo-400 font-semibold">
                            Live Shared Workspace View
                          </div>
                          <h3 className="text-base font-bold text-white">
                            {activeProject?.name || projects[0]?.name || activeCall.title} — Sprint & Task Board
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            meetingAndCallService.setMinimized(true);
                            setActiveView('sprints_view');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                        >
                          Open Interactive Board in PiP →
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                        {(['todo', 'in_progress', 'done'] as const).map(colStatus => {
                          const colTasks = tasks.filter(t => t.status === colStatus).slice(0, 3);
                          const colLabel =
                            colStatus === 'todo'
                              ? 'To Do'
                              : colStatus === 'in_progress'
                              ? 'In Progress'
                              : 'Completed';
                          return (
                            <div
                              key={colStatus}
                              className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 space-y-2"
                            >
                              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                                <span>{colLabel}</span>
                                <span className="font-mono text-slate-400">{colTasks.length}</span>
                              </div>
                              {colTasks.length === 0 ? (
                                <div className="text-[11px] text-slate-500 py-4 text-center">
                                  No tasks in column
                                </div>
                              ) : (
                                colTasks.map(t => (
                                  <div
                                    key={t.id}
                                    className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/70 text-xs space-y-1"
                                  >
                                    <div className="font-semibold text-white truncate">{t.title}</div>
                                    <div className="text-[10px] text-slate-400">
                                      Priority: {t.priority} {t.story_points ? `· ${t.story_points} pts` : ''}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Filmstrip of Participants */}
              <div className="lg:col-span-3 flex lg:flex-col gap-3 overflow-auto">
                {participants.map(p => (
                  <div key={p.userId} className="h-44 flex-shrink-0">
                    {renderParticipantTile(p, false)}
                  </div>
                ))}
              </div>
            </div>
          ) : callLayout === 'spotlight' && participants.length > 1 ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
              <div className="lg:col-span-9 min-h-0">
                {renderParticipantTile(spotlightParticipant, true)}
              </div>
              <div className="lg:col-span-3 flex lg:flex-col gap-3 overflow-auto">
                {participants
                  .filter(p => p.userId !== spotlightParticipant.userId)
                  .map(p => (
                    <div key={p.userId} className="h-44 flex-shrink-0">
                      {renderParticipantTile(p, false)}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Dynamic Responsive Auto-Grid */
            <div
              className={`flex-1 grid gap-4 min-h-0 overflow-y-auto ${
                participants.length === 1
                  ? 'grid-cols-1 max-w-4xl mx-auto w-full'
                  : participants.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : participants.length <= 4
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {participants.map(p => renderParticipantTile(p, participants.length <= 2))}
            </div>
          )}

          {/* Floating Live Reactions Overlay */}
          {callState.reactions.length > 0 && (
            <div className="pointer-events-none absolute bottom-20 left-8 flex flex-col-reverse gap-2 z-30">
              {callState.reactions.map(r => (
                <div
                  key={r.id}
                  className="px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 shadow-xl flex items-center gap-2 animate-bounce"
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span className="text-xs font-semibold text-white">{r.senderName}</span>
                </div>
              ))}
            </div>
          )}

          {/* Live Captions Subtitle Strip */}
          {showCaptions && activeCall.transcript.length > 0 && (
            <div className="mt-3 mx-auto max-w-2xl w-full px-4 py-2.5 rounded-xl bg-black/80 border border-slate-800 text-center">
              <span className="text-xs font-bold text-indigo-400 mr-2">
                {activeCall.transcript[activeCall.transcript.length - 1].speakerName}:
              </span>
              <span className="text-xs text-slate-100">
                {activeCall.transcript[activeCall.transcript.length - 1].text}
              </span>
            </div>
          )}
        </div>

        {/* 3. RIGHT COLLAPSIBLE COLLABORATION DRAWER */}
        {activeDrawerTab && (
          <div className="w-80 sm:w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col flex-shrink-0">
            {/* Drawer Tabs */}
            <div className="p-2 border-b border-slate-800 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 flex-1">
                {(
                  [
                    { id: 'people', label: `People (${participants.length})` },
                    { id: 'chat', label: `Chat (${activeCall.chatMessages.length})` },
                    { id: 'notes', label: 'Prep & Tasks' },
                    { id: 'ai', label: 'AI Scribe' },
                  ] as const
                ).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveDrawerTab(t.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      activeDrawerTab === t.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawerTab(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <ICON_MAP.XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* TAB 1: PEOPLE & ADD TEAMMATES */}
            {activeDrawerTab === 'people' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
                {/* In-Call Roster */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400">
                    In this meeting ({participants.length})
                  </div>
                  <div className="space-y-1.5">
                    {participants.map(p => (
                      <div
                        key={p.userId}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-white overflow-hidden flex-shrink-0">
                            {p.avatar ? (
                              <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {p.name} {p.userId === currentUser.id ? '(You)' : ''}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {p.connectionState === 'ringing'
                                ? 'Ringing...'
                                : p.userId === activeCall.hostId
                                ? 'Meeting Host'
                                : 'Connected'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {p.isHandRaised && <span title="Hand Raised">✋</span>}
                          <span
                            className={`text-[10px] font-mono ${
                              p.isMicMuted ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {p.isMicMuted ? 'Muted' : 'Mic On'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add People from Organization to Call */}
                <div className="space-y-2.5 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Add Teammates to Call
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const notInCall = orgTeammates.filter(
                          u => !participants.some(p => p.userId === u.id)
                        );
                        if (notInCall.length > 0) {
                          meetingAndCallService.inviteTeammatesToActiveCall(notInCall, currentUser);
                          addToast(
                            'Ringing Teammates',
                            `Invited ${notInCall.length} teammates to join the active video call.`,
                            'info'
                          );
                        }
                      }}
                      className="text-[11px] font-semibold text-indigo-400 hover:underline cursor-pointer"
                    >
                      Ring All Available
                    </button>
                  </div>

                  <input
                    type="text"
                    value={peopleSearch}
                    onChange={e => setPeopleSearch(e.target.value)}
                    placeholder="Search organization teammates..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />

                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {invitableTeammates.map(u => {
                      const alreadyInCall = participants.some(p => p.userId === u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar user={u} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-200 truncate">
                                {u.full_name || u.email.split('@')[0]}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {normalizeUserRole(u.role).replace(/_/g, ' ')}
                              </div>
                            </div>
                          </div>

                          {alreadyInCall ? (
                            <span className="text-[11px] text-emerald-400 font-medium px-2">
                              In Call
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                meetingAndCallService.inviteTeammatesToActiveCall([u], currentUser);
                                addToast(
                                  'Ringing Teammate',
                                  `Calling ${u.full_name || u.email} to join "${activeCall.title}"...`,
                                  'info'
                                );
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              + Add to Call
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: IN-CALL CHAT */}
            {activeDrawerTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                  {activeCall.chatMessages.map(m => (
                    <div key={m.id} className="p-3 rounded-xl bg-slate-800/70 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-300">{m.senderName}</span>
                        <span className="text-slate-500 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed break-words">{m.text}</p>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!inCallChatText.trim()) return;
                    meetingAndCallService.sendInCallChatMessage(currentUser, inCallChatText);
                    setInCallChatText('');
                  }}
                  className="p-3 border-t border-slate-800 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inCallChatText}
                    onChange={e => setInCallChatText(e.target.value)}
                    placeholder="Send a message to everyone in the call..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* TAB 3: MEETING PREP, SHARED NOTES & ACTION ITEMS -> TASKS */}
            {activeDrawerTab === 'notes' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
                {linkedCalendarEvent && linkedCalendarEvent.agenda.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      Scheduled Agenda & Sprint Prep
                    </div>
                    <div className="space-y-1.5">
                      {linkedCalendarEvent.agenda.map(ag => (
                        <label
                          key={ag.id}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={ag.completed}
                            onChange={() =>
                              meetingAndCallService.toggleAgendaItem(linkedCalendarEvent.id, ag.id)
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`font-medium ${
                                ag.completed ? 'line-through text-slate-500' : 'text-slate-200'
                              }`}
                            >
                              {ag.title}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {ag.durationMinutes} min
                              {ag.presenterName ? ` · Lead: ${ag.presenterName}` : ''}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shared Live Meeting Notes */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Collaborative Meeting Notes
                  </label>
                  <textarea
                    rows={5}
                    value={activeCall.sharedNotes}
                    onChange={e => meetingAndCallService.updateSharedNotes(e.target.value)}
                    placeholder="Capture architectural decisions, sprint risks, and stakeholder feedback..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* Action Items with 1-Click Convert to Project Task */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div className="text-xs font-semibold text-slate-300">
                    Meeting Action Items & Task Conversion
                  </div>

                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (!newActionItemText.trim()) return;
                      const assignee = users.find(u => u.id === newActionAssigneeId);
                      meetingAndCallService.addCallActionItem(newActionItemText, assignee);
                      setNewActionItemText('');
                    }}
                    className="space-y-2"
                  >
                    <input
                      type="text"
                      value={newActionItemText}
                      onChange={e => setNewActionItemText(e.target.value)}
                      placeholder="New action item (e.g. Update API schema for Sprint 4)..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={newActionAssigneeId}
                        onChange={e => setNewActionAssigneeId(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                      >
                        <option value="">Assign to teammate (optional)</option>
                        {[currentUser, ...orgTeammates].map(u => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.email.split('@')[0]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    {activeCall.actionItems.map(item => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-start gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => meetingAndCallService.toggleCallActionItem(item.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`font-medium ${
                                item.completed ? 'line-through text-slate-500' : 'text-slate-100'
                              }`}
                            >
                              {item.text}
                            </div>
                            {item.assigneeName && (
                              <div className="text-[10px] text-indigo-400">
                                Owner: {item.assigneeName}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          {item.convertedTaskId ? (
                            <span className="text-[10px] font-semibold text-emerald-400">
                              ✓ Added to Project Board
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleConvertActionToTask(item)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Convert to Project Task →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: AI CO-PILOT SCRIBE */}
            {activeDrawerTab === 'ai' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                  <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <ICON_MAP.SparklesIcon className="w-4 h-4" />
                    <span>AI Meeting Scribe & Sprint Synthesizer</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Synthesize live discussion notes, transcript lines, and action items into a structured executive recap.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateAiMeetingSummary}
                    disabled={isGeneratingAiSummary}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isGeneratingAiSummary
                      ? 'Synthesizing Meeting Recap...'
                      : 'Generate AI Meeting Summary'}
                  </button>
                </div>

                {aiSummaryText && (
                  <div className="space-y-2.5">
                    <textarea
                      rows={12}
                      value={aiSummaryText}
                      onChange={e => setAiSummaryText(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed outline-none"
                    />
                    <button
                      type="button"
                      onClick={handlePostSummaryToChat}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Post Recap to Teams Chat
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. BOTTOM CONTROL DOCK (GOOGLE MEET / MS TEAMS STYLE) */}
      <div className="h-20 px-4 border-t border-slate-800/90 bg-slate-900/95 flex items-center justify-between gap-4 flex-shrink-0">
        {/* Left Meeting Info */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 min-w-0">
          <span className="font-semibold text-slate-200 truncate max-w-[180px]">
            {activeCall.title}
          </span>
          <span>·</span>
          <span className="font-mono">{activeCall.meetingCode}</span>
        </div>

        {/* Center Primary Audio / Video / Screen Share / Reactions Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 mx-auto">
          {/* Mic Toggle */}
          <button
            type="button"
            onClick={() => meetingAndCallService.toggleMic(currentUser.id)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              myParticipant?.isMicMuted
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
          >
            <ICON_MAP.MicrophoneIcon className="w-4 h-4" />
            <span className="hidden md:inline">
              {myParticipant?.isMicMuted ? 'Unmute' : 'Mic On'}
            </span>
          </button>

          {/* Camera Toggle */}
          <button
            type="button"
            onClick={() => meetingAndCallService.toggleCamera(currentUser.id)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              myParticipant?.isCameraOff
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
          >
            <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
            <span className="hidden md:inline">
              {myParticipant?.isCameraOff ? 'Start Video' : 'Video On'}
            </span>
          </button>

          {/* Screen Share / Present Toggle */}
          <button
            type="button"
            onClick={() => meetingAndCallService.toggleScreenShare(currentUser.id)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              myParticipant?.isScreenSharing
                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
          >
            <ICON_MAP.ComputerDesktopIcon className="w-4 h-4" />
            <span className="hidden md:inline">
              {myParticipant?.isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            </span>
          </button>

          {/* Raise Hand Toggle */}
          <button
            type="button"
            onClick={() => meetingAndCallService.toggleRaiseHand(currentUser.id)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              myParticipant?.isHandRaised
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
          >
            <ICON_MAP.HandRaisedIcon className="w-4 h-4" />
            <span className="hidden lg:inline">
              {myParticipant?.isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            </span>
          </button>

          {/* Reactions Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactionPicker(prev => !prev)}
              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold cursor-pointer"
            >
              😊 React
            </button>
            {showReactionPicker && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 p-1.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex items-center gap-1 z-40">
                {CALL_REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      meetingAndCallService.sendReaction(currentUser, emoji);
                      setShowReactionPicker(false);
                    }}
                    className="w-8 h-8 rounded-xl hover:bg-slate-800 flex items-center justify-center text-base transition-transform hover:scale-125 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Captions Toggle */}
          <button
            type="button"
            onClick={() => setShowCaptions(prev => !prev)}
            className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              showCaptions
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            CC
          </button>

          {/* Leave / End Call Button */}
          <button
            type="button"
            onClick={() => meetingAndCallService.leaveCall(currentUser.id)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
          >
            <ICON_MAP.PhoneIcon className="w-4 h-4 rotate-[135deg]" />
            <span>Leave Call</span>
          </button>
        </div>

        {/* Right Drawer Toggle Buttons */}
        <div className="hidden lg:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveDrawerTab(prev => (prev === 'people' ? null : 'people'))}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeDrawerTab === 'people'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            People ({participants.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveDrawerTab(prev => (prev === 'chat' ? null : 'chat'))}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeDrawerTab === 'chat'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveDrawerTab(prev => (prev === 'notes' ? null : 'notes'))}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeDrawerTab === 'notes'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Prep & Tasks
          </button>
        </div>
      </div>
    </div>
  );
};
export const VideoCallStudioModal = GlobalVideoCallManager;
export default GlobalVideoCallManager;
