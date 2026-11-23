import React from 'react';
import { 
  X, 
  Cpu, 
  HardDrive, 
  Activity, 
  ArrowDown, 
  ArrowUp, 
  Clock, 
  Zap, 
  Layers,
  Server,
  RefreshCw
} from 'lucide-react';
import { HostConfig, HostSystemStats } from '@shared/types';
import { formatBytes, formatSpeed, formatUptime } from '../../utils/format';

interface HostStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  host: HostConfig;
  stats: HostSystemStats | null;
}

export const HostStatsModal: React.FC<HostStatsModalProps> = ({
  isOpen,
  onClose,
  host,
  stats,
}) => {
  if (!isOpen) return null;

  const cpuPercent = stats?.cpu.usagePercent ?? 0;
  const memPercent = stats?.memory.usagePercent ?? 0;
  const diskPercent = stats?.disk.usagePercent ?? 0;
  const swapPercent = stats?.memory.swapPercent ?? 0;

  const getStatusColor = (percent: number) => {
    if (percent < 60) return { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30' };
    if (percent < 85) return { text: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/30' };
    return { text: 'text-rose-400', bg: 'bg-rose-500', border: 'border-rose-500/30' };
  };

  const cpuColor = getStatusColor(cpuPercent);
  const memColor = getStatusColor(memPercent);
  const diskColor = getStatusColor(diskPercent);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div 
        className="w-full max-w-3xl bg-cosmo-900 border border-cosmo-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Top Header */}
        <div className="p-5 border-b border-cosmo-800 flex items-center justify-between bg-cosmo-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cosmo-purple via-cosmo-accent to-cosmo-cyan flex items-center justify-center text-cosmo-950 shadow-glow-cyan/20">
              <Activity className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                {host.name}
                <span className="text-xs font-mono font-normal text-slate-400">({host.host})</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  实时监控中
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {stats?.osName ? `${stats.osName} · ` : ''}
                {stats?.cpu.cores ? `${stats.cpu.cores} 核 CPU · ` : ''}
                端口: {host.port || 22} · 用户: {host.username}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-cosmo-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {!stats ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4">
              <RefreshCw className="w-8 h-8 text-cosmo-cyan animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-200">正在与服务器建立监控采样通道...</p>
              <p className="text-xs text-slate-500 mt-1">复用现有 SSH 会话执行轻量级采样（耗时仅 ~30ms）</p>
            </div>
          ) : (
            <>
              {/* 4 Main Gauges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. CPU Card */}
                <div className="bg-cosmo-950/80 border border-cosmo-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-cosmo-cyan/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-cosmo-cyan" /> CPU 使用率
                    </span>
                    <span className={`text-xs font-bold font-mono ${cpuColor.text}`}>
                      {cpuPercent}%
                    </span>
                  </div>

                  <div className="my-3">
                    <div className="w-full h-2 rounded-full bg-cosmo-800 overflow-hidden">
                      <div 
                        className={`h-full ${cpuColor.bg} transition-all duration-300 rounded-full`}
                        style={{ width: `${cpuPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                    <span>1m 负载</span>
                    <span className="text-slate-200 font-semibold">{stats.loadAvg[0].toFixed(2)}</span>
                  </div>
                </div>

                {/* 2. Memory Card */}
                <div className="bg-cosmo-950/80 border border-cosmo-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-400/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-400" /> 内存使用率
                    </span>
                    <span className={`text-xs font-bold font-mono ${memColor.text}`}>
                      {memPercent}%
                    </span>
                  </div>

                  <div className="my-3">
                    <div className="w-full h-2 rounded-full bg-cosmo-800 overflow-hidden">
                      <div 
                        className={`h-full ${memColor.bg} transition-all duration-300 rounded-full`}
                        style={{ width: `${memPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                    <span>已用 / 总量</span>
                    <span className="text-slate-200 font-semibold truncate max-w-[110px]">
                      {formatBytes(stats.memory.used, 1)} / {formatBytes(stats.memory.total, 1)}
                    </span>
                  </div>
                </div>

                {/* 3. Disk Card */}
                <div className="bg-cosmo-950/80 border border-cosmo-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-400/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-amber-400" /> 根磁盘空间
                    </span>
                    <span className={`text-xs font-bold font-mono ${diskColor.text}`}>
                      {diskPercent}%
                    </span>
                  </div>

                  <div className="my-3">
                    <div className="w-full h-2 rounded-full bg-cosmo-800 overflow-hidden">
                      <div 
                        className={`h-full ${diskColor.bg} transition-all duration-300 rounded-full`}
                        style={{ width: `${diskPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                    <span>剩余可用</span>
                    <span className="text-slate-200 font-semibold">
                      {formatBytes(stats.disk.available, 1)}
                    </span>
                  </div>
                </div>

                {/* 4. Network & Uptime Card */}
                <div className="bg-cosmo-950/80 border border-cosmo-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-purple-400/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-purple-400" /> 实时网络带宽
                    </span>
                  </div>

                  <div className="my-2 space-y-1 text-xs font-mono">
                    <div className="flex items-center justify-between text-emerald-400">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" /> 下行
                      </span>
                      <span className="font-bold">{formatSpeed(stats.network.rxBytesPerSec)}</span>
                    </div>
                    <div className="flex items-center justify-between text-cosmo-cyan">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <ArrowUp className="w-3.5 h-3.5 text-cosmo-cyan" /> 上行
                      </span>
                      <span className="font-bold">{formatSpeed(stats.network.txBytesPerSec)}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-cosmo-800/60">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" /> 运行
                    </span>
                    <span className="text-slate-300 truncate max-w-[100px]">{formatUptime(stats.uptime)}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Specs Banner */}
              <div className="bg-cosmo-950/60 border border-cosmo-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-300">
                  <Server className="w-4 h-4 text-cosmo-cyan shrink-0" />
                  <span>系统负载 (LoadAvg): <strong>{stats.loadAvg[0].toFixed(2)}</strong>, {stats.loadAvg[1].toFixed(2)}, {stats.loadAvg[2].toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  {stats.memory.swapTotal ? (
                    <span>Swap 分区: {formatBytes(stats.memory.swapUsed || 0, 1)} / {formatBytes(stats.memory.swapTotal, 1)} ({swapPercent}%)</span>
                  ) : (
                    <span>Swap 分区: 未启用</span>
                  )}
                  <span>连续开机: <strong className="text-slate-200">{formatUptime(stats.uptime)}</strong></span>
                </div>
              </div>

              {/* Top Processes Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    高负载进程列表 (Top 5 Processes by CPU)
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">实时排查卡顿与异常程序</span>
                </div>

                <div className="bg-cosmo-950 border border-cosmo-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-cosmo-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-cosmo-850/60">
                        <th className="py-2.5 px-3.5 w-20">PID</th>
                        <th className="py-2.5 px-3.5 w-24">用户</th>
                        <th className="py-2.5 px-3.5 w-24">CPU 占用</th>
                        <th className="py-2.5 px-3.5 w-24">内存 占用</th>
                        <th className="py-2.5 px-3.5">命令行 / 进程名称</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cosmo-800/60 text-xs font-mono text-slate-300">
                      {stats.topProcesses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500 font-sans text-xs">
                            暂无进程数据或权限受限
                          </td>
                        </tr>
                      ) : (
                        stats.topProcesses.map((p) => {
                          const isHighCpu = p.cpu >= 50;
                          const isMidCpu = p.cpu >= 15;
                          return (
                            <tr key={p.pid} className="hover:bg-cosmo-850/40 transition-colors">
                              <td className="py-2 px-3.5 text-slate-400 font-semibold">{p.pid}</td>
                              <td className="py-2 px-3.5 text-slate-300">{p.user}</td>
                              <td className="py-2 px-3.5">
                                <span className={`font-bold ${isHighCpu ? 'text-rose-400' : isMidCpu ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {p.cpu.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2 px-3.5 text-slate-400">{p.mem.toFixed(1)}%</td>
                              <td className="py-2 px-3.5 text-slate-200 truncate max-w-md" title={p.command}>
                                {p.command}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
