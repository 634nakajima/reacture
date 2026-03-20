const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // setup → main
  sendCreateRequest: (config) => ipcRenderer.send('create-request', config),
  sendConnectRequest: (config) => ipcRenderer.send('connect-request', config),
  onConnectionResult: (callback) =>
    ipcRenderer.on('connection-result', (_event, result) => callback(result)),

  // main → overlay
  onReaction: (callback) =>
    ipcRenderer.on('reaction', (_event, data) => callback(data)),
  onComment: (callback) =>
    ipcRenderer.on('comment', (_event, data) => callback(data)),
  onRoomClosed: (callback) =>
    ipcRenderer.on('room-closed', () => callback()),

  // QRコード（別ウィンドウ）
  openQRWindow: () => ipcRenderer.send('open-qr-window'),
  onQRData: (callback) =>
    ipcRenderer.on('qr-data', (_event, data) => callback(data)),

  // 音声ファイル
  getSoundPath: (filename) => ipcRenderer.sendSync('get-sound-path', filename),
  readFileBuffer: (filePath) => {
    const result = ipcRenderer.sendSync('read-file-buffer', filePath);
    return result;
  },

  // ルームを閉じる
  sendCloseRoom: () => ipcRenderer.send('close-room'),

  // オーバーレイ制御
  toggleOverlay: (visible) => ipcRenderer.send('overlay-toggle', visible),
  onOverlayState: (callback) =>
    ipcRenderer.on('overlay-state', (_event, visible) => callback(visible)),

  // ボリューム
  setVolume: (vol) => ipcRenderer.send('volume-change', vol),
  onVolumeChange: (callback) =>
    ipcRenderer.on('volume-changed', (_event, vol) => callback(vol)),

  // アンケート
  sendPollCreate: (data) => ipcRenderer.send('poll-create', data),
  sendPollEnd: (pollId) => ipcRenderer.send('poll-end', pollId),
  openPollWindow: () => ipcRenderer.send('open-poll-window'),
  onPollStarted: (callback) =>
    ipcRenderer.on('poll-started', (_event, data) => callback(data)),
  onPollUpdated: (callback) =>
    ipcRenderer.on('poll-updated', (_event, data) => callback(data)),
  onPollEnded: (callback) =>
    ipcRenderer.on('poll-ended', (_event, data) => callback(data)),

  // カスタムリアクション
  sendCustomReactionSet: (data) => ipcRenderer.send('custom-reaction-set', data),
  sendCustomReactionRemove: () => ipcRenderer.send('custom-reaction-remove'),
});
