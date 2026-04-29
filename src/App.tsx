import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameCanvas } from './components/GameCanvas';
import { Bike as BikeIcon, Users, Trophy, Play, Settings, Zap } from 'lucide-react';
import { BIKE_TYPES } from './constants';

type GameState = 'MENU' | 'PLAYING';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [playerName, setPlayerName] = useState('');
  const [selectedBike, setSelectedBike] = useState('STANDARD');

  const startGame = () => {
    if (playerName.trim()) {
      setGameState('PLAYING');
    } else {
      alert('Please enter your name');
    }
  };

  return (
    <div className="h-screen w-screen bg-[#050505] text-white flex flex-col items-center justify-center overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {gameState === 'MENU' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center max-w-xl w-full px-6"
            id="main-menu"
          >
            {/* Logo Section */}
            <div className="mb-8 text-center">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="inline-block p-4 rounded-3xl bg-gradient-to-br from-pink-500 to-cyan-500 shadow-2xl shadow-pink-500/20 mb-4"
              >
                <BikeIcon size={40} className="text-white" />
              </motion.div>
              <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-1">
                NEON<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">RIDER</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 font-semibold">
                Duke Edition • Multiplayer
              </p>
            </div>

            {/* Input Section */}
            <div className="w-full space-y-6">
              <input
                type="text"
                placeholder="ENTER RIDER NAME"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center text-lg font-bold tracking-widest focus:outline-none focus:border-pink-500/50 transition-colors"
              />

              {/* Bike Selection */}
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(BIKE_TYPES).map(([key, bike]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedBike(key)}
                    className={`relative p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 ${
                      selectedBike === key 
                        ? 'bg-white/10 border-white/40 shadow-xl shadow-white/5' 
                        : 'bg-white/5 border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-80'
                    }`}
                  >
                    <BikeIcon size={32} style={{ color: bike.color }} />
                    <div className="text-center">
                      <p className="text-[10px] uppercase font-black tracking-widest opacity-50">Type</p>
                      <p className="text-xs font-bold uppercase">{bike.name}</p>
                    </div>
                    {selectedBike === key && (
                      <motion.div layoutId="selection" className="absolute -top-2 -right-2 bg-white text-black p-1 rounded-full">
                        <Zap size={12} fill="currentColor" />
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startGame}
                className="w-full bg-white text-black font-black py-5 rounded-2xl text-xl uppercase tracking-tighter flex items-center justify-center gap-2 hover:bg-cyan-400 transition-colors cursor-pointer shadow-lg shadow-white/10"
              >
                <Play fill="currentColor" />
                Start Race
              </motion.button>
            </div>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <GameCanvas playerName={playerName} bikeType={selectedBike} onQuit={() => setGameState('MENU')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
