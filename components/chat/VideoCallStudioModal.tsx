import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { VoiceTranscribeButton } from '../shared/VoiceTranscribeButton';
import { motion } from 'motion/react';
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
import { GLASS_SPRING } from '../shared/LiquidGlass';
import meetingAndCallService, {
  IncomingCallInvite,
} from '../../services/meetingAndCallService';
import chatService from '../../services/chatService';
import { WhiteboardStudioPage } from '../whiteboard/WhiteboardStudioPage';

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
  volume?: number;
}> = ({ stream, isLocalSpeaking = false, echoGuardEnabled = true, volume = 1 }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTrackId = stream?.getAudioTracks()?.[0]?.id || '';
  const clampedVol = Math.max(0, Math.min(1, volume));

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const audioOnlyStream = new MediaStream(audioTracks);
    el.srcObject = audioOnlyStream;
    el.volume = echoGuardEnabled && isLocalSpeaking ? Math.min(0.05, clampedVol) : clampedVol;
    el.play().catch(() => {});
  }, [stream, audioTrackId]);

  useEffect(() => {
    if (audioRef.current) {
      // When Echo Guard is active and local user speaks into mic, duck speaker output to break same-room feedback loops
      audioRef.current.volume =
        echoGuardEnabled && isLocalSpeaking ? Math.min(0.05, clampedVol) : clampedVol;
    }
  }, [isLocalSpeaking, echoGuardEnabled, clampedVol]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

/**
 * Spatial Liquid Glass Icon-Only Control Button with Hover Tooltip
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
    'bg-white/[0.08] hover:bg-white/[0.16] text-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.12),inset_0_1px_2px_rgba(255,255,255,0.18)]';
  if (danger) {
    stateClass =
      'bg-rose-600/95 hover:bg-rose-500 text-white shadow-[0_8px_20px_-4px_rgba(225,29,72,0.5),inset_0_1px_2px_rgba(255,255,255,0.28)]';
  } else if (warning) {
    stateClass =
      'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_8px_20px_-4px_rgba(245,158,11,0.4),inset_0_1px_2px_rgba(255,255,255,0.35)]';
  } else if (accent || active) {
    stateClass =
      'bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] text-[var(--accent-cta-ink)] shadow-[0_8px_20px_-4px_rgba(var(--primary-rgb),0.45),inset_0_1px_2px_rgba(255,255,255,0.28)]';
  }

  return (
    <div className="relative group flex items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={tooltip}
        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center backdrop-blur-md transition-all duration-150 active:scale-95 cursor-pointer ${stateClass} ${className}`}
      >
        {children}
        {badge !== undefined && badge !== 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-[10px] font-bold flex items-center justify-center ring-2 ring-black/60 tabular-nums">
            {badge}
          </span>
        )}
      </button>

      {/* Hover / Focus Tooltip Pill */}
      <div className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0 absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-xl editorial-popover text-[11px] font-medium text-[var(--text-primary)] whitespace-nowrap z-50 flex items-center gap-1.5">
        <span>{tooltip}</span>
        {shortcut && (
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[var(--surface-glass-2)] text-[var(--text-secondary)]">
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
  const [callLayout, setCallLayout] = useState<'grid' | 'spotlight' | 'presentation' | 'whiteboard'>('grid');
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'people' | 'chat' | 'notes' | 'ai' | null>('chat');
  const [showCaptions, setShowCaptions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMoreDock, setShowMoreDock] = useState(false);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [bgMode, setBgMode] = useState<'none' | 'blur' | 'studio' | 'midnight'>('studio');
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [liveMicLevel, setLiveMicLevel] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(1);

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
        <div className="rounded-[26px] liquid-glass-overlay p-5 text-[var(--text-primary)]">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-[var(--surface-glass-2)] flex items-center justify-center text-lg font-bold text-[var(--accent-text)] ring-4 ring-[var(--accent)]/25 animate-pulse overflow-hidden">
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
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-[var(--bg-surface)] flex items-center justify-center">
                <ICON_MAP.VideoCameraIcon className="w-2.5 h-2.5 text-white" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-[var(--accent-text)]">
                {inv.type === 'direct' ? 'Incoming 1:1 Call' : 'Incoming Team Meeting'}
              </div>
              <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{inv.title}</h4>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {inv.callerName} is calling · {inv.meetingCode}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              type="button"
              onClick={() => handleAcceptIncomingInvite(true)}
              className="py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
              <span>Accept</span>
            </button>
            <button
              type="button"
              onClick={() => handleAcceptIncomingInvite(false)}
              className="py-2 px-3 rounded-full bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] text-[var(--accent-cta-ink)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ICON_MAP.PhoneIcon className="w-4 h-4" />
              <span>Voice</span>
            </button>
            <button
              type="button"
              onClick={handleDeclineIncomingInvite}
              className="py-2 px-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
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
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
        onClick={closePreJoinLobby}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="liquid-glass-overlay rounded-[28px] max-w-3xl w-full overflow-hidden text-[var(--text-primary)] grid grid-cols-1 md:grid-cols-12 animate-modal-appear"
        >
          {/* Left Camera & Audio Preview */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between bg-[var(--surface-glass-1)]/60 border-b md:border-b-0 md:border-r border-[var(--border-hairline)]/45">
            <div className="relative aspect-video rounded-[22px] overflow-hidden bg-slate-950/85 flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
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
                  <span className="text-xs text-slate-300">
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
                      className="px-4 py-1.5 rounded-full bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] text-[var(--accent-cta-ink)] text-xs font-semibold cursor-pointer"
                    >
                      Enable Camera Preview
                    </button>
                  )}
                </div>
              )}

              {/* Bottom Icon-Only Controls inside Preview */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-black/55 backdrop-blur-xl px-4 py-2 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.12)]">
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
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span className="flex items-center gap-2">
                  <span>Mic Input:</span>
                  <div className="w-28 h-2 rounded-full bg-[var(--surface-glass-2)] overflow-hidden">
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
                    className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                  >
                    Test Speakers
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleRunMicLoopbackTest}
                    className="text-[11px] font-semibold text-emerald-500 hover:underline cursor-pointer"
                  >
                    {isRecordingMicTest ? 'Recording...' : 'Test Mic'}
                  </button>
                </div>
              </div>
              {micTestStatus && (
                <p className="text-[11px] text-emerald-500 font-medium">{micTestStatus}</p>
              )}
            </div>
          </div>

          {/* Right Meeting Info & Join Actions */}
          <div className="md:col-span-5 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-[var(--accent-text)]">Ready to join?</div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] leading-snug">{preJoinTarget.title}</h3>
              {preJoinTarget.meetingCode && (
                <div className="text-xs font-mono text-[var(--text-muted)]">
                  Room Code: {preJoinTarget.meetingCode}
                </div>
              )}

              {preJoinTarget.invitedUsers && preJoinTarget.invitedUsers.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-xs text-[var(--text-muted)]">
                    Participants ({preJoinTarget.invitedUsers.length + 1}):
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {preJoinTarget.invitedUsers.slice(0, 6).map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-1.5 bg-[var(--surface-glass-2)] rounded-full px-2.5 py-1 text-xs"
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

            <div className="space-y-2.5 pt-4 border-t border-[var(--border-hairline)]/45">
              <button
                type="button"
                onClick={handleConfirmPreJoin}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] text-[var(--accent-cta-ink)] text-sm font-semibold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
                <span>Join Meeting Now</span>
              </button>
              <button
                type="button"
                onClick={closePreJoinLobby}
                className="w-full py-2 px-4 rounded-full glass-bubble-control text-[var(--text-primary)] text-xs font-semibold cursor-pointer"
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
      <div className="fixed bottom-20 right-4 sm:right-6 z-[9995] w-72 sm:w-80 rounded-[24px] liquid-glass-overlay text-[var(--text-primary)] overflow-hidden animate-modal-appear">
        {/* Keep remote audio playing seamlessly while minimized */}
        {Array.from(callState.remoteStreams.entries()).map(([peerId, rStream]) => (
          <RemoteAudioPlayer
            key={peerId}
            stream={rStream}
            isLocalSpeaking={liveMicLevel > 22 && !myParticipant?.isMicMuted}
            echoGuardEnabled={callState.echoGuardEnabled}
            volume={remoteVolume}
          />
        ))}
        <div className="p-3 bg-[var(--surface-glass-1)]/60 border-b border-[var(--border-hairline)]/45 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{activeCall.title}</div>
              <div className="text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                {formatTimer(callDurationSec)} · {connectedParticipants.length} active
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => meetingAndCallService.setMinimized(false)}
            title="Expand Call Window"
            className="w-8 h-8 rounded-full bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] text-[var(--accent-cta-ink)] flex items-center justify-center cursor-pointer"
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
                className="w-8 h-8 rounded-full bg-[var(--surface-glass-2)] border-2 border-[var(--bg-surface)] flex items-center justify-center text-xs font-bold overflow-hidden"
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
                  : 'glass-bubble-control text-[var(--text-primary)]'
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
                  : 'glass-bubble-control text-[var(--text-primary)]'
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
    if (mode === 'blur') return 'bg-gradient-to-br from-white/[0.09] via-black/55 to-black/80';
    if (mode === 'studio') return 'bg-gradient-to-b from-white/[0.07] via-black/50 to-black/75';
    if (mode === 'midnight') return 'bg-black/80';
    return 'bg-white/[0.04]';
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
        <div className="relative w-full h-full flex items-center justify-center bg-black/90">
          <VideoStreamTile stream={callState.screenStream} muted fit="contain" />
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/65 backdrop-blur-xl border border-white/15 text-[11px] font-medium text-[var(--accent)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />
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
          <div className="relative w-full h-full flex items-center justify-center bg-black/90">
            <VideoStreamTile stream={remotePeerStream} muted fit="contain" />
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/65 backdrop-blur-xl border border-white/15 text-[11px] font-medium text-[var(--accent)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />
              <span>Viewing {screenSharer.name}&apos;s live HD screen stream</span>
            </div>
          </div>
        );
      }

      if (remoteScreenFrame) {
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-black/90">
            <img
              src={remoteScreenFrame}
              alt={`${screenSharer.name}'s shared screen`}
              className="w-full h-full object-contain select-none"
            />
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/65 backdrop-blur-xl border border-white/15 text-[11px] font-medium text-[var(--accent)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />
              <span>Viewing {screenSharer.name}&apos;s live screen</span>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-white/60">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-[var(--accent)] animate-pulse">
            <ICON_MAP.ComputerDesktopIcon className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-white">
            Connecting to {screenSharer.name}&apos;s screen stream...
          </div>
          <p className="text-xs text-white/60 max-w-sm">
            Synchronizing live video frames for {activeCall.title}.
          </p>
        </div>
      );
    }

    // If user manually switched to Presentation Stage without anyone currently sharing
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-[var(--accent)]">
          <ICON_MAP.ComputerDesktopIcon className="w-7 h-7" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm sm:text-base font-bold text-white">
            No one is presenting right now
          </h3>
          <p className="text-xs text-white/60">
            Share your entire screen, a specific application window, or a browser tab with everyone in the call.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await meetingAndCallService.toggleScreenShare(currentUser.id);
          }}
          className="px-4 py-2 rounded-full bg-[var(--accent-cta)] hover:opacity-90 text-[var(--accent-cta-ink)] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
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
    const isActivelySpeaking = p.isSpeaking && !p.isMicMuted && p.connectionState === 'connected';

    return (
      <div
        key={p.userId}
        onClick={() => setPinnedUserId(prev => (prev === p.userId ? null : p.userId))}
        className={`relative rounded-[26px] overflow-hidden border-[1.5px] backdrop-blur-xl transition-all duration-300 select-none cursor-pointer flex items-center justify-center group shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_16px_40px_rgba(0,0,0,0.45)] ${getTileBgClass(
          p
        )} ${
          isActivelySpeaking
            ? 'border-emerald-400/80 ring-2 ring-emerald-400/25'
            : pinnedUserId === p.userId
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/25'
            : isDeclined
            ? 'border-rose-500/40 opacity-75'
            : isRinging
            ? 'border-amber-400/40'
            : 'border-white/[0.12] hover:border-white/[0.24]'
        } ${
          isLargeStage
            ? 'h-full min-h-[260px] sm:min-h-[360px]'
            : 'min-h-[140px] sm:min-h-[190px] h-full'
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
            <div className="relative flex items-center justify-center">
              {/* Concentric spatial glass rings */}
              <div
                className={`absolute rounded-full border border-white/[0.08] bg-white/[0.02] pointer-events-none ${
                  isLargeStage ? 'w-36 h-36 sm:w-44 sm:h-44' : 'w-24 h-24 sm:w-28 sm:h-28'
                } ${isActivelySpeaking ? 'animate-pulse border-emerald-400/35' : ''}`}
              />
              <div
                className={`absolute rounded-full border border-white/[0.12] bg-white/[0.03] pointer-events-none ${
                  isLargeStage ? 'w-28 h-28 sm:w-32 sm:h-32' : 'w-20 h-20 sm:w-22 sm:h-22'
                }`}
              />
              <div
                className={`relative z-10 ${
                  isLargeStage
                    ? 'w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl'
                    : 'w-14 h-14 sm:w-16 sm:h-16 text-lg sm:text-xl'
                } rounded-full bg-white/[0.08] backdrop-blur-xl border-2 ${
                  isActivelySpeaking
                    ? 'border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.45)]'
                    : isDeclined
                    ? 'border-rose-500/70'
                    : isRinging
                    ? 'border-amber-400 animate-pulse'
                    : 'border-white/20'
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
                  className="absolute -top-1 -right-1 z-20 w-7 h-7 rounded-full bg-amber-400 text-black flex items-center justify-center text-sm shadow-lg animate-bounce"
                >
                  ✋
                </span>
              )}
            </div>

            {isDeclined ? (
              <div className="flex flex-col items-center gap-1.5 relative z-10">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-[11px] font-semibold text-rose-200">
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
                  className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
                >
                  Ring Again
                </button>
              </div>
            ) : isRinging ? (
              <div className="flex flex-col items-center gap-1 relative z-10">
                <span className="text-xs font-medium text-amber-300 animate-pulse">
                  Ringing {p.name}...
                </span>
                <span className="text-[10px] text-white/55">
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
                className="relative z-10 px-3.5 py-1.5 rounded-full bg-white/[0.1] hover:bg-[var(--accent-cta)] text-white hover:text-[var(--accent-cta-ink)] border border-white/15 backdrop-blur-xl text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" />
                <span>Turn On Camera</span>
              </button>
            ) : null}
          </div>
        )}

        {/* Top-Left Frosted Mic Status Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {p.connectionState === 'connected' && p.isMicMuted && (
            <span
              title="Microphone Muted"
              className="w-7 h-7 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 text-rose-400 flex items-center justify-center shadow-md"
            >
              <ICON_MAP.MicrophoneIcon className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Top-Right Status Badges */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {p.isHandRaised && (
            <span className="px-2 py-0.5 rounded-full bg-amber-400/95 text-black text-[10px] font-bold">
              ✋
            </span>
          )}
          {pinnedUserId === p.userId && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-[10px] font-semibold shadow-sm">
              Pinned
            </span>
          )}
          {p.isScreenSharing && p.connectionState === 'connected' && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-[10px] font-bold shadow-sm">
              Presenting
            </span>
          )}
        </div>

        {/* Bottom Frosted Glass Name Capsule & Live Audio Meter */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-xl border border-white/15">
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
            <span className="text-[11px] sm:text-xs font-semibold text-white truncate">
              {p.name} {isMe ? '(You)' : ''}
            </span>
            {p.role && isLargeStage && (
              <span className="text-[10px] text-white/65 truncate hidden sm:inline">
                · {normalizeUserRole(p.role).replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {p.connectionState !== 'connected' ? (
              <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-black/55 backdrop-blur-xl text-white/80 border border-white/15">
                {p.connectionState === 'declined' ? 'Declined' : 'Ringing'}
              </span>
            ) : p.isMicMuted ? (
              <span
                title="Microphone Muted"
                className="w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-sm"
              >
                <ICON_MAP.MicrophoneIcon className="w-3 h-3" />
              </span>
            ) : (
              <span
                title="Microphone Active"
                className="px-1.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur-xl border border-emerald-400/35 flex items-center gap-0.5"
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
    <div className="fixed inset-0 z-[9990] bg-[#0D1015] text-white/95 flex overflow-hidden animate-fadeIn select-none">
      {/* Atmospheric palette-tinted ambient glow behind the obsidian studio */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background:
            'radial-gradient(55% 50% at 18% 12%, var(--ambient-primary, rgba(56,189,248,0.28)) 0%, transparent 70%), radial-gradient(50% 50% at 85% 88%, var(--ambient-secondary, rgba(168,85,247,0.24)) 0%, transparent 72%)',
        }}
      />

      {/* Mount hidden audio players for all remote WebRTC streams with lossless 48kHz clarity & Echo Guard */}
      {Array.from(callState.remoteStreams.entries()).map(([peerId, rStream]) => (
        <RemoteAudioPlayer
          key={peerId}
          stream={rStream}
          isLocalSpeaking={liveMicLevel > 22 && !myParticipant?.isMicMuted}
          echoGuardEnabled={callState.echoGuardEnabled}
          volume={remoteVolume}
        />
      ))}

      {/* ==================================================================== */}
      {/* COLUMN 1: LEFT VERTICAL ICON RAIL + BOTTOM-LEFT VOLUME SLIDER        */}
      {/* ==================================================================== */}
      <aside className="relative z-20 hidden sm:flex w-[68px] flex-col items-center justify-between py-5 border-r border-white/[0.06] bg-black/25 backdrop-blur-2xl flex-shrink-0">
        {/* Top Brand Mark */}
        <button
          type="button"
          onClick={() => meetingAndCallService.setMinimized(true)}
          title="Minimize Call to Picture-in-Picture"
          className="w-10 h-10 rounded-2xl bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer"
        >
          <ICON_MAP.VideoCameraIcon className="w-5 h-5" />
        </button>

        {/* Middle Navigation Icons */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => meetingAndCallService.setMinimized(true)}
            title="Home / Minimize to PiP"
            className="w-10 h-10 rounded-xl text-white/45 hover:text-white hover:bg-white/[0.07] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ICON_MAP.HomeIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawerTab(prev => (prev === 'notes' ? null : 'notes'))}
            title="Agenda, Shared Notes & Action Items"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              activeDrawerTab === 'notes'
                ? 'bg-white/[0.1] text-[var(--accent)]'
                : 'text-white/45 hover:text-white hover:bg-white/[0.07]'
            }`}
          >
            <ICON_MAP.CalendarIcon className="w-5 h-5" />
          </button>

          {/* Active Video Call Indicator */}
          <button
            type="button"
            onClick={() => setCallLayout('grid')}
            title="Live Video Stage"
            className="relative w-10 h-10 rounded-xl bg-white/[0.08] text-[var(--accent)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ICON_MAP.VideoCameraIcon className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawerTab(prev => (prev === 'ai' ? null : 'ai'))}
            title="AI Meeting Scribe & Recap"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              activeDrawerTab === 'ai'
                ? 'bg-white/[0.1] text-[var(--accent)]'
                : 'text-white/45 hover:text-white hover:bg-white/[0.07]'
            }`}
          >
            <ICON_MAP.ClipboardDocumentListIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowDeviceSettings(true)}
            title="Camera, Microphone & Audio Settings"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              showDeviceSettings
                ? 'bg-white/[0.1] text-[var(--accent)]'
                : 'text-white/45 hover:text-white hover:bg-white/[0.07]'
            }`}
          >
            <ICON_MAP.CogIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom-Left Vertical Volume Slider (matches mockup) */}
        <div
          title={`Output Volume: ${Math.round(remoteVolume * 100)}%`}
          className="flex flex-col items-center gap-3 pb-1"
        >
          <div className="relative h-24 w-5 flex items-center justify-center">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={remoteVolume}
              onChange={e => setRemoteVolume(parseFloat(e.target.value))}
              aria-label="Call output volume"
              className="w-24 h-1.5 -rotate-90 accent-[var(--accent-cta)] cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={() => setRemoteVolume(prev => (prev > 0 ? 0 : 1))}
            title={remoteVolume > 0 ? 'Mute Call Audio' : 'Unmute Call Audio'}
            className="text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <ICON_MAP.SpeakerWaveIcon className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* COLUMN 2: CENTER MAIN CALL STAGE                                     */}
      {/* ==================================================================== */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 min-h-0">
        {/* TOP HEADER BAR (Title + Teams Badge | Layout Switcher Icons) */}
        <header className="h-16 px-4 sm:px-7 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-white truncate max-w-[180px] sm:max-w-md">
              {activeCall.title}
            </h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-[11px] font-semibold shadow-sm flex-shrink-0">
              <ICON_MAP.UserGroupIcon className="w-3.5 h-3.5" />
              <span>{activeCall.type === 'direct' ? '1:1 Call' : 'Teams'}</span>
            </span>
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
              className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] font-mono text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <span>{activeCall.meetingCode}</span>
            </button>
          </div>

          {/* Right: Quality, Echo Guard, Layout Switcher Icons */}
          <div className="flex items-center gap-2">
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
              title="Toggle 1080p / 720p HD"
              className="hidden lg:inline-flex h-7 px-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] font-mono font-bold text-[var(--accent)] items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{callState.videoQualityMode || '1080p'}</span>
              <span className="text-emerald-400">HD</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextGuard = !callState.echoGuardEnabled;
                meetingAndCallService.setEchoGuardEnabled(nextGuard);
                addToast(
                  nextGuard ? 'Acoustic Echo Guard Enabled' : 'Full-Duplex Studio Mode',
                  nextGuard
                    ? 'Anti-screech speaker attenuation active.'
                    : 'Unattenuated full-duplex studio audio.',
                  'info'
                );
              }}
              title="Toggle Acoustic Echo Guard"
              className={`hidden xl:inline-flex h-7 px-2.5 rounded-full border text-[10px] font-semibold items-center gap-1 transition-colors cursor-pointer ${
                callState.echoGuardEnabled
                  ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                  : 'bg-white/[0.05] border-white/[0.08] text-white/55 hover:text-white'
              }`}
            >
              <span>{callState.echoGuardEnabled ? 'Echo Guard' : 'Full-Duplex'}</span>
            </button>

            {/* Layout Switcher matching the 3-icon switcher in mockup */}
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'spotlight', label: 'Speaker View', icon: ICON_MAP.UserCircleIcon },
                  { id: 'presentation', label: 'Screen Share Stage', icon: ICON_MAP.ComputerDesktopIcon },
                  { id: 'grid', label: '2x2 Gallery Grid', icon: ICON_MAP.Squares2X2Icon },
                  { id: 'whiteboard', label: 'Live Co-Whiteboard', icon: ICON_MAP.SparklesIcon },
                ] as const
              ).map(mode => {
                const IconComp = mode.icon;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setCallLayout(mode.id)}
                    title={mode.label}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                      callLayout === mode.id
                        ? 'text-[var(--accent)] bg-white/[0.08]'
                        : 'text-white/45 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                );
              })}
            </div>

            {/* Mobile Drawer Toggle */}
            <button
              type="button"
              onClick={() => setActiveDrawerTab(prev => (prev ? null : 'chat'))}
              title="Toggle Chat & Collaboration Panel"
              className="lg:hidden w-8 h-8 rounded-xl bg-white/[0.07] text-white flex items-center justify-center cursor-pointer"
            >
              <ICON_MAP.ChatBubbleLeftIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* SUB-HEADER ROW: ● Record MM:SS  |  + Add User */}
        <div className="px-5 sm:px-7 pt-4 pb-2 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsRecordingCall(prev => !prev);
              addToast(
                !isRecordingCall ? 'Session Recording Started' : 'Session Recording Paused',
                !isRecordingCall
                  ? 'Call timer & local session markers are now recording.'
                  : 'Recording indicator paused.',
                'info'
              );
            }}
            className="flex items-center gap-2 text-xs font-medium text-white/75 hover:text-white transition-colors cursor-pointer tabular-nums"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRecordingCall ? 'bg-rose-500 animate-ping' : 'bg-rose-500'
              }`}
            />
            <span>{isRecordingCall ? 'Record' : 'Live'} {formatTimer(callDurationSec)}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawerTab('people')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <span className="w-5 h-5 rounded-md bg-white/[0.1] border border-white/[0.12] flex items-center justify-center text-white">
              <ICON_MAP.PlusIcon className="w-3 h-3" />
            </span>
            <span>Add User</span>
          </button>
        </div>

        {/* MAIN VIDEO STAGE */}
        <div className="flex-1 flex flex-col px-5 sm:px-7 pb-3 min-w-0 min-h-0 relative overflow-hidden">
          {callLayout === 'presentation' ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
              <div className="lg:col-span-9 rounded-[26px] bg-black/75 border border-white/[0.1] overflow-hidden flex flex-col relative min-h-[260px] shadow-2xl">
                <div className="px-4 py-2.5 bg-white/[0.05] backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--accent)] flex items-center gap-2">
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
                      className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      Stop Sharing
                    </button>
                  )}
                </div>
                <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
                  {renderLiveScreenShareStage()}
                </div>
              </div>
              <div className="lg:col-span-3 flex lg:flex-col gap-3 overflow-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                {stageParticipants.map(p => (
                  <div key={p.userId} className="w-48 lg:w-full h-36 sm:h-44 flex-shrink-0">
                    {renderParticipantTile(p, false)}
                  </div>
                ))}
              </div>
            </div>
          ) : callLayout === 'whiteboard' ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
              <div className="lg:col-span-9 rounded-[26px] bg-[#05070B] border border-white/[0.1] overflow-hidden flex flex-col relative min-h-[340px] shadow-2xl">
                <WhiteboardStudioPage
                  compactMode
                  projectIdOverride={activeProject?.id}
                  onCloseCompact={() => setCallLayout('grid')}
                />
              </div>
              <div className="lg:col-span-3 flex lg:flex-col gap-3 overflow-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                {stageParticipants.map(p => (
                  <div key={p.userId} className="w-48 lg:w-full h-36 sm:h-44 flex-shrink-0">
                    {renderParticipantTile(p, false)}
                  </div>
                ))}
              </div>
            </div>
          ) : callLayout === 'spotlight' && stageParticipants.length > 1 ? (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex items-center gap-3 overflow-x-auto pb-1 flex-shrink-0 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                {stageParticipants
                  .filter(p => p.userId !== spotlightParticipant.userId)
                  .map(p => (
                    <div key={p.userId} className="w-44 sm:w-52 h-28 sm:h-32 flex-shrink-0">
                      {renderParticipantTile(p, false)}
                    </div>
                  ))}
              </div>
              <div className="flex-1 min-h-0">{renderParticipantTile(spotlightParticipant, true)}</div>
            </div>
          ) : (
            /* 2x2 Squircle Gallery Grid matching mockup */
            <div
              className={`flex-1 grid gap-4 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] ${
                stageParticipants.length === 1
                  ? 'grid-cols-1 max-w-3xl mx-auto w-full'
                  : stageParticipants.length <= 4
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
              }`}
            >
              {stageParticipants.map(p =>
                renderParticipantTile(p, stageParticipants.length <= 2)
              )}
            </div>
          )}

          {/* Floating Ringing / Waiting Card */}
          {ringingOrDeclinedParticipants.filter(p => p.connectionState === 'ringing').length > 0 && (
            <div className="absolute top-4 left-7 z-30 max-w-xs rounded-2xl bg-black/65 backdrop-blur-2xl border border-white/15 px-3.5 py-2.5 shadow-2xl flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  Ringing{' '}
                  {ringingOrDeclinedParticipants
                    .filter(p => p.connectionState === 'ringing')
                    .map(p => p.name.split(' ')[0])
                    .join(', ')}
                </div>
                <div className="text-[10px] text-white/60">Waiting to join session...</div>
              </div>
            </div>
          )}

          {/* Floating Live Reactions Overlay */}
          {callState.reactions.length > 0 && (
            <div className="pointer-events-none absolute bottom-6 left-7 flex flex-col-reverse gap-2 z-30">
              {callState.reactions.map(r => (
                <div
                  key={r.id}
                  className="px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-2xl border border-white/15 shadow-xl flex items-center gap-2 animate-bounce"
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span className="text-xs font-semibold text-white">{r.senderName}</span>
                </div>
              ))}
            </div>
          )}

          {/* Live Captions Subtitle Strip */}
          {showCaptions && Array.isArray(activeCall.transcript) && activeCall.transcript.length > 0 && (
            <div className="mt-2 mx-auto max-w-2xl w-full px-4 py-2 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/15 text-center shadow-lg">
              <span className="text-xs font-bold text-[var(--accent)] mr-2">
                {activeCall.transcript[activeCall.transcript.length - 1]?.speakerName}:
              </span>
              <span className="text-xs text-white/95">
                {activeCall.transcript[activeCall.transcript.length - 1]?.text}
              </span>
            </div>
          )}
        </div>

        {/* BOTTOM CENTER 5-BUTTON CONTROL DOCK (matches mockup) */}
        <div className="pb-5 pt-2 px-4 flex items-center justify-center gap-3 flex-shrink-0 relative z-30">
          {/* 1. Camera Toggle */}
          <DockIconButton
            onClick={() => meetingAndCallService.toggleCamera(currentUser.id)}
            tooltip={myParticipant?.isCameraOff ? 'Turn on camera' : 'Turn off camera'}
            shortcut="V"
            danger={Boolean(myParticipant?.isCameraOff)}
          >
            <ICON_MAP.VideoCameraIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </DockIconButton>

          {/* 2. Microphone Toggle */}
          <DockIconButton
            onClick={() => meetingAndCallService.toggleMic(currentUser.id)}
            tooltip={myParticipant?.isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            shortcut="M"
            danger={Boolean(myParticipant?.isMicMuted)}
          >
            <ICON_MAP.MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            {!myParticipant?.isMicMuted && liveMicLevel > 8 && (
              <span className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400/70 animate-ping pointer-events-none" />
            )}
          </DockIconButton>

          {/* 3. Centerpiece Prominent End / Leave Call Button (matches mockup gradient button) */}
          <button
            type="button"
            onClick={() => meetingAndCallService.leaveCall(currentUser.id)}
            title="Leave Call"
            className="w-14 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-400 hover:brightness-110 text-white flex items-center justify-center shadow-[0_10px_28px_-4px_rgba(244,63,94,0.6)] active:scale-95 transition-all cursor-pointer"
          >
            <ICON_MAP.PhoneIcon className="w-5 h-5 rotate-[135deg]" />
          </button>

          {/* 4. Record Toggle */}
          <DockIconButton
            onClick={() => {
              setIsRecordingCall(prev => !prev);
              addToast(
                !isRecordingCall ? 'Recording Started' : 'Recording Stopped',
                !isRecordingCall ? 'Session recording indicator is active.' : 'Recording indicator stopped.',
                'info'
              );
            }}
            tooltip={isRecordingCall ? 'Stop recording' : 'Record meeting'}
            active={isRecordingCall}
          >
            <span
              className={`w-3 h-3 rounded-full ${
                isRecordingCall ? 'bg-rose-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
          </DockIconButton>

          {/* 5. Screen Share & More Tools Popover */}
          <div className="relative">
            <DockIconButton
              onClick={() => setShowMoreDock(prev => !prev)}
              tooltip="Screen Share, Whiteboard, Hand Raise & Captions"
              accent={Boolean(myParticipant?.isScreenSharing) || callLayout === 'whiteboard' || showMoreDock}
            >
              <ICON_MAP.ComputerDesktopIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </DockIconButton>

            {showMoreDock && (
              <div className="absolute bottom-14 right-0 sm:left-1/2 sm:-translate-x-1/2 p-2 rounded-2xl bg-[#14181F]/95 backdrop-blur-2xl border border-white/15 shadow-2xl flex items-center gap-1.5 z-50">
                <DockIconButton
                  onClick={async () => {
                    setShowMoreDock(false);
                    const started = await meetingAndCallService.toggleScreenShare(currentUser.id);
                    if (started) setCallLayout('presentation');
                  }}
                  tooltip={myParticipant?.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                  accent={Boolean(myParticipant?.isScreenSharing)}
                >
                  <ICON_MAP.ComputerDesktopIcon className="w-4 h-4" />
                </DockIconButton>
                <DockIconButton
                  onClick={() => {
                    setShowMoreDock(false);
                    setCallLayout(prev => (prev === 'whiteboard' ? 'grid' : 'whiteboard'));
                  }}
                  tooltip="Live Co-Whiteboard"
                  accent={callLayout === 'whiteboard'}
                >
                  <ICON_MAP.SparklesIcon className="w-4 h-4" />
                </DockIconButton>
                <DockIconButton
                  onClick={() => {
                    setShowMoreDock(false);
                    meetingAndCallService.toggleRaiseHand(currentUser.id);
                  }}
                  tooltip={myParticipant?.isHandRaised ? 'Lower hand' : 'Raise hand'}
                  warning={Boolean(myParticipant?.isHandRaised)}
                >
                  <ICON_MAP.HandRaisedIcon className="w-4 h-4" />
                </DockIconButton>
                <DockIconButton
                  onClick={() => {
                    setShowMoreDock(false);
                    setShowCaptions(prev => !prev);
                  }}
                  tooltip="Live Captions"
                  active={showCaptions}
                >
                  <span className="text-[11px] font-black">CC</span>
                </DockIconButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* COLUMN 3: RIGHT INTEGRATED COLLABORATION PANEL (matches mockup)      */}
      {/* ==================================================================== */}
      {activeDrawerTab && (
        <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[348px] xl:w-[376px] lg:static lg:inset-auto border-l border-white/[0.06] bg-[#14181F]/92 backdrop-blur-2xl flex flex-col flex-shrink-0 shadow-2xl">
          {/* Right Panel Top Bar (Chat / Notes / AI icons | Bell + User Avatar) */}
          <div className="h-16 px-5 border-b border-white/[0.06] flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveDrawerTab('chat')}
                title="In-Call Chat"
                className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                  activeDrawerTab === 'chat'
                    ? 'text-[var(--accent)] bg-white/[0.07]'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <ICON_MAP.ChatBubbleLeftIcon className="w-5 h-5" />
                {activeDrawerTab === 'chat' && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawerTab('notes')}
                title="Meeting Notes & Action Items"
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  activeDrawerTab === 'notes'
                    ? 'text-[var(--accent)] bg-white/[0.07]'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <ICON_MAP.ClipboardDocumentListIcon className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawerTab('ai')}
                title="AI Meeting Scribe"
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  activeDrawerTab === 'ai'
                    ? 'text-[var(--accent)] bg-white/[0.07]'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <ICON_MAP.SparklesIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveDrawerTab('people')}
                title="Participants & Notifications"
                className="relative p-1.5 text-white/55 hover:text-white transition-colors cursor-pointer"
              >
                <ICON_MAP.BellIcon className="w-5 h-5" />
                {connectedParticipants.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {connectedParticipants.length}
                  </span>
                )}
              </button>

              <div className="relative">
                <Avatar user={currentUser} size="sm" disableHoverCard />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#14181F]" />
              </div>

              <button
                type="button"
                onClick={() => setActiveDrawerTab(null)}
                title="Close Panel"
                className="lg:hidden p-1.5 rounded-lg text-white/55 hover:text-white cursor-pointer"
              >
                <ICON_MAP.XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Participant Avatar Strip (👥 ▾  |  Avatars + +N overflow) */}
          <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveDrawerTab(prev => (prev === 'people' ? 'chat' : 'people'))}
              title="View & Invite Participants"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                activeDrawerTab === 'people'
                  ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] border-transparent'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-white/80'
              }`}
            >
              <ICON_MAP.UserGroupIcon className="w-4 h-4" />
              <ICON_MAP.ChevronDownIcon className="w-3 h-3" />
            </button>

            <div className="flex items-center gap-2">
              {connectedParticipants.slice(0, 3).map(p => (
                <div key={p.userId} className="relative" title={p.name}>
                  <div className="w-9 h-9 rounded-full bg-white/[0.08] border border-white/15 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      (p.name || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#14181F] ${
                      p.isMicMuted ? 'bg-rose-500' : 'bg-emerald-400'
                    }`}
                  />
                </div>
              ))}
              {connectedParticipants.length > 3 && (
                <button
                  type="button"
                  onClick={() => setActiveDrawerTab('people')}
                  className="w-9 h-9 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-xs font-bold flex items-center justify-center shadow-sm cursor-pointer tabular-nums"
                >
                  +{connectedParticipants.length - 3}
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: PEOPLE & ADD TEAMMATES */}
          {activeDrawerTab === 'people' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-white/65">
                  <span>Active on Call ({connectedParticipants.length})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">● Live Session</span>
                </div>
                <div className="space-y-1.5">
                  {connectedParticipants.map(p => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.05] border border-white/[0.08]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/15 flex items-center justify-center text-xs font-bold text-[var(--accent)] overflow-hidden">
                            {p.avatar ? (
                              <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#14181F]" />
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

              {ringingOrDeclinedParticipants.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                  <div className="text-xs font-semibold text-white/60">
                    Invited / Ringing ({ringingOrDeclinedParticipants.length})
                  </div>
                  <div className="space-y-1.5">
                    {ringingOrDeclinedParticipants.map(p => (
                      <div
                        key={p.userId}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.07]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/80 overflow-hidden">
                            {p.avatar ? (
                              <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white/90 truncate">
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

              <div className="space-y-2.5 pt-3 border-t border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/75">
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
                        meetingAndCallService.inviteTeammatesToActiveCall(targetList, currentUser);
                        addToast(
                          'Ringing Teammates',
                          `Ringing ${targetList.length} teammate(s) to join the call.`,
                          'info'
                        );
                      }
                    }}
                    className="text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Ring Online
                  </button>
                </div>

                <input
                  type="text"
                  value={peopleSearch}
                  onChange={e => setPeopleSearch(e.target.value)}
                  placeholder="Search organization teammates..."
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs text-white placeholder-white/40 outline-none focus:border-[var(--accent)]"
                />

                <div className="space-y-1.5 max-h-64 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                  {invitableTeammates.map(u => {
                    const participantRecord = allParticipants.find(p => p.userId === u.id);
                    const isConnected = participantRecord?.connectionState === 'connected';
                    const isRinging = participantRecord?.connectionState === 'ringing';
                    const online = isTeammateOnline(u.id);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-2xl bg-white/[0.04] border border-white/[0.08]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative flex-shrink-0">
                            <Avatar user={u} size="sm" disableHoverCard />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#14181F] ${
                                online ? 'bg-emerald-400' : 'bg-white/30'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white/95 truncate">
                              {u.full_name || u.email.split('@')[0]}
                            </div>
                            <div className="text-[10px] text-white/55 truncate flex items-center gap-1">
                              <span className={online ? 'text-emerald-400' : 'text-white/40'}>
                                {online ? 'Online' : 'Offline'}
                              </span>
                              <span>·</span>
                              <span>{normalizeUserRole(u.role).replace(/_/g, ' ')}</span>
                            </div>
                          </div>
                        </div>

                        {isConnected ? (
                          <span className="text-[11px] text-emerald-400 font-semibold px-2">Active</span>
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
                            className="px-2.5 py-1 rounded-full bg-[var(--accent-cta)] hover:opacity-90 text-[var(--accent-cta-ink)] text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
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

          {/* TAB 2: IN-CALL CHAT (Default — matches mockup) */}
          {activeDrawerTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
                {(Array.isArray(activeCall.chatMessages) ? activeCall.chatMessages : []).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
                    <div className="w-11 h-11 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/45 mb-3">
                      <ICON_MAP.ChatBubbleLeftIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-white/80">In-call chat is ready</p>
                    <p className="text-[11px] text-white/45 mt-1">
                      Share links, meeting notes, or quick updates with everyone on the call.
                    </p>
                  </div>
                ) : (
                  (Array.isArray(activeCall.chatMessages) ? activeCall.chatMessages : []).map((m, idx) => {
                    if (!m) return null;
                    const isMine = m.senderId === currentUser.id;
                    const msgTime = m.timestamp ? new Date(m.timestamp) : null;
                    const formattedTime =
                      msgTime && !Number.isNaN(msgTime.getTime())
                        ? msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';
                    return (
                      <div
                        key={m.id || `cmsg-idx-${idx}`}
                        className={`flex flex-col gap-1.5 ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-white/45 px-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                          <span className="font-medium text-white/60">
                            {isMine ? 'You' : m.senderName || 'Participant'}
                          </span>
                          <span className="font-mono tabular-nums">{formattedTime}</span>
                        </div>

                        <div className={`flex items-end gap-2 max-w-[90%] ${isMine ? 'flex-row-reverse' : ''}`}>
                          {!isMine && (
                            <div className="w-7 h-7 rounded-full bg-white/[0.1] border border-white/15 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                              {(m.senderName || 'P').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div
                            className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words ${
                              isMine
                                ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] font-medium rounded-br-md shadow-sm'
                                : 'bg-white/[0.06] border border-white/[0.08] text-white/90 rounded-bl-md'
                            }`}
                          >
                            {m.text || ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Chat Composer (matches mockup with quick emoji reactions + Send plane) */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!inCallChatText.trim()) return;
                  meetingAndCallService.sendInCallChatMessage(currentUser, inCallChatText);
                  setInCallChatText('');
                }}
                className="p-4 border-t border-white/[0.06] flex items-end gap-2.5"
              >
                <div className="flex-1 rounded-2xl bg-white/[0.04] border border-white/[0.1] px-3.5 py-2.5 space-y-2 focus-within:border-[var(--accent)] transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inCallChatText}
                      onChange={e => setInCallChatText(e.target.value)}
                      placeholder="Message..."
                      className="flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowReactionPicker(prev => !prev)}
                      title="More Reactions"
                      className="text-white/45 hover:text-white transition-colors cursor-pointer"
                    >
                      <ICON_MAP.FaceSmileIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5 pt-0.5 text-white/45">
                    <button
                      type="button"
                      onClick={() => setActiveDrawerTab('notes')}
                      title="Open Shared Notes"
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      <ICON_MAP.PaperClipIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => meetingAndCallService.toggleMic(currentUser.id)}
                      title="Toggle Mic"
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      <ICON_MAP.MicrophoneIcon className="w-3.5 h-3.5" />
                    </button>
                    <VoiceTranscribeButton
                      compact
                      label="Transcribe"
                      prompt="Transcribe this live video call speech concisely."
                      onTranscript={text =>
                        setInCallChatText(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))
                      }
                      onError={msg => addToast('Transcription Error', msg, 'error')}
                      className="!bg-white/10 !text-white/80 hover:!text-white !border-white/15 !py-0.5 !px-2"
                    />
                    <div className="flex items-center gap-1.5 ml-1">
                      {['😍', '😮', '👏'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => meetingAndCallService.sendReaction(currentUser, emoji)}
                          title={`Send ${emoji} reaction`}
                          className="text-sm hover:scale-125 transition-transform cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  title="Send Message"
                  className="w-10 h-10 rounded-2xl bg-[var(--accent-cta)] hover:opacity-90 text-[var(--accent-cta-ink)] flex items-center justify-center flex-shrink-0 shadow-md cursor-pointer"
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
                  <div className="text-xs font-semibold text-white/65">
                    Scheduled Agenda & Sprint Prep
                  </div>
                  <div className="space-y-1.5">
                    {linkedCalendarEvent.agenda.map(ag => (
                      <label
                        key={ag.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-xs cursor-pointer"
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
                              ag.completed ? 'line-through text-white/40' : 'text-white/95'
                            }`}
                          >
                            {ag.title}
                          </div>
                          <div className="text-[10px] text-white/55">
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
                <label className="block text-xs font-semibold text-white/65">
                  Collaborative Meeting Notes
                </label>
                <textarea
                  rows={5}
                  value={activeCall.sharedNotes}
                  onChange={e => meetingAndCallService.updateSharedNotes(e.target.value)}
                  placeholder="Capture architectural decisions, sprint risks, and stakeholder feedback..."
                  className="w-full p-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-xs text-white/95 placeholder-white/40 outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>

              <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-white/65">
                    Action Items & Task Conversion
                  </div>
                  {activeCall.actionItems.length > 0 && (
                    <span className="text-[10px] font-mono text-white/60 tabular-nums">
                      {activeCall.actionItems.filter(i => i.completed).length}/
                      {activeCall.actionItems.length}
                    </span>
                  )}
                </div>

                {activeCall.actionItems.length > 0 && (() => {
                  const total = activeCall.actionItems.length;
                  const done = activeCall.actionItems.filter(i => i.completed).length;
                  const filledTicks = Math.round((done / total) * 12);
                  return (
                    <div className="flex items-center gap-1 py-1">
                      {Array.from({ length: 12 }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`h-2 flex-1 rounded-full transition-colors ${
                            idx < filledTicks ? 'bg-[var(--accent-cta)]' : 'bg-white/[0.12]'
                          }`}
                        />
                      ))}
                    </div>
                  );
                })()}

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
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs text-white placeholder-white/40 outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newActionAssigneeId}
                      onChange={e => setNewActionAssigneeId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs text-white/95"
                    >
                      <option value="" className="bg-[#0D1015]">Assign to teammate (optional)</option>
                      {[currentUser, ...orgTeammates].map(u => (
                        <option key={u.id} value={u.id} className="bg-[#0D1015]">
                          {u.full_name || u.email.split('@')[0]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      title="Add Action Item"
                      className="w-8 h-8 rounded-full bg-[var(--accent-cta)] hover:opacity-90 text-[var(--accent-cta-ink)] flex items-center justify-center cursor-pointer"
                    >
                      <ICON_MAP.PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  {activeCall.actionItems.map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] space-y-2"
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
                              item.completed ? 'line-through text-white/40' : 'text-white/95'
                            }`}
                          >
                            {item.text}
                          </div>
                          {item.assigneeName && (
                            <div className="text-[10px] text-[var(--accent)]">
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
                            className="px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-[var(--accent-cta)] text-[var(--accent)] hover:text-[var(--accent-cta-ink)] border border-white/[0.12] text-[10px] font-semibold transition-all cursor-pointer"
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
              <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.1] space-y-2">
                <div className="text-xs font-bold text-[var(--accent)] flex items-center gap-1.5">
                  <ICON_MAP.SparklesIcon className="w-4 h-4" />
                  <span>AI Meeting Scribe</span>
                </div>
                <p className="text-[11px] text-white/65 leading-relaxed">
                  Synthesize live discussion notes, transcript lines, and action items into an executive recap.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateAiMeetingSummary}
                  disabled={isGeneratingAiSummary}
                  className="w-full py-2 px-3 rounded-full bg-[var(--accent-cta)] hover:opacity-90 text-[var(--accent-cta-ink)] text-xs font-semibold transition-all cursor-pointer"
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
                    className="w-full p-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-xs text-white/95 font-mono leading-relaxed outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePostSummaryToChat}
                    className="w-full py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Post Recap to Teams Chat
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      )}

      {/* 4. CAMERA & AUDIO STUDIO CHECK POPOVER */}
      {showDeviceSettings && (
        <div
          className="fixed inset-0 z-[9995] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowDeviceSettings(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#0C1016]/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-5 text-white/95 space-y-4 animate-modal-appear"
          >
            <div className="flex items-center justify-between border-b border-white/[0.1] pb-3">
              <div className="flex items-center gap-2">
                <ICON_MAP.VideoCameraIcon className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-bold">Camera, Microphone & Audio Check</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeviceSettings(false)}
                className="p-1 rounded-lg text-white/60 hover:text-white cursor-pointer"
              >
                <ICON_MAP.XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Live Self-Camera Preview Mirror */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/70 border border-white/[0.1] flex items-center justify-center">
              {callState.localStream &&
              callState.localStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live') ? (
                <VideoStreamTile stream={callState.localStream} muted mirror />
              ) : (
                <div className="flex flex-col items-center gap-2.5 p-4 text-center">
                  <Avatar user={currentUser} size="lg" disableHoverCard />
                  <p className="text-xs text-white/60">Camera preview is currently off</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await meetingAndCallService.acquireLocalMedia(true, !myParticipant?.isMicMuted);
                      if (myParticipant?.isCameraOff) {
                        await meetingAndCallService.toggleCamera(currentUser.id);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--accent-cta)] hover:opacity-90 text-[var(--accent-cta-ink)] text-xs font-semibold cursor-pointer"
                  >
                    Turn On Camera Preview
                  </button>
                </div>
              )}
              <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/65 backdrop-blur-xl text-[10px] font-mono text-emerald-400 border border-white/10">
                Live Hardware Preview
              </span>
            </div>

            {/* Device Selectors */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-white/65 mb-1">
                  Camera Input Device
                </label>
                <select
                  value={selectedVideoId}
                  onChange={async e => {
                    const id = e.target.value;
                    setSelectedVideoId(id);
                    await meetingAndCallService.switchMediaDevices(id, selectedAudioId, currentUser.id);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-xs text-white/95"
                >
                  {videoDevices.length === 0 ? (
                    <option value="" className="bg-[#0C1016]">System Default Camera</option>
                  ) : (
                    videoDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId} className="bg-[#0C1016]">
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/65 mb-1">
                  Microphone Input Device
                </label>
                <select
                  value={selectedAudioId}
                  onChange={async e => {
                    const id = e.target.value;
                    setSelectedAudioId(id);
                    await meetingAndCallService.switchMediaDevices(selectedVideoId, id, currentUser.id);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-xs text-white/95"
                >
                  {audioInputDevices.length === 0 ? (
                    <option value="" className="bg-[#0C1016]">System Default Microphone</option>
                  ) : (
                    audioInputDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId} className="bg-[#0C1016]">
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Live Mic Level Bar */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/90 font-semibold">Live Microphone Input Level</span>
                  <span className="font-mono text-emerald-400 tabular-nums">
                    {myParticipant?.isMicMuted ? 'Muted' : `${liveMicLevel}%`}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/[0.1] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-cta)] transition-all duration-150"
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
                    className="flex-1 py-2 px-3 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.12] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ICON_MAP.SpeakerWaveIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Test Speaker Output</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunMicLoopbackTest}
                    disabled={isRecordingMicTest}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
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
                <span className="text-[11px] font-semibold text-white/65">
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
                          ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)]'
                          : 'bg-white/[0.07] text-white/65 hover:text-white'
                      }`}
                    >
                      {q === '1080p' ? '1080p Full HD' : '720p Fast HD'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-white/65">
                  Same-Room Echo Guard (48kHz Opus)
                </span>
                <button
                  type="button"
                  onClick={() => meetingAndCallService.setEchoGuardEnabled(!callState.echoGuardEnabled)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                    callState.echoGuardEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/[0.07] text-white/65 hover:text-white'
                  }`}
                >
                  {callState.echoGuardEnabled ? 'Active (Anti-Screech)' : 'Off (Full-Duplex)'}
                </button>
              </div>

              {/* Studio Background Mode */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-white/65">
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
                          ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)]'
                          : 'bg-white/[0.07] text-white/65 hover:text-white'
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

      {/* Global Emoji Reaction Picker Popover */}
      {showReactionPicker && (
        <div
          className="fixed inset-0 z-[9994]"
          onClick={() => setShowReactionPicker(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="fixed bottom-20 right-8 p-1.5 rounded-full bg-[#14181F]/95 backdrop-blur-2xl border border-white/15 shadow-2xl flex items-center gap-1 z-50"
          >
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
        </div>
      )}
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
        <div className="fixed bottom-5 right-5 z-[10000] max-w-sm rounded-3xl bg-black/75 border border-white/15 p-4 text-white/95 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[var(--accent)]">Call Interface Recovered</h4>
              <p className="text-[11px] text-white/65 mt-0.5">
                Your call connection is still active. Click Resume to reopen the studio controls.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                }}
                className="px-2.5 py-1 rounded-full bg-[var(--accent-cta)] hover:opacity-90 text-[var(--accent-cta-ink)] text-[11px] font-semibold cursor-pointer"
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
                className="px-2 py-1 rounded-full bg-white/10 hover:bg-rose-600 text-white/75 hover:text-white text-[11px] font-semibold cursor-pointer"
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
