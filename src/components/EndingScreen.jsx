import { useState, useEffect } from 'react';
import { generateVerdict } from '../services/groq';
import './EndingScreen.css';

const VERDICT_COLORS = {
  confess: '#8B0000',
  deny: '#4a6a8a',
  silent: '#5a5a5a',
};

const VERDICT_TITLES = {
  confess: 'CONFESSION',
  deny: 'RELEASED',
  silent: 'NO COMMENT',
};

export default function EndingScreen({ answers, playerName, scenario, onRestart }) {
  const [revealed, setRevealed] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      // answers is now an array of { question, answer, caseFileNote }
      const history = Array.isArray(answers) ? answers : Object.entries(answers).map(([id, ans]) => ({
        question: id,
        answer: ans,
        caseFileNote: '',
      }));

      try {
        const result = await generateVerdict(scenario, playerName, history);
        setVerdict(result);
      } catch (e) {
        console.warn('Verdict generation failed, using fallback:', e);
        // Fallback based on answer analysis
        const allText = history.map(h => h.answer).join(' ').toLowerCase();
        const hasSilence = history.some(h => h.answer === '...' || h.answer.trim().length < 3);
        let verdictType = 'deny';
        if (hasSilence && allText.split(' ').length < 20) verdictType = 'silent';
        else if (allText.includes('sorry') || allText.includes('truth') || allText.includes('did it')) verdictType = 'confess';

        setVerdict({
          verdictType,
          detectiveClosingLine: 'The recording keeps running long after you leave.',
          suspectObservation: 'Every word was noted.',
          caseStatus: verdictType === 'confess' ? 'CASE CLOSED' : verdictType === 'silent' ? 'FILE REMAINS OPEN' : 'UNDER OBSERVATION',
        });
      }

      setLoading(false);
      setTimeout(() => setRevealed(true), 600);
    };
    run();
  }, [answers, playerName, scenario]);

  const history = Array.isArray(answers) ? answers : [];
  const color = verdict ? VERDICT_COLORS[verdict.verdictType] : '#5a5a5a';
  const title = verdict ? VERDICT_TITLES[verdict.verdictType] : '...';

  return (
    <div className="ending">
      <div className="ending-noise" />
      <div className="ending-grid" />

      <div className={`ending-content ${revealed && !loading ? 'revealed' : ''}`}>
        <div className="ending-case">{scenario.caseNumber}</div>

        {loading ? (
          <div className="ending-loading">
            <div className="waiting-dots"><span>●</span><span>●</span><span>●</span></div>
            <p>REVIEWING STATEMENTS...</p>
          </div>
        ) : (
          <>
            <div className="ending-verdict-wrap">
              <div className="ending-verdict-label">VERDICT</div>
              <h1 className="ending-title" style={{ color }}>{title}</h1>
              <div className="ending-verdict-line" style={{ background: color }} />
            </div>

            <p className="ending-subtitle">{verdict?.detectiveClosingLine}</p>
            <p className="ending-detail">{verdict?.suspectObservation}</p>

            <div className="ending-badge" style={{ borderColor: color, color }}>
              {verdict?.caseStatus}
            </div>

            <div className="ending-divider" />

            <div className="ending-transcript">
              <p className="ending-transcript-label">STATEMENTS ON RECORD — {playerName.toUpperCase()}</p>
              {history.slice(0, 3).map((h, i) => (
                <p key={i} className="ending-transcript-line">
                  <span className="ending-q-num">Q{i + 1}</span>
                  "{h.answer.slice(0, 80)}{h.answer.length > 80 ? '...' : ''}"
                </p>
              ))}
            </div>

            <button className="ending-restart" onClick={onRestart}>
              NEW INTERROGATION →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
