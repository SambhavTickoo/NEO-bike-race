import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { io, Socket } from 'socket.io-client';
import { Bike } from '../game/Bike';
import { COLORS, TRACK_WIDTH, PHYSICS_CONFIG } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Droplets, Zap } from 'lucide-react';

interface GameCanvasProps {
  playerName: string;
  bikeType: string;
  onQuit: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ playerName, bikeType, onQuit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const localBikeRef = useRef<Bike | null>(null);
  const remoteBikesRef = useRef<Record<string, Bike>>({});
  const coinsRef = useRef<Matter.Body[]>([]);
  const fuelCansRef = useRef<Matter.Body[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const requestRef = useRef<number>(0);
  
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [fuel, setFuel] = useState(PHYSICS_CONFIG.maxFuel);
  const [finished, setFinished] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [outOfFuel, setOutOfFuel] = useState(false);
  const [stuntMessage, setStuntMessage] = useState<string | null>(null);
  const [activePlayers, setActivePlayers] = useState<number>(1);
  const [cameraZoom, setCameraZoom] = useState(1);

  const crashTimerRef = useRef<number>(0);
  const rotationAccRef = useRef<number>(0); // Accumulated rotation for flips
  const lastAngleRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const engine = Matter.Engine.create();
    engineRef.current = engine;
    const world = engine.world;
    engine.gravity.y = PHYSICS_CONFIG.gravity;

    // Track creation (Hill Climb Style - Bumpy and challenging)
    const createTrack = () => {
      const terrain = [];
      let lastY = 700; // Start at a consistent height
      for (let x = 0; x < TRACK_WIDTH; x += 150) {
        // FLAT START for the first 1000m to prevent falling back immediately
        let h = 0;
        if (x > 1000) {
          const hillFreq = 0.0015;
          const bumpFreq = 0.006;
          // Progressively increase hill height after the start
          const difficultyMultiplier = Math.min(1.5, 0.5 + x / 10000);
          h = (Math.sin(x * hillFreq) * 120 + Math.cos(x * bumpFreq) * 60) * difficultyMultiplier;
        }
        
        const currentY = 800 + h;
        
        const groundSegment = Matter.Bodies.rectangle(x + 75, (lastY + currentY) / 2 + 100, 155, 300, {
          isStatic: true,
          angle: Math.atan2(currentY - lastY, 150),
          label: 'ground'
        });
        terrain.push(groundSegment);

        // Add Coins
        if (x > 500 && x % 450 === 0 && Math.random() > 0.3) {
          const coin = Matter.Bodies.circle(x, currentY - 80, 10, {
            isSensor: true,
            isStatic: true,
            label: 'coin'
          });
          coinsRef.current.push(coin);
          Matter.World.add(world, coin);
        }

        // Add Fuel Cans (Gasoline) - Essential items
        if (x > 1000 && x % 2500 === 0) {
          const fuelCan = Matter.Bodies.rectangle(x, currentY - 100, 20, 30, {
            isSensor: true,
            isStatic: true,
            label: 'fuel'
          });
          fuelCansRef.current.push(fuelCan);
          Matter.World.add(world, fuelCan);
        }

        lastY = currentY;
      }
      
      terrain.push(Matter.Bodies.rectangle(TRACK_WIDTH - 200, 500, 50, 1000, { 
        isStatic: true, 
        isSensor: true, 
        label: 'finish' 
      }));
      
      return terrain;
    };

    Matter.World.add(world, createTrack());

    const localBike = new Bike(world, 100, 500, bikeType, true);
    localBikeRef.current = localBike;

    // Collision handling
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach(pair => {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        
        // Coins
        if (labels.includes('bike-frame') && labels.includes('coin')) {
          const coinBody = pair.bodyA.label === 'coin' ? pair.bodyA : pair.bodyB;
          Matter.World.remove(world, coinBody);
          coinsRef.current = coinsRef.current.filter(c => c !== coinBody);
          setCoinsCollected(prev => prev + 1);
        }

        // Fuel
        if (labels.includes('bike-frame') && labels.includes('fuel')) {
          const fuelBody = pair.bodyA.label === 'fuel' ? pair.bodyA : pair.bodyB;
          Matter.World.remove(world, fuelBody);
          fuelCansRef.current = fuelCansRef.current.filter(c => c !== fuelBody);
          setFuel(prev => Math.min(PHYSICS_CONFIG.maxFuel, prev + PHYSICS_CONFIG.fuelGain));
        }
      });
    });

    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { name: playerName, color: localBike.color, bikeType: bikeType });
    });

    socket.on('players', (players: any) => {
      setActivePlayers(Object.keys(players).length);
      Object.keys(players).forEach(id => {
        if (id !== socket.id && !remoteBikesRef.current[id]) {
          remoteBikesRef.current[id] = new Bike(world, players[id].x, players[id].y, players[id].bikeType || 'STANDARD', false);
        }
      });
    });

    socket.on('player_joined', (player: any) => {
      setActivePlayers(prev => prev + 1);
      if (player.id !== socket.id && !remoteBikesRef.current[player.id]) {
        remoteBikesRef.current[player.id] = new Bike(world, player.x, player.y, player.bikeType || 'STANDARD', false);
      }
    });

    socket.on('player_updated', (player: any) => {
      if (remoteBikesRef.current[player.id]) {
        remoteBikesRef.current[player.id].sync(player);
      }
    });

    socket.on('player_left', (id: string) => {
      setActivePlayers(prev => Math.max(1, prev - 1));
      if (remoteBikesRef.current[id]) {
        remoteBikesRef.current[id].destroy(world);
        delete remoteBikesRef.current[id];
      }
    });

    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'KeyR') {
        const bike = localBikeRef.current;
        if (bike) {
          Matter.Body.setPosition(bike.body, { x: 100, y: 500 });
          Matter.Body.setVelocity(bike.body, { x: 0, y: 0 });
          Matter.Body.setAngle(bike.body, 0);
          Matter.Body.setAngularVelocity(bike.body, 0);
          setFinished(false);
          setCrashed(false);
          setOutOfFuel(false);
          setDistance(0);
          setFuel(PHYSICS_CONFIG.maxFuel);
          crashTimerRef.current = 0;
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keys[e.code] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const update = () => {
      Matter.Engine.update(engine, 1000 / 60);
      
      const inputs = {
        forward: !!(keys['ArrowRight'] || keys['KeyD']),
        backward: !!(keys['ArrowLeft'] || keys['KeyA']),
        left: !!(keys['ArrowUp'] || keys['KeyW']),
        right: !!(keys['ArrowDown'] || keys['KeyS'])
      };

      if (localBike && !finished && !crashed && !outOfFuel) {
        localBike.update(inputs);
        setDistance(Math.floor(localBike.body.position.x));
        setSpeed(Math.floor(localBike.body.velocity.x * 10));

        // Fuel consumption
        if (inputs.forward || inputs.backward) {
          setFuel(prev => {
            const next = prev - PHYSICS_CONFIG.fuelConsumption;
            if (next <= 0) {
              setOutOfFuel(true);
              return 0;
            }
            return next;
          });
        }

        // Stunt Detection (Flips)
        const angleDiff = localBike.body.angle - lastAngleRef.current;
        rotationAccRef.current += angleDiff;
        lastAngleRef.current = localBike.body.angle;

        if (rotationAccRef.current > Math.PI * 2) {
          showStunt('Backflip! +500');
          setCoinsCollected(prev => prev + 5);
          rotationAccRef.current = 0;
        } else if (rotationAccRef.current < -Math.PI * 2) {
          showStunt('Frontflip! +500');
          setCoinsCollected(prev => prev + 5);
          rotationAccRef.current = 0;
        }

        // Crash Detection (Stayed upside down too long)
        const angle = Math.abs(localBike.body.angle % (Math.PI * 2));
        const normAngle = angle > Math.PI ? 2 * Math.PI - angle : angle;
        if (normAngle > 1.8) {
          crashTimerRef.current++;
          if (crashTimerRef.current > 60) setCrashed(true);
        } else {
          crashTimerRef.current = 0;
        }

        // Dynamic Camera Zoom (Drone View logic)
        const d = localBike.body.position.x;
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        if ((d > 4000 && d < 6000) || (d > 12000 && d < 14000)) {
          setCameraZoom(prev => lerp(prev, 0.5, 0.05));
        } else {
          setCameraZoom(prev => lerp(prev, 1.0, 0.05));
        }

        if (localBike.body.position.x > TRACK_WIDTH - 250) setFinished(true);

        socket.emit('update', {
          x: localBike.body.position.x,
          y: localBike.body.position.y,
          rotation: localBike.body.angle,
          bikeType: bikeType
        });
      }

      render();
      requestRef.current = requestAnimationFrame(update);
    };

    const showStunt = (msg: string) => {
      setStuntMessage(msg);
      setTimeout(() => setStuntMessage(null), 2000);
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const lBike = localBikeRef.current;
      if (!lBike) return;
      
      const cameraX = lBike.body.position.x - width / (4 * cameraZoom);
      const cameraY = lBike.body.position.y - height / (1.5 * cameraZoom);

      ctx.save();
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(-cameraX, -cameraY);

      drawBackground(ctx, cameraX, cameraY, width/cameraZoom, height/cameraZoom);

      const bodies = Matter.Composite.allBodies(world);
      bodies.forEach(body => {
        if (body.label === 'ground') drawGround(ctx, body);
        else if (body.label === 'finish') drawFinishLine(ctx, body);
        else if (body.label === 'coin') drawCoin(ctx, body);
        else if (body.label === 'fuel') drawFuelCan(ctx, body);
      });

      drawBike(ctx, lBike);
      Object.keys(remoteBikesRef.current).forEach(id => {
        const remoteBike = remoteBikesRef.current[id];
        if (remoteBike) drawBike(ctx, remoteBike, true);
      });

      ctx.restore();
    };

    const drawBackground = (ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number) => {
      const gridSize = 150;
      const startX = Math.floor(camX / gridSize) * gridSize;
      const startY = Math.floor(camY / gridSize) * gridSize;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (let x = startX; x < startX + w + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, camY); ctx.lineTo(x, camY + h); ctx.stroke();
      }
      for (let y = startY; y < startY + h + gridSize; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(camX, y); ctx.lineTo(camX + w, y); ctx.stroke();
      }
    };

    const drawGround = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
      ctx.fillStyle = COLORS.ground;
      ctx.beginPath();
      const vertices = body.vertices;
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) { ctx.lineTo(vertices[i].x, vertices[i].y); }
      ctx.lineTo(vertices[vertices.length-1].x, vertices[vertices.length-1].y + 1000);
      ctx.lineTo(vertices[0].x, vertices[0].y + 1000);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = COLORS.road;
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      ctx.lineTo(vertices[1].x, vertices[1].y);
      ctx.lineTo(vertices[1].x, vertices[1].y + 30);
      ctx.lineTo(vertices[0].x, vertices[0].y + 30);
      ctx.closePath();
      ctx.fill();

      // Road edge detail (dirt/dust)
      ctx.fillStyle = '#443322';
      ctx.fillRect(vertices[0].x, vertices[0].y + 25, vertices[1].x - vertices[0].x, 5);
      
      ctx.strokeStyle = COLORS.marking;
      ctx.setLineDash([20, 30]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y + 15);
      ctx.lineTo(vertices[1].x, vertices[1].y + 15);
      ctx.stroke();
      ctx.setLineDash([]);

      // Roadside grass/bushes occasionally
      if (Math.floor(vertices[0].x / 150) % 7 === 0) {
        ctx.fillStyle = '#3a4a1a';
        ctx.beginPath();
        ctx.arc(vertices[0].x, vertices[0].y + 5, 20, Math.PI, 0);
        ctx.fill();
      }

      if (Math.floor(vertices[0].x / 150) % 15 === 0) {
        const dLeft = Math.floor((TRACK_WIDTH - vertices[0].x) / 100);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(vertices[0].x, vertices[0].y - 35, 25, 35);
        ctx.fillStyle = '#ffcc00'; ctx.fillRect(vertices[0].x, vertices[0].y - 35, 25, 12);
        ctx.fillStyle = '#000000'; ctx.font = '8px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`${dLeft}`, vertices[0].x + 12, vertices[0].y - 12);
      }
    };

    const drawCoin = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
      ctx.save(); ctx.translate(body.position.x, body.position.y);
      ctx.fillStyle = COLORS.coin; ctx.shadowBlur = 15; ctx.shadowColor = COLORS.coin;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };

    const drawFuelCan = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
      ctx.save(); ctx.translate(body.position.x, body.position.y);
      ctx.fillStyle = '#ff0000'; ctx.fillRect(-10, -15, 20, 30);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-5, -5, 10, 3);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 8px Arial'; ctx.fillText('GAS', -8, 15);
      ctx.restore();
    };

    const drawFinishLine = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
      ctx.fillStyle = COLORS.accent;
      const { min, max } = body.bounds;
      ctx.fillRect(min.x, min.y, max.x - min.x, max.y - min.y);
    };

    const drawBike = (ctx: CanvasRenderingContext2D, bike: Bike, isRemote: boolean = false) => {
      const color = isRemote ? COLORS.ghost : (bike.color || COLORS.primary);
      const isDuke = bike.settings.name.includes('Duke');
      
      ctx.save();
      ctx.translate(bike.body.position.x, bike.body.position.y);
      ctx.rotate(bike.body.angle);
      ctx.fillStyle = color;
      
      if (isDuke) {
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-20, -15); ctx.lineTo(10, -20); ctx.lineTo(30, 0); ctx.lineTo(-30, 0); ctx.fill();
      } else {
        ctx.fillRect(-30, -10, 60, 20);
      }
      
      ctx.fillStyle = isRemote ? '#ffffff33' : '#ffffff';
      ctx.fillRect(-5, -30, 5, 20);
      ctx.beginPath(); ctx.arc(-2, -35, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      [bike.wheelA, bike.wheelB].forEach(wheel => {
        ctx.save(); ctx.translate(wheel.position.x, wheel.position.y); ctx.rotate(wheel.angle);
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 15 * bike.settings.scale, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
    };

    requestRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      socket.disconnect();
      Matter.Engine.clear(engine);
    };
  }, [playerName, finished, bikeType]);

  const fuelProgress = (fuel / PHYSICS_CONFIG.maxFuel) * 100;
  const raceProgress = (distance / TRACK_WIDTH) * 100;

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#1a140f]">
      <canvas ref={canvasRef} className="block" />
      
      <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none">
        <div className="flex gap-4">
          <HUDCard label="Speed" value={`${speed}`} unit="km/h" color="cyan" />
          <HUDCard label="Coins" value={`${coinsCollected}`} unit="$" color="yellow" />
          
          <div className="bg-black/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-1 h-8 rounded-full bg-red-400" />
            <div className="w-24">
              <p className="text-[8px] uppercase tracking-widest text-white/40 font-bold mb-1">Fuel</p>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${fuel < 30 ? 'bg-red-500 animate-pulse' : 'bg-red-400'}`}
                  animate={{ width: `${fuelProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
             <Users size={14} className="text-cyan-400" />
             <span className="text-[10px] font-bold tracking-widest">{activePlayers} RIDERS</span>
        </div>
      </div>

      <AnimatePresence>
        {stuntMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 text-4xl font-black italic text-cyan-400 drop-shadow-lg"
          >
            {stuntMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-1/2 max-w-md h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 pointer-events-none">
         <motion.div 
          className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 shadow-[0_0_15px_#ff9900]"
          animate={{ width: `${raceProgress}%` }}
         />
      </div>

      <div className="absolute top-6 right-6 pointer-events-auto">
         <button onClick={onQuit} className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 text-[10px] uppercase font-bold tracking-widest hover:bg-white/10 transition-colors">Quit</button>
      </div>

      <AnimatePresence>
        {(finished || crashed || outOfFuel) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50 p-6">
            <div className="bg-white text-black p-10 rounded-[40px] text-center shadow-2xl max-w-sm w-full">
              <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-2">
                {finished ? 'Victory!' : outOfFuel ? 'Tank Empty!' : 'Crashed!'}
              </h2>
              <p className="text-xs font-bold tracking-widest mb-8 opacity-60 uppercase">
                {finished ? 'Track Conquered' : 'Better luck next time'}
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-black/5 p-4 rounded-2xl">
                   <p className="text-[8px] uppercase font-bold opacity-40">Distance</p>
                   <p className="text-xl font-mono">{distance}m</p>
                </div>
                <div className="bg-black/5 p-4 rounded-2xl">
                   <p className="text-[8px] uppercase font-bold opacity-40">Earnings</p>
                   <p className="text-xl font-mono">${coinsCollected}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))} className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-tighter hover:bg-orange-500 transition-colors cursor-pointer">
                  Try Again (R)
                </button>
                <button onClick={onQuit} className="w-full bg-black/5 text-black py-4 rounded-2xl font-black uppercase tracking-tighter hover:bg-black/10 transition-colors cursor-pointer">
                  Back to Menu
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HUDCard = ({ label, value, unit, color }: any) => (
  <div className="bg-black/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
    <div className={`w-1 h-8 rounded-full ${color === 'cyan' ? 'bg-cyan-400' : 'bg-yellow-400'}`} />
    <div>
      <p className="text-[8px] uppercase tracking-widest text-white/40 font-bold">{label}</p>
      <p className="text-xl font-mono text-white leading-none tracking-tighter">
        {value} <span className="text-[10px] opacity-40">{unit}</span>
      </p>
    </div>
  </div>
);
