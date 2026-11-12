import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { AppDataPayload, CloudSyncConfig, HostConfig, HostGroup, CommandSnippet, AppSettings } from '../shared/types';

const defaultSettings: AppSettings = {
  theme: 'cosmo-dark',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  cursorBlink: true,
  scrollback: 5000,
};

const defaultGroups: HostGroup[] = [
  { id: 'default', name: 'General', color: '#4facfe' },
  { id: 'prod', name: 'Production', color: '#f43f5e' },
  { id: 'staging', name: 'Staging', color: '#f59e0b' },
];

const defaultSnippets: CommandSnippet[] = [
  { id: '1', name: 'System Info', command: 'uname -a && cat /etc/os-release', category: 'Monitoring' },
  { id: '2', name: 'Disk Usage', command: 'df -h', category: 'Monitoring' },
  { id: '3', name: 'Memory Usage', command: 'free -m', category: 'Monitoring' },
  { id: '4', name: 'Active Ports', command: 'netstat -tuln || ss -tuln', category: 'Network' },
  { id: '5', name: 'Docker Status', command: 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', category: 'Docker' },
  { id: '6', name: 'Top Processes', command: 'top -b -n 1 | head -n 20', category: 'Monitoring' },
];

interface FullStoreData {
  data: AppDataPayload;
  syncConfig: CloudSyncConfig;
}

export class AppStore {
  private filePath: string;
  private state: FullStoreData;

  constructor() {
    const userData = app.getPath('userData');
    this.filePath = path.join(userData, 'cosmossh-store.json');
    this.state = this.load();
  }

  private load(): FullStoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load store, initializing defaults:', err);
    }

    return {
      data: {
        version: '1.0.0',
        updatedAt: Date.now(),
        hosts: [],
        groups: defaultGroups,
        snippets: defaultSnippets,
        settings: defaultSettings,
      },
      syncConfig: {
        workerUrl: 'https://cosmossh-sync.flat-mouse-41ef.workers.dev',
        token: '',
        autoSync: false,
      },
    };
  }

  private save() {
    try {
      this.state.data.updatedAt = Date.now();
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save store:', err);
    }
  }

  public getData(): AppDataPayload {
    return this.state.data;
  }

  public setData(payload: Partial<AppDataPayload>): AppDataPayload {
    this.state.data = {
      ...this.state.data,
      ...payload,
      updatedAt: Date.now(),
    };
    this.save();
    return this.state.data;
  }

  public getSyncConfig(): CloudSyncConfig {
    return this.state.syncConfig;
  }

  public setSyncConfig(config: CloudSyncConfig): CloudSyncConfig {
    this.state.syncConfig = { ...this.state.syncConfig, ...config };
    this.save();
    return this.state.syncConfig;
  }

  // Host helpers
  public saveHost(host: HostConfig): HostConfig[] {
    const idx = this.state.data.hosts.findIndex((h) => h.id === host.id);
    if (idx >= 0) {
      this.state.data.hosts[idx] = { ...host, updatedAt: Date.now() };
    } else {
      this.state.data.hosts.push({
        ...host,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    this.save();
    return this.state.data.hosts;
  }

  public deleteHost(id: string): HostConfig[] {
    this.state.data.hosts = this.state.data.hosts.filter((h) => h.id !== id);
    this.save();
    return this.state.data.hosts;
  }
}
