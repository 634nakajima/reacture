const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
} = require('electron');
const path = require('path');
const { io } = require('socket.io-client');
const QRCode = require('qrcode');

let setupWindow = null;
let overlayWindow = null;
let tray = null;
let socket = null;

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 480,
    height: 580,
    resizable: false,
    frame: true,
    title: 'Reacture Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setupWindow.loadFile('setup.html');
  setupWindow.setMenuBarVisibility(false);

  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile('overlay.html');
  overlayWindow.hide();

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createRoom(serverUrl) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  console.log('[main] Creating room on', serverUrl);
  socket = io(serverUrl, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    console.log('[main] Socket connected, creating room...');
    socket.emit('room:create', (data) => {
      if (data && data.roomId) {
        console.log('[main] Room created:', data.roomId);
        if (setupWindow) {
          setupWindow.webContents.send('connection-result', {
            success: true,
            roomId: data.roomId,
          });
          // ルームコードを見せるために設定画面を最前面に
          setupWindow.setAlwaysOnTop(true);
          setupWindow.focus();
          // 少し待ってから最前面を解除（ユーザーが操作できるように）
          setTimeout(() => {
            if (setupWindow) setupWindow.setAlwaysOnTop(false);
          }, 1000);
        }
        if (overlayWindow) {
          overlayWindow.show();
        }
        setupSocketListeners();
      } else {
        console.error('[main] Failed to create room');
        if (setupWindow) {
          setupWindow.webContents.send('connection-result', {
            success: false,
            error: 'ルームの作成に失敗しました',
          });
        }
        socket.disconnect();
        socket = null;
      }
    });
  });

  socket.on('connect_error', (err) => {
    console.error('[main] Connection error:', err.message);
    if (setupWindow) {
      setupWindow.webContents.send('connection-result', {
        success: false,
        error: 'サーバーに接続できません',
      });
    }
    socket.disconnect();
    socket = null;
  });
}

function connectToRoom(serverUrl, roomId) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  console.log('[main] Connecting to', serverUrl, 'room', roomId);
  socket = io(serverUrl, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    console.log('[main] Socket connected, joining room...');
    socket.emit('room:join', { roomId }, (data) => {
      if (data && data.success) {
        console.log('[main] Joined room:', roomId);
        if (setupWindow) {
          setupWindow.webContents.send('connection-result', { success: true });
          setupWindow.hide();
        }
        if (overlayWindow) {
          overlayWindow.show();
        }
        setupSocketListeners();
      } else {
        console.error('[main] Failed to join:', data && data.error);
        if (setupWindow) {
          setupWindow.webContents.send('connection-result', {
            success: false,
            error: (data && data.error) || 'ルームが見つかりません',
          });
        }
        socket.disconnect();
        socket = null;
      }
    });
  });

  socket.on('connect_error', (err) => {
    console.error('[main] Connection error:', err.message);
    if (setupWindow) {
      setupWindow.webContents.send('connection-result', {
        success: false,
        error: 'サーバーに接続できません',
      });
    }
    socket.disconnect();
    socket = null;
  });
}

function setupSocketListeners() {
  socket.on('reaction:new', (reaction) => {
    if (overlayWindow) {
      overlayWindow.webContents.send('reaction', reaction);
    }
  });

  socket.on('comment:new', (comment) => {
    if (overlayWindow) {
      overlayWindow.webContents.send('comment', comment);
    }
  });

  socket.on('room:closed', () => {
    console.log('[main] Room closed');
    if (overlayWindow) {
      overlayWindow.webContents.send('room-closed');
      overlayWindow.hide();
    }
    if (setupWindow) {
      setupWindow.show();
      setupWindow.focus();
      setupWindow.webContents.send('connection-result', {
        success: false,
        error: 'ルームが閉じられました',
      });
    } else {
      createSetupWindow();
    }
    socket.disconnect();
    socket = null;
  });

  socket.on('connect_error', (err) => {
    console.error('[main] Connection error:', err.message);
    if (setupWindow) {
      setupWindow.webContents.send('connection-result', {
        success: false,
        error: 'サーバーに接続できません',
      });
    }
    socket.disconnect();
    socket = null;
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '..', 'public', 'logo.png')
  );
  const trayIcon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '設定画面を表示',
      click: () => {
        if (setupWindow) {
          setupWindow.show();
          setupWindow.focus();
        } else {
          createSetupWindow();
        }
      },
    },
    {
      label: 'オーバーレイ表示/非表示',
      click: () => {
        if (overlayWindow) {
          if (overlayWindow.isVisible()) {
            overlayWindow.hide();
          } else {
            overlayWindow.show();
          }
        }
      },
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Reacture Overlay');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createSetupWindow();
  createOverlayWindow();
  createTray();

  globalShortcut.register('CmdOrCtrl+Shift+R', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide();
      } else {
        overlayWindow.show();
      }
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (socket) {
    socket.disconnect();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.on('create-request', (_event, config) => {
  console.log('[main] Create request:', config);
  createRoom(config.serverUrl);
});

ipcMain.on('connect-request', (_event, config) => {
  console.log('[main] Connect request:', config);
  connectToRoom(config.serverUrl, config.roomId);
});

ipcMain.on('quit', () => {
  app.quit();
});

ipcMain.on('get-sound-path', (event, filename) => {
  event.returnValue = path.join(__dirname, 'sounds', filename);
});

ipcMain.handle('generate-qr', async (_event, text) => {
  return await QRCode.toDataURL(text, { width: 300, margin: 2 });
});

ipcMain.on('read-file-buffer', (event, filePath) => {
  try {
    const fs = require('fs');
    const buf = fs.readFileSync(filePath);
    // Uint8Array に変換して返す（シリアライズ可能）
    event.returnValue = buf.toJSON().data;
  } catch (e) {
    console.warn('[main] Failed to read file:', filePath, e);
    event.returnValue = null;
  }
});
