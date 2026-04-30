import { useState } from 'react';
import IntroScreen from './components/IntroScreen';
import CinematicIntro from './components/CinematicIntro';
import InterrogationRoom from './components/InterrogationRoom';
import EndingScreen from './components/EndingScreen';
import './App.css';

export default function App() {
  const [screen, setScreen] = useState('intro');
  const [playerName, setPlayerName] = useState('');
  const [scenario, setScenario] = useState(null);
  const [finalAnswers, setFinalAnswers] = useState([]);

  const handleIntroComplete = ({ scenario: s, playerName: name }) => {
    setScenario(s);
    setPlayerName(name);
    setScreen('cinematic');
  };

  const handleCinematicDone = () => {
    setScreen('game');
  };

  const handleGameEnd = ({ answers }) => {
    setFinalAnswers(answers);
    setScreen('ending');
  };

  const handleRestart = () => {
    setScreen('intro');
    setPlayerName('');
    setScenario(null);
    setFinalAnswers([]);
  };

  return (
    <>
      {screen === 'intro' && <IntroScreen onStart={handleIntroComplete} />}
      {screen === 'cinematic' && (
        <CinematicIntro
          scenario={scenario}
          playerName={playerName}
          onBegin={handleCinematicDone}
        />
      )}
      {screen === 'game' && (
        <InterrogationRoom
          scenario={scenario}
          playerName={playerName}
          onEnd={handleGameEnd}
        />
      )}
      {screen === 'ending' && (
        <EndingScreen
          answers={finalAnswers}
          playerName={playerName}
          scenario={scenario}
          onRestart={handleRestart}
        />
      )}
    </>
  );
}
