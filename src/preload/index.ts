import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { HostConfig, CloudSyncConfig, AppDataPayload, UpdateInfo, SFTPFileItem } from '../shared/types';

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
    startDrag: (data: {
      sessionId: string;
      hostConfig: HostConfig;
      remotePath: string;
      filename: string;
    }) => {
      ipcRenderer.send('sftp:startDrag', data);
    },
  },

  // File Path from Drop Event (Electron webUtils)
  getPathForFile: (file: File): string => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) {
      // fallback
    }
    return (file as any).path || '';
  },

  // Clipboard
  clipboard: {
    readText: (): Promise<string> => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string): Promise<boolean> => ipcRenderer.invoke('clipboard:writeText', text),
  },

  // Shell (open external links in default browser)
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
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

  // Updater
  updater: {
    checkUpdate: (): Promise<UpdateInfo> => ipcRenderer.invoke('updater:checkUpdate'),
    downloadUpdate: (url: string, filename: string): Promise<{ success: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke('updater:downloadUpdate', { url, filename }),
    onDownloadProgress: (callback: (progress: { received: number; total: number; percent: number }) => void) => {
      const handler = (_event: any, progress: any) => callback(progress);
      ipcRenderer.on('updater:downloadProgress', handler);
      return () => ipcRenderer.removeListener('updater:downloadProgress', handler);
    },
    showInFolder: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('updater:showInFolder', filePath),
  },

  // Local File System (WinSCP Dual-Pane)
  localFs: {
    list: (dirPath?: string): Promise<{ path: string; files: SFTPFileItem[] }> =>
      ipcRenderer.invoke('localFs:list', dirPath),
    getSpecialDirs: (): Promise<{ desktop: string; downloads: string; home: string }> =>
      ipcRenderer.invoke('localFs:getSpecialDirs'),
    mkdir: (dirPath: string): Promise<boolean> =>
      ipcRenderer.invoke('localFs:mkdir', dirPath),
    delete: (targetPath: string): Promise<boolean> =>
      ipcRenderer.invoke('localFs:delete', targetPath),
    openPath: (targetPath: string): Promise<string> =>
      ipcRenderer.invoke('localFs:openPath', targetPath),
  },
};

contextBridge.exposeInMainWorld('cosmossh', api);

export type CosmoSSHAPI = typeof api;
