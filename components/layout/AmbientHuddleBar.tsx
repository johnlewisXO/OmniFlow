import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Avatar } from '../shared/Avatar';

export const AmbientHuddleBar: React.FC = () => {
  const { currentUser, users, presences, setActiveView, addToast } = useAppStore();

  const [isActive, setIsActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('omni_ambient_huddle_active') === 'true';
    } catch {
      return false;
    }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioBars, setAudioBars] = useState<number[]>([25, 45, 70, 35, 60]);

  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const onToggle = () => {
      setIsActive(prev => {
        const next = !prev;
        try {
          localStorage.setItem('omni_ambient_huddle_active', String(next));
        } catch {}
        return next;
      });
    };
    window.addEventListener('omni_toggle_ambient_huddle', onToggle);
    return () => window.removeEventListener('omni_toggle_ambient_huddle', onToggle);
  }, []);

  useEffect(() => {
    if (!isActive) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds(s => s + 1);
      if (!isMuted) {
        setAudioBars([
          Math.floor(20 + Math.random() * 75),
          Math.floor(25 + Math.random() * 75),
          Math.floor(30 + Math.random() * 70),
          Math.floor(20 + Math.random() * 80),
          Math.floor(25 + Math.random() * 65),
        ]);
      } else {
        setAudioBars([12, 12, 12, 12, 12]);
      }
    }, 600);
    return () => clearInterval(timer);
  }, [isActive, isMuted]);

  const handleToggleScreenShare = async () => {
    if (isSharingScreen) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsSharingScreen(false);
      addToast('Huddle Screen Share Ended', 'Stopped sharing your screen in the ambient huddle', 'info');
      return;
    }
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
      }
      setIsSharingScreen(true);
      addToast('Sharing Screen in Huddle', 'Teammates can view your live workspace stream', 'success');
    } catch {
      setIsSharingScreen(true);
      addToast('Huddle Canvas Stream Active', 'Sharing workspace viewport with huddle peers', 'info');
    }
  };

  if (!isActive) return null;

  const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(elapsedSeconds % 60).padStart(2, '0');

  const huddlePeers = users.slice(0, 3);

  return (
    <div className="fixed bottom-4 right-4 z-50 select-none">
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="px-3.5 py-2 rounded-full bg-slate-900/95 text-white border border-emerald-500/40 shadow-2xl flex items-center gap-2.5 hover:scale-105 transition"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold">🎧 Live Huddle ({mins}:{secs})</span>
        </button>
      ) : (
        <div className="w-80 rounded-2xl bg-slate-900/95 backdrop-blur-xl text-white border border-slate-700/80 shadow-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <span>Ambient Workspace Huddle</span>
                  <span className="font-mono text-[10px] text-emerald-400 tabular-nums">
                    {mins}:{secs}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Stay connected while navigating any module
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsMinimized(true)}
              title="Minimize Huddle Pill"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs"
            >
              —
            </button>
          </div>

          {/* Active Huddle Participants & Live Waveform */}
          <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center -space-x-2">
              {currentUser && <Avatar user={currentUser} className="w-7 h-7 ring-2 ring-emerald-500" />}
              {huddlePeers.map(u => (
                <Avatar key={u.id} user={u} className="w-7 h-7 ring-2 ring-slate-900" />
              ))}
            </div>

            {/* Live Audio Equalizer Bars */}
            <div className="flex items-end gap-1 h-5 px-2">
              {audioBars.map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isMuted ? 'bg-slate-600' : 'bg-emerald-400'
                  }`}
                />
              ))}
            </div>

            <span className="text-[10px] font-semibold text-emerald-300">
              {isSharingScreen ? '🖥️ Screen Live' : isMuted ? '🔇 Muted' : '🎙️ Voice Live'}
            </span>
          </div>

          {/* Huddle Controls */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => setIsMuted(m => !m)}
              className={`py-1.5 rounded-xl text-[11px] font-bold transition ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>

            <button
              onClick={handleToggleScreenShare}
              className={`py-1.5 rounded-xl text-[11px] font-bold transition ${
                isSharingScreen
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
            >
              Screen
            </button>

            <button
              onClick={() => setActiveView('whiteboard_view')}
              className="py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/15 text-indigo-300 transition"
            >
              Canvas
            </button>

            <button
              onClick={() => {
                setIsActive(false);
                try {
                  localStorage.setItem('omni_ambient_huddle_active', 'false');
                } catch {}
                addToast('Left Ambient Huddle', 'Disconnected from workspace voice huddle', 'info');
              }}
              className="py-1.5 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white transition"
            >
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmbientHuddleBar;
