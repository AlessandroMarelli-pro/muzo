import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as isDev from 'electron-is-dev';

// Keep a global reference of the window object (unused but kept for reference)
// let mainWindow: BrowserWindow | null = null;

// Enable live reload for development
if (isDev) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

// Enable auto-updater logging
if (autoUpdater.logger) {
  // Note: electron-log types may not be fully compatible
  (autoUpdater.logger as any).transports.file.level = 'info';
}

class MuzoApp {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    // This method will be called when Electron has finished initialization
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupMenu();
      this.setupAutoUpdater();
      this.setupIpcHandlers();

      app.on('activate', () => {
        // On macOS, re-create a window when the dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Quit when all windows are closed
    app.on('window-all-closed', () => {
      // On macOS, keep the app running even when all windows are closed
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (_event, contents) => {
      contents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      });
    });
  }

  private createMainWindow(): void {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false, // Don't show until ready
      icon: this.getAppIcon()
    });

    // Load the app
    this.loadApp();

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      
      // Focus on the window
      if (this.mainWindow) {
        this.mainWindow.focus();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Development tools
    if (isDev) {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private loadApp(): void {
    if (isDev) {
      // Development: Load from Vite dev server
      this.mainWindow?.loadURL('http://localhost:5173');
    } else {
      // Production: Load from built frontend
      this.mainWindow?.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Library',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-library');
            }
          },
          {
            label: 'Open Library',
            accelerator: 'CmdOrCtrl+O',
            click: async () => {
              const result = await dialog.showOpenDialog(this.mainWindow!, {
                properties: ['openDirectory'],
                title: 'Select Music Library Directory'
              });
              
              if (!result.canceled && result.filePaths.length > 0) {
                this.mainWindow?.webContents.send('menu-open-library', result.filePaths[0]);
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Preferences',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              this.mainWindow?.webContents.send('menu-preferences');
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Library',
        submenu: [
          {
            label: 'Scan Library',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow?.webContents.send('menu-scan-library');
            }
          },
          {
            label: 'Analyze Tracks',
            accelerator: 'CmdOrCtrl+A',
            click: () => {
              this.mainWindow?.webContents.send('menu-analyze-tracks');
            }
          },
          { type: 'separator' },
          {
            label: 'Export Library',
            accelerator: 'CmdOrCtrl+E',
            click: () => {
              this.mainWindow?.webContents.send('menu-export-library');
            }
          }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About Muzo',
            click: () => {
              this.mainWindow?.webContents.send('menu-about');
            }
          },
          {
            label: 'Documentation',
            click: () => {
              shell.openExternal('https://github.com/AlessandroMarelli-pro/muzo');
            }
          },
          {
            label: 'Report Issue',
            click: () => {
              shell.openExternal('https://github.com/AlessandroMarelli-pro/muzo/issues');
            }
          }
        ]
      }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          {
            label: 'About Muzo',
            click: () => {
              this.mainWindow?.webContents.send('menu-about');
            }
          },
          { type: 'separator' },
          {
            label: 'Services',
            role: 'services'
          },
          { type: 'separator' },
          {
            label: 'Hide Muzo',
            accelerator: 'Command+H',
            role: 'hide'
          },
          {
            label: 'Hide Others',
            accelerator: 'Command+Shift+H',
            role: 'hideOthers'
          },
          {
            label: 'Show All',
            role: 'unhide'
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: 'Command+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupAutoUpdater(): void {
    // Check for updates on startup
    autoUpdater.checkForUpdatesAndNotify();

    // Handle update events
    autoUpdater.on('update-available', () => {
      this.mainWindow?.webContents.send('update-available');
    });

    autoUpdater.on('update-downloaded', () => {
      this.mainWindow?.webContents.send('update-downloaded');
    });

    autoUpdater.on('error', (error) => {
      this.mainWindow?.webContents.send('update-error', error.message);
    });
  }

  private setupIpcHandlers(): void {
    // Handle update installation
    ipcMain.handle('install-update', () => {
      autoUpdater.quitAndInstall();
    });

    // Handle file operations
    ipcMain.handle('select-directory', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openDirectory'],
        title: 'Select Directory'
      });
      
      return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('select-file', async (_event, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        ...options,
        properties: ['openFile']
      });
      
      return result.canceled ? null : result.filePaths[0];
    });

    // Handle app info
    ipcMain.handle('get-app-version', () => {
      return app.getVersion();
    });

    ipcMain.handle('get-app-name', () => {
      return app.getName();
    });
  }

  private getAppIcon(): string {
    const iconPath = path.join(__dirname, '../assets');
    
    switch (process.platform) {
      case 'darwin':
        return path.join(iconPath, 'icon.icns');
      case 'win32':
        return path.join(iconPath, 'icon.ico');
      default:
        return path.join(iconPath, 'icon.png');
    }
  }
}

// Initialize the app
new MuzoApp();
