import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import { AppDataPayload, CloudSyncConfig, HostConfig, HostGroup, CommandSnippet, AppSettings } from '../shared/types';

const ENC_PREFIX = 'enc:v1:';

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

function canUseSafeStorage(): boolean {
  try {
    return app.isReady() && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptSecret(value?: string): string | undefined {
  if (!value) return value;
  if (value.startsWith(ENC_PREFIX)) return value;
  if (!canUseSafeStorage()) return value;
  try {
    const encrypted = safeStorage.encryptString(value);
    return ENC_PREFIX + encrypted.toString('base64');
  } catch (err) {
    console.error('Failed to encrypt secret via safeStorage:', err);
    return value;
  }
}

function decryptSecret(value?: string): string | undefined {
  if (!value || !value.startsWith(ENC_PREFIX)) return value;
  if (!canUseSafeStorage()) return value;
  try {
    const buf = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  } catch (err) {
    console.error('Failed to decrypt secret via safeStorage:', err);
    return '';
  }
}

function encryptStoreForDisk(state: FullStoreData): FullStoreData {
  return {
    data: {
      ...state.data,
      hosts: (state.data.hosts || []).map((h) => ({
        ...h,
        password: encryptSecret(h.password),
        privateKey: encryptSecret(h.privateKey),
        passphrase: encryptSecret(h.passphrase),
      })),
    },
    syncConfig: {
      ...state.syncConfig,
      token: encryptSecret(state.syncConfig.token) || '',
    },
  };
}

function decryptStoreFromDisk(raw: FullStoreData): { decrypted: FullStoreData; needsMigration: boolean } {
  let needsMigration = false;
  const encryptionReady = canUseSafeStorage();

  const hosts = (raw.data?.hosts || []).map((h) => {
    if (
      encryptionReady &&
      ((h.password && !h.password.startsWith(ENC_PREFIX)) ||
        (h.privateKey && !h.privateKey.startsWith(ENC_PREFIX)) ||
        (h.passphrase && !h.passphrase.startsWith(ENC_PREFIX)))
    ) {
      needsMigration = true;
    }
    return {
      ...h,
      password: decryptSecret(h.password),
      privateKey: decryptSecret(h.privateKey),
      passphrase: decryptSecret(h.passphrase),
    };
  });

  const rawToken = raw.syncConfig?.token || '';
  if (encryptionReady && rawToken && !rawToken.startsWith(ENC_PREFIX)) {
    needsMigration = true;
  }

  return {
    decrypted: {
      data: {
        version: raw.data?.version || app.getVersion() || '1.0.4',
        updatedAt: raw.data?.updatedAt || Date.now(),
        hosts,
        groups: raw.data?.groups?.length ? raw.data.groups : defaultGroups,
        snippets: raw.data?.snippets?.length ? raw.data.snippets : defaultSnippets,
        settings: { ...defaultSettings, ...(raw.data?.settings || {}) },
      },
      syncConfig: {
        workerUrl: raw.syncConfig?.workerUrl || 'https://cosmossh-sync.flat-mouse-41ef.workers.dev',
        token: decryptSecret(rawToken) || '',
        autoSync: raw.syncConfig?.autoSync ?? false,
        lastSyncedAt: raw.syncConfig?.lastSyncedAt,
      },
    },
    needsMigration,
  };
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
        const parsed = JSON.parse(raw) as FullStoreData;
        const { decrypted, needsMigration } = decryptStoreFromDisk(parsed);
        if (needsMigration) {
          this.state = decrypted;
          this.save();
        }
        return decrypted;
      }
    } catch (err) {
      console.error('Failed to load store, initializing defaults:', err);
    }

    return {
      data: {
        version: app.getVersion() || '1.0.4',
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
      const diskData = encryptStoreForDisk(this.state);
      fs.writeFileSync(this.filePath, JSON.stringify(diskData, null, 2), 'utf-8');
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
