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
