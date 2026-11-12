import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Sparkles } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial state
    window.cosmossh.window.isMaximized().then(setIsMaximized).catch(() => {});

    // Listen to changes
    const cleanup = window.cosmossh.window.onMaximizedChange((max) => {
      setIsMaximized(max);
    });

    return () => {
      cleanup();
    };
  }, []);

  const handleMinimize = () => {
    window.cosmossh.window.minimize();
  };

  const handleMaximize = () => {
    window.cosmossh.window.maximize();
  };

  const handleClose = () => {
    window.cosmossh.window.close();
  };

  return (
    <div
      className="h-9 w-full bg-cosmo-950 border-b border-cosmo-800/80 flex items-center justify-between select-none shrink-0 z-50 text-slate-300"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleMaximize}
    >
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-2.5 px-3 h-full">
        <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-cosmo-purple via-cosmo-accent to-cosmo-cyan flex items-center justify-center text-white shadow-glow-cyan/20">
          <Sparkles className="w-3 h-3" />
        </div>
        <span className="text-xs font-bold tracking-wider bg-gradient-to-r from-white via-slate-200 to-cosmo-cyan bg-clip-text text-transparent">
          CosmoSSH
        </span>
        <span className="text-[10px] text-cosmo-500 font-mono hidden sm:inline">
          Terminal & SFTP
        </span>
      </div>

      {/* Center: Draggable Space */}
      <div className="flex-1 h-full" />

      {/* Right: Window Control Action Buttons */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-cosmo-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
          title="最小化"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-cosmo-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <Copy className="w-3.5 h-3.5 rotate-180" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-rose-600 hover:text-white text-slate-400 transition-colors flex items-center justify-center"
          title="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
