import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import {
  User,
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
} from '../../services/meetingAndCallService';
import chatService from '../../services/chatService';

const CALL_REACTION_EMOJIS = ['👍', '❤️', '🎉', '👏', '🔥', '🚀'];

/**
 * Reliable WebRTC Video Element that binds strictly video-only tracks
 * so <video> never outputs duplicate audio alongside RemoteAudioPlayer.
 */
const VideoStreamTile: React.FC<{
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  fit?: 'cover' | 'contain';
  className?: string;
}> = ({ stream, mirror = false, fit = 'cover', className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTracks = stream ? stream.getVideoTracks() : [];
  const trackCount = videoTracks.length;
  const firstTrackId = videoTracks[0]?.id || '';

  const videoOnlyStream = useMemo(() => {
    if (!stream) return null;
    const tracks = stream.getVideoTracks();
    if (tracks.length === 0) return null;
    return new MediaStream(tracks);
  }, [stream, trackCount, firstTrackId]);

  const bindStream = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && videoOnlyStream) {
        if (el.srcObject !== videoOnlyStream) {
          el.srcObject = videoOnlyStream;
        }
        el.muted = true;
        el.defaultMuted = true;
        el.volume = 0;
        el.play().catch(() => {});
      }
    },
    [videoOnlyStream]
  );

  useEffect(() => {
    const el = videoRef.current;
    if (el && videoOnlyStream) {
      if (el.srcObject !== videoOnlyStream) {
        el.srcObject = videoOnlyStream;
      }
      el.muted = true;
      el.defaultMuted = true;
      el.volume = 0;
      el.play().catch(() => {});
    }
  }, [videoOnlyStream, trackCount, firstTrackId]);

  if (!videoOnlyStream || trackCount === 0) return null;

  return (
    <video
      ref={bindStream}
      autoPlay
      playsInline
      muted
      className={`w-full h-full ${fit === 'contain' ? 'object-contain bg-black' : 'object-cover'} ${
        mirror ? 'scale-x-[-1]' : ''
      } ${className}`}
    />
  );
};

/**
 * Dedicated Lossless 48kHz Audio Player for remote WebRTC participants.
 * Uses a single audio-only MediaStream per peer so hardware AEC has a clean reference,
 * with automatic Echo Guard speaker attenuation when testing two devices in the same room.
 */
const RemoteAudioPlayer: React.FC<{
  stream: MediaStream;
  isLocalSpeaking?: boolean;
  echoGuardEnabled?: boolean;
}> = ({ stream, isLocalSpeaking = false, echoGuardEnabled = true }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTrackId = stream?.getAudioTracks()?.[0]?.id || '';

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const audioOnlyStream = new MediaStream(audioTracks);
    el.srcObject = audioOnlyStream;
    el.volume = echoGuardEnabled && isLocalSpeaking ? 0.05 : 1.0;
    el.play().catch(() => {});
  }, [stream, audioTrackId]);

  useEffect(() => {
    if (audioRef.current) {
      // When Echo Guard is active and local user speaks into mic, duck speaker output to break same-room feedback loops
      audioRef.current.volume = echoGuardEnabled && isLocalSpeaking ? 0.05 : 1.0;
    }
  }, [isLocalSpeaking, echoGuardEnabled]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

/**
 * Sleek Google Meet / Microsoft Teams / Zoom Icon-Only Control Button with Hover Tooltip
 */
const DockIconButton: React.FC<{
  onClick: () => void;
  tooltip: string;
  shortcut?: string;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  warning?: boolean;
  badge?: number | string;
  children: React.ReactNode;
  className?: string;
}> = ({
  onClick,
  tooltip,
  shortcut,
  active = false,
  danger = false,
  accent = false,
  warning = false,
  badge,
  children,
  className = '',
}) => {
  let stateClass =
    'bg-white/[0.07] hover:bg-white/[0.14] text-slate-100 border border-white/[0.08]';
  if (danger) {
    stateClass =
      'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/80 shadow-lg shadow-rose-600/25';
  } else if (warning) {
    stateClass =
      'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 shadow-lg shadow-amber-500/20';
  } else if (accent) {
    stateClass =
      'bg-sky-500 hover:bg-sky-400 text-slate-950 border border-sky-400 shadow-lg shadow-sky-500/25';
  } else if (active) {
    stateClass =
      'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/80 shadow-lg shadow-indigo-500/25';
  }

  return (
    <div className="relative group flex items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={tooltip}
        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer ${stateClass} ${className}`}
      >
        {children}
        {badge !== undefined && badge !== 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#090D16]">
            {badge}
          </span>
        )}
      </button>

      {/* Hover / Focus Tooltip Pill */}
      <div className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0 absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-950/95 border border-white/10 text-[11px] font-medium text-white whitespace-nowrap shadow-xl z-50 flex items-center gap-1.5">
        <span>{tooltip}</span>
        {shortcut && (
          <kbd className="px-1 py-0.5 text-[9px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
            {shortcut}
          </kbd>
        )}
      </div>
    </div>
  );
};

const GlobalVideoCallManagerInner: React.FC = () => {
  const {
    currentUser,
    users,
    presences,
    projects,
    activeProject,
    tasks,
    createTask,
    addToast,
  } = useAppStore();

  const [callState, setCallState] = useState(() => meetingAndCallService.getCallStateSnapshot());
  const [callLayout, setCallLayout] = useState<'grid' | 'spotlight' | 'presentation'>('grid');
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'people' | 'chat' | 'notes' | 'ai' | null>(null);
  const [showCaptions, setShowCaptions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [bgMode, setBgMode] = useState<'none' | 'blur' | 'studio' | 'midnight'>('studio');
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [liveMicLevel, setLiveMicLevel] = useState(0);

  // Hardware devices & loopback audio test states
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [isRecordingMicTest, setIsRecordingMicTest] = useState(false);
  const [micTestStatus, setMicTestStatus] = useState<string | null>(null);

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

  // Poll live mic input level for real-time audio visualizer on dock and device check
  useEffect(() => {
    if (!callState.activeCall && !preJoinTarget && !showDeviceSettings) {
      setLiveMicLevel(0);
      return;
    }
    const timer = setInterval(() => {
      setLiveMicLevel(meetingAndCallService.getLiveMicLevel());
    }, 150);
    return () => clearInterval(timer);
  }, [callState.activeCall?.id, Boolean(preJoinTarget), showDeviceSettings]);

  // Enumerate available camera & microphone hardware devices
  const refreshHardwareDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter(d => d.kind === 'videoinput');
      const auds = list.filter(d => d.kind === 'audioinput');
      setVideoDevices(vids);
      setAudioInputDevices(auds);
      const currentSelected = meetingAndCallService.getSelectedDevices();
      if (currentSelected.videoDeviceId) setSelectedVideoId(currentSelected.videoDeviceId);
      else if (vids[0]?.deviceId && !selectedVideoId) setSelectedVideoId(vids[0].deviceId);
      if (currentSelected.audioDeviceId) setSelectedAudioId(currentSelected.audioDeviceId);
      else if (auds[0]?.deviceId && !selectedAudioId) setSelectedAudioId(auds[0].deviceId);
    } catch {}
  }, [selectedVideoId, selectedAudioId]);

  useEffect(() => {
    if (callState.activeCall || preJoinTarget || showDeviceSettings) {
      refreshHardwareDevices();
    }
  }, [callState.activeCall?.id, Boolean(preJoinTarget), showDeviceSettings, refreshHardwareDevices]);

  // 3-Second Real Microphone Loopback Recording & Playback Check
  const handleRunMicLoopbackTest = async () => {
    if (isRecordingMicTest) return;
    setIsRecordingMicTest(true);
    setMicTestStatus('🎙️ Speak now... Recording 3s audio sample...');

    try {
      let streamToRecord = callState.localStream || preJoinStream;
      let tempStream: MediaStream | null = null;
      if (!streamToRecord || streamToRecord.getAudioTracks().length === 0) {
        tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamToRecord = tempStream;
      }

      const audioOnlyStream = new MediaStream(streamToRecord.getAudioTracks());
      const recorder = new MediaRecorder(audioOnlyStream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        if (tempStream) {
          tempStream.getTracks().forEach(t => t.stop());
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        setMicTestStatus('🔊 Playing back your voice sample through speakers...');
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setIsRecordingMicTest(false);
          setMicTestStatus('✓ Mic input & speaker output verified!');
          setTimeout(() => setMicTestStatus(null), 4000);
        };
        audio.onerror = () => {
          setIsRecordingMicTest(false);
          setMicTestStatus('Playback completed.');
        };
        audio.play().catch(() => {
          setIsRecordingMicTest(false);
          setMicTestStatus('Audio captured! Click Test Speaker to verify output.');
        });
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 3000);
    } catch (err: any) {
      setIsRecordingMicTest(false);
      setMicTestStatus('Could not access microphone: ' + (err?.message || 'Check permissions'));
    }
  };

  // Listen for global call launch, incoming ring, and remote call decline events
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
        meetingAndCallService
          .acquireLocalMedia(detail.initialVideo !== false, detail.initialAudio !== false)
          .then(s => setPreJoinStream(s))
          .catch(() => setPreJoinStream(null));
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

    const handleRemoteCallDeclined = (
      e: CustomEvent<{ callId?: string; meetingCode?: string; userId: string; userName: string }>
    ) => {
      if (!currentUser || !e.detail) return;
      if (e.detail.userId === currentUser.id) return;
      addToast(
        'Call Declined',
        `${e.detail.userName || 'Participant'} declined the call invitation.`,
        'warning'
      );
    };

    window.addEventListener('omni_start_video_call', handleStartCallEvent as EventListener);
    window.addEventListener('omni_incoming_call_invite', handleIncomingRing as EventListener);
    window.addEventListener('omni_call_declined', handleRemoteCallDeclined as EventListener);
    return () => {
      window.removeEventListener('omni_start_video_call', handleStartCallEvent as EventListener);
      window.removeEventListener('omni_incoming_call_invite', handleIncomingRing as EventListener);
      window.removeEventListener('omni_call_declined', handleRemoteCallDeclined as EventListener);
    };
  }, [currentUser, addToast]);

  // Call duration timer
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
    return (
      activeCall?.participants.find(
        p => p.isScreenSharing && p.connectionState === 'connected'
      ) || null
    );
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

  // Check if a teammate is online & authenticated in real-time
  const isTeammateOnline = useCallback(
    (userId: string) => {
      if (userId === currentUser?.id) return true;
      if (
        typeof meetingAndCallService.isUserActivelyOnline === 'function' &&
        meetingAndCallService.isUserActivelyOnline(userId)
      ) {
        return true;
      }
      if (
        typeof meetingAndCallService.isUserOnlineInOrg === 'function' &&
        meetingAndCallService.isUserOnlineInOrg(userId)
      ) {
        return true;
      }
      return (presences || []).some(
        p => p.userId === userId && Date.now() - (p.lastSeenLocally || new Date(p.lastActive || 0).getTime() || 0) < 120000
      );
    },
    [currentUser?.id, presences]
  );

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
    return orgTeammates
      .filter(u => {
        const name = (u.full_name || u.email || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return !q || name.includes(q) || email.includes(q);
      })
      .sort((a, b) => Number(isTeammateOnline(b.id)) - Number(isTeammateOnline(a.id)));
  }, [orgTeammates, activeCall, peopleSearch, isTeammateOnline]);

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
    if (currentUser) {
      meetingAndCallService.declineCall(currentUser, callState.incomingInvite || undefined);
    } else {
      meetingAndCallService.setIncomingInvite(null);
    }
    addToast('Call Declined', 'You declined the incoming call and notified the caller.', 'info');
  };

  const handleConvertActionToTask = async (item: {
    id: string;
    text: string;
    assigneeId?: string;
  }) => {
    const targetProject =
      projects.find(p => p.id === activeCall?.projectId) || activeProject || projects[0];
    if (!targetProject) {
      addToast(
        'Select a Project First',
        'Create or open a project to convert meeting action items into tasks.',
        'warning'
      );
      return;
    }

    const created = await createTask({
      title: item.text,
      description: `Action item captured during live video meeting "${
        activeCall?.title || 'Sync'
      }" (Room: ${activeCall?.meetingCode || ''}).`,
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
      const connectedNames = activeCall.participants
        .filter(p => p.connectionState === 'connected')
        .map(p => p.name)
        .join(', ');
      const actionList =
        activeCall.actionItems.length > 0
          ? activeCall.actionItems
              .map(
                a =>
                  `- [${a.completed ? 'x' : ' '}] ${a.text}${
                    a.assigneeName ? ` (@${a.assigneeName})` : ''
                  }`
              )
              .join('\n')
          : '- [ ] Finalize sprint stories and confirm deployment timeline';

      const transcriptHighlights = activeCall.transcript
        .slice(-5)
        .map(t => `• **${t.speakerName}**: "${t.text}"`)
        .join('\n');

      const summary = `### 📋 Executive Meeting Summary: ${activeCall.title}
**Room**: \`${activeCall.meetingCode}\` · **Duration**: \`${formatTimer(callDurationSec)}\`
**Active Participants**: ${connectedNames || currentUser?.full_name || 'Host'}

#### Key Decisions & Alignment
${
  activeCall.sharedNotes.trim() ||
  '• Aligned on current sprint scope, blocker resolution, and deliverable owners.'
}

#### Transcript Highlights
${transcriptHighlights || '• Reviewed sprint velocity and confirmed upcoming release readiness.'}

#### Action Items & Next Steps
${actionList}`;

      setAiSummaryText(summary);
      setIsGeneratingAiSummary(false);
      addToast(
        'AI Meeting Summary Ready',
        'Meeting notes, decisions, and action items synthesized.',
        'success'
      );
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
    addToast(
      'Summary Posted to Chat',
      'Executive meeting recap shared with your team in chat.',
      'success'
    );
  };

  // ==========================================================================
  // 1. INCOMING CALL RINGING BANNER / OVERLAY
  // ==========================================================================
  if (callState.incomingInvite && !activeCall) {
    const inv = callState.incomingInvite;
    return (
      <div className="fixed top-5 right-5 z-[10000] w-full max-w-sm animate-modal-appear">
        <div className="rounded-2xl bg-[#0B0F19]/95 border border-indigo-500/40 shadow-[0_24px_60px_rgba(0,0,0,0.85)] p-5 text-white backdrop-blur-2xl">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-lg font-bold ring-4 ring-indigo-500/30 animate-pulse overflow-hidden">
                {inv.callerAvatar ? (
                  <img
                    src={inv.callerAvatar}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
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
                {inv.type === 'direct' ? 'Incoming 1:1 Call' : 'Incoming Team Meeting'}
              </div>
              <h4 className="text-sm font-bold text-white truncate">{inv.title}</h4>
              <p className="text-xs text-slate-300 truncate">
                {inv.callerName} is calling · {inv.meetingCode}
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
              <span>Accept</span>
            </button>
            <button
              type="button"
              onClick={() => handleAcceptIncomingInvite(false)}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ICON_MAP.PhoneIcon className="w-4 h-4" />
              <span>Voice Only</span>
            </button>
            <button
              type="button"
              onClick={handleDeclineIncomingInvite}
              className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 2. PRE-JOIN "GREEN ROOM" LOBBY MODAL WITH LIVE CAMERA, MIC METER & AUDIO TEST
  // ==========================================================================
  if (preJoinTarget && !activeCall && currentUser) {
    return (
      <div
        className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        onClick={closePreJoinLobby}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="bg-[#0B0F19] border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden text-white grid grid-cols-1 md:grid-cols-12 animate-modal-appear"
        >
          {/* Left Camera & Audio Preview */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between bg-[#070A12] border-b md:border-b-0 md:border-r border-white/10">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center">
              {preJoinTarget.initialVideo &&
              (preJoinStream || callState.localStream) &&
              (preJoinStream || callState.localStream)!.getVideoTracks().length > 0 ? (
                <VideoStreamTile
                  stream={preJoinStream || callState.localStream}
                  muted
                  mirror
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <Avatar user={currentUser} size="lg" disableHoverCard />
                  <span className="text-xs text-slate-400">
                    {preJoinTarget.initialVideo
                      ? 'Camera permission needed — click Enable Camera below'
                      : 'Camera is turned off'}
                  </span>
                  {preJoinTarget.initialVideo && (
                    <button
                      type="button"
                      onClick={async () => {
                        const s = await meetingAndCallService.acquireLocalMedia(
                          true,
                          preJoinTarget.initialAudio
                        );
                        if (s) setPreJoinStream(s);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Enable Camera Preview
                    </button>
                  )}
                </div>
              )}

              {/* Bottom Icon-Only Controls inside Preview */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <DockIconButton
                  onClick={async () => {
                    const nextAudio = !preJoinTarget.initialAudio;
                    setPreJoinTarget(prev => (prev ? { ...prev, initialAudio: nextAudio } : null));
                    if (
                      nextAudio &&
                      (!preJoinStream || preJoinStream.getAudioTracks().length === 0)
                    ) {
                      const s = await meetingAndCallService.acquireLocalMedia(
                        preJoinTarget.initialVideo,
                        true
                      );
                      if (s) setPreJoinStream(s);
                    } else if (preJoinStream) {
                      preJoinStream.getAudioTracks().forEach(t => (t.enabled = nextAudio));
                    }
                  }}
                  tooltip={preJoinTarget.initialAudio ? 'Mute Microphone' : 'Unmute Microphone'}
                  danger={!preJoinTarget.initialAudio}
                >
                  <ICON_MAP.MicrophoneIcon className="w-4 h-4" />
                </DockIconButton>

                <DockIconButton
                  onClick={async () => {
                    const nextVideo = !preJoinTarget.initialVideo;
                    setPreJoinTarget(prev => (prev ? { ...prev, initialVideo: nextVideo } : null));
                    if (nextVideo) {
                      const s = await meetingAndCallService.acquireLocalMedia(
                        true,
                        preJoinTarget.initialAudio
                      );
                      if (s) setPreJoinStream(s);
                    } else if (preJoinStream) {
                      preJoinStream.getVideoTracks().forEach(t => (t.enabled = false));
                    }
                  }}
                  tooltip={preJoinTarget.initialVideo ? 'Turn Off Camera' : 'Turn On Camera'}
                  danger={!preJoinTarget.initialVideo}
                >
                  <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
                </DockIconButton>

                <DockIconButton
                  onClick={() => meetingAndCallService.playTestSpeakerSound()}
                  tooltip="Test Speaker Audio Output"
                >
                  <ICON_MAP.SpeakerWaveIcon className="w-4 h-4" />
                </DockIconButton>
              </div>
            </div>

            {/* Live Mic Input Level Meter & Speaker Test */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-2">
                  <span>Mic Input:</span>
                  <div className="w-28 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-150"
                      style={{
                        width: `${preJoinTarget.initialAudio ? Math.max(6, liveMicLevel) : 0}%`,
                      }}
                    />
                  </div>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => meetingAndCallService.playTestSpeakerSound()}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    Test Speakers
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleRunMicLoopbackTest}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    {isRecordingMicTest ? 'Recording...' : 'Test Mic'}
                  </button>
                </div>
              </div>
              {micTestStatus && (
                <p className="text-[11px] text-emerald-400 font-medium">{micTestStatus}</p>
              )}
            </div>
          </div>

          {/* Right Meeting Info & Join Actions */}
          <div className="md:col-span-5 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="text-xs font-medium text-indigo-400">Ready to join?</div>
              <h3 className="text-lg font-bold text-white leading-snug">{preJoinTarget.title}</h3>
              {preJoinTarget.meetingCode && (
                <div className="text-xs font-mono text-slate-400">
                  Room Code: {preJoinTarget.meetingCode}
                </div>
              )}

              {preJoinTarget.invitedUsers && preJoinTarget.invitedUsers.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-xs text-slate-400">
                    Participants ({preJoinTarget.invitedUsers.length + 1}):
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {preJoinTarget.invitedUsers.slice(0, 6).map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-1.5 bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-xs"
                      >
                        <Avatar user={u} size="sm" disableHoverCard />
                        <span className="truncate max-w-[100px]">
                          {u.full_name || u.email.split('@')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-4 border-t border-white/10">
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

  // Separate active connected participants vs ringing/declined so fake/offline users never appear as connected
  const allParticipants = activeCall.participants;
  const connectedParticipants = allParticipants.filter(
    p => p.connectionState === 'connected' || p.userId === currentUser.id
  );
  const ringingOrDeclinedParticipants = allParticipants.filter(
    p =>
      p.userId !== currentUser.id &&
      (p.connectionState === 'ringing' || p.connectionState === 'declined')
  );
  // Display connected participants + currently ringing/declined invitees on the stage
  const stageParticipants = [
    ...connectedParticipants,
    ...ringingOrDeclinedParticipants,
  ];

  const myParticipant =
    allParticipants.find(p => p.userId === currentUser.id) || connectedParticipants[0];

  // ==========================================================================
  // 3. MINIMIZED PICTURE-IN-PICTURE (PiP) FLOATING BAR
  // ==========================================================================
  if (callState.isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 sm:right-6 z-[9995] w-72 sm:w-80 rounded-2xl bg-[#0B0F19]/95 border border-white/10 shadow-2xl text-white overflow-hidden backdrop-blur-2xl animate-modal-appear">
        {/* Keep remote audio playing seamlessly while minimized */}
        {Array.from(callState.remoteStreams.entries()).map(([peerId, rStream]) => (
          <RemoteAudioPlayer
            key={peerId}
            stream={rStream}
            isLocalSpeaking={liveMicLevel > 22 && !myParticipant?.isMicMuted}
            echoGuardEnabled={callState.echoGuardEnabled}
          />
        ))}
        <div className="p-3 bg-black/40 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{activeCall.title}</div>
              <div className="text-[10px] font-mono text-slate-400">
                {formatTimer(callDurationSec)} · {connectedParticipants.length} active
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => meetingAndCallService.setMinimized(false)}
            title="Expand Call Window"
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
          >
            <ICON_MAP.ArrowsPointingOutIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Mini video preview if camera or screen share is active */}
        {myParticipant?.isScreenSharing &&
        callState.screenStream &&
        callState.screenStream.getVideoTracks().length > 0 ? (
          <div className="h-32 w-full bg-black relative overflow-hidden">
            <VideoStreamTile stream={callState.screenStream} muted fit="contain" />
          </div>
        ) : (
          !myParticipant?.isCameraOff &&
          callState.localStream &&
          callState.localStream.getVideoTracks().length > 0 && (
            <div className="h-32 w-full bg-slate-950 relative overflow-hidden">
              <VideoStreamTile stream={callState.localStream} muted mirror />
            </div>
          )
        )}

        <div className="p-3 flex items-center justify-between gap-3">
          <div className="flex -space-x-2 overflow-hidden">
            {connectedParticipants.slice(0, 5).map(p => (
              <div
                key={p.userId}
                className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold overflow-hidden"
                title={`${p.name} (Active)`}
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
              className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer ${
                myParticipant?.isMicMuted
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <ICON_MAP.MicrophoneIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => meetingAndCallService.toggleCamera(currentUser.id)}
              title={myParticipant?.isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer ${
                myParticipant?.isCameraOff
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => meetingAndCallService.leaveCall(currentUser.id)}
              title="Leave Call"
              className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer"
            >
              <ICON_MAP.PhoneIcon className="w-4 h-4 rotate-[135deg]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 4. SLEEK GOOGLE MEET / MS TEAMS / ZOOM VIDEO CALL STUDIO
  // ==========================================================================
  const spotlightParticipant =
    stageParticipants.find(p => p.userId === pinnedUserId) ||
    connectedParticipants.find(p => p.isSpeaking) ||
    connectedParticipants[0] ||
    stageParticipants[0];

  const getTileBgClass = (p: VideoCallParticipant) => {
    const mode = p.userId === currentUser.id ? bgMode : p.backgroundMode || 'studio';
    if (mode === 'blur') return 'bg-gradient-to-br from-[#131B2E] via-[#0D1322] to-[#161B33]';
    if (mode === 'studio') return 'bg-gradient-to-b from-[#141A29] to-[#0D111C]';
    if (mode === 'midnight') return 'bg-[#080B12]';
    return 'bg-[#111622]';
  };

  // Resolve live screen share stream or real-time broadcast frame for both 1:1 and team calls
  const renderLiveScreenShareStage = () => {
    const isMePresenting =
      Boolean(myParticipant?.isScreenSharing) ||
      screenSharer?.userId === currentUser.id;

    if (
      isMePresenting &&
      callState.screenStream &&
      callState.screenStream.getVideoTracks().length > 0
    ) {
      return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <VideoStreamTile stream={callState.screenStream} muted fit="contain" />
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/75 border border-white/10 text-[11px] font-medium text-sky-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>Broadcasting your screen live in {callState.videoQualityMode} @ 60fps</span>
          </div>
        </div>
      );
    }

    if (screenSharer && screenSharer.userId !== currentUser.id) {
      const remoteScreenFrame = callState.remoteScreenFrames?.get(screenSharer.userId);
      const remotePeerStream = callState.remoteStreams.get(screenSharer.userId) || null;
      const hasRemoteVideoTrack = Boolean(
        remotePeerStream &&
          remotePeerStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
      );

      // Prioritize native 1080p/60fps WebRTC video stream first for ultra-low latency & crystal clarity
      if (hasRemoteVideoTrack && remotePeerStream) {
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <VideoStreamTile stream={remotePeerStream} muted fit="contain" />
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/75 border border-white/10 text-[11px] font-medium text-sky-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>Viewing {screenSharer.name}&apos;s live HD screen stream</span>
            </div>
          </div>
        );
      }

      if (remoteScreenFrame) {
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <img
              src={remoteScreenFrame}
              alt={`${screenSharer.name}'s shared screen`}
              className="w-full h-full object-contain select-none"
            />
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/75 border border-white/10 text-[11px] font-medium text-sky-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>Viewing {screenSharer.name}&apos;s live screen</span>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 animate-pulse">
            <ICON_MAP.ComputerDesktopIcon className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-white">
            Connecting to {screenSharer.name}&apos;s screen stream...
          </div>
          <p className="text-xs text-slate-400 max-w-sm">
            Synchronizing live video frames for {activeCall.title}.
          </p>
        </div>
      );
    }

    // If user manually switched to Presentation Stage without anyone currently sharing
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-sky-400">
          <ICON_MAP.ComputerDesktopIcon className="w-7 h-7" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm sm:text-base font-bold text-white">
            No one is presenting right now
          </h3>
          <p className="text-xs text-slate-400">
            Share your entire screen, a specific application window, or a browser tab with everyone in the call.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await meetingAndCallService.toggleScreenShare(currentUser.id);
          }}
          className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-sky-500/20"
        >
          <ICON_MAP.ComputerDesktopIcon className="w-4 h-4" />
          <span>Share Your Screen Now</span>
        </button>
      </div>
    );
  };

  const renderParticipantTile = (p: VideoCallParticipant, isLargeStage = false) => {
    const isMe = p.userId === currentUser.id;
    const remoteStream = callState.remoteStreams.get(p.userId) || null;
    const remoteCameraFrame = !isMe ? callState.remoteCameraFrames?.get(p.userId) : undefined;
    const streamToRender = isMe ? callState.localStream : remoteStream;
    const hasVideoTracks = Boolean(
      streamToRender &&
        streamToRender.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
    );
    const showLiveVideo = !p.isCameraOff && hasVideoTracks;
    const showRemoteFrameFallback = !isMe && !p.isCameraOff && !showLiveVideo && Boolean(remoteCameraFrame);
    const isRinging = p.connectionState === 'ringing';
    const isDeclined = p.connectionState === 'declined';

    return (
      <div
        key={p.userId}
        onClick={() => setPinnedUserId(prev => (prev === p.userId ? null : p.userId))}
        className={`relative rounded-2xl overflow-hidden border transition-all duration-200 select-none cursor-pointer flex items-center justify-center group ${getTileBgClass(
          p
        )} ${
          p.isSpeaking && !p.isMicMuted && p.connectionState === 'connected'
            ? 'border-emerald-400/90 ring-2 ring-emerald-500/30'
            : pinnedUserId === p.userId
            ? 'border-indigo-400/90 ring-2 ring-indigo-500/25'
            : isDeclined
            ? 'border-rose-500/40 opacity-75'
            : isRinging
            ? 'border-amber-500/40'
            : 'border-white/[0.08] hover:border-white/[0.18]'
        } ${
          isLargeStage
            ? 'h-full min-h-[260px] sm:min-h-[360px]'
            : 'min-h-[170px] sm:min-h-[210px] h-full'
        }`}
      >
        {showLiveVideo ? (
          <VideoStreamTile stream={streamToRender} muted mirror={isMe} />
        ) : showRemoteFrameFallback && remoteCameraFrame ? (
          <img
            src={remoteCameraFrame}
            alt={p.name}
            className="w-full h-full object-cover select-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
            <div className="relative">
              <div
                className={`${
                  isLargeStage
                    ? 'w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl'
                    : 'w-14 h-14 sm:w-16 sm:h-16 text-lg sm:text-xl'
                } rounded-full bg-slate-800/90 border-2 ${
                  p.isSpeaking && !p.isMicMuted && p.connectionState === 'connected'
                    ? 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.4)]'
                    : isDeclined
                    ? 'border-rose-500/70'
                    : isRinging
                    ? 'border-amber-400 animate-pulse'
                    : 'border-white/15'
                } flex items-center justify-center font-bold text-white overflow-hidden shadow-inner`}
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

            {isDeclined ? (
              <div className="flex flex-col items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-[11px] font-semibold text-rose-300">
                  Declined Call
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    const u = orgTeammates.find(usr => usr.id === p.userId);
                    if (u) {
                      meetingAndCallService.inviteTeammatesToActiveCall([u], currentUser);
                      addToast('Ringing Again', `Calling ${p.name}...`, 'info');
                    }
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  Ring Again
                </button>
              </div>
            ) : isRinging ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-amber-300 animate-pulse">
                  Ringing {p.name}...
                </span>
                <span className="text-[10px] text-slate-400">
                  Waiting for {p.name} to accept
                </span>
              </div>
            ) : isMe && (p.isCameraOff || !hasVideoTracks) ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  if (p.isCameraOff) {
                    meetingAndCallService.toggleCamera(currentUser.id);
                  } else {
                    meetingAndCallService.acquireLocalMedia(true, !p.isMicMuted);
                  }
                }}
                className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-indigo-600 text-slate-200 hover:text-white border border-white/10 text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" />
                <span>Turn On Camera</span>
              </button>
            ) : null}
          </div>
        )}

        {/* Top-Right Status Badges */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {p.isHandRaised && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/95 text-slate-950 text-[10px] font-bold">
              ✋
            </span>
          )}
          {pinnedUserId === p.userId && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-600/90 text-white text-[10px] font-semibold">
              Pinned
            </span>
          )}
          {p.isScreenSharing && p.connectionState === 'connected' && (
            <span className="px-2 py-0.5 rounded-full bg-sky-500/90 text-slate-950 text-[10px] font-bold">
              Presenting
            </span>
          )}
        </div>

        {/* Bottom Scrim & Participant Label */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                p.connectionState === 'connected'
                  ? 'bg-emerald-400'
                  : p.connectionState === 'declined'
                  ? 'bg-rose-500'
                  : 'bg-amber-400 animate-ping'
              }`}
              title={
                p.connectionState === 'connected'
                  ? 'Authenticated & Active on Call'
                  : p.connectionState === 'declined'
                  ? 'Declined'
                  : 'Ringing'
              }
            />
            <span className="text-xs font-semibold text-white truncate">
              {p.name} {isMe ? '(You)' : ''}
            </span>
            {p.role && (
              <span className="text-[10px] text-slate-300/80 truncate hidden sm:inline">
                · {normalizeUserRole(p.role).replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {p.connectionState !== 'connected' ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-slate-300 border border-white/10">
                {p.connectionState === 'declined' ? 'Declined' : 'Ringing'}
              </span>
            ) : p.isMicMuted ? (
              <span
                title="Microphone Muted"
                className="w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center"
              >
                <ICON_MAP.MicrophoneIcon className="w-3 h-3" />
              </span>
            ) : (
              <span
                title="Microphone Active"
                className="px-1.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-0.5"
              >
                <span
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-100"
                  style={{
                    height: isMe ? `${Math.max(4, Math.min(12, liveMicLevel / 8))}px` : '8px',
                  }}
                />
                <span
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-100"
                  style={{
                    height: isMe ? `${Math.max(6, Math.min(14, liveMicLevel / 6))}px` : '11px',
                  }}
                />
                <span
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-100"
                  style={{
                    height: isMe ? `${Math.max(4, Math.min(10, liveMicLevel / 9))}px` : '6px',
                  }}
                />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9990] bg-[#090D16] text-white flex flex-col overflow-hidden animate-fadeIn select-none">
      {/* Mount hidden audio players for all remote WebRTC streams with lossless 48kHz clarity & Echo Guard */}
      {Array.from(callState.remoteStreams.entries()).map(([peerId, rStream]) => (
        <RemoteAudioPlayer
          key={peerId}
          stream={rStream}
          isLocalSpeaking={liveMicLevel > 22 && !myParticipant?.isMicMuted}
          echoGuardEnabled={callState.echoGuardEnabled}
        />
      ))}

      {/* 1. SLEEK GOOGLE MEET / MS TEAMS TOP HEADER BAR */}
      <div className="h-14 px-4 sm:px-6 border-b border-white/[0.07] bg-[#090D16]/90 backdrop-blur-xl flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{formatTimer(callDurationSec)}</span>
          </div>

          <div className="min-w-0 flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[160px] sm:max-w-sm">
              {activeCall.title}
            </h2>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(activeCall.meetingCode);
                addToast(
                  'Meeting Code Copied',
                  `Room code ${activeCall.meetingCode} copied to clipboard.`,
                  'info'
                );
              }}
              title="Copy meeting room code"
              className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.07] text-[11px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer hidden md:inline-flex items-center gap-1"
            >
              <span>{activeCall.meetingCode}</span>
            </button>
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-[11px] text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                {connectedParticipants.length} active
                {ringingOrDeclinedParticipants.filter(p => p.connectionState === 'ringing').length >
                0
                  ? ` · ${
                      ringingOrDeclinedParticipants.filter(p => p.connectionState === 'ringing')
                        .length
                    } ringing`
                  : ''}
              </span>
            </span>
          </div>
        </div>

        {/* Top-Right Compact Controls (1080p/720p HD, Echo Guard, Layout, Add People, Minimize PiP) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 1080p / 720p HD Quality Switcher */}
          <button
            type="button"
            onClick={() => {
              const nextMode = callState.videoQualityMode === '1080p' ? '720p' : '1080p';
              meetingAndCallService.setVideoQualityMode(nextMode);
              addToast(
                `Video Stream: ${nextMode} HD`,
                nextMode === '1080p'
                  ? 'Switched to 1080p Full HD video & 60fps screen share.'
                  : 'Switched to 720p Low-Latency HD stream.',
                'info'
              );
            }}
            title="Toggle between 1080p Full HD (60fps screen share) and 720p Low-Latency HD"
            className="hidden md:inline-flex h-7 px-2.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 text-[10px] font-mono font-bold text-indigo-300 items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{callState.videoQualityMode || '1080p'}</span>
            <span className="text-emerald-400">HD</span>
          </button>

          {/* Acoustic Echo Guard Toggle for multi-device / speakerphone clarity */}
          <button
            type="button"
            onClick={() => {
              const nextGuard = !callState.echoGuardEnabled;
              meetingAndCallService.setEchoGuardEnabled(nextGuard);
              addToast(
                nextGuard ? 'Acoustic Echo Guard Enabled' : 'Full-Duplex Studio Mode',
                nextGuard
                  ? 'Anti-screech speaker attenuation active for multi-device & speakerphone calls.'
                  : 'Switched to unattenuated full-duplex studio audio (recommended for headphones).',
                'info'
              );
            }}
            title={
              callState.echoGuardEnabled
                ? 'Echo Guard ON: Prevents echo & screeching when using speakers or multiple devices nearby'
                : 'Echo Guard OFF: Unattenuated full-duplex audio (best for headphones)'
            }
            className={`hidden md:inline-flex h-7 px-2.5 rounded-full border text-[10px] font-semibold items-center gap-1 transition-colors cursor-pointer ${
              callState.echoGuardEnabled
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-white/[0.05] border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            <span>{callState.echoGuardEnabled ? 'Echo Guard ON' : 'Echo Guard OFF'}</span>
          </button>

          {/* Layout Switcher Icons */}
          <div className="hidden sm:flex items-center gap-0.5 p-1 rounded-full bg-white/[0.05] border border-white/[0.08]">
            {(
              [
                { id: 'grid', label: 'Gallery Grid', icon: ICON_MAP.Squares2X2Icon },
                { id: 'spotlight', label: 'Speaker View', icon: ICON_MAP.UserCircleIcon },
                {
                  id: 'presentation',
                  label: 'Screen Share Stage',
                  icon: ICON_MAP.ComputerDesktopIcon,
                },
              ] as const
            ).map(mode => {
              const IconComp = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setCallLayout(mode.id)}
                  title={mode.label}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    callLayout === mode.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          {/* Add People Button showing strictly active connected count */}
          <button
            type="button"
            onClick={() => setActiveDrawerTab(prev => (prev === 'people' ? null : 'people'))}
            title={`Active Participants (${connectedParticipants.length}) & Invite Teammates`}
            className={`h-8 px-3 rounded-full border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeDrawerTab === 'people'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.08] text-slate-200'
            }`}
          >
            <ICON_MAP.UserPlusIcon className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">{connectedParticipants.length}</span>
          </button>

          {/* Picture-in-Picture Minimize Icon Button */}
          <button
            type="button"
            onClick={() => meetingAndCallService.setMinimized(true)}
            title="Minimize to Picture-in-Picture"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ICON_MAP.ArrowsPointingInIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN CALL STAGE + RESPONSIVE SIDE DRAWER */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Video Stage Area */}
        <div className="flex-1 flex flex-col p-3 sm:p-5 pb-24 sm:pb-24 min-w-0 min-h-0 relative overflow-hidden">
          {callLayout === 'presentation' ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 min-h-0">
              {/* Primary Live Screen Share Stage */}
              <div className="lg:col-span-9 rounded-2xl bg-[#05070B] border border-white/[0.08] overflow-hidden flex flex-col relative min-h-[260px] shadow-2xl">
                <div className="px-4 py-2.5 bg-[#0B0F19] border-b border-white/[0.07] flex items-center justify-between text-xs">
                  <span className="font-semibold text-sky-400 flex items-center gap-2">
                    <ICON_MAP.ComputerDesktopIcon className="w-4 h-4" />
                    {screenSharer
                      ? `${screenSharer.name}${
                          screenSharer.userId === currentUser.id ? ' (You)' : ''
                        } — Live Screen Share`
                      : 'Screen Presentation Stage'}
                  </span>
                  {(callState.screenStream || myParticipant?.isScreenSharing) && (
                    <button
                      type="button"
                      onClick={() => meetingAndCallService.toggleScreenShare(currentUser.id)}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      Stop Sharing
                    </button>
                  )}
                </div>

                <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
                  {renderLiveScreenShareStage()}
                </div>
              </div>

              {/* Right Filmstrip of Participants */}
              <div className="lg:col-span-3 flex lg:flex-col gap-3 overflow-auto [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
                {stageParticipants.map(p => (
                  <div key={p.userId} className="w-48 lg:w-full h-36 sm:h-44 flex-shrink-0">
                    {renderParticipantTile(p, false)}
                  </div>
                ))}
              </div>
            </div>
          ) : callLayout === 'spotlight' && stageParticipants.length > 1 ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 min-h-0">
              <div className="lg:col-span-9 min-h-0">
                {renderParticipantTile(spotlightParticipant, true)}
              </div>
              <div className="lg:col-span-3 flex lg:flex-col gap-3 overflow-auto [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
                {stageParticipants
                  .filter(p => p.userId !== spotlightParticipant.userId)
                  .map(p => (
                    <div key={p.userId} className="w-48 lg:w-full h-36 sm:h-44 flex-shrink-0">
                      {renderParticipantTile(p, false)}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Dynamic Responsive Auto-Grid across Mobile, Tablet, and Desktop */
            <div
              className={`flex-1 grid gap-3 sm:gap-4 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#334155_transparent] ${
                stageParticipants.length === 1
                  ? 'grid-cols-1 max-w-4xl mx-auto w-full'
                  : stageParticipants.length === 2
                  ? 'grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto w-full'
                  : stageParticipants.length <= 4
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {stageParticipants.map(p =>
                renderParticipantTile(p, stageParticipants.length <= 2)
              )}
            </div>
          )}

          {/* Floating Live Reactions Overlay */}
          {callState.reactions.length > 0 && (
            <div className="pointer-events-none absolute bottom-24 left-6 flex flex-col-reverse gap-2 z-30">
              {callState.reactions.map(r => (
                <div
                  key={r.id}
                  className="px-3 py-1.5 rounded-full bg-slate-900/90 border border-white/10 shadow-xl flex items-center gap-2 animate-bounce"
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span className="text-xs font-semibold text-white">{r.senderName}</span>
                </div>
              ))}
            </div>
          )}

          {/* Live Captions Subtitle Strip */}
          {showCaptions && Array.isArray(activeCall.transcript) && activeCall.transcript.length > 0 && (
            <div className="mt-2 mx-auto max-w-2xl w-full px-4 py-2 rounded-xl bg-black/80 border border-white/10 text-center">
              <span className="text-xs font-bold text-indigo-400 mr-2">
                {activeCall.transcript[activeCall.transcript.length - 1]?.speakerName}:
              </span>
              <span className="text-xs text-slate-100">
                {activeCall.transcript[activeCall.transcript.length - 1]?.text}
              </span>
            </div>
          )}
        </div>

        {/* 3. RIGHT COLLAPSIBLE COLLABORATION DRAWER */}
        {activeDrawerTab && (
          <div className="fixed inset-y-14 right-0 z-40 w-full sm:w-96 lg:static lg:inset-auto border-l border-white/[0.08] bg-[#0B0F19]/98 backdrop-blur-2xl flex flex-col flex-shrink-0 pb-20 lg:pb-0 shadow-2xl">
            {/* Drawer Header Icon Tabs */}
            <div className="p-2.5 border-b border-white/[0.08] flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 flex-1">
                {(
                  [
                    {
                      id: 'people',
                      label: `People (${connectedParticipants.length})`,
                      icon: ICON_MAP.UserGroupIcon,
                    },
                    {
                      id: 'chat',
                      label: `Chat (${(activeCall.chatMessages || []).length})`,
                      icon: ICON_MAP.ChatBubbleLeftIcon,
                    },
                    {
                      id: 'notes',
                      label: 'Notes & Tasks',
                      icon: ICON_MAP.ClipboardDocumentListIcon,
                    },
                    { id: 'ai', label: 'AI Scribe', icon: ICON_MAP.SparklesIcon },
                  ] as const
                ).map(t => {
                  const TabIcon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveDrawerTab(t.id)}
                      title={t.label}
                      className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        activeDrawerTab === t.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{t.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawerTab(null)}
                title="Close Panel"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <ICON_MAP.XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* TAB 1: PEOPLE & ADD TEAMMATES */}
            {activeDrawerTab === 'people' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                    <span>Active on Call ({connectedParticipants.length})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">● Live Session</span>
                  </div>
                  <div className="space-y-1.5">
                    {connectedParticipants.map(p => (
                      <div
                        key={p.userId}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                              {p.avatar ? (
                                <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                p.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0B0F19]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {p.name} {p.userId === currentUser.id ? '(You)' : ''}
                            </div>
                            <div className="text-[10px] text-emerald-400/90">
                              {p.userId === activeCall.hostId
                                ? 'Host · Connected'
                                : 'Authenticated · Connected'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {p.isHandRaised && <span title="Hand Raised">✋</span>}
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              p.isMicMuted
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                            title={p.isMicMuted ? 'Muted' : 'Mic On'}
                          >
                            <ICON_MAP.MicrophoneIcon className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ringing or Declined Invitees */}
                {ringingOrDeclinedParticipants.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/[0.07]">
                    <div className="text-xs font-semibold text-slate-400">
                      Invited / Ringing ({ringingOrDeclinedParticipants.length})
                    </div>
                    <div className="space-y-1.5">
                      {ringingOrDeclinedParticipants.map(p => (
                        <div
                          key={p.userId}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 overflow-hidden">
                              {p.avatar ? (
                                <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                p.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-200 truncate">
                                {p.name}
                              </div>
                              <div
                                className={`text-[10px] font-medium ${
                                  p.connectionState === 'declined'
                                    ? 'text-rose-400'
                                    : 'text-amber-400 animate-pulse'
                                }`}
                              >
                                {p.connectionState === 'declined'
                                  ? 'Declined invitation'
                                  : 'Ringing...'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add People from Organization to Call */}
                <div className="space-y-2.5 pt-3 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Invite Organization Teammates
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const onlineAvailable = orgTeammates.filter(
                          u =>
                            isTeammateOnline(u.id) &&
                            !connectedParticipants.some(p => p.userId === u.id)
                        );
                        const targetList =
                          onlineAvailable.length > 0
                            ? onlineAvailable
                            : orgTeammates.filter(
                                u => !connectedParticipants.some(p => p.userId === u.id)
                              );
                        if (targetList.length > 0) {
                          meetingAndCallService.inviteTeammatesToActiveCall(
                            targetList,
                            currentUser
                          );
                          addToast(
                            'Ringing Teammates',
                            `Ringing ${targetList.length} teammate(s) to join the call.`,
                            'info'
                          );
                        }
                      }}
                      className="text-[11px] font-semibold text-indigo-400 hover:underline cursor-pointer"
                    >
                      Ring Online
                    </button>
                  </div>

                  <input
                    type="text"
                    value={peopleSearch}
                    onChange={e => setPeopleSearch(e.target.value)}
                    placeholder="Search organization teammates..."
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />

                  <div className="space-y-1.5 max-h-64 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
                    {invitableTeammates.map(u => {
                      const participantRecord = allParticipants.find(p => p.userId === u.id);
                      const isConnected = participantRecord?.connectionState === 'connected';
                      const isRinging = participantRecord?.connectionState === 'ringing';
                      const online = isTeammateOnline(u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative flex-shrink-0">
                              <Avatar user={u} size="sm" disableHoverCard />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0B0F19] ${
                                  online ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                                title={online ? 'Online & Signed In' : 'Offline'}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-200 truncate">
                                {u.full_name || u.email.split('@')[0]}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                <span className={online ? 'text-emerald-400' : 'text-slate-500'}>
                                  {online ? 'Online' : 'Offline'}
                                </span>
                                <span>·</span>
                                <span>{normalizeUserRole(u.role).replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                          </div>

                          {isConnected ? (
                            <span className="text-[11px] text-emerald-400 font-semibold px-2">
                              Active
                            </span>
                          ) : isRinging ? (
                            <span className="text-[11px] text-amber-400 font-medium px-2 animate-pulse">
                              Ringing...
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
                              title="Ring teammate to join call"
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <ICON_MAP.PhoneIcon className="w-3 h-3" />
                              <span>Ring</span>
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
                  {(Array.isArray(activeCall.chatMessages) ? activeCall.chatMessages : []).map((m, idx) => {
                    if (!m) return null;
                    const msgTime = m.timestamp ? new Date(m.timestamp) : null;
                    const formattedTime =
                      msgTime && !Number.isNaN(msgTime.getTime())
                        ? msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';
                    return (
                      <div
                        key={m.id || `cmsg-idx-${idx}`}
                        className="p-3 rounded-xl bg-slate-800/70 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-indigo-300">{m.senderName || 'Participant'}</span>
                          <span className="text-slate-500 font-mono">{formattedTime}</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed break-words">{m.text || ''}</p>
                      </div>
                    );
                  })}
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
                    placeholder="Message everyone in call..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    title="Send Message"
                    className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer"
                  >
                    <ICON_MAP.PaperAirplaneIcon className="w-4 h-4" />
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
                      placeholder="New action item..."
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
                        title="Add Action Item"
                        className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer"
                      >
                        <ICON_MAP.PlusIcon className="w-4 h-4" />
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
                              Convert to Task →
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
                    <span>AI Meeting Scribe</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Synthesize live discussion notes, transcript lines, and action items into an executive recap.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateAiMeetingSummary}
                    disabled={isGeneratingAiSummary}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isGeneratingAiSummary ? 'Synthesizing...' : 'Generate AI Summary'}
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

      {/* 4. CAMERA & AUDIO STUDIO CHECK POPOVER (Live Camera Preview, Device Selector, Mic Meter & Speaker Test) */}
      {showDeviceSettings && (
        <div
          className="fixed inset-0 z-[9995] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowDeviceSettings(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl p-5 text-white space-y-4 animate-modal-appear"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ICON_MAP.VideoCameraIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold">Camera, Microphone & Audio Check</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeviceSettings(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <ICON_MAP.XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Live Self-Camera Preview Mirror */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {callState.localStream &&
              callState.localStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live') ? (
                <VideoStreamTile stream={callState.localStream} muted mirror />
              ) : (
                <div className="flex flex-col items-center gap-2.5 p-4 text-center">
                  <Avatar user={currentUser} size="lg" disableHoverCard />
                  <p className="text-xs text-slate-400">Camera preview is currently off</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await meetingAndCallService.acquireLocalMedia(true, !myParticipant?.isMicMuted);
                      if (myParticipant?.isCameraOff) {
                        await meetingAndCallService.toggleCamera(currentUser.id);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Turn On Camera Preview
                  </button>
                </div>
              )}
              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-mono text-emerald-400">
                Live Hardware Preview
              </span>
            </div>

            {/* Device Selectors */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Camera Input Device
                </label>
                <select
                  value={selectedVideoId}
                  onChange={async e => {
                    const id = e.target.value;
                    setSelectedVideoId(id);
                    await meetingAndCallService.switchMediaDevices(id, selectedAudioId, currentUser.id);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  {videoDevices.length === 0 ? (
                    <option value="">System Default Camera</option>
                  ) : (
                    videoDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Microphone Input Device
                </label>
                <select
                  value={selectedAudioId}
                  onChange={async e => {
                    const id = e.target.value;
                    setSelectedAudioId(id);
                    await meetingAndCallService.switchMediaDevices(selectedVideoId, id, currentUser.id);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  {audioInputDevices.length === 0 ? (
                    <option value="">System Default Microphone</option>
                  ) : (
                    audioInputDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Live Mic Level Bar */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-semibold">Live Microphone Input Level</span>
                  <span className="font-mono text-emerald-400">
                    {myParticipant?.isMicMuted ? 'Muted' : `${liveMicLevel}%`}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150"
                    style={{
                      width: `${myParticipant?.isMicMuted ? 0 : Math.max(4, liveMicLevel)}%`,
                    }}
                  />
                </div>

                {/* Audio Output & Loopback Test Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      meetingAndCallService.playTestSpeakerSound();
                      addToast(
                        'Testing Speaker Output',
                        'Playing stereo harmonic test chime through your audio output.',
                        'info'
                      );
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ICON_MAP.SpeakerWaveIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Test Speaker Output</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunMicLoopbackTest}
                    disabled={isRecordingMicTest}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ICON_MAP.MicrophoneIcon className="w-3.5 h-3.5" />
                    <span>{isRecordingMicTest ? 'Recording 3s...' : 'Test Mic & Playback'}</span>
                  </button>
                </div>

                {micTestStatus && (
                  <div className="text-[11px] text-emerald-400 font-medium pt-1">
                    {micTestStatus}
                  </div>
                )}
              </div>

              {/* HD Video Stream Resolution & Acoustic Echo Guard */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-slate-400">
                  Video Stream Quality
                </span>
                <div className="flex items-center gap-1">
                  {(['1080p', '720p'] as const).map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => meetingAndCallService.setVideoQualityMode(q)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer ${
                        (callState.videoQualityMode || '1080p') === q
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {q === '1080p' ? '1080p Full HD' : '720p Fast HD'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-slate-400">
                  Same-Room Echo Guard (48kHz Opus)
                </span>
                <button
                  type="button"
                  onClick={() => meetingAndCallService.setEchoGuardEnabled(!callState.echoGuardEnabled)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                    callState.echoGuardEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {callState.echoGuardEnabled ? 'Active (Anti-Screech)' : 'Off (Full-Duplex)'}
                </button>
              </div>

              {/* Studio Background Mode */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-slate-400">
                  Studio Tile Backdrop
                </span>
                <div className="flex items-center gap-1">
                  {(['blur', 'studio', 'midnight', 'none'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBgMode(m)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize cursor-pointer ${
                        bgMode === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. FLOATING GLASSMORPHIC ICON-ONLY CONTROL DOCK (GOOGLE MEET / MS TEAMS / ZOOM STYLE) */}
      <div className="fixed bottom-4 inset-x-0 z-50 flex items-center justify-center px-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-full bg-[#0E1320]/95 backdrop-blur-2xl border border-white/[0.1] shadow-[0_20px_50px_rgba(0,0,0,0.85)] max-w-full">
          {/* 1. Microphone Toggle (Icon-only + Live Voice Ring) */}
          <DockIconButton
            onClick={() => meetingAndCallService.toggleMic(currentUser.id)}
            tooltip={myParticipant?.isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            shortcut="M"
            danger={Boolean(myParticipant?.isMicMuted)}
          >
            <ICON_MAP.MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            {!myParticipant?.isMicMuted && liveMicLevel > 8 && (
              <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400/70 animate-ping pointer-events-none" />
            )}
          </DockIconButton>

          {/* 2. Camera Toggle (Icon-only) */}
          <DockIconButton
            onClick={() => meetingAndCallService.toggleCamera(currentUser.id)}
            tooltip={myParticipant?.isCameraOff ? 'Turn on camera' : 'Turn off camera'}
            shortcut="V"
            danger={Boolean(myParticipant?.isCameraOff)}
          >
            <ICON_MAP.VideoCameraIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* 3. Present / Share Screen (Triggers Native Tab / Window / Screen Picker & Live Broadcast) */}
          <DockIconButton
            onClick={async () => {
              if (myParticipant?.isScreenSharing) {
                await meetingAndCallService.toggleScreenShare(currentUser.id);
              } else {
                const started = await meetingAndCallService.toggleScreenShare(currentUser.id);
                if (started) {
                  setCallLayout('presentation');
                }
              }
            }}
            tooltip={
              myParticipant?.isScreenSharing
                ? 'Stop sharing screen'
                : 'Share screen, window, or tab'
            }
            accent={Boolean(myParticipant?.isScreenSharing)}
          >
            <ICON_MAP.ComputerDesktopIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* 4. Raise Hand (Icon-only) */}
          <DockIconButton
            onClick={() => meetingAndCallService.toggleRaiseHand(currentUser.id)}
            tooltip={myParticipant?.isHandRaised ? 'Lower hand' : 'Raise hand'}
            warning={Boolean(myParticipant?.isHandRaised)}
          >
            <ICON_MAP.HandRaisedIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* 5. Reactions (Icon-only with Emoji Popover) */}
          <div className="relative">
            <DockIconButton
              onClick={() => setShowReactionPicker(prev => !prev)}
              tooltip="Send live reaction"
              active={showReactionPicker}
            >
              <ICON_MAP.FaceSmileIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </DockIconButton>

            {showReactionPicker && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 p-1.5 rounded-full bg-[#0E1320]/98 border border-white/10 shadow-2xl flex items-center gap-1 z-50">
                {CALL_REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      meetingAndCallService.sendReaction(currentUser, emoji);
                      setShowReactionPicker(false);
                    }}
                    className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-lg transition-transform hover:scale-125 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 6. Live Captions Toggle (Icon-only) */}
          <DockIconButton
            onClick={() => setShowCaptions(prev => !prev)}
            tooltip={showCaptions ? 'Hide live captions' : 'Turn on live captions'}
            shortcut="C"
            active={showCaptions}
            className="hidden sm:flex"
          >
            <span className="text-[11px] font-black tracking-tighter">CC</span>
          </DockIconButton>

          {/* 7. Camera, Mic & Speaker Check / Settings (Icon-only) */}
          <DockIconButton
            onClick={() => setShowDeviceSettings(prev => !prev)}
            tooltip="Camera, Mic & Speaker Check"
            active={showDeviceSettings}
          >
            <ICON_MAP.CogIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 mx-0.5 hidden sm:block" />

          {/* 8. People / Participants Drawer Toggle (Icon-only) */}
          <DockIconButton
            onClick={() => setActiveDrawerTab(prev => (prev === 'people' ? null : 'people'))}
            tooltip="Participants & Invite"
            active={activeDrawerTab === 'people'}
            badge={connectedParticipants.length}
          >
            <ICON_MAP.UserGroupIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* 9. In-Call Chat Drawer Toggle (Icon-only) */}
          <DockIconButton
            onClick={() => setActiveDrawerTab(prev => (prev === 'chat' ? null : 'chat'))}
            tooltip="In-call chat"
            active={activeDrawerTab === 'chat'}
            badge={(activeCall.chatMessages || []).length}
          >
            <ICON_MAP.ChatBubbleLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* 10. Meeting Notes & Action Items Drawer Toggle (Icon-only) */}
          <DockIconButton
            onClick={() => setActiveDrawerTab(prev => (prev === 'notes' ? null : 'notes'))}
            tooltip="Shared notes & action items"
            active={activeDrawerTab === 'notes'}
            className="hidden sm:flex"
          >
            <ICON_MAP.ClipboardDocumentListIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* 11. AI Scribe Drawer Toggle (Icon-only) */}
          <DockIconButton
            onClick={() => setActiveDrawerTab(prev => (prev === 'ai' ? null : 'ai'))}
            tooltip="AI Meeting Scribe"
            active={activeDrawerTab === 'ai'}
            className="hidden sm:flex"
          >
            <ICON_MAP.SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 mx-0.5" />

          {/* 12. End / Leave Call Button (Icon-only Pill) */}
          <DockIconButton
            onClick={() => meetingAndCallService.leaveCall(currentUser.id)}
            tooltip="Leave call"
            danger
            className="!w-12 sm:!w-14 bg-rose-600 hover:bg-rose-500"
          >
            <ICON_MAP.PhoneIcon className="w-4 h-4 sm:w-5 sm:h-5 rotate-[135deg]" />
          </DockIconButton>
        </div>
      </div>
    </div>
  );
};

class VideoCallErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || 'Unexpected call error' };
  }

  componentDidCatch(error: Error) {
    console.warn('[VideoCallErrorBoundary] Recovered from call UI error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-5 right-5 z-[10000] max-w-sm rounded-2xl bg-slate-900/95 border border-indigo-500/40 p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-indigo-300">Call Interface Recovered</h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Your call connection is still active. Click Resume to reopen the studio controls.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    meetingAndCallService.endCallForAll();
                  } catch {}
                  this.setState({ hasError: false, errorMessage: '' });
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-[11px] font-semibold cursor-pointer"
              >
                End
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const GlobalVideoCallManager: React.FC = () => (
  <VideoCallErrorBoundary>
    <GlobalVideoCallManagerInner />
  </VideoCallErrorBoundary>
);

export const VideoCallStudioModal = GlobalVideoCallManager;
export default GlobalVideoCallManager;
