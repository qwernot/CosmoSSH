import { ipcMain, dialog, BrowserWindow, shell, clipboard, app, nativeImage } from 'electron';
import { AppStore } from './store';
import { SSHService } from './ssh-service';
import { SFTPService } from './sftp-service';
import { LocalFSService } from './local-fs-service';
import { HostMonitorService } from './host-monitor-service';
import { HostConfig, CloudSyncConfig, AppDataPayload, UpdateInfo } from '../shared/types';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { exec } from 'child_process';

let handlersRegistered = false;

function tryIcmpPing(host: string, timeoutMs: number = 1500): Promise<number | null> {
  return new Promise((resolve) => {
    if (!host || !/^[a-zA-Z0-9.\-_]+$/.test(host.trim())) {
      return resolve(null);
    }
    const cleanHost = host.trim();
    const isWin = process.platform === 'win32';
    const cmd = isWin
      ? `ping -n 1 -w ${timeoutMs} ${cleanHost}`
      : `ping -c 1 -W ${Math.max(1, Math.ceil(timeoutMs / 1000))} ${cleanHost}`;

    exec(cmd, { timeout: timeoutMs + 500 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve(null);
      }
      const match = stdout.match(/(?:time|时间)[=<]([0-9.]+)\s*ms/i);
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) {
          return resolve(Math.max(1, Math.round(val)));
        }
      }
      resolve(null);
    });
  });
}

function tryTcpPing(host: string, port: number, timeoutMs: number = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const socket = new net.Socket();
    let hasResolved = false;

    socket.setTimeout(timeoutMs);

    const finish = (latency: number) => {
      if (hasResolved) return;
      hasResolved = true;
      socket.destroy();
      resolve(Math.max(1, Math.round(latency)));
    };

    socket.once('data', () => {
      finish(performance.now() - start);
    });

    socket.on('connect', () => {
      const connectLatency = performance.now() - start;
      setTimeout(() => {
        if (!hasResolved) {
          finish(connectLatency);
        }
      }, 350);
    });

    socket.on('timeout', () => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        reject(new Error('超时'));
      }
    });

    socket.on('error', (err: any) => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        reject(err);
      }
    });

    try {
      socket.connect(port, host);
    } catch (e: any) {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        reject(e);
      }
    }
  });
}

export function bindWindowEvents(win: BrowserWindow) {
  win.on('maximize', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window:maximizedChange', true);
    }
  });

  win.on('unmaximize', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window:maximizedChange', false);
    }
  });
}

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  store: AppStore,
  sshService: SSHService,
  sftpService: SFTPService,
  localFSService: LocalFSService,
  hostMonitorService: HostMonitorService
) {
  if (handlersRegistered) return;
  handlersRegistered = true;

  const sendToRenderer = (channel: string, ...args: any[]) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  };

  // Network Ping Handler
  ipcMain.handle('network:pingHost', async (_event, { host, port, timeout = 3000 }) => {
    try {
      const icmp = await tryIcmpPing(host, Math.min(timeout, 1500));
      if (typeof icmp === 'number' && icmp > 0) {
        return { success: true, latency: icmp };
      }
    } catch {
      // ignore
    }

    try {
      const latency = await tryTcpPing(host, port || 22, timeout);
      return { success: true, latency };
    } catch (err: any) {
      return { success: false, error: err.message || '连接失败' };
    }
  });

  // Store Handlers
  ipcMain.handle('store:getData', () => store.getData());

  ipcMain.handle('store:setData', (_event, payload: Partial<AppDataPayload>) =>
    store.setData(payload)
  );

  ipcMain.handle('store:saveHost', (_event, host: HostConfig) =>
    store.saveHost(host)
  );

  ipcMain.handle('store:deleteHost', (_event, id: string) =>
    store.deleteHost(id)
  );

  ipcMain.handle('store:getSyncConfig', () => store.getSyncConfig());

  ipcMain.handle('store:setSyncConfig', (_event, config: CloudSyncConfig) =>
    store.setSyncConfig(config)
  );

  // SSH Handlers
  ipcMain.handle(
    'ssh:connect',
    async (_event, { sessionId, hostConfig, rows, cols }) => {
      try {
        await sshService.connect(
          sessionId,
          hostConfig,
          rows,
          cols,
          (data) => {
            sendToRenderer(`ssh:data:${sessionId}`, data);
          },
          (hadError) => {
            hostMonitorService.stopMonitoring(sessionId);
            sendToRenderer(`ssh:close:${sessionId}`, hadError);
          },
          (err) => {
            sendToRenderer(`ssh:error:${sessionId}`, err.message);
          }
        );
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'SSH connection failed' };
      }
    }
  );

  ipcMain.handle('ssh:write', (_event, { sessionId, data }) =>
    sshService.write(sessionId, data)
  );

  ipcMain.handle('ssh:resize', (_event, { sessionId, rows, cols }) =>
    sshService.resize(sessionId, rows, cols)
  );

  ipcMain.handle('ssh:disconnect', (_event, sessionId: string) => {
    hostMonitorService.stopMonitoring(sessionId);
    sshService.disconnect(sessionId);
    sftpService.disconnect(sessionId);
    return true;
  });

  // Host System Monitor Handlers
  ipcMain.handle('monitor:start', (_event, sessionId: string) => {
    hostMonitorService.startMonitoring(sessionId);
    return true;
  });

  ipcMain.handle('monitor:stop', (_event, sessionId: string) => {
    hostMonitorService.stopMonitoring(sessionId);
    return true;
  });

  // SFTP Handlers
  ipcMain.handle('sftp:list', async (_event, { sessionId, hostConfig, path: dirPath }) => {
    try {
      const res = await sftpService.listDirectory(sessionId, hostConfig, dirPath);
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:readFile', async (_event, { sessionId, hostConfig, filePath }) => {
    try {
      const content = await sftpService.readFile(sessionId, hostConfig, filePath);
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:writeFile', async (_event, { sessionId, hostConfig, filePath, content }) => {
    try {
      await sftpService.writeFile(sessionId, hostConfig, filePath, content);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:upload', async (_event, { transferId, sessionId, hostConfig, localPath, remotePath }) => {
    try {
      await sftpService.upload(
        sessionId,
        hostConfig,
        localPath,
        remotePath,
        (transferred, total) => {
          sendToRenderer(`sftp:progress:${transferId}`, { transferred, total });
        }
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:download', async (_event, { transferId, sessionId, hostConfig, remotePath, localPath }) => {
    try {
      await sftpService.download(
        sessionId,
        hostConfig,
        remotePath,
        localPath,
        (transferred, total) => {
          sendToRenderer(`sftp:progress:${transferId}`, { transferred, total });
        }
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:delete', async (_event, { sessionId, hostConfig, remotePath, isDir }) => {
    try {
      await sftpService.delete(sessionId, hostConfig, remotePath, isDir);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:rename', async (_event, { sessionId, hostConfig, oldPath, newPath }) => {
    try {
      await sftpService.rename(sessionId, hostConfig, oldPath, newPath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:mkdir', async (_event, { sessionId, hostConfig, dirPath }) => {
    try {
      await sftpService.mkdir(sessionId, hostConfig, dirPath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:chmod', async (_event, { sessionId, hostConfig, remotePath, mode }) => {
    try {
      await sftpService.chmod(sessionId, hostConfig, remotePath, mode);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Native File Dialogs
  ipcMain.handle('dialog:openKeyFile', async () => {
    const win = getMainWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Select SSH Private Key',
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Keys', extensions: ['pem', 'key', 'id_rsa', 'id_ed25519', 'ppk'] },
      ],
    });
    if (!res.canceled && res.filePaths.length > 0) {
      try {
        const content = fs.readFileSync(res.filePaths[0], 'utf-8');
        return { filePath: res.filePaths[0], content };
      } catch (e: any) {
        return { error: e.message };
      }
    }
    return null;
  });

  ipcMain.handle('dialog:selectUploadFiles', async () => {
    const win = getMainWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Select File(s) to Upload via SFTP',
      properties: ['openFile', 'multiSelections'],
    });
    if (!res.canceled) {
      return res.filePaths;
    }
    return [];
  });

  ipcMain.handle('dialog:selectDownloadLocation', async (_event, defaultFileName: string) => {
    const win = getMainWindow();
    const res = await dialog.showSaveDialog(win!, {
      title: 'Save Downloaded File As',
      defaultPath: defaultFileName,
    });
    if (!res.canceled) {
      return res.filePath;
    }
    return null;
  });

  // Window Controls
  ipcMain.on('window:minimize', () => {
    getMainWindow()?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    getMainWindow()?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return getMainWindow()?.isMaximized() ?? false;
  });

  // Clipboard
  ipcMain.handle('clipboard:readText', () => clipboard.readText());

  ipcMain.handle('clipboard:writeText', (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  // Shell open external link
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      await shell.openExternal(url);
    }
  });

  // SFTP Native Drag Out (only used in single-pane mode if explicitly triggered)
  ipcMain.on('sftp:startDrag', async (event, { sessionId, hostConfig, remotePath, filename }) => {
    try {
      const dragCacheDir = path.join(app.getPath('temp'), 'cosmossh-drag-cache');
      if (!fs.existsSync(dragCacheDir)) {
        fs.mkdirSync(dragCacheDir, { recursive: true });
      }
      const safeName = path.basename(filename);
      const localFilePath = path.join(dragCacheDir, safeName);

      await sftpService.download(sessionId, hostConfig, remotePath, localFilePath);

      if (fs.existsSync(localFilePath)) {
        const iconPath = path.join(__dirname, '../../assets/icon.png');
        event.sender.startDrag({
          file: localFilePath,
          icon: fs.existsSync(iconPath) ? iconPath : nativeImage.createEmpty(),
        });
      }
    } catch (err) {
      console.error('SFTP startDrag error:', err);
    }
  });

  // Local File System Handlers (Dual-Pane)
  ipcMain.handle('localFs:list', async (_event, dirPath?: string) =>
    localFSService.listDirectory(dirPath)
  );

  ipcMain.handle('localFs:getSpecialDirs', async () =>
    localFSService.getSpecialDirs()
  );

  ipcMain.handle('localFs:mkdir', async (_event, dirPath: string) =>
    localFSService.mkdir(dirPath)
  );

  ipcMain.handle('localFs:delete', async (_event, targetPath: string) =>
    localFSService.delete(targetPath)
  );

  ipcMain.handle('localFs:openPath', async (_event, targetPath: string) =>
    shell.openPath(targetPath)
  );

  // Updater: Check for updates via GitHub Releases (dynamic version from package.json)
  function compareVersions(latest: string, current: string): boolean {
    const l = latest.replace(/^v/i, '').trim().split('.').map((n) => parseInt(n, 10) || 0);
    const c = current.replace(/^v/i, '').trim().split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(l.length, c.length); i++) {
      const lPart = l[i] || 0;
      const cPart = c[i] || 0;
      if (lPart > cPart) return true;
      if (lPart < cPart) return false;
    }
    return false;
  }

  ipcMain.handle('updater:checkUpdate', async (): Promise<UpdateInfo> => {
    const currentVersion = app.getVersion() || '1.0.4';
    try {
      const res = await fetch('https://api.github.com/repos/qwernot/CosmoSSH/releases/latest', {
        headers: { 'User-Agent': 'CosmoSSH-Client' },
      });
      if (!res.ok) {
        throw new Error(`GitHub API HTTP ${res.status}`);
      }
      const data: any = await res.json();
      const latestTag = data.tag_name || '';
      const hasUpdate = compareVersions(latestTag, currentVersion);

      const assets = Array.isArray(data.assets)
        ? data.assets.map((a: any) => ({
            name: a.name,
            browser_download_url: a.browser_download_url,
            size: a.size,
          }))
        : [];

      return {
        hasUpdate,
        currentVersion,
        latestVersion: latestTag.replace(/^v/i, ''),
        releaseNotes: data.body || '无更新说明',
        publishedAt: data.published_at || '',
        releaseUrl: data.html_url || 'https://github.com/qwernot/CosmoSSH/releases',
        assets,
      };
    } catch (err: any) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseNotes: '',
        publishedAt: '',
        releaseUrl: 'https://github.com/qwernot/CosmoSSH/releases',
        assets: [],
        error: err?.message || '网络连接异常',
      };
    }
  });

  ipcMain.handle('updater:downloadUpdate', async (_event, { url, filename }: { url: string; filename: string }) => {
    try {
      const downloadsDir = app.getPath('downloads');
      const safeName = path.basename(filename);
      const targetPath = path.join(downloadsDir, safeName);

      const response = await fetch(url, {
        headers: { 'User-Agent': 'CosmoSSH-Client' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取下载数据流');

      const fileStream = fs.createWriteStream(targetPath);
      let received = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const ok = fileStream.write(Buffer.from(value));
            if (!ok) {
              await new Promise<void>((resolve) => fileStream.once('drain', resolve));
            }
            received += value.length;
            sendToRenderer('updater:downloadProgress', {
              received,
              total,
              percent: total > 0 ? Math.round((received / total) * 100) : 0,
            });
          }
        }

        // Wait until stream finishes flushing all bytes to disk
        await new Promise<void>((resolve, reject) => {
          fileStream.on('finish', resolve);
          fileStream.on('error', reject);
          fileStream.end();
        });
      } catch (writeErr) {
        fileStream.destroy();
        throw writeErr;
      }

      return { success: true, filePath: targetPath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('updater:showInFolder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
}
