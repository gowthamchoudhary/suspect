import './Waveform.css';

export default function Waveform({ active, color = '#cc3333', bars = 10, erratic = true }) {
  return (
    <div className="wv" style={{ '--wv-color': color }}>
      {[...Array(bars)].map((_, i) => (
        <div
          key={i}
          className={`wv-bar ${active ? 'active' : ''} ${erratic ? 'erratic' : ''}`}
          style={{ animationDelay: `${i * (erratic ? 0.04 : 0.07)}s` }}
        />
      ))}
    </div>
  );
}
