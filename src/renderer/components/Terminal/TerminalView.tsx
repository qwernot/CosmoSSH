import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
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
  Copy,
  Search,
  ChevronUp,
  ChevronDown,
  RotateCw,
} from 'lucide-react';
import { HostConfig, CommandSnippet, AppSettings } from '@shared/types';
import { HostStatsBar } from './HostStatsBar';

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
  onReconnectSession: (id: string) => void;
  onNewSessionClick: () => void;
  onNewSessionForHost: (host: HostConfig) => void;
  onOpenSFTP: (host: HostConfig) => void;
  snippets: CommandSnippet[];
  settings: AppSettings;
}

interface TerminalInstance {
  term: XTerm;
  fit: FitAddon;
  search: SearchAddon;
  cleanupData: () => void;
  element: HTMLElement;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  isVisible,
  sessions,
  activeSessionId,
  onSelectSession,
  onCloseSession,
  onReconnectSession,
  onNewSessionClick,
  onNewSessionForHost,
  onOpenSFTP,
  snippets,
  settings,
}) => {
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const [showSnippets, setShowSnippets] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  // Terminal Search Bar (Ctrl+F)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Store persistent xterm instances and data cleanup callbacks per session
  const terminalMap = useRef<Map<string, TerminalInstance>>(new Map());

  const openSearchBar = () => {
    setSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 20);
  };

  const closeSearchBar = () => {
    setSearchOpen(false);
    if (activeSessionId) {
      const instance = terminalMap.current.get(activeSessionId);
      instance?.search.clearDecorations();
      instance?.term.focus();
    }
  };

  const runSearch = (direction: 'next' | 'prev', query: string = searchQuery) => {
    if (!activeSessionId || !query) return;
    const instance = terminalMap.current.get(activeSessionId);
    if (!instance) return;
    if (direction === 'next') {
      instance.search.findNext(query, { caseSensitive: false });
    } else {
      instance.search.findPrevious(query, { caseSensitive: false });
    }
  };

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
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(new WebLinksAddon());

    // Smart Copy & Paste & Search Keybindings (Ctrl+C / Ctrl+V / Ctrl+F)
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const isCtrlOrCmd = (event.ctrlKey || event.metaKey) && !event.altKey;
      if (!isCtrlOrCmd) return true;

      // Ctrl+F -> Open terminal search bar
      if (event.code === 'KeyF' || event.key === 'f' || event.key === 'F') {
        if (event.type === 'keydown') {
          openSearchBar();
        }
        return false;
      }

      // Ctrl+C -> Copy if selection exists, otherwise pass SIGINT \x03
      if (event.code === 'KeyC' || event.key === 'c' || event.key === 'C') {
        if (event.type === 'keydown') {
          if (term.hasSelection()) {
            const selection = term.getSelection();
            if (selection) {
              navigator.clipboard.writeText(selection).catch(() => {
                window.cosmossh.clipboard.writeText(selection);
              });
            }
            return false;
          }
        }
        return true;
      }

      // Ctrl+V -> Paste from OS clipboard
      if (event.code === 'KeyV' || event.key === 'v' || event.key === 'V') {
        if (event.type === 'keydown') {
          (async () => {
            try {
              let text = await navigator.clipboard.readText();
              if (!text) {
                text = await window.cosmossh.clipboard.readText();
              }
              if (text) {
                window.cosmossh.ssh.write(sessionId, text);
              }
            } catch {
              const text = await window.cosmossh.clipboard.readText();
              if (text) {
                window.cosmossh.ssh.write(sessionId, text);
              }
            }
          })();
        }
        return false;
      }

      return true;
    });

    term.open(el);

    // Right-click: Copy if selection, otherwise paste
    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault();
      if (term.hasSelection()) {
        const text = term.getSelection();
        if (text) {
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            await window.cosmossh.clipboard.writeText(text);
          }
        }
      } else {
        try {
          let text = await navigator.clipboard.readText();
          if (!text) text = await window.cosmossh.clipboard.readText();
          if (text) {
            window.cosmossh.ssh.write(sessionId, text);
          }
        } catch {
          const text = await window.cosmossh.clipboard.readText();
          if (text) window.cosmossh.ssh.write(sessionId, text);
        }
      }
    };
    el.addEventListener('contextmenu', handleContextMenu);

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
      search: searchAddon,
      cleanupData: () => {
        cleanupData();
        el.removeEventListener('contextmenu', handleContextMenu);
      },
      element: el,
    });

    if (sessionId === activeSessionId && isVisible) {
      setTimeout(() => {
        try {
          fitAddon.fit();
          window.cosmossh.ssh.resize(sessionId, term.rows, term.cols);
        } catch {
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
      } catch {
        // ignore
      }
      if (!searchOpen) {
        instance.term.focus();
      }
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
        } catch {
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
      } catch {
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

  const handleReconnectClick = () => {
    if (!activeSessionId) return;
    const instance = terminalMap.current.get(activeSessionId);
    if (instance) {
      instance.term.writeln('\r\n\x1b[36m[CosmoSSH] 正在尝试重新连接服务器...\x1b[0m');
    }
    onReconnectSession(activeSessionId);
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
    <div
      className="flex-1 flex flex-col h-full bg-cosmo-950 overflow-hidden"
      onClick={() => plusMenuOpen && setPlusMenuOpen(false)}
    >
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
                className="opacity-60 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                title="关闭此会话"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Plus Button with Menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
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
        <div className="h-10 px-4 bg-cosmo-900/60 border-b border-cosmo-800 flex items-center justify-between text-xs text-slate-400 shrink-0 gap-3 overflow-x-auto">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-mono text-slate-300 font-semibold">
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
            {!activeSession.connected && !activeSession.connecting && (
              <button
                onClick={handleReconnectClick}
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[11px] font-semibold flex items-center gap-1 border border-amber-500/35 transition-colors cursor-pointer"
                title="会话已断开，点击立即重新连接"
              >
                <RotateCw className="w-3 h-3" /> 重新连接
              </button>
            )}
          </div>

          {/* Real-time Hardware System Monitor Bar */}
          {activeSession.connected && (
            <div className="flex items-center shrink-0">
              <HostStatsBar
                sessionId={activeSession.id}
                host={activeSession.host}
                connected={activeSession.connected}
                isVisible={isVisible}
              />
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNewSessionForHost(activeSession.host)}
              className="px-2.5 py-1 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-cosmo-cyan text-[11px] font-medium flex items-center gap-1 transition-colors border border-cosmo-cyan/30 shadow-sm cursor-pointer"
              title="为此服务器打开新的独立终端会话"
            >
              <Plus className="w-3.5 h-3.5" /> 新建会话
            </button>

            <button
              onClick={() => onOpenSFTP(activeSession.host)}
              className="px-2.5 py-1 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition-colors border border-cosmo-700 cursor-pointer"
            >
              <FolderSync className="w-3.5 h-3.5 text-cosmo-cyan" /> SFTP
            </button>

            <button
              onClick={() => setShowSnippets(!showSnippets)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors border cursor-pointer ${
                showSnippets
                  ? 'bg-cosmo-cyan/20 text-cosmo-cyan border-cosmo-cyan/40'
                  : 'bg-cosmo-800 hover:bg-cosmo-700 text-slate-200 border-cosmo-700'
              }`}
            >
              <Command className="w-3.5 h-3.5" /> 常用命令
            </button>

            <button
              onClick={() => (searchOpen ? closeSearchBar() : openSearchBar())}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                searchOpen
                  ? 'bg-cosmo-cyan/20 text-cosmo-cyan'
                  : 'hover:bg-cosmo-800 text-slate-400 hover:text-slate-200'
              }`}
              title="搜索终端日志 (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
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
        {/* Floating Terminal Search Bar (Ctrl+F) */}
        {searchOpen && (
          <div className="absolute top-3 right-5 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cosmo-900/95 border border-cosmo-700 shadow-2xl backdrop-blur-md">
            <Search className="w-3.5 h-3.5 text-cosmo-cyan shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val) runSearch('next', val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch(e.shiftKey ? 'prev' : 'next');
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeSearchBar();
                }
              }}
              placeholder="搜索终端输出..."
              className="w-48 bg-cosmo-950 border border-cosmo-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan"
            />
            <button
              type="button"
              onClick={() => runSearch('prev')}
              className="p-1 rounded hover:bg-cosmo-800 text-slate-400 hover:text-white cursor-pointer"
              title="上一个匹配 (Shift+Enter)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runSearch('next')}
              className="p-1 rounded hover:bg-cosmo-800 text-slate-400 hover:text-white cursor-pointer"
              title="下一个匹配 (Enter)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={closeSearchBar}
              className="p-1 rounded hover:bg-cosmo-800 text-slate-400 hover:text-rose-400 cursor-pointer"
              title="关闭搜索 (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
