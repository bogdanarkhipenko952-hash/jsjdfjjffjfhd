import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, ShoppingBag, Gamepad2, User, Search, Clock, Cloud, Monitor, Download, Upload } from 'lucide-react';
import { useInput } from '../hooks/useInput';
import { API, CloudProgress, GameData } from '../lib/api';
import Game from './Game';

type ViewState = 'dashboard' | 'game' | 'custom_game' | 'store' | 'settings';

const SYSTEM_APPS: GameData[] = [
  { id: 'game', title: 'Super Webrio', type: 'game', bg: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=2000' },
  { id: 'store', title: 'Магазин PlayOS', type: 'app', bg: 'https://images.unsplash.com/photo-1614294149010-950b698f72c0?auto=format&fit=crop&q=80&w=2000' },
  { id: 'settings', title: 'Настройки', type: 'app', bg: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&q=80&w=2000' },
];

export default function PlayOS() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [apps, setApps] = useState<GameData[]>(SYSTEM_APPS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [time, setTime] = useState(new Date());
  const [syncCode, setSyncCode] = useState<string>(() => localStorage.getItem('playos_sync') || 'user_123');
  const [progress, setProgress] = useState<CloudProgress>({ unlockedLevels: 1 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [settingFocus, setSettingFocus] = useState(0); 
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads.find(g => g !== null);
      if (gp) {
        setGamepadName(gp.id);
      } else {
        setGamepadName(null);
      }
    };
    window.addEventListener("gamepadconnected", updateGamepad);
    window.addEventListener("gamepaddisconnected", updateGamepad);
    updateGamepad();
    const interval = setInterval(updateGamepad, 1000);
    return () => {
      window.removeEventListener("gamepadconnected", updateGamepad);
      window.removeEventListener("gamepaddisconnected", updateGamepad);
      clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    handleLoadCloud(syncCode);
    loadGames();
  }, []);

  const loadGames = async () => {
    const customGames = await API.getGames();
    setApps([...SYSTEM_APPS, ...customGames]);
  };

  const handleSaveCloud = async (code: string, prog: CloudProgress) => {
    setIsSyncing(true);
    await API.saveProgress(code, prog);
    localStorage.setItem('playos_sync', code);
    setTimeout(() => setIsSyncing(false), 500);
  };

  const handleLoadCloud = async (code: string) => {
    setIsSyncing(true);
    const data = await API.loadProgress(code);
    if (data) setProgress(data);
    localStorage.setItem('playos_sync', code);
    setTimeout(() => setIsSyncing(false), 500);
  };

  useInput({
    isActive: view === 'dashboard',
    onInput: (action) => {
      if (action === 'right') {
        setSelectedIndex((prev) => Math.min(prev + 1, apps.length - 1));
      } else if (action === 'left') {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (action === 'action') {
        const app = apps[selectedIndex];
        if (app.id === 'game') setView('game');
        else if (app.type === 'custom') setView('custom_game');
        else if (app.id === 'store') setView('store');
        else if (app.id === 'settings') setView('settings');
      }
    }
  });

  useInput({
    isActive: view === 'store',
    onInput: (action) => {
      if (action === 'back') setView('dashboard');
    }
  });

  useInput({
    isActive: view === 'custom_game',
    onInput: (action) => {
      // Allow exiting custom games with back button
      if (action === 'back') setView('dashboard');
    }
  });

  useInput({
    isActive: view === 'settings',
    onInput: (action) => {
      if (action === 'back') setView('dashboard');
      if (action === 'down') setSettingFocus(prev => Math.min(prev + 1, 2));
      if (action === 'up') setSettingFocus(prev => Math.max(prev - 1, 0));
      if (action === 'action') {
        if (settingFocus === 1) handleSaveCloud(syncCode, progress);
        if (settingFocus === 2) handleLoadCloud(syncCode);
      }
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await API.uploadGame(file, file.name.replace('.zip', ''));
    if (res && !res.error) {
      loadGames();
    }
  };

  const activeApp = apps[selectedIndex];

  return (
    <div className="w-full h-screen bg-black overflow-hidden font-sans text-white select-none">
      <AnimatePresence>
        {view === 'dashboard' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, scale: 1.05 }}
            className="absolute inset-0"
          >
            <div 
              className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out opacity-40 blur-sm"
              style={{ backgroundImage: `url(${activeApp?.bg})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />

            <header className="relative z-10 flex items-center justify-between px-12 pt-10">
              <div className="flex items-center gap-6 text-sm font-medium tracking-wide">
                <span className="flex items-center gap-2 hover:bg-white/10 px-4 py-2 rounded-full cursor-pointer transition-colors">
                  <Search size={18} /> Поиск
                </span>
                <span className="flex items-center gap-2 hover:bg-white/10 px-4 py-2 rounded-full cursor-pointer transition-colors text-white/50">
                  Игры
                </span>
              </div>
              <div className="flex items-center gap-6">
                {isSyncing && <Cloud size={20} className="animate-pulse text-blue-400" />}
                <Settings size={24} className="opacity-80" />
                <div className="flex items-center gap-3 bg-white/10 px-4 py-1.5 rounded-full">
                  <User size={18} />
                  <span className="text-sm font-medium">{syncCode}</span>
                </div>
                <div className="flex items-center gap-2 text-lg font-medium">
                  <Clock size={20} className="opacity-60" />
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </header>

            <div className="relative z-10 mt-32 px-12">
              <div className="flex items-end gap-6 overflow-visible transition-transform duration-500 ease-out" 
                   style={{ transform: `translateX(calc(-${selectedIndex * 160}px))` }}>
                {apps.map((app, idx) => {
                  const isActive = idx === selectedIndex;
                  return (
                    <div 
                      key={app.id}
                      className={`relative flex-shrink-0 transition-all duration-300 ease-out rounded-2xl flex items-center justify-center cursor-pointer border-2 overflow-hidden
                        ${isActive ? 'w-48 h-48 bg-slate-800 border-white/40 shadow-2xl shadow-white/20 -translate-y-4' : 'w-32 h-32 bg-slate-800/50 border-transparent opacity-60 hover:opacity-100'}`}
                      onClick={() => setSelectedIndex(idx)}
                    >
                      {app.id === 'game' && <Gamepad2 size={48} className="text-red-500 z-10" />}
                      {app.id === 'store' && <ShoppingBag size={48} className="text-blue-500 z-10" />}
                      {app.id === 'settings' && <Settings size={48} className="text-slate-300 z-10" />}
                      {app.type === 'custom' && (
                         <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${app.bg})` }} />
                      )}
                    </div>
                  );
                })}
              </div>

              <motion.div 
                key={activeApp?.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-16 max-w-2xl"
              >
                <h1 className="text-5xl font-light tracking-tight">{activeApp?.title}</h1>
                <p className="text-white/60 mt-4 text-lg">
                  {activeApp?.id === 'game' && `Прогресс: Открыт уровень ${progress.unlockedLevels}`}
                  {activeApp?.id === 'store' && 'Открывайте новые игры и приложения'}
                  {activeApp?.id === 'settings' && 'Конфигурация системы и аккаунты'}
                  {activeApp?.type === 'custom' && 'Установленная игра'}
                </p>
                <div className="mt-8 flex items-center gap-4">
                  <button 
                    onClick={() => {
                       if (activeApp?.id === 'game') setView('game');
                       else if (activeApp?.type === 'custom') setView('custom_game');
                       else if (activeApp?.id === 'store') setView('store');
                       else if (activeApp?.id === 'settings') setView('settings');
                    }}
                    className="bg-white text-black px-12 py-3 rounded-full font-semibold flex items-center gap-2 hover:bg-slate-200 transition-colors shadow-lg shadow-white/20"
                  >
                    {activeApp?.type === 'app' ? 'Открыть' : 'Играть'} <Gamepad2 size={20} />
                  </button>
                </div>
              </motion.div>
            </div>
            
            <div className="absolute bottom-10 left-12 right-12 flex justify-between text-sm text-white/50 border-t border-white/10 pt-4">
              <div className="flex gap-8">
                <span className="flex items-center gap-2">🕹️ D-Pad для навигации</span>
                <span className="flex items-center gap-2">❌ Выбрать</span>
              </div>
              <span className="flex items-center gap-2"><Monitor size={16}/> Оптимизировано для 4K ТВ</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'game' && (
        <Game 
          initialLevel={progress.unlockedLevels} 
          onExit={(levelsCompleted) => {
            const newProgress = Math.max(progress.unlockedLevels, levelsCompleted);
            if (newProgress > progress.unlockedLevels) {
              const newProg = { unlockedLevels: newProgress };
              setProgress(newProg);
              handleSaveCloud(syncCode, newProg);
            }
            setView('dashboard');
          }} 
        />
      )}

      {view === 'custom_game' && activeApp?.url && (
        <div className="absolute inset-0 bg-black z-50">
           <iframe src={activeApp.url} className="w-full h-full border-none" title={activeApp.title} />
           <div className="absolute top-4 right-4 z-50">
             <button onClick={() => setView('dashboard')} className="bg-black/50 hover:bg-black/80 text-white px-4 py-2 rounded-full border border-white/20 backdrop-blur-md">
               Нажмите ⭕ / Esc для выхода
             </button>
           </div>
        </div>
      )}

      {view === 'store' && (
        <div className="absolute inset-0 bg-slate-950 p-12 overflow-y-auto">
          <div className="flex items-center gap-4 mb-12">
            <ShoppingBag size={40} className="text-white" />
            <h2 className="text-4xl font-light tracking-tight">Магазин PlayOS</h2>
          </div>
          
          <div className="mb-12">
             <h3 className="text-xl text-white/70 mb-6 font-medium tracking-wide">Установленные приложения</h3>
             <div className="grid grid-cols-4 gap-6">
                {apps.map(app => (
                  <div key={app.id} className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden flex flex-col group hover:border-white/20 transition-all">
                    <div className="relative w-full h-32 bg-slate-800 flex items-center justify-center overflow-hidden">
                       {app.bg ? (
                         <div className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:opacity-100 transition-opacity" style={{ backgroundImage: `url(${app.bg})` }} />
                       ) : (
                         <Gamepad2 size={40} className="text-white/20" />
                       )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h4 className="font-semibold text-lg">{app.title}</h4>
                      <p className="text-white/40 text-sm mt-1 mb-4 flex-1">{app.type === 'game' ? 'Официальная игра' : app.type === 'custom' ? 'Пользовательская установка' : 'Системное приложение'}</p>
                      <button disabled className="w-full bg-white/5 py-2.5 rounded-lg text-white/30 text-sm font-medium cursor-not-allowed">
                        Установлено
                      </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="mb-12">
             <h3 className="text-xl text-white/70 mb-6 font-medium tracking-wide">Установка сторонних игр (Sideload)</h3>
             <div className="grid grid-cols-2 gap-6">
              <div 
                className="bg-slate-900 border-2 border-dashed border-blue-500/30 hover:border-blue-400/80 hover:bg-slate-800/80 transition-all p-8 rounded-3xl flex flex-col items-center justify-center text-center cursor-pointer min-h-[250px] group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Download size={40} className="text-blue-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Установить игру из ZIP</h3>
                <p className="text-slate-400 max-w-[300px] leading-relaxed">
                  Загрузите ZIP-архив с игрой. Архив должен содержать .html файл игры, а также может включать изображения .png и .jpg для обложек.
                </p>
                <input 
                  type="file" 
                  accept=".zip" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </div>

              <div className="bg-slate-900 border border-white/5 p-8 rounded-3xl flex flex-col justify-center">
                 <h4 className="text-xl font-medium text-white mb-4 flex items-center gap-3"><Upload className="text-blue-400" /> Требования к архиву</h4>
                 <ul className="space-y-4 text-slate-400">
                   <li className="flex gap-3">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                     <span>Внутри должен быть минимум один файл с расширением <strong>.html</strong> (например, index.html).</span>
                   </li>
                   <li className="flex gap-3">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                     <span>Для главного фона меню можно добавить файл <strong>.png</strong>.</span>
                   </li>
                   <li className="flex gap-3">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                     <span>Для миниатюры можно использовать файл <strong>.jpg</strong> (1x1).</span>
                   </li>
                 </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-slate-500 text-sm font-medium tracking-wide">
             <span className="bg-white/5 px-3 py-1.5 rounded-md mr-3 text-white/80">⭕</span> Нажмите для возврата на главный экран
          </div>
        </div>
      )}

      {view === 'settings' && (
        <div className="absolute inset-0 bg-slate-950 p-12 overflow-y-auto">
          <div className="flex items-center gap-4 mb-12">
            <Settings size={40} className="text-white" />
            <h2 className="text-4xl font-light tracking-tight">Системные настройки</h2>
          </div>
          <div className="max-w-4xl space-y-12">
            <section>
              <h3 className="text-xl text-white/70 mb-6 font-medium tracking-wide">Контроллеры и ввод</h3>
              <div className="bg-slate-900 rounded-3xl p-8 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                    <Gamepad2 size={32} className="text-blue-400" />
                  </div>
                  <div>
                     <h4 className="text-xl font-medium mb-1">Геймпад / Пульт управления</h4>
                     <p className="text-slate-400 text-sm">Используйте D-Pad для навигации, Крестик/Enter для выбора, Кружок/Esc для возврата.</p>
                  </div>
                </div>
                <div className="text-right">
                  {gamepadName ? (
                    <div>
                       <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium mb-2">Активен</span>
                       <div className="text-sm text-slate-300 max-w-[150px] truncate" title={gamepadName}>{gamepadName}</div>
                    </div>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-slate-800 text-slate-500 rounded-full text-sm font-medium">Не обнаружен</span>
                  )}
                </div>
              </div>
            </section>
            
            <section>
              <h3 className="text-xl text-white/70 mb-6 font-medium tracking-wide">Облачная синхронизация</h3>
              <div className="bg-slate-900 rounded-3xl p-8 border border-white/5">
                <div className="flex gap-12">
                   <div className="flex-1">
                      <div className={`p-5 rounded-2xl border transition-colors ${settingFocus === 0 ? 'border-blue-500 bg-slate-800' : 'border-white/10 bg-black/30'}`}>
                        <label className="block text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Код аккаунта синхронизации</label>
                        <input 
                          type="text" 
                          value={syncCode}
                          onChange={(e) => setSyncCode(e.target.value)}
                          onFocus={() => setSettingFocus(0)}
                          className="w-full bg-transparent text-2xl text-white outline-none placeholder-slate-600 font-medium"
                          placeholder="Введите код"
                        />
                      </div>
                      {isSyncing && (
                         <div className="mt-4 flex items-center gap-3 text-blue-400 text-sm font-medium">
                            <Cloud className="animate-pulse" size={18} /> Синхронизация с облаком...
                         </div>
                      )}
                   </div>
                   
                   <div className="flex-1 flex flex-col gap-4">
                      <button 
                        onClick={() => handleSaveCloud(syncCode, progress)}
                        className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-medium text-lg border-2 ${settingFocus === 1 ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-slate-800 border-transparent hover:bg-slate-700'}`}
                        onMouseEnter={() => setSettingFocus(1)}
                      >
                        <Upload size={24}/> Сохранить в облако
                      </button>
                      <button 
                        onClick={() => handleLoadCloud(syncCode)}
                        className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-medium text-lg border-2 ${settingFocus === 2 ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-slate-800 border-transparent hover:bg-slate-700'}`}
                        onMouseEnter={() => setSettingFocus(2)}
                      >
                        <Download size={24}/> Загрузить из облака
                      </button>
                   </div>
                </div>
              </div>
            </section>
          </div>
          <div className="mt-12 text-slate-500 text-sm font-medium tracking-wide">
             <span className="bg-white/5 px-3 py-1.5 rounded-md mr-3 text-white/80">⭕</span> Нажмите для возврата на главный экран
          </div>
        </div>
      )}
    </div>
  );
}
