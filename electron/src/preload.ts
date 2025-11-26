import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App information
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),

  // File operations
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: (options: any) => ipcRenderer.invoke('select-file', options),

  // Update operations
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Menu event listeners
  onMenuNewLibrary: (callback: () => void) => {
    ipcRenderer.on('menu-new-library', callback);
  },
  onMenuOpenLibrary: (callback: (path: string) => void) => {
    ipcRenderer.on('menu-open-library', (_event, path) => callback(path));
  },
  onMenuPreferences: (callback: () => void) => {
    ipcRenderer.on('menu-preferences', callback);
  },
  onMenuScanLibrary: (callback: () => void) => {
    ipcRenderer.on('menu-scan-library', callback);
  },
  onMenuAnalyzeTracks: (callback: () => void) => {
    ipcRenderer.on('menu-analyze-tracks', callback);
  },
  onMenuExportLibrary: (callback: () => void) => {
    ipcRenderer.on('menu-export-library', callback);
  },
  onMenuAbout: (callback: () => void) => {
    ipcRenderer.on('menu-about', callback);
  },

  // Update event listeners
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update-available', callback);
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback);
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getAppName: () => Promise<string>;
      selectDirectory: () => Promise<string | null>;
      selectFile: (options: any) => Promise<string | null>;
      installUpdate: () => Promise<void>;
      onMenuNewLibrary: (callback: () => void) => void;
      onMenuOpenLibrary: (callback: (path: string) => void) => void;
      onMenuPreferences: (callback: () => void) => void;
      onMenuScanLibrary: (callback: () => void) => void;
      onMenuAnalyzeTracks: (callback: () => void) => void;
      onMenuExportLibrary: (callback: () => void) => void;
      onMenuAbout: (callback: () => void) => void;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
