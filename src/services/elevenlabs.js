const BASE = '/api/eleven';
const key = () => import.meta.env.VITE_ELEVENLABS_API_KEY;

// Hardcoded detective voices — no generation needed
export const DETECTIVE_VOICE_ID = 'SHiZvifpX6NOyojATxRy'; // Garrison - Rugged and Stoic

const jsonHeaders = () => ({
  'xi-api-key': key(),
  'Content-Type': 'application/json',
});

// Detective TTS — cold authoritative voice
export async function detectiveTTS(text) {
  const res = await fetch(`${BASE}/v1/text-to-speech/${DETECTIVE_VOICE_ID}/stream`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.88,
        similarity_boost: 0.92,
        style: 0.18,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Evidence TTS — suspect's cloned voice played back, corrupted
export async function evidenceTTS(clonedVoiceId, text) {
  const voiceId = clonedVoiceId || DETECTIVE_VOICE_ID;
  const res = await fetch(`${BASE}/v1/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.25,
        similarity_boost: 0.55,
        style: 0.6,
        use_speaker_boost: false,
      },
    }),
  });
  if (!res.ok) throw new Error(`evidenceTTS ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Clone from audio blob — used SILENTLY during STT capture
export async function cloneSuspectVoice(audioBlob, name) {
  const form = new FormData();
  form.append('name', `Suspect_${name}_${Date.now()}`);
  form.append('description', `Voice of ${name} — SUSPECT game evidence`);
  form.append('files', audioBlob, 'voice.webm');

  const res = await fetch(`${BASE}/v1/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': key() },
    body: form,
  });
  if (!res.ok) throw new Error(`clone ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.voice_id;
}

// STT — transcribe player's spoken answer, return blob + transcript
export async function transcribeAnswer(audioBlob) {
  const form = new FormData();
  form.append('file', audioBlob, 'answer.webm');
  form.append('model_id', 'scribe_v1');

  const res = await fetch(`${BASE}/v1/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': key() },
    body: form,
  });
  if (!res.ok) throw new Error(`STT ${res.status}`);
  const data = await res.json();
  return data.text || '';
}

// Sound effects via ElevenLabs
export async function generateSFX(prompt, duration = 4) {
  const res = await fetch(`${BASE}/v1/sound-generation`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      text: prompt,
      duration_seconds: duration,
      prompt_influence: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`SFX ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Audio helpers
export function playAudio(url, loop = false, volume = 1.0) {
  const a = new Audio(url);
  a.loop = loop;
  a.volume = volume;
  a.play().catch(console.warn);
  return a;
}

export function stopAudio(a) {
  if (!a) return;
  try { a.pause(); a.currentTime = 0; } catch {}
}
