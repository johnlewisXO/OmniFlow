/**
 * Client-side helper for server-side Gemini audio transcription (`gemini-3.5-transcribe`).
 */

export interface TranscribeResult {
  transcript: string;
  model: string;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read audio data.'));
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudioBlob(
  blob: Blob,
  options?: { prompt?: string }
): Promise<TranscribeResult> {
  const audioBase64 = await blobToBase64(blob);
  const rawMime = blob.type || 'audio/webm';
  // Convert video/webm to audio/webm if needed for audio track transcription
  const mimeType = rawMime.startsWith('video/')
    ? rawMime.replace(/^video\//, 'audio/').split(';')[0]
    : rawMime.split(';')[0] || 'audio/webm';

  const response = await fetch('/api/ai/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64,
      mimeType,
      prompt: options?.prompt,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Transcription failed (HTTP ${response.status})`);
  }

  return {
    transcript: data.transcript || '',
    model: data.model || 'gemini-3.5-transcribe',
  };
}
