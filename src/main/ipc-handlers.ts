import { ipcMain, dialog, BrowserWindow } from 'electron';
import { AppStore } from './store';
import { SSHService } from './ssh-service';
import { SFTPService } from './sftp-service';
import { HostConfig, CloudSyncConfig, AppDataPayload } from '../shared/types';
import fs from 'fs';
import net from 'net';
import { exec } from 'child_process';

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
      // Match patterns: time=23ms, time=23.4 ms, 时间=23ms, 时间<1ms, time<1ms
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

    // If remote SSH server transmits identification banner ("SSH-2.0-..."):
    // This gives the TRUE remote network round-trip time and avoids local TUN/proxy fake-handshakes
    socket.once('data', () => {
      finish(performance.now() - start);
    });

    socket.on('connect', () => {
      const connectLatency = performance.now() - start;
      // If no data (SSH banner) is received within 350ms, fall back to TCP connect handshake time
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

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  store: AppStore,
  sshService: SSHService,
  sftpService: SFTPService
) {
  // Network Ping Handler
  ipcMain.handle('network:pingHost', async (_event, { host, port, timeout = 3000 }) => {
    // 1. Try ICMP ping first (matches system terminal ping output)
    try {
      const icmp = await tryIcmpPing(host, Math.min(timeout, 1500));
      if (typeof icmp === 'number' && icmp > 0) {
        return { success: true, latency: icmp };
      }
    } catch (e) {
      // ignore
    }

    // 2. Fall back to TCP ping with banner verification (handles ICMP-blocked firewalls and TUN proxies)
    try {
      const latency = await tryTcpPing(host, port || 22, timeout);
      return { success: true, latency };
    } catch (err: any) {
      return { success: false, error: err.message || '连接失败' };
    }
  });
  // Store Handlers
  ipcMain.handle('store:getData', () => {
    return store.getData();
  });

  ipcMain.handle('store:setData', (_event, payload: Partial<AppDataPayload>) => {
    return store.setData(payload);
  });

  ipcMain.handle('store:saveHost', (_event, host: HostConfig) => {
    return store.saveHost(host);
  });

  ipcMain.handle('store:deleteHost', (_event, id: string) => {
    return store.deleteHost(id);
  });

  ipcMain.handle('store:getSyncConfig', () => {
    return store.getSyncConfig();
  });

  ipcMain.handle('store:setSyncConfig', (_event, config: CloudSyncConfig) => {
    return store.setSyncConfig(config);
  });

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
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send(`ssh:data:${sessionId}`, data);
            }
          },
          (hadError) => {
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send(`ssh:close:${sessionId}`, hadError);
            }
          },
          (err) => {
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send(`ssh:error:${sessionId}`, err.message);
            }
          }
        );
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'SSH connection failed' };
      }
    }
  );

  ipcMain.handle('ssh:write', (_event, { sessionId, data }) => {
    return sshService.write(sessionId, data);
  });

  ipcMain.handle('ssh:resize', (_event, { sessionId, rows, cols }) => {
    return sshService.resize(sessionId, rows, cols);
  });

  ipcMain.handle('ssh:disconnect', (_event, sessionId: string) => {
    sshService.disconnect(sessionId);
    sftpService.disconnect(sessionId);
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
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`sftp:progress:${transferId}`, { transferred, total });
          }
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
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`sftp:progress:${transferId}`, { transferred, total });
          }
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
    const res = await dialog.showOpenDialog(mainWindow, {
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
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select File(s) to Upload via SFTP',
      properties: ['openFile', 'multiSelections'],
    });
    if (!res.canceled) {
      return res.filePaths;
    }
    return [];
  });

  ipcMain.handle('dialog:selectDownloadLocation', async (_event, defaultFileName: string) => {
    const res = await dialog.showSaveDialog(mainWindow, {
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
    mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow.isMaximized();
  });

  mainWindow.on('maximize', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximizedChange', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximizedChange', false);
    }
  });
}
