import { useState, useEffect, useRef, useCallback } from 'react';
import { detectiveTTS, evidenceTTS, transcribeAnswer, cloneSuspectVoice, generateSFX, playAudio, stopAudio } from '../services/elevenlabs';
import { getDetectiveMove, getRetryMove, getHint } from '../services/groq';
import { useRecorder } from '../hooks/useRecorder';
import CaseFile from './CaseFile';
import Waveform from './Waveform';
import './InterrogationRoom.css';

const PRESSURE_LINES = ['', 'He is watching.', 'He notices everything.', 'His eyes do not leave you.', 'The air is thinning.', 'There is no way out of this room.'];
const TOTAL_QUESTIONS = 6;
const MAX_HINTS = 2;
const MAX_RETRIES = 3;
const ANSWER_TIME_LIMIT = 45;

// Hand-crafted hints per scenario — specific and tactical
const SCENARIO_HINTS = {
  alibi: [
    "He already knows about the calls. Pick a time you were nowhere near that apartment.",
    "Keep your alibi simple. One location, one person who can confirm it.",
    "He's looking for gaps. Don't volunteer extra details — they become inconsistencies.",
    "If he mentions the calls, say you didn't pick up. Don't explain why.",
    "He's watching your eyes. Stay on one story. Don't elaborate.",
    "You're almost through. Repeat your alibi exactly as you stated it before.",
  ],
  missing: [
    "The neighbor saw your car — don't deny it. Say you were dropping something off.",
    "You don't know where she went after she left your place. That's all you know.",
    "Don't speculate about where she might be. Guessing makes you look involved.",
    "He wants you to fill the silence. Don't. Short answers protect you.",
    "Stick to what you directly observed. Don't invent anything you can't verify.",
    "He's building a timeline. Keep yours consistent with what you said in Q1.",
  ],
  accident: [
    "You didn't touch him. He fell. You were downstairs when you heard it.",
    "The forty minutes: you were in shock. You didn't know if he was dead. You froze.",
    "Forensics found marks but falls cause bruising too. Don't address it unless asked.",
    "He wants you to explain the delay. Shock and denial are human. Use that.",
    "One story. He fell. You froze. You called when you were sure he needed help.",
    "You're almost done. Don't add new details now — stay with everything you said before.",
  ],
};

const DETECTIVE_POSE = {
  1: 'neutral',
  2: 'neutral',
  3: 'lean',
  4: 'aggressive',
  5: 'slam',
};

export default function InterrogationRoom({ scenario, playerName, onEnd }) {
  const [phase, setPhase] = useState('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [detectiveSpeaking, setDetectiveSpeaking] = useState(false);
  const [evidencePlaying, setEvidencePlaying] = useState(false);
  const [lightFlicker, setLightFlicker] = useState(false);
  const [pressureLevel, setPressureLevel] = useState(1);
  const [showCaseFile, setShowCaseFile] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [thinkingAI, setThinkingAI] = useState(false);
  const [suspectVoiceId, setSuspectVoiceId] = useState(null);
  const [voiceCloned, setVoiceCloned] = useState(false);
  const [recordingBlobs, setRecordingBlobs] = useState([]);
  const [sfxLoaded, setSfxLoaded] = useState({});
  const [responseStances, setResponseStances] = useState([]);
  const [selectedStance, setSelectedStance] = useState(null);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hintText, setHintText] = useState('');
  const [hintUsed, setHintUsed] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryShake, setRetryShake] = useState(false);
  const [detectivePose, setDetectivePose] = useState('neutral');
  const [poseImages, setPoseImages] = useState({});
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME_LIMIT);
  const [timerActive, setTimerActive] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);

  const audioRef = useRef(null);
  const ambienceRef = useRef(null);
  const hasIntro = useRef(false);
  const timerRef = useRef(null);
  const timerExpiredRef = useRef(false);
  const { isRecording, startRecording, stopRecording } = useRecorder();

  useEffect(() => {
    const poses = ['neutral', 'lean', 'aggressive', 'slam', 'thinking', 'smirk'];
    poses.forEach(pose => {
      const img = new Image();
      img.onload = () => setPoseImages(prev => ({ ...prev, [pose]: `/detective/${pose}.png` }));
      img.onerror = () => {};
      img.src = `/detective/${pose}.png`;
    });
  }, []);

  useEffect(() => {
    let nodes = [];
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const addDrone = (freq, type, vol, delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay);
        osc.connect(gain); gain.connect(ctx.destination); osc.start();
        nodes.push({ osc, ctx });
      };
      addDrone(42, 'sine', 0.07, 4);
      addDrone(84, 'triangle', 0.025, 7);
      addDrone(126, 'sine', 0.01, 10);
      return () => { try { nodes.forEach(n => n.osc.stop()); ctx.close(); } catch {} }
    } catch {}
  }, []);

  useEffect(() => {
    const loadSFX = async () => {
      try {
        const [paperUrl, tensionUrl, staticUrl, slamUrl] = await Promise.all([
          generateSFX('paper folder sliding across metal table, interrogation room', 3),
          generateSFX('low electrical hum, distant ventilation, tense silence in empty room', 6),
          generateSFX('old cassette tape recorder click start, static hiss', 2),
          generateSFX('fist slamming on metal table, sharp impact', 1),
        ]);
        setSfxLoaded({ paper: paperUrl, tension: tensionUrl, static: staticUrl, slam: slamUrl });
        const a = playAudio(tensionUrl, true, 0.2);
        ambienceRef.current = a;
      } catch (e) { console.warn('SFX load failed:', e); }
    };
    loadSFX();
    return () => { stopAudio(ambienceRef.current); };
  }, []);

  // Timer with Web Audio ticking
  const startTimer = useCallback(() => {
    setTimeLeft(ANSWER_TIME_LIMIT);
    setTimerActive(true);
    setTimerExpired(false);
    timerExpiredRef.current = false;
  }, []);

  const stopTimer = useCallback(() => {
    setTimerActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!timerActive) return;
    let tickCtx = null;
    try { tickCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}

    const playTick = (urgent) => {
      if (!tickCtx) return;
      try {
        const osc = tickCtx.createOscillator();
        const gain = tickCtx.createGain();
        osc.frequency.value = urgent ? 1800 : 1100;
        osc.type = 'square';
        const vol = urgent ? 0.14 : 0.05;
        gain.gain.setValueAtTime(vol, tickCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, tickCtx.currentTime + 0.065);
        osc.connect(gain); gain.connect(tickCtx.destination);
        osc.start(tickCtx.currentTime);
        osc.stop(tickCtx.currentTime + 0.1);
      } catch {}
    };

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        playTick(next <= 10);
        if (next <= 0) {
          setTimerActive(false);
          if (!timerExpiredRef.current) {
            timerExpiredRef.current = true;
            setTimerExpired(true);
          }
          clearInterval(timerRef.current);
          try { tickCtx?.close(); } catch {}
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      try { tickCtx?.close(); } catch {}
    };
  }, [timerActive]);

  const typeText = useCallback((text) => {
    setDisplayText('');
    let i = 0;
    const id = setInterval(() => {
      setDisplayText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(id);
    }, 22);
  }, []);

  const detectiveSpeak = useCallback(async (text, pose = null) => {
    if (pose) setDetectivePose(pose);
    setDetectiveSpeaking(true);
    typeText(text);
    try {
      const url = await detectiveTTS(text);
      if (audioRef.current) stopAudio(audioRef.current);
      audioRef.current = playAudio(url, false, 1.0);
      await new Promise((res) => { audioRef.current.onended = res; audioRef.current.onerror = res; });
    } catch (e) {
      await new Promise((r) => setTimeout(r, text.length * 40));
    }
    setDetectiveSpeaking(false);
  }, [typeText]);

  const playEvidence = useCallback(async (text) => {
    setEvidencePlaying(true);
    setLightFlicker(true);
    if (sfxLoaded.static) playAudio(sfxLoaded.static, false, 0.8);
    setTimeout(() => setLightFlicker(false), 2000);
    setDisplayText(`[ EVIDENCE RECORDING ] "${text}"`);
    try {
      const url = await evidenceTTS(suspectVoiceId, text);
      if (audioRef.current) stopAudio(audioRef.current);
      audioRef.current = playAudio(url, false, 0.95);
      await new Promise((res) => { audioRef.current.onended = res; audioRef.current.onerror = res; });
    } catch (e) {
      await new Promise((r) => setTimeout(r, 3000));
    }
    setEvidencePlaying(false);
  }, [suspectVoiceId, sfxLoaded]);

  const attemptSilentClone = useCallback(async (blobs) => {
    if (voiceCloned || blobs.length < 2) return;
    try {
      const combined = new Blob(blobs, { type: 'audio/webm' });
      if (combined.size < 5000) return;
      const voiceId = await cloneSuspectVoice(combined, playerName);
      setSuspectVoiceId(voiceId);
      setVoiceCloned(true);
    } catch {}
  }, [voiceCloned, playerName]);

  const askFirstQuestion = useCallback(async () => {
    setThinkingAI(true);
    setDetectivePose('thinking');
    try {
      const move = await getDetectiveMove(scenario, playerName, [], null);
      setCurrentQuestion(move.nextQuestion);
      setPressureLevel(move.pressureLevel || 1);
      setDetectivePose(DETECTIVE_POSE[move.pressureLevel || 1]);
      setResponseStances(move.responseStances || ['Tell the truth', 'Deny it', 'Deflect']);
      setThinkingAI(false);
      setPhase('asking');
      await detectiveSpeak(move.nextQuestion);
      setPhase('stance_select');
    } catch (e) {
      setThinkingAI(false);
      const fallback = `Let's start at the beginning. Where were you the night of the incident?`;
      setCurrentQuestion(fallback);
      setResponseStances(["Tell the truth", "Deny it", "Stay vague"]);
      setPhase('asking');
      await detectiveSpeak(fallback);
      setPhase('stance_select');
    }
  }, [scenario, playerName, detectiveSpeak]);

  useEffect(() => {
    if (hasIntro.current) return;
    hasIntro.current = true;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 1000));
      if (sfxLoaded.paper) playAudio(sfxLoaded.paper, false, 0.7);
      const intro = `${playerName}. Sit down. I'm Detective Harlow. You're not under arrest — yet. But that depends entirely on what you say in this room.`;
      await detectiveSpeak(intro, 'neutral');
      await new Promise((r) => setTimeout(r, 400));
      await askFirstQuestion();
    };
    setTimeout(run, 800);
  }, [sfxLoaded]);

  const handleSelectStance = (stance) => {
    setSelectedStance(stance);
    setPhase('listening');
    setHintText('');
    setHintUsed(false);
    startTimer();
  };

  const handleGetHint = async () => {
    if (hintsLeft <= 0 || hintLoading) return;
    setHintLoading(true);
    const craftedHint = SCENARIO_HINTS[scenario.id]?.[questionIndex];
    if (craftedHint) {
      setHintText(craftedHint);
      setHintsLeft(h => h - 1);
      setHintUsed(true);
      setHintLoading(false);
      return;
    }
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: `You are a tactical advisor for a suspect in police interrogation. Case: ${scenario.title} — ${scenario.context}. Current question: "${currentQuestion}". Prior answers: ${conversationHistory.map((h,i)=>`Q${i+1}: ${h.answer}`).join(', ')}. Write ONE specific tactical hint (max 15 words) telling the suspect exactly what to say or avoid. Return JSON: { "hint": "..." }` }],
          temperature: 0.7, max_tokens: 80, response_format: { type: 'json_object' },
        }),
      });
      const data = await res.json();
      const parsed = JSON.parse(data.choices?.[0]?.message?.content);
      setHintText(parsed.hint || "Keep it simple. Don't volunteer details.");
    } catch {
      setHintText("Keep it simple. Don't volunteer details.");
    }
    setHintsLeft(h => h - 1);
    setHintUsed(true);
    setHintLoading(false);
  };

  const handleStartAnswer = async () => {
    if (phase !== 'listening') return;
    setPhase('speaking');
    await startRecording();
  };

  const handleStopAnswer = useCallback(async () => {
    stopTimer();
    setPhase('processing');
    setTranscribing(true);
    const blob = await stopRecording();

    let newBlobs = recordingBlobs;
    if (blob && blob.size > 500) {
      newBlobs = [...recordingBlobs, blob];
      setRecordingBlobs(newBlobs);
    }

    let transcript = '...';
    if (blob) {
      try { transcript = await transcribeAnswer(blob) || '...'; } catch {}
    }
    setTranscribing(false);

    const isWeak = !transcript || transcript === '...' || transcript.trim().split(' ').length < 3;

    if (isWeak && retryCount < MAX_RETRIES) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      setIsRetrying(true);
      setRetryShake(true);
      setTimeout(() => setRetryShake(false), 600);
      setPressureLevel(p => Math.min(p + 1, 5));
      const retryPose = newRetryCount >= 2 ? 'aggressive' : 'lean';
      setDetectivePose(retryPose);
      if (sfxLoaded.slam && newRetryCount >= 2) playAudio(sfxLoaded.slam, false, 0.9);
      setLightFlicker(true);
      setTimeout(() => setLightFlicker(false), 1500);
      let retryResponse;
      try {
        retryResponse = await getRetryMove(scenario, playerName, conversationHistory, currentQuestion, transcript, newRetryCount);
      } catch {
        retryResponse = {
          retryResponse: newRetryCount === 1 ? "That is not an answer. Try again." : "You're wasting my time. Answer the question.",
          retryQuestion: currentQuestion,
          pressureLevel: Math.min(newRetryCount + 2, 5),
          responseStances: ["Explain yourself", "Deny it", "Come clean"],
        };
      }
      setPressureLevel(retryResponse.pressureLevel || Math.min(pressureLevel + 1, 5));
      setResponseStances(retryResponse.responseStances || ["Explain yourself", "Deny it", "Come clean"]);
      setIsRetrying(false);
      setPhase('asking');
      await detectiveSpeak(retryResponse.retryResponse + " " + retryResponse.retryQuestion, retryPose);
      setPhase('stance_select');
      return;
    }

    setRetryCount(0);
    if (questionIndex >= 1 && !voiceCloned) attemptSilentClone(newBlobs);

    const newHistory = [
      ...conversationHistory,
      { question: currentQuestion, answer: transcript, caseFileNote: '', retryCount, usedHint: hintUsed, stance: selectedStance },
    ];
    setConversationHistory(newHistory);
    const newQuestionIndex = questionIndex + 1;
    setQuestionIndex(newQuestionIndex);
    setPhase('responding');
    setThinkingAI(true);
    setDetectivePose('thinking');

    let move;
    try {
      move = await getDetectiveMove(scenario, playerName, newHistory, transcript);
    } catch {
      move = {
        detractiveResponse: transcript === '...' ? 'Silence. Noted.' : 'Interesting.',
        nextQuestion: newQuestionIndex >= TOTAL_QUESTIONS ? 'Last chance. Tell me what really happened.' : 'Walk me through that again. Slower this time.',
        pressureLevel: Math.min(pressureLevel + 1, 5),
        isCatchingContradiction: false,
        isFinal: newQuestionIndex >= TOTAL_QUESTIONS,
        caseFileNote: 'Suspect responded',
        responseStances: ["Be honest", "Deny it", "Deflect"],
      };
    }

    const updatedHistory = newHistory.map((h, i) => i === newHistory.length - 1 ? { ...h, caseFileNote: move.caseFileNote || '' } : h);
    setConversationHistory(updatedHistory);
    setThinkingAI(false);
    const newPressure = move.pressureLevel || pressureLevel;
    setPressureLevel(newPressure);
    setDetectivePose(DETECTIVE_POSE[newPressure]);
    setResponseStances(move.responseStances || ["Tell the truth", "Deny it", "Deflect"]);

    if (move.isCatchingContradiction) {
      setLightFlicker(true);
      setTimeout(() => setLightFlicker(false), 1500);
      setDetectivePose('smirk');
    }

    const isEvidenceMoment = newQuestionIndex === 4 && voiceCloned && newHistory.length >= 2;
    if (isEvidenceMoment) {
      const priorAnswer = newHistory[1]?.answer;
      if (priorAnswer && priorAnswer !== '...') {
        const responseText = move.detractiveResponse || move.detectiveResponse;
        if (responseText?.trim()) await detectiveSpeak(responseText);
        await new Promise((r) => setTimeout(r, 400));
        setPhase('evidence');
        await playEvidence(priorAnswer.slice(0, 100));
        await new Promise((r) => setTimeout(r, 400));
        await detectiveSpeak('That is your voice. Your exact words. Now you are telling me something very different.', 'aggressive');
      } else {
        const responseText = move.detractiveResponse || move.detectiveResponse;
        if (responseText?.trim()) await detectiveSpeak(responseText);
      }
    } else {
      const responseText = move.detractiveResponse || move.detectiveResponse;
      if (responseText?.trim()) {
        await detectiveSpeak(responseText);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (move.isFinal || newQuestionIndex >= TOTAL_QUESTIONS) {
      setCurrentQuestion(move.nextQuestion);
      setPhase('asking');
      await detectiveSpeak(move.nextQuestion, 'aggressive');
      await new Promise((r) => setTimeout(r, 2000));
      setPhase('final');
      onEnd({ answers: updatedHistory });
      return;
    }

    setCurrentQuestion(move.nextQuestion);
    setSelectedStance(null);
    setHintText('');
    setHintUsed(false);
    setPhase('asking');
    await detectiveSpeak(move.nextQuestion, DETECTIVE_POSE[newPressure]);
    setPhase('stance_select');
  }, [phase, stopTimer, stopRecording, recordingBlobs, retryCount, voiceCloned, conversationHistory, currentQuestion, hintUsed, selectedStance, questionIndex, pressureLevel, sfxLoaded, scenario, playerName, detectiveSpeak, playEvidence, attemptSilentClone, onEnd]);

  // Auto-submit when timer expires
  useEffect(() => {
    if (timerExpired && (phase === 'listening' || phase === 'speaking')) {
      handleStopAnswer();
    }
  }, [timerExpired]);

  const canSpeak = phase === 'listening';
  const isStanceSelect = phase === 'stance_select';
  const isBusy = ['processing', 'asking', 'responding', 'evidence', 'intro', 'final'].includes(phase);
  const currentPoseImg = poseImages[detectivePose] || poseImages['neutral'];
  const timerPercent = (timeLeft / ANSWER_TIME_LIMIT) * 100;
  const timerUrgent = timeLeft <= 10;
  const timerCritical = timeLeft <= 5;
  const showTimer = (phase === 'listening' || phase === 'speaking') && timerActive;

  return (
    <div className={`room ${lightFlicker ? 'flicker' : ''} pressure-${pressureLevel} ${retryShake ? 'retry-shake' : ''}`}>
      <div className="room-noise" />
      <div className="room-vignette" />
      <div className="room-scanlines" />

      <div className="room-light">
        <div className="room-light-bulb" />
        <div className="room-light-cone" />
      </div>

      <div className="room-case-number">{scenario.caseNumber}</div>

      <div className="room-progress">
        {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
          <div key={i} className={`progress-dot ${i < questionIndex ? 'done' : i === questionIndex ? 'active' : ''}`} />
        ))}
      </div>

      {voiceCloned && <div className="clone-indicator">● REC</div>}

      <div className={`hints-counter ${hintsLeft === 0 ? 'depleted' : ''}`}>
        HINTS: {hintsLeft}/{MAX_HINTS}
      </div>

      {/* Detective */}
      <div className="detective-wrap">
        <div className={`detective ${detectiveSpeaking ? 'speaking' : ''} ${evidencePlaying ? 'playing-evidence' : ''} pose-${detectivePose}`}>
          {currentPoseImg ? (
            <img
              key={detectivePose}
              src={currentPoseImg}
              alt="Detective Harlow"
              className="detective-img"
            />
          ) : (
            <div className="detective-silhouette">
              <div className="detective-sil-head" />
              <div className="detective-sil-neck" />
              <div className="detective-sil-shoulder" />
              <div className="detective-sil-body" />
              <div className="detective-sil-arm left" />
              <div className="detective-sil-arm right" />
            </div>
          )}
          <div className="detective-waveform">
            <Waveform active={detectiveSpeaking || evidencePlaying} color={evidencePlaying ? '#4488cc' : '#cc3333'} bars={10} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="table">
          <div className="table-surface" />
          {conversationHistory.length > 0 && (
            <button className="table-file-btn" onClick={() => setShowCaseFile(true)}>
              CASE FILE ({conversationHistory.length})
            </button>
          )}
        </div>
      </div>

      {/* Dialogue */}
      <div className={`dialogue-box ${evidencePlaying ? 'evidence-mode' : ''}`}>
        <div className="dialogue-speaker">
          {evidencePlaying ? '[ EVIDENCE PLAYBACK — YOUR VOICE ]'
            : thinkingAI ? '...'
            : detectiveSpeaking ? 'DET. HARLOW'
            : transcribing ? 'PROCESSING STATEMENT...'
            : isRetrying ? 'DET. HARLOW — REFUSED'
            : phase === 'speaking' ? `${playerName.toUpperCase()} — SPEAKING`
            : 'DET. HARLOW'}
        </div>
        <p className="dialogue-text">
          {thinkingAI ? '' : transcribing ? 'transcribing your words...' : displayText}
          {(detectiveSpeaking || transcribing) && !thinkingAI && <span className="dialogue-cursor">_</span>}
          {thinkingAI && (
            <span className="thinking-dots">
              <span>●</span><span>●</span><span>●</span>
            </span>
          )}
        </p>
      </div>

      {/* Hint */}
      {hintText && (
        <div className="hint-display">
          <span className="hint-icon">⚠</span>
          <span className="hint-content">{hintText}</span>
        </div>
      )}

      {/* Timer — only during answer phase */}
      {showTimer && (
        <div className={`answer-timer ${timerUrgent ? 'urgent' : ''} ${timerCritical ? 'critical' : ''}`}>
          <div className="timer-label">TIME</div>
          <div className="timer-track">
            <div className="timer-fill" style={{ width: `${timerPercent}%` }} />
          </div>
          <div className="timer-seconds">{timeLeft}</div>
        </div>
      )}

      {/* Stance select */}
      {isStanceSelect && (
        <div className="stance-panel">
          <div className="stance-label">CHOOSE YOUR ANGLE</div>
          <div className="stance-options">
            {responseStances.map((stance, i) => (
              <button key={i} className="stance-btn" onClick={() => handleSelectStance(stance)}>
                {stance}
              </button>
            ))}
          </div>
          {hintsLeft > 0 && (
            <button className={`hint-btn ${hintLoading ? 'loading' : ''}`} onClick={handleGetHint} disabled={hintLoading}>
              {hintLoading ? '...' : `HINT (${hintsLeft} left)`}
            </button>
          )}
        </div>
      )}

      {/* Speaking controls */}
      <div className="suspect-panel">
        <div className="suspect-waveform">
          <Waveform active={isRecording} color="#4488cc" bars={14} />
        </div>
        <div className="suspect-controls">
          {selectedStance && phase === 'listening' && (
            <div className="selected-stance-tag">Angle: {selectedStance}</div>
          )}
          {canSpeak && !isRecording && (
            <button className="speak-btn" onMouseDown={handleStartAnswer} onTouchStart={handleStartAnswer}>
              <div className="speak-btn-dot" />
              HOLD TO SPEAK
            </button>
          )}
          {isRecording && (
            <button className="speak-btn recording" onMouseUp={handleStopAnswer} onTouchEnd={handleStopAnswer}>
              <div className="speak-btn-dot recording" />
              RELEASE TO SUBMIT
            </button>
          )}
          {isBusy && (
            <div className="speak-waiting">
              <div className="waiting-dots"><span>●</span><span>●</span><span>●</span></div>
            </div>
          )}
        </div>
        <div className="pressure-label">{PRESSURE_LINES[pressureLevel] || ''}</div>
      </div>

      {retryCount > 0 && phase !== 'processing' && (
        <div className={`retry-indicator pressure-${pressureLevel}`}>
          {retryCount === 1 && 'ANSWER INSUFFICIENT'}
          {retryCount === 2 && 'STILL NOT ENOUGH'}
          {retryCount >= 3 && 'FINAL WARNING'}
          {' '}{'▐'.repeat(retryCount)}
        </div>
      )}

      {showCaseFile && (
        <CaseFile
          entries={conversationHistory.map((h, i) => ({
            id: i, question: h.question, answer: h.answer,
            questionIndex: i + 1, note: h.caseFileNote,
          }))}
          onClose={() => setShowCaseFile(false)}
          playerName={playerName}
          scenario={scenario}
        />
      )}
    </div>
  );
}
