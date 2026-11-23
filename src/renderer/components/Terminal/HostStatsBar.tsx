import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  HardDrive,
  ArrowDown,
  ArrowUp,
  Activity,
  BarChart2,
} from 'lucide-react';
import { HostConfig, HostSystemStats } from '@shared/types';
import { formatBytes, formatSpeed } from '../../utils/format';
import { HostStatsModal } from './HostStatsModal';

interface HostStatsBarProps {
  sessionId: string;
  host: HostConfig;
  connected: boolean;
  isVisible: boolean;
}

export const HostStatsBar: React.FC<HostStatsBarProps> = ({
  sessionId,
  host,
  connected,
  isVisible,
}) => {
  const [stats, setStats] = useState<HostSystemStats | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Clear stats only when session changes or disconnects
  useEffect(() => {
    if (!connected) {
      setStats(null);
    }
  }, [sessionId, connected]);

  // Pause background SSH polling automatically when user leaves the Terminal tab
  useEffect(() => {
    if (!sessionId || !connected || !isVisible) {
      if (sessionId) {
        window.cosmossh.monitor.stop(sessionId);
      }
      return;
    }

    window.cosmossh.monitor.start(sessionId);

    const cleanup = window.cosmossh.monitor.onStats(sessionId, (newStats) => {
      setStats(newStats);
    });

    return () => {
      cleanup();
      window.cosmossh.monitor.stop(sessionId);
    };
  }, [sessionId, connected, isVisible]);

  if (!connected) return null;

  const cpuPercent = stats?.cpu.usagePercent ?? 0;
  const memPercent = stats?.memory.usagePercent ?? 0;
  const diskPercent = stats?.disk.usagePercent ?? 0;

  const getBadgeColor = (val: number) => {
    if (val < 60) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
    if (val < 85) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/25';
  };

  return (
    <>
      <div className="flex items-center gap-1.5 font-mono text-[11px] select-none">
        {stats ? (
          <>
            {/* CPU Badge */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${getBadgeColor(cpuPercent)}`}
              title={`CPU 实时占用: ${cpuPercent}%${stats.cpu.cores ? ` (${stats.cpu.cores} 核)` : ''}\n1m 负载: ${stats.loadAvg[0].toFixed(2)}`}
            >
              <Cpu className="w-3 h-3 shrink-0" />
              <span>CPU {cpuPercent}%</span>
            </div>

            {/* RAM Badge */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${getBadgeColor(memPercent)}`}
              title={`内存已用: ${formatBytes(stats.memory.used, 1)} / ${formatBytes(stats.memory.total, 1)} (${memPercent}%)`}
            >
              <Layers className="w-3 h-3 shrink-0" />
              <span>RAM {memPercent}%</span>
            </div>

            {/* Disk Badge */}
            <div
              className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${getBadgeColor(diskPercent)}`}
              title={`根分区磁盘空间: ${formatBytes(stats.disk.used, 1)} / ${formatBytes(stats.disk.total, 1)} (${diskPercent}%)`}
            >
              <HardDrive className="w-3 h-3 shrink-0" />
              <span>Disk {diskPercent}%</span>
            </div>

            {/* Network Speed Badge */}
            <div
              className="hidden lg:flex items-center gap-2 px-2 py-0.5 rounded-lg border border-cosmo-750 bg-cosmo-950/70 text-slate-300"
              title={`实时网速:\n下载: ${formatSpeed(stats.network.rxBytesPerSec)}\n上传: ${formatSpeed(stats.network.txBytesPerSec)}`}
            >
              <span className="flex items-center gap-0.5 text-emerald-400">
                <ArrowDown className="w-3 h-3" />
                {formatSpeed(stats.network.rxBytesPerSec)}
              </span>
              <span className="flex items-center gap-0.5 text-cosmo-cyan">
                <ArrowUp className="w-3 h-3" />
                {formatSpeed(stats.network.txBytesPerSec)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-sans px-1.5 py-0.5">
            <Activity className="w-3 h-3 text-cosmo-cyan animate-pulse" />
            <span>监控采集中...</span>
          </div>
        )}

        {/* Expand HUD Dashboard Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-200 hover:text-cosmo-cyan border border-cosmo-700 transition-all font-sans text-xs cursor-pointer shadow-sm"
          title="展开高科技 HUD 系统监控详细仪表盘"
        >
          <BarChart2 className="w-3.5 h-3.5 text-cosmo-cyan" />
          <span className="hidden sm:inline">系统监控</span>
        </button>
      </div>

      {/* Detailed HUD Modal */}
      <HostStatsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        host={host}
        stats={stats}
      />
    </>
  );
};
