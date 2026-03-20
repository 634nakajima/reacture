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

  // QRコード生成
  generateQR: (text) => ipcRenderer.invoke('generate-qr', text),

  // 音声ファイル
  getSoundPath: (filename) => ipcRenderer.sendSync('get-sound-path', filename),
  readFileBuffer: (filePath) => {
    const result = ipcRenderer.sendSync('read-file-buffer', filePath);
    return result;
  },
});
