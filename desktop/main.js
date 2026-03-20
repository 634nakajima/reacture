const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  Notification,
} = require('electron');
const path = require('path');
const { io } = require('socket.io-client');
const QRCode = require('qrcode');

let setupWindow = null;
let overlayWindow = null;
let qrWindow = null;
let pollWindow = null;
let qaWindow = null;
let tray = null;
let socket = null;
let currentVolume = 0.5;
let currentRoomId = null;
let overlayVisible = false;
let questions = [];

const WEB_URL = 'https://reacture-alpha.vercel.app';

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 560,
    height: 520,
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

  // ページ読み込み完了後、現在のルーム状態を復元
  setupWindow.webContents.on('did-finish-load', () => {
    if (currentRoomId && socket && socket.connected) {
      setupWindow.webContents.send('connection-result', {
        success: true,
        roomId: currentRoomId,
      });
    }
  });

  setupWindow.on('show', () => updateTrayMenu());
  setupWindow.on('hide', () => updateTrayMenu());
  setupWindow.on('closed', () => {
    setupWindow = null;
    updateTrayMenu();
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

function openQRWindow() {
  if (!currentRoomId) return;

  if (qrWindow) {
    qrWindow.focus();
    return;
  }

  qrWindow = new BrowserWindow({
    width: 800,
    height: 1000,
    resizable: false,
    frame: true,
    title: 'QRコード - Reacture',
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  qrWindow.setMenuBarVisibility(false);
  qrWindow.loadFile('qr-window.html');
  updateTrayMenu();

  qrWindow.webContents.on('did-finish-load', async () => {
    const joinUrl = WEB_URL + '/room/' + currentRoomId;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 600, margin: 2 });
    qrWindow.webContents.send('qr-data', {
      qrDataUrl,
      roomId: currentRoomId,
      joinUrl,
    });
  });

  qrWindow.on('closed', () => {
    qrWindow = null;
    updateTrayMenu();
  });
}

function openPollWindow() {
  if (pollWindow) {
    pollWindow.focus();
    return;
  }

  pollWindow = new BrowserWindow({
    width: 800,
    height: 1000,
    resizable: true,
    frame: true,
    title: 'アンケート - Reacture',
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  pollWindow.setMenuBarVisibility(false);
  pollWindow.loadFile('poll-window.html');

  pollWindow.on('closed', () => {
    pollWindow = null;
  });
}

function openQAWindow() {
  if (qaWindow) {
    qaWindow.focus();
    return;
  }

  qaWindow = new BrowserWindow({
    width: 700,
    height: 900,
    resizable: true,
    frame: true,
    title: 'Q&A - Reacture',
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  qaWindow.setMenuBarVisibility(false);
  qaWindow.loadFile('qa-window.html');
  updateTrayMenu();

  qaWindow.webContents.on('did-finish-load', () => {
    if (questions.length > 0) {
      const questionsForClient = questions.map(({ voters, ...q }) => q);
      qaWindow.webContents.send('qa-list', questionsForClient);
    }
  });

  qaWindow.on('closed', () => {
    qaWindow = null;
    updateTrayMenu();
  });
}

function closeQAWindow() {
  if (qaWindow) {
    qaWindow.close();
    qaWindow = null;
  }
}

function closePollWindow() {
  if (pollWindow) {
    pollWindow.close();
    pollWindow = null;
  }
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
        currentRoomId = data.roomId;
        console.log('[main] Room created:', data.roomId);
        if (setupWindow) {
          setupWindow.webContents.send('connection-result', {
            success: true,
            roomId: data.roomId,
          });
          setupWindow.setAlwaysOnTop(true);
          setupWindow.focus();
          setTimeout(() => {
            if (setupWindow) setupWindow.setAlwaysOnTop(false);
          }, 1000);
        }
        if (overlayWindow) {
          overlayWindow.show();
          overlayVisible = true;
          overlayWindow.webContents.send('volume-changed', currentVolume);
        }
        updateTrayMenu();
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
        currentRoomId = roomId;
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

  socket.on('poll:started', (data) => {
    console.log('[main] Poll started:', data);
    if (setupWindow) {
      setupWindow.webContents.send('poll-started', data);
    }
    // pollウィンドウを自動で開いてデータを送信
    if (!pollWindow) {
      openPollWindow();
    }
    // did-finish-load で送る場合とすでに開いている場合
    if (pollWindow) {
      const send = () => pollWindow.webContents.send('poll-started', data);
      if (pollWindow.webContents.isLoading()) {
        pollWindow.webContents.on('did-finish-load', send);
      } else {
        send();
      }
    }
  });

  socket.on('poll:updated', (data) => {
    console.log('[main] Poll updated:', data);
    if (pollWindow) {
      pollWindow.webContents.send('poll-updated', data);
    }
  });

  socket.on('poll:ended', (data) => {
    console.log('[main] Poll ended:', data);
    if (setupWindow) {
      setupWindow.webContents.send('poll-ended', data);
    }
    if (pollWindow) {
      pollWindow.webContents.send('poll-ended', data);
    }
  });

  // Q&A イベント
  socket.on('qa:list', (list) => {
    questions = list.map((q) => ({ ...q, voters: new Set() }));
    if (qaWindow) {
      qaWindow.webContents.send('qa-list', list);
    }
    broadcastQACount();
  });

  socket.on('qa:new', (question) => {
    questions.push({ ...question, voters: new Set() });
    if (qaWindow) {
      qaWindow.webContents.send('qa-new', question);
    }
    // オーバーレイにトースト通知
    if (overlayWindow && overlayVisible) {
      overlayWindow.webContents.send('qa-toast', question);
    }
    // macOS デスクトップ通知
    if (Notification.isSupported()) {
      const notif = new Notification({
        title: 'Q&A - 新しい質問',
        body: question.text.length > 80 ? question.text.slice(0, 80) + '...' : question.text,
        silent: true,
      });
      notif.on('click', () => {
        openQAWindow();
      });
      notif.show();
    }
    broadcastQACount();
  });

  socket.on('qa:updated', (data) => {
    const q = questions.find((q) => q.id === data.questionId);
    if (q) q.votes = data.votes;
    if (qaWindow) {
      qaWindow.webContents.send('qa-updated', data);
    }
  });

  socket.on('qa:resolved', (data) => {
    const q = questions.find((q) => q.id === data.questionId);
    if (q) q.resolved = data.resolved;
    if (qaWindow) {
      qaWindow.webContents.send('qa-resolved', data);
    }
    broadcastQACount();
  });

  socket.on('qa:deleted', (data) => {
    questions = questions.filter((q) => q.id !== data.questionId);
    if (qaWindow) {
      qaWindow.webContents.send('qa-deleted', data);
    }
    broadcastQACount();
  });

  socket.on('room:closed', () => {
    console.log('[main] Room closed');
    currentRoomId = null;
    updateTrayMenu();
    if (overlayWindow) {
      overlayWindow.webContents.send('room-closed');
      overlayWindow.hide();
    }
    closePollWindow();
    closeQAWindow();
    questions = [];
    if (qrWindow) {
      qrWindow.close();
      qrWindow = null;
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

function broadcastQACount() {
  const count = questions.filter((q) => !q.resolved).length;
  if (setupWindow) {
    setupWindow.webContents.send('qa-count', count);
  }
  updateTrayMenu();
}

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, 'logo.png')
  );
  const trayIcon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const menuItems = [];

  if (currentRoomId) {
    menuItems.push({
      label: `ルーム: ${currentRoomId}`,
      enabled: false,
    });
    menuItems.push({
      label: qrWindow ? 'QRコードを非表示' : 'QRコードを表示',
      click: () => {
        if (qrWindow) {
          qrWindow.close();
        } else {
          openQRWindow();
        }
      },
    });
    const qaCount = questions.filter((q) => !q.resolved).length;
    menuItems.push({
      label: qaWindow
        ? 'Q&Aを非表示'
        : `Q&Aを表示${qaCount > 0 ? `（${qaCount}件）` : ''}`,
      click: () => {
        if (qaWindow) {
          qaWindow.close();
        } else {
          openQAWindow();
        }
      },
    });
    menuItems.push({
      label: 'ルームを閉じる',
      click: () => {
        if (socket && currentRoomId) {
          socket.emit('room:close', { roomId: currentRoomId });
        }
        currentRoomId = null;
        overlayVisible = false;
        if (overlayWindow) overlayWindow.hide();
        closePollWindow();
        closeQAWindow();
        questions = [];
        if (qrWindow) { qrWindow.close(); qrWindow = null; }
        if (setupWindow) {
          setupWindow.show();
          setupWindow.focus();
          setupWindow.webContents.send('room-closed');
        }
        if (socket) {
          setTimeout(() => {
            if (socket) {
              socket.disconnect();
              socket = null;
            }
          }, 300);
        }
        updateTrayMenu();
      },
    });
    menuItems.push({ type: 'separator' });
  } else {
    menuItems.push({
      label: 'ルームを作成',
      click: () => {
        createRoom('https://reacture-server.onrender.com');
        // 設定画面も表示
        if (setupWindow) {
          setupWindow.show();
          setupWindow.focus();
        } else {
          createSetupWindow();
        }
      },
    });
    menuItems.push({ type: 'separator' });
  }

  const setupVisible = setupWindow && setupWindow.isVisible();
  menuItems.push({
    label: setupVisible ? '設定画面を非表示' : '設定画面を表示',
    click: () => {
      if (setupVisible) {
        setupWindow.hide();
        updateTrayMenu();
      } else if (setupWindow) {
        setupWindow.show();
        setupWindow.focus();
        updateTrayMenu();
      } else {
        createSetupWindow();
        updateTrayMenu();
      }
    },
  });

  if (currentRoomId) {
    menuItems.push({
      label: overlayVisible ? 'オーバーレイをOFF' : 'オーバーレイをON',
      click: () => {
        overlayVisible = !overlayVisible;
        if (overlayWindow) {
          if (overlayVisible) {
            overlayWindow.show();
          } else {
            overlayWindow.hide();
          }
        }
        if (setupWindow) {
          setupWindow.webContents.send('overlay-state', overlayVisible);
        }
        updateTrayMenu();
      },
    });
  }

  menuItems.push({ type: 'separator' });
  menuItems.push({
    label: '終了',
    click: () => {
      app.quit();
    },
  });

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setToolTip(currentRoomId ? `Reacture - ルーム ${currentRoomId}` : 'Reacture Overlay');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createSetupWindow();
  createOverlayWindow();
  createTray();

  globalShortcut.register('CmdOrCtrl+Shift+R', () => {
    if (overlayWindow) {
      overlayVisible = !overlayVisible;
      if (overlayVisible) {
        overlayWindow.show();
      } else {
        overlayWindow.hide();
      }
      if (setupWindow) {
        setupWindow.webContents.send('overlay-state', overlayVisible);
      }
      updateTrayMenu();
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

// ===== IPC handlers =====

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

ipcMain.on('read-file-buffer', (event, filePath) => {
  try {
    const fs = require('fs');
    const buf = fs.readFileSync(filePath);
    event.returnValue = buf.toJSON().data;
  } catch (e) {
    console.warn('[main] Failed to read file:', filePath, e);
    event.returnValue = null;
  }
});

// QRウィンドウを開く
ipcMain.on('open-qr-window', () => {
  openQRWindow();
});

// アンケートウィンドウを開く
ipcMain.on('open-poll-window', () => {
  openPollWindow();
});

// ルームを閉じる
ipcMain.on('close-room', () => {
  console.log('[main] Closing room');
  if (socket && currentRoomId) {
    socket.emit('room:close', { roomId: currentRoomId });
  }
  currentRoomId = null;
  overlayVisible = false;
  updateTrayMenu();
  if (socket) {
    // サーバーへの送信を確実にするため少し遅延して切断
    setTimeout(() => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    }, 300);
  }
  if (overlayWindow) {
    overlayWindow.hide();
  }
  closePollWindow();
  closeQAWindow();
  questions = [];
  if (qrWindow) {
    qrWindow.close();
    qrWindow = null;
  }
});

// オーバーレイ表示/非表示
ipcMain.on('overlay-toggle', (_event, visible) => {
  overlayVisible = visible;
  if (overlayWindow) {
    if (visible) {
      overlayWindow.show();
    } else {
      overlayWindow.hide();
    }
  }
  updateTrayMenu();
});

// ボリューム変更
ipcMain.on('volume-change', (_event, vol) => {
  currentVolume = vol;
  if (overlayWindow) {
    overlayWindow.webContents.send('volume-changed', vol);
  }
});

// アンケート作成
ipcMain.on('poll-create', (_event, data) => {
  if (socket && currentRoomId) {
    console.log('[main] Creating poll:', data);
    socket.emit('poll:create', { ...data, roomId: currentRoomId });
  }
});

// アンケート終了
ipcMain.on('poll-end', (_event, pollId) => {
  if (socket && currentRoomId) {
    console.log('[main] Ending poll:', pollId);
    socket.emit('poll:end', { pollId, roomId: currentRoomId });
  }
});

// カスタムリアクション設定
ipcMain.on('custom-reaction-set', (_event, data) => {
  if (socket && currentRoomId) {
    console.log('[main] Setting custom reaction:', data);
    socket.emit('custom-reaction:set', { ...data, roomId: currentRoomId });
  }
});

// カスタムリアクション解除
ipcMain.on('custom-reaction-remove', () => {
  if (socket && currentRoomId) {
    console.log('[main] Removing custom reaction');
    socket.emit('custom-reaction:remove', { roomId: currentRoomId });
  }
});

// Q&Aウィンドウを開く
ipcMain.on('open-qa-window', () => {
  openQAWindow();
});

// Q&A: 回答済みマーク
ipcMain.on('qa-resolve', (_event, questionId) => {
  if (socket && currentRoomId) {
    socket.emit('qa:resolve', { roomId: currentRoomId, questionId });
  }
});

// Q&A: 質問削除
ipcMain.on('qa-delete', (_event, questionId) => {
  if (socket && currentRoomId) {
    socket.emit('qa:delete', { roomId: currentRoomId, questionId });
  }
});
