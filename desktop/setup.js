const serverUrlInput = document.getElementById('serverUrl');
const createBtn = document.getElementById('createBtn');
const statusEl = document.getElementById('status');
const createdRoomIdEl = document.getElementById('createdRoomId');
const qrBtn = document.getElementById('qrBtn');
const qrOverlay = document.getElementById('qrOverlay');
const qrImage = document.getElementById('qrImage');
const qrRoomCode = document.getElementById('qrRoomCode');
const qrUrl = document.getElementById('qrUrl');
const qrCloseBtn = document.getElementById('qrCloseBtn');

let currentRoomId = null;
const WEB_URL = 'https://reacture-alpha.vercel.app';

// ルーム作成
createBtn.addEventListener('click', () => {
  const serverUrl = serverUrlInput.value.trim();
  if (!serverUrl) return;

  createBtn.disabled = true;
  createBtn.textContent = '作成中...';
  statusEl.textContent = '';
  statusEl.className = 'status';

  window.electronAPI.sendCreateRequest({ serverUrl });
});

// QRコード表示
qrBtn.addEventListener('click', () => {
  if (!currentRoomId) return;
  const joinUrl = WEB_URL + '/room/' + currentRoomId;

  qrRoomCode.textContent = currentRoomId;
  qrUrl.textContent = joinUrl;

  window.electronAPI.generateQR(joinUrl).then((dataUrl) => {
    qrImage.src = dataUrl;
    qrOverlay.classList.add('show');
  });
});

// QRモーダルを閉じる
qrCloseBtn.addEventListener('click', () => {
  qrOverlay.classList.remove('show');
});

qrOverlay.addEventListener('click', (e) => {
  if (e.target === qrOverlay) {
    qrOverlay.classList.remove('show');
  }
});

// メインプロセスからの接続結果
window.electronAPI.onConnectionResult((result) => {
  if (result.success && result.roomId) {
    currentRoomId = result.roomId;
    createdRoomIdEl.textContent = result.roomId;
    createdRoomIdEl.classList.remove('empty');
    statusEl.textContent = 'オーバーレイ起動中';
    statusEl.className = 'status success';
    createBtn.textContent = 'ルームを作成';
    createBtn.disabled = false;
    qrBtn.style.display = 'block';
  } else {
    statusEl.textContent = result.error || '接続に失敗しました';
    statusEl.className = 'status error';
    createBtn.textContent = 'ルームを作成';
    createBtn.disabled = false;
  }
});
