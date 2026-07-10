import { useEffect, useRef, useState } from 'react';
import { useInput } from '../hooks/useInput';

interface GameProps {
  initialLevel: number;
  onExit: (progressMade: number) => void;
}

// 16:9 Aspect Ratio
const CANVAS_W = 854;
const CANVAS_H = 480;
const TILE = 32;

// Map legends:
// . = empty, # = ground/brick, ? = question block, G = Goomba, F = Flag (End), M = Mario spawn
const LEVELS = [
  [
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "......?...................",
    "............#?#...........",
    "..........................",
    "..........................",
    "....G....................F",
    "M........................F",
    "##########################",
    "##########################",
    "##########################"
  ],
  [
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    ".......?..................",
    "..............#...........",
    ".............##...........",
    "............###...........",
    "...........####...........",
    "....G.....#####..........F",
    "M........######..........F",
    "##########################",
    "##########################",
    "##########################"
  ]
];

export default function Game({ initialLevel, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(initialLevel - 1);
  const [gameState, setGameState] = useState<'playing' | 'won_level' | 'won_game' | 'dead'>('playing');
  
  const inputRef = useRef({ left: false, right: false, up: false, action: false });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') inputRef.current.left = isDown;
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current.right = isDown;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        inputRef.current.up = isDown;
        if (isDown) inputRef.current.action = true;
      }
      if (e.key === 'Enter') inputRef.current.action = isDown;
    };
    const onKeyDown = (e: KeyboardEvent) => handleKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => handleKey(e, false);
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useInput({
    isActive: true,
    onInput: (action) => {
      if (action === 'back') onExit(currentLevelIndex + 1);
      if (action === 'action') inputRef.current.action = true;
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (gameState !== 'playing') {
      if (inputRef.current.action) {
        if (gameState === 'won_level') {
          setCurrentLevelIndex(prev => prev + 1);
          setGameState('playing');
        } else if (gameState === 'won_game') {
          onExit(currentLevelIndex + 1);
        } else if (gameState === 'dead') {
          setGameState('playing');
        }
        inputRef.current.action = false;
      }
    }

    const levelMap = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
    const mapW = levelMap[0].length * TILE;
    const mapH = levelMap.length * TILE;

    let player = { x: 50, y: 50, w: 24, h: 24, vx: 0, vy: 0, isGrounded: false, dead: false };
    let cameraX = 0;

    let blocks: any[] = [];
    let enemies: any[] = [];
    let flag: any = null;

    // Parse map
    levelMap.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const char = row[x];
        const px = x * TILE;
        const py = y * TILE;
        if (char === '#') blocks.push({ type: 'brick', x: px, y: py, w: TILE, h: TILE });
        if (char === '?') blocks.push({ type: 'question', x: px, y: py, w: TILE, h: TILE, active: true });
        if (char === 'G') enemies.push({ type: 'goomba', x: px, y: py + 8, w: 24, h: 24, vx: -1, dead: false, deadTimer: 0 });
        if (char === 'F') flag = { x: px + 12, y: py, w: 8, h: TILE };
        if (char === 'M') { player.x = px + 4; player.y = py + 8; }
      }
    });

    const gravity = 0.5;
    const friction = 0.8;
    const maxSpeed = 4;
    const jumpForce = -9;

    let animationId: number;

    const AABB = (r1: any, r2: any) => {
      return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
    };

    const loop = () => {
      if (gameState !== 'playing') {
        if (inputRef.current.action || inputRef.current.up) {
           if (gameState === 'won_level') {
             setCurrentLevelIndex(prev => prev + 1);
             setGameState('playing');
           } else if (gameState === 'won_game') {
             onExit(currentLevelIndex + 1);
           } else if (gameState === 'dead') {
             setGameState('playing');
           }
           inputRef.current.action = false;
           inputRef.current.up = false;
        }
        animationId = requestAnimationFrame(loop);
        return;
      }

      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads.find(g => g !== null);
      if (gp) {
        inputRef.current.left = gp.buttons[14]?.pressed || gp.axes[0] < -0.5 || inputRef.current.left;
        inputRef.current.right = gp.buttons[15]?.pressed || gp.axes[0] > 0.5 || inputRef.current.right;
        inputRef.current.up = gp.buttons[0]?.pressed || gp.buttons[12]?.pressed || gp.axes[1] < -0.5 || inputRef.current.up;
      }

      if (!player.dead) {
        if (inputRef.current.left) player.vx -= 1;
        else if (inputRef.current.right) player.vx += 1;
        else player.vx *= friction;

        if (player.vx > maxSpeed) player.vx = maxSpeed;
        if (player.vx < -maxSpeed) player.vx = -maxSpeed;

        if (inputRef.current.up && player.isGrounded) {
          player.vy = jumpForce;
          player.isGrounded = false;
          inputRef.current.up = false;
        }

        player.vy += gravity;
        player.x += player.vx;
        player.isGrounded = false;

        // X collision
        blocks.forEach(b => {
          if (AABB(player, b)) {
            if (player.vx > 0) { player.x = b.x - player.w; player.vx = 0; }
            else if (player.vx < 0) { player.x = b.x + b.w; player.vx = 0; }
          }
        });

        player.y += player.vy;
        
        // Y collision
        blocks.forEach(b => {
          if (AABB(player, b)) {
            if (player.vy > 0) {
              player.y = b.y - player.h;
              player.vy = 0;
              player.isGrounded = true;
            } else if (player.vy < 0) {
              player.y = b.y + b.h;
              player.vy = 0;
              if (b.type === 'question' && b.active) {
                b.active = false; // hit block
              }
            }
          }
        });

        // Map bounds
        if (player.x < 0) { player.x = 0; player.vx = 0; }
        if (player.y > mapH) { player.dead = true; }

        // Camera logic
        const targetCam = player.x - CANVAS_W / 2 + player.w / 2;
        cameraX += (targetCam - cameraX) * 0.1;
        if (cameraX < 0) cameraX = 0;
        if (cameraX > mapW - CANVAS_W) cameraX = mapW - CANVAS_W;
      } else {
        // Death animation
        player.vy += gravity;
        player.y += player.vy;
        if (player.y > mapH + 100) {
           setGameState('dead');
        }
      }

      // Enemies
      enemies.forEach(e => {
        if (e.dead) {
          e.deadTimer++;
          return;
        }
        e.vy = (e.vy || 0) + gravity;
        e.x += e.vx;
        
        blocks.forEach(b => {
          if (AABB(e, b)) {
            if (e.vx > 0) { e.x = b.x - e.w; e.vx = -e.vx; }
            else if (e.vx < 0) { e.x = b.x + b.w; e.vx = -e.vx; }
          }
        });
        
        e.y += e.vy;
        blocks.forEach(b => {
          if (AABB(e, b)) {
            if (e.vy > 0) { e.y = b.y - e.h; e.vy = 0; }
          }
        });

        if (!player.dead && AABB(player, e)) {
          if (player.vy > 0 && player.y + player.h < e.y + 16) {
            e.dead = true;
            player.vy = -6; // bounce
          } else {
            player.dead = true;
            player.vy = -8;
            player.isGrounded = false;
          }
        }
      });

      // Flag
      if (flag && !player.dead && AABB(player, flag)) {
        if (currentLevelIndex + 1 >= LEVELS.length) setGameState('won_game');
        else setGameState('won_level');
      }

      // Render
      ctx.fillStyle = '#5c94fc'; // Mario sky blue
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.save();
      ctx.translate(-Math.floor(cameraX), 0);

      // Blocks
      blocks.forEach(b => {
        if (b.type === 'brick') {
          ctx.fillStyle = '#c84c0c';
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = '#000';
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        } else if (b.type === 'question') {
          ctx.fillStyle = b.active ? '#fca044' : '#888';
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = '#000';
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          if (b.active) {
            ctx.fillStyle = '#000';
            ctx.font = '20px sans-serif';
            ctx.fillText('?', b.x + 10, b.y + 24);
          }
        }
      });

      // Enemies
      enemies.forEach(e => {
        if (e.deadTimer > 30) return;
        ctx.fillStyle = e.dead ? '#888' : '#a81000';
        if (e.dead) {
          ctx.fillRect(e.x, e.y + 12, e.w, 12); // squished
        } else {
          ctx.fillRect(e.x, e.y, e.w, e.h);
        }
      });

      // Flag
      if (flag) {
        ctx.fillStyle = '#000'; // pole
        ctx.fillRect(flag.x, flag.y, flag.w, flag.h);
        ctx.fillStyle = '#00a800'; // flag
        ctx.fillRect(flag.x + flag.w, flag.y, 24, 24);
      }

      // Player
      ctx.fillStyle = player.dead ? '#000' : '#f83800'; // Mario red
      ctx.fillRect(player.x, player.y, player.w, player.h);

      ctx.restore();
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [currentLevelIndex, gameState, onExit]);

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center flex-col z-50">
      <div className="relative w-full max-w-[1280px] aspect-video bg-black flex items-center justify-center border-4 border-slate-900 rounded-lg overflow-hidden shadow-2xl">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_W} 
          height={CANVAS_H} 
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
        {gameState !== 'playing' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col text-white backdrop-blur-sm">
            <h2 className="text-6xl font-black mb-8 text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
              {gameState === 'won_level' ? 'УРОВЕНЬ ПРОЙДЕН!' : 
               gameState === 'won_game' ? 'ИГРА ПРОЙДЕНА!' : 'ИГРА ОКОНЧЕНА'}
            </h2>
            <p className="text-xl font-bold bg-white/20 px-8 py-3 rounded-full animate-pulse">
              Нажмите [Enter / ❌] для продолжения
            </p>
          </div>
        )}
      </div>
      
      {/* Remote Guide */}
      <div className="mt-8 text-white/50 text-lg flex gap-12 uppercase tracking-widest font-bold">
        <span className="flex items-center gap-2">🕹️ Движение</span>
        <span className="flex items-center gap-2">❌ Прыжок / Выбор</span>
        <span className="flex items-center gap-2">⭕ Назад</span>
      </div>
    </div>
  );
}

