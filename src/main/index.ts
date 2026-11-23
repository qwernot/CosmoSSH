import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppStore } from './store';
import { SSHService } from './ssh-service';
import { SFTPService } from './sftp-service';
import { LocalFSService } from './local-fs-service';
import { HostMonitorService } from './host-monitor-service';
import { registerIpcHandlers, bindWindowEvents } from './ipc-handlers';

// Disable default menu
Menu.setApplicationMenu(null);

// Disable hardware acceleration issues in some Linux environments if needed
app.commandLine.appendSwitch('no-sandbox');

let mainWindow: BrowserWindow | null = null;
let store: AppStore | null = null;

const sshService = new SSHService();
const sftpService = new SFTPService(sshService);
const localFSService = new LocalFSService();
const hostMonitorService = new HostMonitorService(sshService, () => mainWindow);

function cleanupTempDragCache() {
  try {
    const dragCacheDir = path.join(app.getPath('temp'), 'cosmossh-drag-cache');
    if (fs.existsSync(dragCacheDir)) {
      fs.rmSync(dragCacheDir, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup failure
  }
}

function createWindow() {
  if (!store) {
    store = new AppStore();
  }

  mainWindow = new BrowserWindow({
    title: 'CosmoSSH',
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    backgroundColor: '#07090e',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://') || details.url.startsWith('http://')) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  registerIpcHandlers(
    () => mainWindow,
    store,
    sshService,
    sftpService,
    localFSService,
    hostMonitorService
  );
  bindWindowEvents(mainWindow);

  // Load Vite Dev Server in development or index.html in production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  cleanupTempDragCache();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  hostMonitorService.stopAll();
  sshService.disconnectAll();
  sftpService.disconnectAll();
  cleanupTempDragCache();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
