import { BrowserWindow } from 'electron';
import { SSHService } from './ssh-service';
import { HostSystemStats, ProcessInfo } from '../shared/types';

interface PreviousSample {
  timestamp: number;
  cpu: {
    user: number;
    nice: number;
    system: number;
    idle: number;
    iowait: number;
    irq: number;
    softirq: number;
    steal: number;
  };
  net: {
    rxBytes: number;
    txBytes: number;
  };
}

export class HostMonitorService {
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private previousSamples = new Map<string, PreviousSample>();
  private isQuerying = new Set<string>();

  constructor(
    private sshService: SSHService,
    private getMainWindow: () => BrowserWindow | null
  ) {}

  public startMonitoring(sessionId: string, intervalMs: number = 2500) {
    if (this.activeTimers.has(sessionId)) {
      return;
    }

    // Run first sample immediately
    this.pollStats(sessionId);

    const timer = setInterval(() => {
      this.pollStats(sessionId);
    }, intervalMs);

    this.activeTimers.set(sessionId, timer);
  }

  public stopMonitoring(sessionId: string) {
    const timer = this.activeTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(sessionId);
    }
    this.previousSamples.delete(sessionId);
    this.isQuerying.delete(sessionId);
  }

  public stopAll() {
    for (const sessionId of Array.from(this.activeTimers.keys())) {
      this.stopMonitoring(sessionId);
    }
  }

  private async pollStats(sessionId: string) {
    const client = this.sshService.getClient(sessionId);
    if (!client) {
      // Session disconnected or not found
      return;
    }

    if (this.isQuerying.has(sessionId)) {
      // Previous query still in flight, skip this cycle to avoid congestion
      return;
    }

    this.isQuerying.add(sessionId);

    const cmd = [
      'echo "===CPU==="',
      'cat /proc/stat 2>/dev/null | grep \'^cpu \'',
      'echo "===MEM==="',
      'cat /proc/meminfo 2>/dev/null | grep -E \'^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):\'',
      'echo "===LOAD==="',
      'cat /proc/loadavg 2>/dev/null',
      'echo "===UPTIME==="',
      'cat /proc/uptime 2>/dev/null',
      'echo "===DISK==="',
      'df -k / 2>/dev/null | tail -n +2',
      'echo "===NET==="',
      'cat /proc/net/dev 2>/dev/null',
      'echo "===TOP==="',
      'ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu 2>/dev/null | head -n 6',
    ].join('; ');

    try {
      const output = await new Promise<string>((resolve, reject) => {
        client.exec(cmd, (err, stream) => {
          if (err) return reject(err);
          let stdout = '';
          stream.on('data', (data: Buffer) => {
            stdout += data.toString('utf-8');
          });
          stream.stderr?.on('data', () => {});
          stream.on('close', () => resolve(stdout));
          stream.on('error', (e: any) => reject(e));
        });
      });

      const stats = this.parseOutput(sessionId, output);
      if (stats) {
        const mainWindow = this.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(`monitor:stats:${sessionId}`, stats);
        }
      }
    } catch (err) {
      // Ignore transient errors on command exec
    } finally {
      this.isQuerying.delete(sessionId);
    }
  }

  private parseOutput(sessionId: string, raw: string): HostSystemStats | null {
    if (!raw || !raw.includes('===CPU===')) return null;

    const sections = raw.split(/===[A-Z]+===/);
    // sections indices correspond to:
    // 0: empty before first header
    // 1: CPU
    // 2: MEM
    // 3: LOAD
    // 4: UPTIME
    // 5: DISK
    // 6: NET
    // 7: TOP

    const now = Date.now();
    const prev = this.previousSamples.get(sessionId);

    // 1. Parse CPU
    const cpuRaw = (sections[1] || '').trim();
    const cpuParts = cpuRaw.split(/\s+/).slice(1).map(Number);
    const currCpu = {
      user: cpuParts[0] || 0,
      nice: cpuParts[1] || 0,
      system: cpuParts[2] || 0,
      idle: cpuParts[3] || 0,
      iowait: cpuParts[4] || 0,
      irq: cpuParts[5] || 0,
      softirq: cpuParts[6] || 0,
      steal: cpuParts[7] || 0,
    };

    let cpuUsagePercent = 0;
    if (prev) {
      const prevTotal =
        prev.cpu.user +
        prev.cpu.nice +
        prev.cpu.system +
        prev.cpu.idle +
        prev.cpu.iowait +
        prev.cpu.irq +
        prev.cpu.softirq +
        prev.cpu.steal;

      const currTotal =
        currCpu.user +
        currCpu.nice +
        currCpu.system +
        currCpu.idle +
        currCpu.iowait +
        currCpu.irq +
        currCpu.softirq +
        currCpu.steal;

      const diffTotal = currTotal - prevTotal;
      const diffIdle = (currCpu.idle + currCpu.iowait) - (prev.cpu.idle + prev.cpu.iowait);

      if (diffTotal > 0) {
        cpuUsagePercent = Math.max(0, Math.min(100, Math.round(((diffTotal - diffIdle) / diffTotal) * 100)));
      }
    }

    // 2. Parse Memory
    const memRaw = sections[2] || '';
    const memMap: Record<string, number> = {};
    for (const line of memRaw.split('\n')) {
      const match = line.match(/^([a-zA-Z]+):\s*(\d+)/);
      if (match) {
        memMap[match[1]] = parseInt(match[2], 10) * 1024; // convert kB to bytes
      }
    }

    const memTotal = memMap['MemTotal'] || 1;
    const memAvailable =
      memMap['MemAvailable'] !== undefined
        ? memMap['MemAvailable']
        : (memMap['MemFree'] || 0) + (memMap['Buffers'] || 0) + (memMap['Cached'] || 0);

    const memUsed = Math.max(0, memTotal - memAvailable);
    const memUsagePercent = Math.max(0, Math.min(100, Math.round((memUsed / memTotal) * 100)));

    const swapTotal = memMap['SwapTotal'] || 0;
    const swapFree = memMap['SwapFree'] || 0;
    const swapUsed = Math.max(0, swapTotal - swapFree);
    const swapPercent = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0;

    // 3. Parse Load Average
    const loadRaw = (sections[3] || '').trim().split(/\s+/);
    const loadAvg: [number, number, number] = [
      parseFloat(loadRaw[0]) || 0,
      parseFloat(loadRaw[1]) || 0,
      parseFloat(loadRaw[2]) || 0,
    ];

    // 4. Parse Uptime
    const uptimeRaw = (sections[4] || '').trim().split(/\s+/);
    const uptime = Math.floor(parseFloat(uptimeRaw[0]) || 0);

    // 5. Parse Disk
    const diskLines = (sections[5] || '').trim().split('\n');
    let diskStats = {
      filesystem: '/',
      mount: '/',
      total: 0,
      used: 0,
      available: 0,
      usagePercent: 0,
    };

    if (diskLines.length > 0 && diskLines[0]) {
      const diskParts = diskLines[0].trim().split(/\s+/);
      if (diskParts.length >= 5) {
        const total = (parseInt(diskParts[1], 10) || 0) * 1024;
        const used = (parseInt(diskParts[2], 10) || 0) * 1024;
        const available = (parseInt(diskParts[3], 10) || 0) * 1024;
        const usagePercent = parseInt((diskParts[4] || '0').replace('%', ''), 10) || 0;
        diskStats = {
          filesystem: diskParts[0],
          mount: diskParts[5] || '/',
          total,
          used,
          available,
          usagePercent,
        };
      }
    }

    // 6. Parse Network
    const netRaw = sections[6] || '';
    let totalRxBytes = 0;
    let totalTxBytes = 0;

    for (const line of netRaw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('lo:') || !trimmed.includes(':')) continue;
      const [iface, dataPart] = trimmed.split(':');
      if (!dataPart) continue;
      const values = dataPart.trim().split(/\s+/).map(Number);
      if (values.length >= 9) {
        totalRxBytes += values[0] || 0; // bytes received
        totalTxBytes += values[8] || 0; // bytes transmitted
      }
    }

    let rxBytesPerSec = 0;
    let txBytesPerSec = 0;

    if (prev && prev.timestamp < now) {
      const deltaSec = (now - prev.timestamp) / 1000;
      if (deltaSec > 0.5) {
        rxBytesPerSec = Math.max(0, Math.round((totalRxBytes - prev.net.rxBytes) / deltaSec));
        txBytesPerSec = Math.max(0, Math.round((totalTxBytes - prev.net.txBytes) / deltaSec));
      }
    }

    // 7. Parse Top Processes
    const topRaw = sections[7] || '';
    const topProcesses: ProcessInfo[] = [];
    const topLines = topRaw.trim().split('\n').filter(Boolean);

    // Skip header line
    for (let i = 1; i < topLines.length && i <= 6; i++) {
      const parts = topLines[i].trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parseInt(parts[0], 10) || 0;
        const user = parts[1] || '';
        const cpu = parseFloat(parts[2]) || 0;
        const mem = parseFloat(parts[3]) || 0;
        const command = parts.slice(4).join(' ');
        if (pid > 0) {
          topProcesses.push({ pid, user, cpu, mem, command });
        }
      }
    }

    // Update previous sample
    this.previousSamples.set(sessionId, {
      timestamp: now,
      cpu: currCpu,
      net: {
        rxBytes: totalRxBytes,
        txBytes: totalTxBytes,
      },
    });

    return {
      timestamp: now,
      cpu: {
        usagePercent: cpuUsagePercent,
      },
      memory: {
        total: memTotal,
        used: memUsed,
        free: memMap['MemFree'] || 0,
        available: memAvailable,
        usagePercent: memUsagePercent,
        swapTotal,
        swapUsed,
        swapPercent,
      },
      disk: diskStats,
      network: {
        rxBytesPerSec,
        txBytesPerSec,
      },
      loadAvg,
      uptime,
      topProcesses,
    };
  }
}
