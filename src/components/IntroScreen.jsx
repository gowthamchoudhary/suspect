import { useState } from 'react';
import { CASE_ARCHETYPES } from '../services/groq';
import './IntroScreen.css';

export default function IntroScreen({ onStart }) {
  const [selected, setSelected] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [phase, setPhase] = useState('name');

  const handleNameSubmit = () => {
    if (playerName.trim().length < 1) return;
    setPhase('scenario');
  };

  const handleStart = () => {
    if (!selected) return;
    onStart({ scenario: CASE_ARCHETYPES[selected], playerName: playerName.trim() });
  };

  return (
    <div className="intro">
      <div className="intro-noise" />
      <div className="intro-grid" />

      <div className="intro-header">
        <div className="intro-badge">INTERROGATION ROOM 3 — ACTIVE SESSION</div>
      </div>

      <div className="intro-center">
        <div className="intro-title-wrap">
          <h1 className="intro-title">SUSPECT</h1>
          <div className="intro-title-line" />
        </div>
        <p className="intro-sub">your words will be used against you</p>

        {phase === 'name' && (
          <div className="intro-name-phase">
            <p className="intro-instruction">state your name for the record</p>
            <div className="intro-input-wrap">
              <input
                className="intro-input"
                placeholder="full name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                maxLength={30}
                autoFocus
              />
              <div className="intro-input-line" />
            </div>
            <button
              className="intro-btn"
              onClick={handleNameSubmit}
              disabled={!playerName.trim()}
            >
              <span>ENTER THE ROOM</span>
              <div className="intro-btn-arrow">→</div>
            </button>
          </div>
        )}

        {phase === 'scenario' && (
          <div className="intro-scenario-phase">
            <p className="intro-instruction">select your case</p>
            <div className="scenario-grid">
              {Object.values(CASE_ARCHETYPES).map((s) => (
                <button
                  key={s.id}
                  className={`scenario-card ${selected === s.id ? 'selected' : ''}`}
                  onClick={() => setSelected(s.id)}
                >
                  <div className="scenario-case">{s.caseNumber}</div>
                  <div className="scenario-title">{s.title}</div>
                  <div className="scenario-subtitle">{s.subtitle}</div>
                  <p className="scenario-desc">{s.description}</p>
                  {selected === s.id && <div className="scenario-selected-indicator">SELECTED</div>}
                </button>
              ))}
            </div>
            <button
              className="intro-btn"
              onClick={handleStart}
              disabled={!selected}
            >
              <span>BEGIN INTERROGATION</span>
              <div className="intro-btn-arrow">→</div>
            </button>
          </div>
        )}
      </div>

      <div className="intro-footer">
        <span>AI-POWERED INTERROGATION</span>
        <span className="intro-dot">●</span>
        <span>EVERYTHING YOU SAY IS RECORDED</span>
      </div>
    </div>
  );
}
