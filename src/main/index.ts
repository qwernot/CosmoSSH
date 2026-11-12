import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'path';
import { AppStore } from './store';
import { SSHService } from './ssh-service';
import { SFTPService } from './sftp-service';
import { registerIpcHandlers } from './ipc-handlers';

// Disable default menu
Menu.setApplicationMenu(null);

// Disable hardware acceleration issues in some Linux environments if needed
app.commandLine.appendSwitch('no-sandbox');

let mainWindow: BrowserWindow | null = null;

const store = new AppStore();
const sshService = new SSHService();
const sftpService = new SFTPService(sshService);

function createWindow() {
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
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  registerIpcHandlers(mainWindow, store, sshService, sftpService);

  // Load Vite Dev Server in development or index.html in production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
