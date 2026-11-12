import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { 
  X, 
  Plus, 
  Terminal as TerminalIcon, 
  FolderSync, 
  Trash2, 
  Command, 
  Play, 
  AlertCircle,
  RefreshCw,
  Copy
} from 'lucide-react';
import { HostConfig, CommandSnippet, AppSettings } from '@shared/types';

export interface TerminalSession {
  id: string;
  host: HostConfig;
  title?: string;
  connected: boolean;
  connecting: boolean;
  error?: string;
}

interface TerminalViewProps {
  isVisible: boolean;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onNewSessionClick: () => void;
  onNewSessionForHost: (host: HostConfig) => void;
  onOpenSFTP: (host: HostConfig) => void;
  snippets: CommandSnippet[];
  settings: AppSettings;
}

interface TerminalInstance {
  term: XTerm;
  fit: FitAddon;
  cleanupData: () => void;
  element: HTMLElement;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  isVisible,
  sessions,
  activeSessionId,
  onSelectSession,
  onCloseSession,
  onNewSessionClick,
  onNewSessionForHost,
  onOpenSFTP,
  snippets,
  settings,
}) => {
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const [showSnippets, setShowSnippets] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  // Store persistent xterm instances and data cleanup callbacks per session
  const terminalMap = useRef<Map<string, TerminalInstance>>(new Map());

  // Attach or initialize xterm when each session's container div mounts
  const attachTerminalContainer = (sessionId: string, el: HTMLDivElement | null) => {
    if (!el) return;

    if (terminalMap.current.has(sessionId)) {
      const existing = terminalMap.current.get(sessionId)!;
      if (existing.element !== el) {
        existing.element = el;
        el.innerHTML = '';
        existing.term.open(el);
      }
      return;
    }

    // Create new XTerm instance
    const term = new XTerm({
      theme: {
        background: '#07090e',
        foreground: '#e2e8f0',
        cursor: '#00f2fe',
        cursorAccent: '#07090e',
        selectionBackground: '#344460',
        black: '#07090e',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#4facfe',
        magenta: '#7928ca',
        cyan: '#00f2fe',
        white: '#f8fafc',
        brightBlack: '#485d82',
        brightRed: '#fb7185',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a855f7',
        brightCyan: '#38bdf8',
        brightWhite: '#ffffff',
      },
      fontSize: settings.fontSize || 14,
      fontFamily: settings.fontFamily || "'JetBrains Mono', 'Fira Code', monospace",
      cursorBlink: settings.cursorBlink ?? true,
      scrollback: settings.scrollback || 5000,
      allowTransparency: true,
      lineHeight: 1.25,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(el);

    // Keystroke forwarding to backend
    term.onData((data) => {
      window.cosmossh.ssh.write(sessionId, data);
    });

    // Backend data listener - persistent across tab switches
    const cleanupData = window.cosmossh.ssh.onData(sessionId, (data) => {
      term.write(data);
    });

    terminalMap.current.set(sessionId, {
      term,
      fit: fitAddon,
      cleanupData,
      element: el,
    });

    if (sessionId === activeSessionId && isVisible) {
      setTimeout(() => {
        try {
          fitAddon.fit();
          window.cosmossh.ssh.resize(sessionId, term.rows, term.cols);
        } catch (e) {
          // ignore
        }
        term.focus();
      }, 50);
    }
  };

  // Cleanup closed sessions
  useEffect(() => {
    const sessionIds = new Set(sessions.map((s) => s.id));
    terminalMap.current.forEach((instance, id) => {
      if (!sessionIds.has(id)) {
        instance.cleanupData();
        instance.term.dispose();
        terminalMap.current.delete(id);
      }
    });
  }, [sessions]);

  // Adjust fit and focus when activeSessionId or isVisible changes
  useEffect(() => {
    if (!isVisible || !activeSessionId) return;

    const instance = terminalMap.current.get(activeSessionId);
    if (!instance) return;

    const timer = setTimeout(() => {
      try {
        instance.fit.fit();
        window.cosmossh.ssh.resize(
          activeSessionId,
          instance.term.rows,
          instance.term.cols
        );
      } catch (e) {
        // ignore
      }
      instance.term.focus();
    }, 40);

    return () => clearTimeout(timer);
  }, [activeSessionId, isVisible]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!isVisible || !activeSessionId) return;
      const instance = terminalMap.current.get(activeSessionId);
      if (instance) {
        try {
          instance.fit.fit();
          window.cosmossh.ssh.resize(
            activeSessionId,
            instance.term.rows,
            instance.term.cols
          );
        } catch (e) {
          // ignore
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeSessionId, isVisible]);

  // Apply settings dynamically
  useEffect(() => {
    terminalMap.current.forEach(({ term, fit }) => {
      term.options.fontSize = settings.fontSize || 14;
      term.options.fontFamily = settings.fontFamily || "'JetBrains Mono', 'Fira Code', monospace";
      term.options.cursorBlink = settings.cursorBlink ?? true;
      term.options.scrollback = settings.scrollback || 5000;
      try {
        fit.fit();
      } catch (e) {
        // ignore
      }
    });
  }, [settings]);

  const handleSendSnippet = (command: string) => {
    if (activeSessionId) {
      window.cosmossh.ssh.write(activeSessionId, command + '\n');
      const instance = terminalMap.current.get(activeSessionId);
      if (instance) {
        instance.term.focus();
      }
    }
  };

  const handleClearTerminal = () => {
    if (activeSessionId) {
      const instance = terminalMap.current.get(activeSessionId);
      if (instance) {
        instance.term.clear();
        instance.term.focus();
      }
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-cosmo-950 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cosmo-900 border border-cosmo-800 flex items-center justify-center text-cosmo-cyan shadow-glow-cyan/20 shadow-lg mb-4">
          <TerminalIcon className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-200 mb-1">当前没有活动的终端会话</h3>
        <p className="text-xs text-slate-500 mb-5 max-w-sm">
          前往“服务器列表”选择一台服务器点击连接，或点击下方按钮直接选择主机开启连接。
        </p>
        <button
          onClick={onNewSessionClick}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 shadow-glow-cyan/20 shadow flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> 选择服务器连接
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-cosmo-950 overflow-hidden">
      {/* Session Tab Bar */}
      <div className="h-11 bg-cosmo-900 border-b border-cosmo-800 flex items-center px-2 gap-1.5 overflow-x-auto shrink-0 select-none">
        {sessions.map((s) => {
          const isActive = s.id === activeSessionId;
          const displayName = s.title || s.host.name;
          return (
            <div
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all border ${
                isActive
                  ? 'bg-cosmo-800 text-cosmo-cyan border-cosmo-cyan/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-cosmo-850 border-transparent'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  s.connecting
                    ? 'bg-amber-400 animate-ping'
                    : s.connected
                    ? 'bg-emerald-400'
                    : 'bg-rose-400'
                }`}
              />
              <span className="font-medium max-w-[140px] truncate" title={displayName}>
                {displayName}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseSession(s.id);
                }}
                className="opacity-60 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition-colors"
                title="关闭此会话"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Plus Button with Menu */}
        <div className="relative">
          <button
            onClick={() => setPlusMenuOpen(!plusMenuOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cosmo-800 transition-colors ml-1 cursor-pointer"
            title="新建会话"
          >
            <Plus className="w-4 h-4" />
          </button>

          {plusMenuOpen && (
            <div
              onClick={() => setPlusMenuOpen(false)}
              className="absolute left-0 top-9 z-40 w-44 bg-cosmo-850 border border-cosmo-700 rounded-xl shadow-2xl py-1 text-xs"
            >
              {activeSession && (
                <button
                  onClick={() => onNewSessionForHost(activeSession.host)}
                  className="w-full px-3 py-2 text-left text-slate-200 hover:bg-cosmo-750 hover:text-cosmo-cyan flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-cosmo-cyan" /> 新建同机终端会话
                </button>
              )}
              <button
                onClick={onNewSessionClick}
                className="w-full px-3 py-2 text-left text-slate-300 hover:bg-cosmo-750 hover:text-white flex items-center gap-2 cursor-pointer"
              >
                <TerminalIcon className="w-3.5 h-3.5 text-cosmo-accent" /> 从服务器列表选择
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Toolbar */}
      {activeSession && (
        <div className="h-9 px-4 bg-cosmo-900/40 border-b border-cosmo-800/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-slate-300">
              {activeSession.host.username}@{activeSession.host.host}:{activeSession.host.port}
            </span>
            {activeSession.connecting && (
              <span className="text-amber-400 flex items-center gap-1 font-mono text-[11px]">
                <RefreshCw className="w-3 h-3 animate-spin" /> 正在连接...
              </span>
            )}
            {activeSession.error && (
              <span className="text-rose-400 flex items-center gap-1 font-mono text-[11px]">
                <AlertCircle className="w-3 h-3" /> {activeSession.error}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNewSessionForHost(activeSession.host)}
              className="px-2.5 py-1 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-cosmo-cyan text-[11px] font-medium flex items-center gap-1.5 transition-colors border border-cosmo-cyan/30 shadow-sm cursor-pointer"
              title="为此服务器打开新的独立终端会话"
            >
              <Plus className="w-3.5 h-3.5" /> 新建会话
            </button>

            <button
              onClick={() => onOpenSFTP(activeSession.host)}
              className="px-2.5 py-1 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-200 text-[11px] font-medium flex items-center gap-1.5 transition-colors border border-cosmo-700 cursor-pointer"
            >
              <FolderSync className="w-3.5 h-3.5 text-cosmo-cyan" /> SFTP 文件传输
            </button>

            <button
              onClick={() => setShowSnippets(!showSnippets)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors border cursor-pointer ${
                showSnippets
                  ? 'bg-cosmo-cyan/20 text-cosmo-cyan border-cosmo-cyan/40'
                  : 'bg-cosmo-800 hover:bg-cosmo-700 text-slate-200 border-cosmo-700'
              }`}
            >
              <Command className="w-3.5 h-3.5" /> 常用快捷命令
            </button>

            <button
              onClick={handleClearTerminal}
              className="p-1 rounded-lg hover:bg-cosmo-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="清空终端屏幕"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Snippets Bar (Drawer) */}
      {showSnippets && (
        <div className="p-2.5 bg-cosmo-900 border-b border-cosmo-800 flex items-center gap-2 overflow-x-auto shrink-0 select-none">
          <span className="text-[11px] font-bold text-cosmo-cyan px-2 flex items-center gap-1">
            <Command className="w-3 h-3" /> 快捷执行:
          </span>
          {snippets.map((snip) => (
            <button
              key={snip.id}
              onClick={() => handleSendSnippet(snip.command)}
              className="px-2.5 py-1 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 border border-cosmo-700/60 hover:border-cosmo-cyan/40 transition-all shrink-0 cursor-pointer"
              title={`执行: ${snip.command}`}
            >
              <Play className="w-2.5 h-2.5 text-emerald-400" />
              <span>{snip.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Persistent XTerm Containers per session */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-cosmo-950">
        {sessions.map((s) => (
          <div
            key={s.id}
            ref={(el) => attachTerminalContainer(s.id, el)}
            style={{ display: s.id === activeSessionId ? 'block' : 'none' }}
            className="w-full h-full absolute inset-0"
          />
        ))}
      </div>
    </div>
  );
};
