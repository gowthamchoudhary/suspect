import './LoadingScreen.css';

export default function LoadingScreen({ message, progress }) {
  return (
    <div className="lscreen">
      <div className="lscreen-noise" />
      <div className="lscreen-content">
        <img
          className="lscreen-logo"
          src="/detective/logo_detective.png"
          alt=""
          aria-hidden="true"
        />
        <h1 className="lscreen-title">SUSPECT</h1>
        <p className="lscreen-msg">{message}</p>
        <div className="lscreen-bar">
          <div className="lscreen-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="lscreen-pct">{progress}%</p>
        <p className="lscreen-sub">preparing interrogation room</p>
      </div>
    </div>
  );
}
