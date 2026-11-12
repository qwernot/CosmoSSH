import React from 'react';
import { 
  Server, 
  Terminal, 
  FolderSync, 
  Cloud, 
  Settings, 
  Sparkles,
  Layers
} from 'lucide-react';

export type NavTab = 'hosts' | 'terminal' | 'sftp' | 'sync' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeSessionCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeSessionCount,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'hosts',
      label: '服务器列表',
      icon: <Server className="w-5 h-5" />,
    },
    {
      id: 'terminal',
      label: '终端会话',
      icon: <Terminal className="w-5 h-5" />,
      badge: activeSessionCount > 0 ? activeSessionCount : undefined,
    },
    {
      id: 'sftp',
      label: 'SFTP 传输',
      icon: <FolderSync className="w-5 h-5" />,
    },
    {
      id: 'sync',
      label: '云端同步',
      icon: <Cloud className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: '偏好设置',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <aside className="w-60 bg-cosmo-900 border-r border-cosmo-700/60 flex flex-col justify-between shrink-0 select-none">
      {/* Navigation Section */}
      <div className="pt-3">
        <div className="px-4 pb-2 text-[10px] font-bold tracking-wider text-cosmo-500 uppercase font-mono">
          NAVIGATION
        </div>

        {/* Navigation List */}
        <nav className="px-2.5 space-y-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-cosmo-800 text-white shadow-md border border-cosmo-cyan/30 text-cosmo-cyan'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-cosmo-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${isActive ? 'text-cosmo-cyan' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cosmo-cyan/20 text-cosmo-cyan border border-cosmo-cyan/40">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Status Card */}
      <div className="p-4 border-t border-cosmo-800/60">
        <div className="p-3 rounded-xl bg-cosmo-950/60 border border-cosmo-800 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-300 font-mono">v1.0.0</span>
          </div>
          <span className="text-[11px] text-cosmo-500 font-mono">E2EE Ready</span>
        </div>
      </div>
    </aside>
  );
};
