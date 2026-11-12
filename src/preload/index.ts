import { contextBridge, ipcRenderer } from 'electron';
import { HostConfig, CloudSyncConfig, AppDataPayload } from '../shared/types';

export const api = {
  // Store
  store: {
    getData: (): Promise<AppDataPayload> => ipcRenderer.invoke('store:getData'),
    setData: (payload: Partial<AppDataPayload>): Promise<AppDataPayload> =>
      ipcRenderer.invoke('store:setData', payload),
    saveHost: (host: HostConfig): Promise<HostConfig[]> =>
      ipcRenderer.invoke('store:saveHost', host),
    deleteHost: (id: string): Promise<HostConfig[]> =>
      ipcRenderer.invoke('store:deleteHost', id),
    getSyncConfig: (): Promise<CloudSyncConfig> =>
      ipcRenderer.invoke('store:getSyncConfig'),
    setSyncConfig: (config: CloudSyncConfig): Promise<CloudSyncConfig> =>
      ipcRenderer.invoke('store:setSyncConfig', config),
  },

  // SSH
  ssh: {
    connect: (
      sessionId: string,
      hostConfig: HostConfig,
      rows: number,
      cols: number
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('ssh:connect', { sessionId, hostConfig, rows, cols }),
    write: (sessionId: string, data: string): Promise<boolean> =>
      ipcRenderer.invoke('ssh:write', { sessionId, data }),
    resize: (sessionId: string, rows: number, cols: number): Promise<boolean> =>
      ipcRenderer.invoke('ssh:resize', { sessionId, rows, cols }),
    disconnect: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke('ssh:disconnect', sessionId),
    onData: (sessionId: string, callback: (data: string) => void) => {
      const channel = `ssh:data:${sessionId}`;
      const handler = (_event: any, data: string) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onClose: (sessionId: string, callback: (hadError: boolean) => void) => {
      const channel = `ssh:close:${sessionId}`;
      const handler = (_event: any, hadError: boolean) => callback(hadError);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onError: (sessionId: string, callback: (errorMessage: string) => void) => {
      const channel = `ssh:error:${sessionId}`;
      const handler = (_event: any, msg: string) => callback(msg);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },

  // SFTP
  sftp: {
    list: (sessionId: string, hostConfig: HostConfig, path: string) =>
      ipcRenderer.invoke('sftp:list', { sessionId, hostConfig, path }),
    readFile: (sessionId: string, hostConfig: HostConfig, filePath: string) =>
      ipcRenderer.invoke('sftp:readFile', { sessionId, hostConfig, filePath }),
    writeFile: (
      sessionId: string,
      hostConfig: HostConfig,
      filePath: string,
      content: string
    ) =>
      ipcRenderer.invoke('sftp:writeFile', {
        sessionId,
        hostConfig,
        filePath,
        content,
      }),
    upload: (
      transferId: string,
      sessionId: string,
      hostConfig: HostConfig,
      localPath: string,
      remotePath: string
    ) =>
      ipcRenderer.invoke('sftp:upload', {
        transferId,
        sessionId,
        hostConfig,
        localPath,
        remotePath,
      }),
    download: (
      transferId: string,
      sessionId: string,
      hostConfig: HostConfig,
      remotePath: string,
      localPath: string
    ) =>
      ipcRenderer.invoke('sftp:download', {
        transferId,
        sessionId,
        hostConfig,
        remotePath,
        localPath,
      }),
    onProgress: (
      transferId: string,
      callback: (progress: { transferred: number; total: number }) => void
    ) => {
      const channel = `sftp:progress:${transferId}`;
      const handler = (_event: any, progress: any) => callback(progress);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    delete: (
      sessionId: string,
      hostConfig: HostConfig,
      remotePath: string,
      isDir: boolean
    ) =>
      ipcRenderer.invoke('sftp:delete', {
        sessionId,
        hostConfig,
        remotePath,
        isDir,
      }),
    rename: (
      sessionId: string,
      hostConfig: HostConfig,
      oldPath: string,
      newPath: string
    ) =>
      ipcRenderer.invoke('sftp:rename', {
        sessionId,
        hostConfig,
        oldPath,
        newPath,
      }),
    mkdir: (sessionId: string, hostConfig: HostConfig, dirPath: string) =>
      ipcRenderer.invoke('sftp:mkdir', { sessionId, hostConfig, dirPath }),
    chmod: (
      sessionId: string,
      hostConfig: HostConfig,
      remotePath: string,
      mode: number
    ) =>
      ipcRenderer.invoke('sftp:chmod', { sessionId, hostConfig, remotePath, mode }),
  },

  // Dialogs
  dialog: {
    openKeyFile: () => ipcRenderer.invoke('dialog:openKeyFile'),
    selectUploadFiles: () => ipcRenderer.invoke('dialog:selectUploadFiles'),
    selectDownloadLocation: (defaultFileName: string) =>
      ipcRenderer.invoke('dialog:selectDownloadLocation', defaultFileName),
  },

  // Window Controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (callback: (isMax: boolean) => void) => {
      const handler = (_event: any, isMax: boolean) => callback(isMax);
      ipcRenderer.on('window:maximizedChange', handler);
      return () => ipcRenderer.removeListener('window:maximizedChange', handler);
    },
  },

  // Network
  network: {
    pingHost: (host: string, port: number): Promise<{ success: boolean; latency?: number; error?: string; timeout?: boolean }> =>
      ipcRenderer.invoke('network:pingHost', { host, port }),
  },
};

contextBridge.exposeInMainWorld('cosmossh', api);

export type CosmoSSHAPI = typeof api;
