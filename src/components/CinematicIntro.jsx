import { useState, useEffect } from 'react';
import './CinematicIntro.css';

const CASE_STORIES = {
  alibi: {
    caseNumber: 'CASE #4471-B',
    title: 'THE ALIBI',
    lines: [
      'October 14th. 11:58 PM.',
      'Marcus Hale was found dead in his apartment.',
      'Blunt force trauma. Single blow.',
      'He called you three times that night.',
      'You were the last person seen with him.',
      'The detective knows more than he is saying.',
      'You have six questions to walk out of this room.',
    ],
    warning: 'Do not mention the calls unless he brings them up first.',
    goal: 'SURVIVE THE INTERROGATION — GET RELEASED',
  },
  missing: {
    caseNumber: 'CASE #2209-A',
    title: 'THE MISSING',
    lines: [
      'Sarah Chen. Gone for six days.',
      'No body. No note. No trace.',
      'She was last seen leaving your residence.',
      'A neighbor placed your car near her building.',
      'The morning she vanished.',
      'The detective has been watching you for days.',
      'He thinks you know where she is.',
    ],
    warning: 'The neighbor already spoke to police. Choose your words carefully.',
    goal: 'STAY CONSISTENT — DO NOT CONTRADICT YOURSELF',
  },
  accident: {
    caseNumber: 'CASE #0088-C',
    title: 'THE ACCIDENT',
    lines: [
      'Daniel Reeves. Fell down the stairs.',
      'Or so you told them.',
      'Forensics found bruising. Grab marks on both wrists.',
      'You were the only other person in the house.',
      'You called it in forty minutes after it happened.',
      'The detective knows about those forty minutes.',
      'He is going to ask you to fill them.',
    ],
    warning: 'You cannot explain the forty minutes. So do not try.',
    goal: 'CONTROL THE NARRATIVE — KEEP THE STORY SIMPLE',
  },
};

export default function CinematicIntro({ scenario, playerName, onBegin }) {
  const [lineIndex, setLineIndex] = useState(-1);
  const [showWarning, setShowWarning] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showBegin, setShowBegin] = useState(false);
  const [flickering, setFlickering] = useState(false);

  const story = CASE_STORIES[scenario.id];

  useEffect(() => {
    let t;
    // Flicker in
    setFlickering(true);
    t = setTimeout(() => setFlickering(false), 600);

    // Reveal lines one by one
    const delays = story.lines.map((_, i) => 800 + i * 900);
    const timers = delays.map((d, i) =>
      setTimeout(() => setLineIndex(i), d)
    );

    const lastDelay = 800 + story.lines.length * 900;
    const t2 = setTimeout(() => setShowWarning(true), lastDelay + 200);
    const t3 = setTimeout(() => setShowGoal(true), lastDelay + 900);
    const t4 = setTimeout(() => setShowBegin(true), lastDelay + 1600);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className={`cinematic ${flickering ? 'flicker-in' : ''}`}>
      <div className="cinematic-noise" />
      <div className="cinematic-vignette" />
      <div className="cinematic-scanlines" />

      <div className="cinematic-top">
        <span className="cinematic-case">{story.caseNumber}</span>
        <span className="cinematic-sep">—</span>
        <span className="cinematic-name">{playerName.toUpperCase()}</span>
      </div>

      <div className="cinematic-center">
        <h1 className="cinematic-title">{story.title}</h1>

        <div className="cinematic-lines">
          {story.lines.map((line, i) => (
            <p
              key={i}
              className={`cinematic-line ${i <= lineIndex ? 'visible' : ''} ${i === lineIndex ? 'current' : ''}`}
              style={{ transitionDelay: `0ms` }}
            >
              {line}
            </p>
          ))}
        </div>

        {showWarning && (
          <div className="cinematic-warning">
            <span className="cinematic-warning-icon">⚠</span>
            <span>{story.warning}</span>
          </div>
        )}

        {showGoal && (
          <div className="cinematic-goal">
            {story.goal}
          </div>
        )}

        {showBegin && (
          <button className="cinematic-begin" onClick={onBegin}>
            <span>ENTER THE ROOM</span>
            <span className="cinematic-begin-arrow">→</span>
          </button>
        )}
      </div>

      <div className="cinematic-bottom">
        DETECTIVE HARLOW IS ALREADY INSIDE
      </div>
    </div>
  );
}
