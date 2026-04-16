import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../physics/gameEngine';

export const GameCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    
    const [score, setScore] = useState(0);
    const [level, setLevel] = useState(0);
    const [birdsLeft, setBirdsLeft] = useState(0);
    const [gameState, setGameState] = useState<'start' | 'playing' | 'win_level' | 'win_game' | 'loss'>('start');

    useEffect(() => {
        if (!canvasRef.current) return;
        
        engineRef.current = new GameEngine({
            canvas: canvasRef.current,
            width: 1200,
            height: 800,
            onScoreEvent: (points) => {
                if (points === 0) setScore(0);
                else setScore(s => s + points);
            },
            onLevelComplete: (didWin, nextLevelExists) => {
                if (didWin) {
                    setGameState(nextLevelExists ? 'win_level' : 'win_game');
                } else {
                    setGameState('loss');
                }
            },
            onBirdConsumed: (left) => {
                 setBirdsLeft(left);
            }
        });

        return () => {
            if (engineRef.current) engineRef.current.stop();
        };
    }, []);

    const startGame = () => {
        setLevel(0);
        setGameState('playing');
        if (engineRef.current) engineRef.current.start(0);
    };

    const nextLevel = () => {
        const next = level + 1;
        setLevel(next);
        setGameState('playing');
        if (engineRef.current) engineRef.current.start(next);
    };

    const restartLevel = () => {
        setGameState('playing');
        if (engineRef.current) engineRef.current.start(level);
    };

    return (
        <div className="game-container">
            {/* New Unified Background */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url(/assets/background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 1 }} />
            
            <div style={{ position: 'absolute', left: 230, top: 550, width: 40, height: 120, backgroundImage: 'url(/assets/slingshot.png)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', zIndex: 4 }} />

            <canvas ref={canvasRef} className="canvas-layer" width={1200} height={800} style={{ zIndex: 5 }}></canvas>

            <div className="ui-overlay" style={{ zIndex: 10 }}>
                {gameState === 'playing' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', pointerEvents: 'auto' }}>
                        <div className="score-panel">
                            LEVEL: {level + 1}
                        </div>
                        <div className="score-panel">
                            raiku: {birdsLeft}
                        </div>
                        <div className="score-panel">
                            SCORE: {score.toString().padStart(5, '0')}
                        </div>
                    </div>
                )}



                {gameState === 'start' && (
                    <div className="glass-modal">
                        <h1>RAIKU</h1>
                        <p>3 Exciting Levels!</p>
                        <button className="cyber-btn" onClick={startGame}>START GAME</button>
                    </div>
                )}

                {gameState === 'win_level' && (
                    <div className="glass-modal">
                        <h1>LEVEL {level + 1} CLEARED!</h1>
                        <p>Score: {score}</p>
                        <button className="cyber-btn" onClick={nextLevel}>NEXT LEVEL</button>
                    </div>
                )}

                {gameState === 'win_game' && (
                    <div className="glass-modal">
                        <h1>YOU BEAT THE GAME!</h1>
                        <p>Final Score: {score}</p>
                        <p>Oink oink! No more pigs left.</p>
                        <button className="cyber-btn" onClick={startGame}>PLAY AGAIN</button>
                    </div>
                )}

                {gameState === 'loss' && (
                    <div className="glass-modal">
                        <h1>OUT OF RAIKU</h1>
                        <p>The pigs survived this round.</p>
                        <button className="cyber-btn" onClick={restartLevel}>TRY AGAIN</button>
                    </div>
                )}
            </div>
        </div>
    );
};
