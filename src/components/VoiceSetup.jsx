import { useState, useEffect, useRef } from 'react';
import { cloneSuspectVoice, playAudio, stopAudio } from '../services/elevenlabs';
import { useRecorder } from '../hooks/useRecorder';
import './VoiceSetup.css';

export default function VoiceSetup({ playerName, onComplete }) {
  const [phase, setPhase] = useState('intro');
  const [error, setError] = useState(null);
  const { isRecording, startRecording, stopRecording } = useRecorder();
  const ambienceRef = useRef(null);

  // Play static tension ambience on mount
  useEffect(() => {
    // Use a subtle oscillator-based tone as background atmosphere
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(58, ctx.currentTime + 8);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(110, ctx.currentTime);
      osc2.frequency.linearRampToValueAtTime(108, ctx.currentTime + 6);
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc.start();
      osc2.start();

      ambienceRef.current = { ctx, osc, osc2, gain, gain2 };
    } catch {}

    return () => {
      try {
        if (ambienceRef.current) {
          ambienceRef.current.osc.stop();
          ambienceRef.current.osc2.stop();
          ambienceRef.current.ctx.close();
        }
      } catch {}
    };
  }, []);

  const handleRecord = async () => {
    const ok = await startRecording();
    if (!ok) {
      setError('Microphone access denied. Continuing without voice clone.');
      return;
    }
    setPhase('recording');
  };

  const handleStop = async () => {
    setPhase('processing');
    const blob = await stopRecording();

    if (!blob || blob.size < 1000) {
      setError('Recording too short.');
      setPhase('intro');
      return;
    }

    try {
      const voiceId = await cloneSuspectVoice(blob, playerName);
      setPhase('done');
      setTimeout(() => onComplete(voiceId), 1800);
    } catch (e) {
      console.warn('Clone failed:', e);
      setPhase('failed');
      setTimeout(() => onComplete(null), 2200);
    }
  };

  const handleSkip = () => onComplete(null);

  return (
    <div className="vsetup">
      <div className="vsetup-noise" />
      <div className="vsetup-content">
        <div className="vsetup-icon">
          <div className={`vsetup-mic ${isRecording ? 'recording' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
            </svg>
          </div>
        </div>

        <h2 className="vsetup-title">VOICE CAPTURE</h2>
        <p className="vsetup-sub">the detective will use your own voice as evidence</p>

        {phase === 'intro' && (
          <>
            <p className="vsetup-instruction">
              Record 5–8 seconds of your voice. Read this aloud:
              <span className="vsetup-prompt">
                "I don't know what you think I did, but I'm telling you the truth. Every word."
              </span>
            </p>
            {error && <p className="vsetup-error">{error}</p>}
            <div className="vsetup-btns">
              <button className="vsetup-btn primary" onClick={handleRecord}>
                ● BEGIN RECORDING
              </button>
              <button className="vsetup-btn ghost" onClick={handleSkip}>
                skip — use generated voice
              </button>
            </div>
          </>
        )}

        {phase === 'recording' && (
          <>
            <div className="vsetup-rec-bars">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="vsetup-bar" style={{ animationDelay: `${i * 0.06}s` }} />
              ))}
            </div>
            <p className="vsetup-rec-label">● RECORDING — speak now</p>
            <button className="vsetup-btn primary" onClick={handleStop}>■ STOP</button>
          </>
        )}

        {phase === 'processing' && (
          <div className="vsetup-processing">
            <div className="vsetup-spinner" />
            <p className="vsetup-status">binding your voice to the case file...</p>
            <p className="vsetup-status-sub">the detective is listening</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="vsetup-done">
            <p className="vsetup-status done">✓ voice captured.</p>
            <p className="vsetup-status-sub">entering interrogation room...</p>
          </div>
        )}

        {phase === 'failed' && (
          <div className="vsetup-done">
            <p className="vsetup-status">voice capture failed.</p>
            <p className="vsetup-status-sub">continuing with generated voice...</p>
          </div>
        )}
      </div>
    </div>
  );
}
