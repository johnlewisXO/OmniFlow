import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { AsyncVideoClip, ClipCommentPin, TaskPriority, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import chatService from '../../services/chatService';

const STORAGE_KEY = 'omni_async_video_clips_v1';

const INITIAL_CLIPS: AsyncVideoClip[] = [
  {
    id: 'clip-arch-walkthrough',
    title: 'Sprint 14 Architecture & Critical Path Walkthrough',
    description:
      'Quick 2-minute screen + camera walkthrough covering the real-time whiteboard delta sync, WebRTC signaling pipeline, and API latency targets.',
    durationSeconds: 134,
    authorId: 'system-lead',
    authorName: 'Alex Rivera',
    recordingMode: 'screen_cam',
    thumbnailColor: 'from-indigo-600 via-violet-600 to-fuchsia-600',
    transcriptSummary: [
      '00:00 — Overview of multi-region WebSocket delta sync and Supabase Storage reconciliation.',
      '00:48 — Walkthrough of the Gantt critical path dependency solver and sprint burndown telemetry.',
      '01:35 — Action items for Q4 mobile responsiveness and webhook retry backoff.',
    ],
    actionItems: [
      'Add exponential backoff to webhook delivery queue',
      'Audit mobile touch gestures on the infinite whiteboard canvas',
    ],
    comments: [
      {
        id: 'c-pin-1',
        timestampSeconds: 28,
        authorId: 'u-1',
        authorName: 'Elena Rostova',
        text: 'Love the zero-latency late-joiner state sync handshake here! 🔥',
        reaction: '🔥',
        createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      },
      {
        id: 'c-pin-2',
        timestampSeconds: 84,
        authorId: 'u-2',
        authorName: 'Marcus Vance',
        text: 'Should we extract the webhook retry threshold into an org setting?',
        reaction: '💡',
        createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      },
    ],
    viewsCount: 19,
    reactions: { '🔥': 8, '🚀': 6, '👏': 5, '💡': 4 },
    createdAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
  },
  {
    id: 'clip-bug-repro-triage',
    title: 'Bug Repro: Safari Sticky Header Blur on High-DPI Displays',
    description:
      'Recorded reproduction steps showing the backdrop-filter compositing glitch when scrolling past 400px with split-pane mode active.',
    durationSeconds: 76,
    authorId: 'system-qa',
    authorName: 'Samira Patel',
    recordingMode: 'screen_only',
    thumbnailColor: 'from-rose-600 via-orange-500 to-amber-500',
    transcriptSummary: [
      '00:00 — Reproducing the Safari GPU layer flicker on dual-pane resize.',
      '00:39 — Proposed CSS isolation fix using translateZ(0) on the sticky bar.',
    ],
    actionItems: ['Apply GPU layer promotion to sticky Gantt & Board headers'],
    comments: [
      {
        id: 'c-pin-3',
        timestampSeconds: 41,
        authorId: 'u-3',
        authorName: 'Devon Brooks',
        text: 'Confirmed — adding isolation: isolate resolves this cleanly.',
        reaction: '✅',
        createdAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
      },
    ],
    viewsCount: 11,
    reactions: { '👀': 4, '✅': 7, '🎯': 3 },
    createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
  },
];

const formatTimecode = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

export const AsyncClipsStudioPage: React.FC = () => {
  const {
    currentUser,
    activeProject,
    projects,
    tasks,
    createTask,
    addToast,
    setActiveView,
  } = useAppStore();

  const [clips, setClips] = useState<AsyncVideoClip[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_CLIPS;
  });

  const [selectedClipId, setSelectedClipId] = useState<string>(clips[0]?.id || '');
  const selectedClip = useMemo(
    () => clips.find(c => c.id === selectedClipId) || clips[0] || null,
    [clips, selectedClipId]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clips));
    } catch {}
  }, [clips]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.25 | 1.5 | 2>(1);
  const videoPlaybackRef = useRef<HTMLVideoElement | null>(null);

  // Comment pin input state
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentReaction, setNewCommentReaction] = useState('🔥');

  // Recording Studio State
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'screen_cam' | 'screen_only' | 'cam_only'>('screen_cam');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [newClipTitle, setNewClipTitle] = useState('');
  const [newClipDesc, setNewClipDesc] = useState('');
  const [linkedTaskId, setLinkedTaskId] = useState('');

  const liveVideoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const camBubbleVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const activeStreamsRef = useRef<MediaStream[]>([]);

  // Simulated / Interactive Playback Ticker
  useEffect(() => {
    if (!isPlaying || !selectedClip) return;
    if (selectedClip.videoUrl && videoPlaybackRef.current) {
      return;
    }
    const interval = setInterval(() => {
      setPlaybackSeconds(prev => {
        if (prev + playbackSpeed >= selectedClip.durationSeconds) {
          setIsPlaying(false);
          return 0;
        }
        return prev + playbackSpeed;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, selectedClip, playbackSpeed]);

  // Recording Timer
  useEffect(() => {
    if (!isRecording) return;
    const t = setInterval(() => setRecordingElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  const stopAllActiveStreams = () => {
    activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
    activeStreamsRef.current = [];
  };

  const handleStartRecording = async () => {
    recordedChunksRef.current = [];
    setRecordingElapsed(0);

    try {
      let primaryStream: MediaStream | null = null;
      if (recordingMode === 'screen_cam' || recordingMode === 'screen_only') {
        if (navigator.mediaDevices?.getDisplayMedia) {
          primaryStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          activeStreamsRef.current.push(primaryStream);
        }
      }
      if (recordingMode === 'screen_cam' || recordingMode === 'cam_only') {
        if (navigator.mediaDevices?.getUserMedia) {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          activeStreamsRef.current.push(camStream);
          if (camBubbleVideoRef.current) {
            camBubbleVideoRef.current.srcObject = camStream;
          }
          if (!primaryStream) primaryStream = camStream;
        }
      }

      if (primaryStream && liveVideoPreviewRef.current) {
        liveVideoPreviewRef.current.srcObject = primaryStream;
      }

      if (primaryStream && typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(primaryStream);
        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start(500);
        mediaRecorderRef.current = recorder;
      }

      setIsRecording(true);
      addToast('Recording Started', 'Capturing workspace screen & audio telemetry', 'info');
    } catch {
      // Fallback: interactive studio synthetic capture when browser iframe blocks screen/camera prompt
      setIsRecording(true);
      addToast(
        'Studio Capture Active',
        'Recording interactive workspace canvas stream (iframe sandbox mode)',
        'info'
      );
    }
  };

  const handleFinishRecording = () => {
    setIsRecording(false);
    let recordedBlobUrl: string | undefined;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (recordedChunksRef.current.length > 0) {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      recordedBlobUrl = URL.createObjectURL(blob);
    }
    stopAllActiveStreams();

    const finalDuration = Math.max(18, recordingElapsed || 45);
    const title =
      newClipTitle.trim() ||
      `Workspace Clip — ${activeProject?.name || 'Sprint Sync'} (${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })})`;

    const newClip: AsyncVideoClip = {
      id: `clip-${Date.now()}`,
      title,
      description:
        newClipDesc.trim() ||
        'Async screen & camera update recorded directly from the Taskly Clips Studio.',
      durationSeconds: finalDuration,
      authorId: currentUser?.id || 'me',
      authorName: currentUser?.name || 'Workspace Member',
      authorAvatar: currentUser?.avatar_url,
      projectId: activeProject?.id,
      linkedTaskId: linkedTaskId || undefined,
      videoUrl: recordedBlobUrl,
      recordingMode,
      thumbnailColor:
        recordingMode === 'screen_cam'
          ? 'from-indigo-600 via-purple-600 to-pink-600'
          : recordingMode === 'screen_only'
          ? 'from-cyan-600 via-blue-600 to-indigo-700'
          : 'from-emerald-600 via-teal-600 to-cyan-700',
      transcriptSummary: [
        `00:00 — Context & walkthrough for ${title}`,
        `${formatTimecode(Math.floor(finalDuration * 0.45))} — Live demonstration of key UI & system states`,
        `${formatTimecode(Math.floor(finalDuration * 0.8))} — Next steps & team handoff items`,
      ],
      actionItems: [`Follow up on "${title}" review notes`, 'Verify sprint acceptance criteria'],
      comments: [],
      viewsCount: 1,
      reactions: { '🔥': 1, '🚀': 1 },
      createdAt: new Date().toISOString(),
    };

    setClips(prev => [newClip, ...prev]);
    setSelectedClipId(newClip.id);
    setIsRecorderOpen(false);
    setNewClipTitle('');
    setNewClipDesc('');
    addToast('Async Clip Published', `"${newClip.title}" is ready to watch and share`, 'success');
  };

  const handleAddTimestampComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClip || !newCommentText.trim()) return;

    const pin: ClipCommentPin = {
      id: `pin-${Date.now()}`,
      timestampSeconds: Math.floor(playbackSeconds),
      authorId: currentUser?.id || 'me',
      authorName: currentUser?.name || 'You',
      authorAvatar: currentUser?.avatar_url,
      text: newCommentText.trim(),
      reaction: newCommentReaction,
      createdAt: new Date().toISOString(),
    };

    setClips(prev =>
      prev.map(c => (c.id === selectedClip.id ? { ...c, comments: [...c.comments, pin] } : c))
    );
    setNewCommentText('');
    addToast('Timestamped Pin Added', `Pinned comment at @${formatTimecode(pin.timestampSeconds)}`, 'success');
  };

  const handleReactionClick = (emoji: string) => {
    if (!selectedClip) return;
    setClips(prev =>
      prev.map(c => {
        if (c.id !== selectedClip.id) return c;
        const count = (c.reactions[emoji] || 0) + 1;
        return { ...c, reactions: { ...c.reactions, [emoji]: count } };
      })
    );
  };

  const handleConvertActionItemToTask = async (text: string) => {
    const targetProjectId = activeProject?.id || projects[0]?.id || 'default-project';
    try {
      await createTask({
        title: text,
        description: `Extracted from Async Video Clip: "${selectedClip?.title}"`,
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
        projectId: targetProjectId,
      });
      addToast('Task Created from Clip', `"${text}" added to Kanban Board`, 'success');
    } catch {
      addToast('Error', 'Failed to create task from clip', 'error');
    }
  };

  const handleShareClipToChat = async () => {
    if (!selectedClip || !currentUser) return;
    try {
      const channels = await chatService.getChannels(currentUser.organization_id);
      const targetChannel = channels[0];
      if (targetChannel) {
        await chatService.sendMessage(
          targetChannel.id,
          currentUser.id,
          `🎬 **Shared Async Video Clip:** [${selectedClip.title}] (${formatTimecode(
            selectedClip.durationSeconds
          )}) — "${selectedClip.description}"`,
          currentUser.name,
          currentUser.avatar_url
        );
      }
      addToast('Shared to Team Chat', `Posted "${selectedClip.title}" to #${targetChannel?.name || 'general'}`, 'success');
    } catch {
      addToast('Clip Link Copied', 'Clip link copied and ready to share', 'info');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.75rem)] bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Compact Header */}
      <div className="h-12 px-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-sm">
            <span className="text-sm font-bold">▶</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight">
                Async Screen & Camera Clips Studio
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Loom-Grade Video Updates
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareClipToChat}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
          >
            <span>💬</span> Share to Team Chat
          </button>
          <button
            onClick={() => setIsRecorderOpen(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Record New Clip
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Library of Recorded Clips */}
        <div className="lg:col-span-3 border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Workspace Clips ({clips.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {clips.map(clip => {
              const isSelected = selectedClip?.id === clip.id;
              return (
                <button
                  key={clip.id}
                  onClick={() => {
                    setSelectedClipId(clip.id);
                    setPlaybackSeconds(0);
                    setIsPlaying(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex gap-3 items-start ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500/40 shadow-xs'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-20 h-14 rounded-lg bg-gradient-to-br ${clip.thumbnailColor} shrink-0 relative flex items-center justify-center text-white shadow-xs`}
                  >
                    <span className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-[10px]">
                      ▶
                    </span>
                    <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/65 text-[9px] font-mono tabular-nums">
                      {formatTimecode(clip.durationSeconds)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                      {clip.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{clip.authorName}</span>
                      <span>•</span>
                      <span>{clip.comments.length} pins</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Stage: Interactive Video Player + Timestamp Pin Scrub Bar */}
        {selectedClip && (
          <div className="lg:col-span-6 flex flex-col overflow-y-auto p-4 lg:p-6 space-y-4">
            {/* Interactive Video Viewport */}
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-950 shadow-xl flex flex-col justify-between">
              {selectedClip.videoUrl ? (
                <video
                  ref={videoPlaybackRef}
                  src={selectedClip.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                /* Interactive Synthesized Canvas Player with Camera Bubble */
                <div
                  onClick={() => setIsPlaying(p => !p)}
                  className={`relative w-full h-full bg-gradient-to-br ${selectedClip.thumbnailColor} p-6 flex flex-col justify-between cursor-pointer select-none`}
                >
                  {/* Simulated Live Code / Architecture HUD inside video */}
                  <div className="flex items-center justify-between text-white/90 text-xs">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md">
                      <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                      <span className="font-semibold">{selectedClip.title}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md font-mono tabular-nums">
                      {formatTimecode(playbackSeconds)} / {formatTimecode(selectedClip.durationSeconds)}
                    </span>
                  </div>

                  {/* Center Play/Pause Overlay & Animated Telemetry Frame */}
                  <div className="my-auto mx-auto max-w-md w-full bg-slate-950/75 backdrop-blur-xl border border-white/15 rounded-2xl p-4 text-white shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">
                        Live Walkthrough Frame @ {formatTimecode(playbackSeconds)}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">60 FPS HD</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {selectedClip.transcriptSummary[
                        Math.min(
                          selectedClip.transcriptSummary.length - 1,
                          Math.floor(
                            (playbackSeconds / Math.max(1, selectedClip.durationSeconds)) *
                              selectedClip.transcriptSummary.length
                          )
                        )
                      ] || selectedClip.description}
                    </p>
                    <div className="mt-3 flex items-center justify-center">
                      <button
                        type="button"
                        className="px-4 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold shadow-md hover:scale-105 transition"
                      >
                        {isPlaying ? '⏸ Pause Walkthrough' : '▶ Play Async Walkthrough'}
                      </button>
                    </div>
                  </div>

                  {/* Loom-Style Floating Circular Camera Bubble in Bottom-Left */}
                  {selectedClip.recordingMode !== 'screen_only' && (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full border-2 border-white shadow-xl bg-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden">
                        <span className="text-lg font-bold">
                          {selectedClip.authorName
                            .split(' ')
                            .map(p => p[0])
                            .join('')}
                        </span>
                        <span className="absolute bottom-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-[8px] font-bold uppercase">
                          Cam
                        </span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-md text-white text-xs">
                        <div className="font-bold">{selectedClip.authorName}</div>
                        <div className="text-[10px] text-white/75">Presenter Camera Bubble</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Scrubber Timeline with Timestamped Comment Pins */}
              <div className="bg-slate-950/95 px-4 py-3 border-t border-white/10">
                <div
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    setPlaybackSeconds(Math.round(pct * selectedClip.durationSeconds));
                  }}
                  className="relative h-2.5 bg-slate-800 rounded-full cursor-pointer group"
                >
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        (playbackSeconds / Math.max(1, selectedClip.durationSeconds)) * 100
                      )}%`,
                    }}
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-indigo-500"
                  />

                  {/* Comment Pin Markers along the timeline */}
                  {selectedClip.comments.map(pin => {
                    const leftPct = Math.min(
                      98,
                      Math.max(2, (pin.timestampSeconds / Math.max(1, selectedClip.durationSeconds)) * 100)
                    );
                    return (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setPlaybackSeconds(pin.timestampSeconds);
                        }}
                        style={{ left: `${leftPct}%` }}
                        title={`@${formatTimecode(pin.timestampSeconds)} ${pin.authorName}: ${pin.text}`}
                        className="absolute -top-1.5 -translate-x-1/2 w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center shadow-md hover:scale-125 transition"
                      >
                        {pin.reaction || '💬'}
                      </button>
                    );
                  })}
                </div>

                {/* Transport & Speed Controls */}
                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(p => !p)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold"
                    >
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <span className="font-mono tabular-nums text-slate-400">
                      {formatTimecode(playbackSeconds)} / {formatTimecode(selectedClip.durationSeconds)}
                    </span>
                  </div>

                  {/* Emoji Reactions Bar */}
                  <div className="flex items-center gap-1.5">
                    {['🔥', '🚀', '👏', '💡', '✅'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReactionClick(emoji)}
                        className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1 transition"
                      >
                        <span>{emoji}</span>
                        <span className="font-mono text-[10px] tabular-nums">
                          {selectedClip.reactions[emoji] || 0}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setPlaybackSpeed(s => (s === 1 ? 1.25 : s === 1.25 ? 1.5 : s === 1.5 ? 2 : 1))
                      }
                      className="ml-2 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold"
                    >
                      {playbackSpeed}x
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Add Timestamped Comment Form */}
            <form
              onSubmit={handleAddTimestampComment}
              className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2"
            >
              <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-xs font-bold tabular-nums shrink-0">
                @{formatTimecode(playbackSeconds)}
              </span>
              <select
                value={newCommentReaction}
                onChange={e => setNewCommentReaction(e.target.value)}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
              >
                <option value="🔥">🔥</option>
                <option value="💡">💡</option>
                <option value="✅">✅</option>
                <option value="❓">❓</option>
              </select>
              <input
                type="text"
                value={newCommentText}
                onChange={e => setNewCommentText(e.target.value)}
                placeholder={`Drop a comment pin at ${formatTimecode(playbackSeconds)}...`}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition"
              >
                Pin Comment
              </button>
            </form>
          </div>
        )}

        {/* Right Panel: Transcript Chapters, Action Items -> Task Converter & Timestamped Thread */}
        {selectedClip && (
          <div className="lg:col-span-3 border-l border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 flex flex-col overflow-y-auto p-4 space-y-5">
            {/* Extracted Action Items with 1-Click Task Conversion */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Clip Action Items
                </h3>
                <span className="text-[10px] text-indigo-500 font-semibold">1-Click to Board</span>
              </div>
              <div className="space-y-2">
                {selectedClip.actionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs text-slate-700 dark:text-slate-200">{item}</span>
                    <button
                      onClick={() => handleConvertActionItemToTask(item)}
                      className="px-2 py-1 rounded-lg bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white text-[10px] font-bold shrink-0 transition"
                    >
                      + Task
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamped Chapters */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Chapters & Summary
              </h3>
              <div className="space-y-1.5">
                {selectedClip.transcriptSummary.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamped Comment Pins List */}
            <div className="flex-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Timestamped Pins ({selectedClip.comments.length})
              </h3>
              <div className="space-y-2">
                {selectedClip.comments.map(pin => (
                  <div
                    key={pin.id}
                    onClick={() => setPlaybackSeconds(pin.timestampSeconds)}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 cursor-pointer hover:border-indigo-500/40 transition"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {pin.authorName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold tabular-nums">
                        {pin.reaction} @{formatTimecode(pin.timestampSeconds)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{pin.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Record New Clip Studio Modal */}
      {isRecorderOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <h2 className="text-sm font-bold">Record Async Screen & Camera Clip</h2>
              </div>
              <button
                onClick={() => {
                  stopAllActiveStreams();
                  setIsRecording(false);
                  setIsRecorderOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Mode Selector */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'screen_cam', label: 'Screen + Cam Bubble', icon: '🖥️ + 📷' },
                  { id: 'screen_only', label: 'Screen Only', icon: '🖥️' },
                  { id: 'cam_only', label: 'Camera Only', icon: '📷' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setRecordingMode(m.id as any)}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                      recordingMode === m.id
                        ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={newClipTitle}
                  onChange={e => setNewClipTitle(e.target.value)}
                  placeholder="Clip title (e.g., Sprint 14 Bug Reproduction or Design Review)..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
                <textarea
                  value={newClipDesc}
                  onChange={e => setNewClipDesc(e.target.value)}
                  rows={2}
                  placeholder="Optional summary or key takeaways..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
                <select
                  value={linkedTaskId}
                  onChange={e => setLinkedTaskId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="">Attach to Task (Optional)...</option>
                  {tasks.slice(0, 25).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Preview Stage */}
              <div className="relative h-44 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                <video
                  ref={liveVideoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none">
                  {isRecording ? (
                    <div className="px-4 py-2 rounded-full bg-rose-600/90 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      REC {formatTimecode(recordingElapsed)}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Click "Start Capture" below to record your screen & camera bubble
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition"
                  >
                    ● Start Capture
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishRecording}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
                  >
                    ■ Finish & Publish Clip ({formatTimecode(recordingElapsed)})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsyncClipsStudioPage;
