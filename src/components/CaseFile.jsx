import './CaseFile.css';

export default function CaseFile({ entries, onClose, playerName, scenario }) {
  return (
    <div className="casefile-overlay" onClick={onClose}>
      <div className="casefile" onClick={(e) => e.stopPropagation()}>
        <div className="casefile-header">
          <div className="casefile-stamp">CONFIDENTIAL</div>
          <div className="casefile-meta">
            <div className="casefile-meta-row">
              <span className="casefile-label">CASE</span>
              <span className="casefile-val">{scenario.caseNumber}</span>
            </div>
            <div className="casefile-meta-row">
              <span className="casefile-label">SUBJECT</span>
              <span className="casefile-val">{playerName.toUpperCase()}</span>
            </div>
            <div className="casefile-meta-row">
              <span className="casefile-label">INTERVIEWER</span>
              <span className="casefile-val">DET. HARLOW</span>
            </div>
          </div>
          <h2 className="casefile-title">{scenario.title}</h2>
          <p className="casefile-subtitle">{scenario.subtitle}</p>
        </div>

        <div className="casefile-entries">
          {entries.map((entry, i) => (
            <div key={entry.id ?? i} className="casefile-entry">
              <div className="casefile-q-label">Q{entry.questionIndex}</div>
              <div className="casefile-q-text">{entry.question}</div>
              <div className="casefile-a-wrap">
                <div className="casefile-a-label">SUBJECT STATED:</div>
                <div className="casefile-a-text">"{entry.answer}"</div>
              </div>
              {entry.note && (
                <div className="casefile-note-detective">
                  <span className="casefile-note-label">DET. NOTE:</span> {entry.note}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="casefile-footer">
          <p className="casefile-note">★ All statements recorded and admissible.</p>
          <button className="casefile-close" onClick={onClose}>CLOSE FILE</button>
        </div>
      </div>
    </div>
  );
}
