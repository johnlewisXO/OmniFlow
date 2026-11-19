import React, { useEffect, useRef, useState } from 'react';
import { transcribeAudioBlob } from '../../services/audioTranscribeService';
import soundService from '../../services/soundService';

export interface VoiceTranscribeButtonProps {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  prompt?: string;
  compact?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const VoiceTranscribeButton: React.FC<VoiceTranscribeButtonProps> = ({
  onTranscript,
  onError,
  prompt,
  compact = false,
  label = 'Voice Note',
  className = '',
  disabled = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const stopRecordingAndTranscribe = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const startRecording = async () => {
    if (disabled || status !== 'idle') return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (audioBlob.size < 200) {
          setStatus('idle');
          setElapsedSec(0);
          return;
        }

        setStatus('transcribing');
        try {
          const result = await transcribeAudioBlob(audioBlob, { prompt });
          if (result.transcript) {
            soundService.play('task_complete');
            onTranscript(result.transcript);
          } else {
            onError?.('No speech detected in the recording.');
          }
        } catch (err: any) {
          onError?.(err?.message || 'Audio transcription failed.');
        } finally {
          setStatus('idle');
          setElapsedSec(0);
        }
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setElapsedSec(0);
      setStatus('recording');
      soundService.play('click_soft');

      timerRef.current = window.setInterval(() => {
        setElapsedSec(s => s + 1);
      }, 1000);
    } catch (err: any) {
      setStatus('idle');
      onError?.(err?.message || 'Could not access microphone.');
    }
  };

  const handleClick = () => {
    if (status === 'recording') {
      stopRecordingAndTranscribe();
    } else if (status === 'idle') {
      startRecording();
    }
  };

  const formattedTime = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || status === 'transcribing'}
      aria-label={
        status === 'recording'
          ? 'Stop recording and transcribe audio'
          : status === 'transcribing'
          ? 'Transcribing audio'
          : 'Record voice note to transcribe'
      }
      title={
        status === 'recording'
          ? 'Click to stop & transcribe'
          : status === 'transcribing'
          ? 'Transcribing with Gemini...'
          : 'Dictate voice note (Audio Transcription)'
      }
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-all cursor-pointer disabled:opacity-50 ${
        compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-1.5 text-xs'
      } ${
        status === 'recording'
          ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40 shadow-sm animate-pulse'
          : status === 'transcribing'
          ? 'bg-[var(--accent-cta)]/15 text-[var(--accent-cta)] border border-[var(--accent-cta)]/30'
          : 'bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
      } ${className}`}
    >
      {status === 'transcribing' ? (
        <>
          <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
          {!compact && <span>Transcribing...</span>}
        </>
      ) : status === 'recording' ? (
        <>
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="font-mono tabular-nums">{formattedTime}</span>
          {!compact && <span>Stop</span>}
        </>
      ) : (
        <>
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          {!compact && <span>{label}</span>}
        </>
      )}
    </button>
  );
};
