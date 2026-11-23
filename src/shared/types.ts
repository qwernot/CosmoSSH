export type AuthType = 'password' | 'privateKey';

export interface HostConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  groupId?: string;
  tags: string[];
  notes?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HostGroup {
  id: string;
  name: string;
  color?: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  hostId: string;
  connected: boolean;
  active: boolean;
}

export interface SFTPFileItem {
  name: string;
  type: 'd' | '-' | 'l'; // directory, regular file, symlink
  size: number;
  modifyTime: number; // Unix timestamp in seconds
  accessTime: number;
  permissions: number;
  modeStr?: string;
}

export interface TransferQueueItem {
  id: string;
  type: 'upload' | 'download';
  localPath: string;
  remotePath: string;
  filename: string;
  totalSize: number;
  transferredSize: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'canceled';
  error?: string;
}

export interface CloudSyncConfig {
  workerUrl: string;
  token: string;
  lastSyncedAt?: number;
  autoSync: boolean;
}

export interface CommandSnippet {
  id: string;
  name: string;
  command: string;
  category?: string;
}

export interface AppSettings {
  theme: 'cosmo-dark' | 'deep-space' | 'cyberpunk' | 'monokai';
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;
}

export interface AppDataPayload {
  version: string;
  updatedAt: number;
  hosts: HostConfig[];
  groups: HostGroup[];
  snippets: CommandSnippet[];
  settings: AppSettings;
}

export interface UpdateReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  publishedAt: string;
  releaseUrl: string;
  assets: UpdateReleaseAsset[];
}

export interface ProcessInfo {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
}

export interface HostSystemStats {
  timestamp: number;
  osName?: string;
  cpu: {
    usagePercent: number; // 0-100
    cores?: number;
  };
  memory: {
    total: number; // in bytes
    used: number; // in bytes
    free: number; // in bytes
    available: number; // in bytes
    usagePercent: number; // 0-100
    swapTotal?: number;
    swapUsed?: number;
    swapPercent?: number;
  };
  disk: {
    filesystem: string;
    mount: string;
    total: number; // in bytes
    used: number; // in bytes
    available: number; // in bytes
    usagePercent: number; // 0-100
  };
  network: {
    rxBytesPerSec: number;
    txBytesPerSec: number;
  };
  loadAvg: [number, number, number]; // 1m, 5m, 15m
  uptime: number; // in seconds
  topProcesses: ProcessInfo[];
}

