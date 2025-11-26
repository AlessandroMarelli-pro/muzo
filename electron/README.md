# Muzo Desktop Application

This directory contains the Electron wrapper for the Muzo AI-powered music library organization desktop application.

## Overview

The Electron app provides a native desktop experience for Muzo, wrapping the React frontend in a desktop application with native OS integration, auto-updates, and enhanced file system access.

## Features

### 🖥️ **Native Desktop Integration**
- **Cross-platform**: Windows, macOS, and Linux support
- **Native menus**: Platform-specific application menus
- **File system access**: Direct integration with OS file dialogs
- **Auto-updates**: Automatic application updates
- **Native notifications**: OS-level notifications

### 🔧 **Development Features**
- **Hot reload**: Live reload during development
- **DevTools**: Integrated Chrome DevTools
- **TypeScript**: Full TypeScript support
- **ESLint**: Code quality and consistency

### 🚀 **Production Features**
- **Code signing**: Automatic code signing for distribution
- **Auto-updater**: Seamless application updates
- **Security**: Context isolation and secure IPC
- **Performance**: Optimized for desktop performance

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Frontend application built and running

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development**:
   ```bash
   npm run dev
   ```
   This will:
   - Start the frontend development server
   - Wait for the frontend to be ready
   - Launch the Electron app

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Create distribution packages**:
   ```bash
   npm run dist
   ```

### Scripts

- `npm run dev` - Start development with hot reload
- `npm run build` - Build the Electron app
- `npm run dist` - Create distribution packages
- `npm run pack` - Create unpacked distribution
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## Architecture

### Main Process (`src/main.ts`)
- **Window Management**: Creates and manages the main application window
- **Menu Setup**: Configures native application menus
- **Auto-updater**: Handles application updates
- **IPC Handlers**: Manages communication with renderer process
- **Security**: Implements security best practices

### Preload Script (`src/preload.ts`)
- **Context Bridge**: Secure communication between main and renderer
- **API Exposure**: Exposes safe Electron APIs to the renderer
- **Type Safety**: TypeScript definitions for exposed APIs

### Security Features
- **Context Isolation**: Prevents direct access to Node.js APIs
- **Node Integration**: Disabled for security
- **Remote Module**: Disabled for security
- **Web Security**: Enabled with secure defaults

## Configuration

### Electron Builder
The app is configured for cross-platform distribution:

- **macOS**: DMG packages for Intel and Apple Silicon
- **Windows**: NSIS installer with custom options
- **Linux**: AppImage for easy distribution

### Auto-updater
- **Check on startup**: Automatically checks for updates
- **Background updates**: Downloads updates in the background
- **User notifications**: Notifies users when updates are available

## Integration with Frontend

The Electron app integrates with the React frontend through:

1. **Development**: Loads from Vite dev server (`http://localhost:5173`)
2. **Production**: Loads from built frontend files
3. **IPC Communication**: Secure communication via context bridge
4. **Menu Integration**: Native menus trigger frontend actions

## File Structure

```
electron/
├── src/
│   ├── main.ts          # Main Electron process
│   └── preload.ts       # Preload script for secure IPC
├── package.json         # Electron app configuration
├── tsconfig.json        # TypeScript configuration
├── .eslintrc.js         # ESLint configuration
└── README.md           # This file
```

## Building and Distribution

### Development Build
```bash
npm run build
```

### Production Distribution
```bash
npm run dist
```

This creates platform-specific packages:
- **macOS**: `release/Muzo-1.0.0.dmg`
- **Windows**: `release/Muzo Setup 1.0.0.exe`
- **Linux**: `release/Muzo-1.0.0.AppImage`

### Code Signing
The app is configured for automatic code signing:
- **macOS**: Requires Apple Developer certificate
- **Windows**: Requires code signing certificate
- **Linux**: No code signing required

## Troubleshooting

### Common Issues

1. **Frontend not loading**: Ensure the frontend dev server is running
2. **Build failures**: Check that all dependencies are installed
3. **Permission errors**: Ensure proper file system permissions

### Debug Mode
Run with debug logging:
```bash
DEBUG=electron:* npm run dev
```

## Contributing

1. Follow the TypeScript and ESLint configurations
2. Ensure all IPC communication goes through the context bridge
3. Test on multiple platforms before submitting changes
4. Update documentation for any new features

## License

MIT License - see the main project LICENSE file for details.
