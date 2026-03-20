const serverUrlInput = document.getElementById('serverUrl');
const createBtn = document.getElementById('createBtn');
const statusEl = document.getElementById('status');
const createdRoomIdEl = document.getElementById('createdRoomId');
const controlsRow = document.getElementById('controlsRow');
const toolsRow = document.getElementById('toolsRow');
const volumeRow = document.getElementById('volumeRow');
const qrBtn = document.getElementById('qrBtn');

// オーバーレイ
const overlayToggleBtn = document.getElementById('overlayToggleBtn');

// ボリューム
const volumeSlider = document.getElementById('volumeSlider');
const volumeIcon = document.getElementById('volumeIcon');

// アンケートモーダル
const pollModal = document.getElementById('pollModal');
const pollOpenBtn = document.getElementById('pollOpenBtn');
const pollFormView = document.getElementById('pollFormView');
const pollActiveView = document.getElementById('pollActiveView');
const pollQuestion = document.getElementById('pollQuestion');
const pollOptions = document.getElementById('pollOptions');
const pollAddBtn = document.getElementById('pollAddBtn');
const pollCancelBtn = document.getElementById('pollCancelBtn');
const pollSubmitBtn = document.getElementById('pollSubmitBtn');
const pollActiveQuestion = document.getElementById('pollActiveQuestion');
const pollEndBtn = document.getElementById('pollEndBtn');
const pollActiveCloseBtn = document.getElementById('pollActiveCloseBtn');

// カスタムリアクションモーダル
const customModal = document.getElementById('customModal');
const customOpenBtn = document.getElementById('customOpenBtn');
const customEmoji = document.getElementById('customEmoji');
const customLabel = document.getElementById('customLabel');
const customSetBtn = document.getElementById('customSetBtn');
const customRemoveBtn = document.getElementById('customRemoveBtn');
const customCloseBtn = document.getElementById('customCloseBtn');

// Q&A
const qaOpenBtn = document.getElementById('qaOpenBtn');
const qaBadge = document.getElementById('qaBadge');

let currentRoomId = null;
let overlayVisible = true;
let currentVolume = 0.5;
let volumeBeforeMute = 0.5;
let activePollId = null;

// ===== ルーム作成 / 閉じる =====
createBtn.addEventListener('click', () => {
  if (currentRoomId) {
    window.electronAPI.sendCloseRoom();
    resetToInitial();
    return;
  }

  const serverUrl = serverUrlInput.value.trim();
  if (!serverUrl) return;

  createBtn.disabled = true;
  createBtn.textContent = '作成中...';
  statusEl.textContent = '';
  statusEl.className = 'status';

  window.electronAPI.sendCreateRequest({ serverUrl });
});

function resetToInitial() {
  currentRoomId = null;
  createdRoomIdEl.textContent = '----';
  createdRoomIdEl.classList.add('empty');
  createBtn.textContent = 'ルームを作成';
  createBtn.className = 'btn';
  createBtn.disabled = false;
  controlsRow.classList.add('hidden');
  toolsRow.classList.add('hidden');
  volumeRow.classList.add('hidden');
  statusEl.textContent = '';
  statusEl.className = 'status';
  activePollId = null;
  overlayVisible = true;
  updateOverlayBtn();
}

// トレイメニューからルームを閉じた場合
window.electronAPI.onRoomClosed(() => {
  resetToInitial();
});

// ===== メインプロセスからの接続結果 =====
window.electronAPI.onConnectionResult((result) => {
  console.log('[setup] Received result:', result);
  if (result.success && result.roomId) {
    currentRoomId = result.roomId;
    createdRoomIdEl.textContent = result.roomId;
    createdRoomIdEl.classList.remove('empty');
    statusEl.textContent = '';
    statusEl.className = 'status';

    createBtn.textContent = 'ルームを閉じる';
    createBtn.className = 'btn btn-danger';
    createBtn.disabled = false;

    controlsRow.classList.remove('hidden');
    toolsRow.classList.remove('hidden');
    volumeRow.classList.remove('hidden');
  } else {
    statusEl.textContent = result.error || '接続に失敗しました';
    statusEl.className = 'status error';
    createBtn.textContent = 'ルームを作成';
    createBtn.className = 'btn';
    createBtn.disabled = false;
  }
});

// ===== QRコード（別ウィンドウ） =====
qrBtn.addEventListener('click', () => {
  if (!currentRoomId) return;
  window.electronAPI.openQRWindow();
});

// ===== オーバーレイ表示/非表示 =====
overlayToggleBtn.addEventListener('click', () => {
  overlayVisible = !overlayVisible;
  window.electronAPI.toggleOverlay(overlayVisible);
  updateOverlayBtn();

  if (!overlayVisible) {
    volumeBeforeMute = currentVolume;
    currentVolume = 0;
    volumeSlider.value = 0;
    updateVolumeIcon();
    window.electronAPI.setVolume(0);
  } else {
    currentVolume = volumeBeforeMute;
    volumeSlider.value = currentVolume;
    updateVolumeIcon();
    window.electronAPI.setVolume(currentVolume);
  }
});

function updateOverlayBtn() {
  if (overlayVisible) {
    overlayToggleBtn.textContent = 'オーバーレイ ON';
    overlayToggleBtn.className = 'btn btn-toggle active';
  } else {
    overlayToggleBtn.textContent = 'オーバーレイ OFF';
    overlayToggleBtn.className = 'btn btn-toggle inactive';
  }
}

// トレイメニューやショートカットからの状態変更を受け取る
window.electronAPI.onOverlayState((visible) => {
  overlayVisible = visible;
  updateOverlayBtn();

  if (!visible) {
    volumeBeforeMute = currentVolume;
    currentVolume = 0;
    volumeSlider.value = 0;
    updateVolumeIcon();
    window.electronAPI.setVolume(0);
  } else {
    currentVolume = volumeBeforeMute;
    volumeSlider.value = currentVolume;
    updateVolumeIcon();
    window.electronAPI.setVolume(currentVolume);
  }
});

// ===== ボリューム =====
volumeSlider.addEventListener('input', () => {
  currentVolume = parseFloat(volumeSlider.value);
  updateVolumeIcon();
  window.electronAPI.setVolume(currentVolume);
});

volumeIcon.addEventListener('click', () => {
  if (currentVolume > 0) {
    volumeBeforeMute = currentVolume;
    currentVolume = 0;
  } else {
    currentVolume = volumeBeforeMute || 0.5;
  }
  volumeSlider.value = currentVolume;
  updateVolumeIcon();
  window.electronAPI.setVolume(currentVolume);
});

function updateVolumeIcon() {
  if (currentVolume === 0) {
    volumeIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63z"/><path d="M2.1 2.1L.69 3.51l4.8 4.8L5 9H1v6h4l5 5v-6.59l4.45 4.45c-.7.54-1.51.96-2.45 1.18v2.06c1.52-.32 2.89-1.02 4.01-2.01l2.48 2.48 1.41-1.41L2.1 2.1z"/></svg>';
  } else if (currentVolume < 0.3) {
    volumeIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>';
  } else if (currentVolume < 0.7) {
    volumeIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
  } else {
    volumeIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
  }
}

// ===== アンケートモーダル（作成のみ） =====
pollOpenBtn.addEventListener('click', () => {
  if (activePollId) {
    // 投票中なら別ウィンドウを開く
    window.electronAPI.openPollWindow();
    return;
  }
  pollFormView.classList.remove('hidden');
  pollActiveView.classList.add('hidden');
  pollModal.classList.add('show');
});

pollCancelBtn.addEventListener('click', () => {
  pollModal.classList.remove('show');
  resetPollForm();
});

pollModal.addEventListener('click', (e) => {
  if (e.target === pollModal) {
    pollModal.classList.remove('show');
  }
});

pollAddBtn.addEventListener('click', () => {
  const count = pollOptions.querySelectorAll('.poll-option-row').length;
  if (count >= 6) return;
  const row = document.createElement('div');
  row.className = 'poll-option-row';
  row.innerHTML = `<input class="poll-input" placeholder="選択肢 ${count + 1}" /><button class="poll-remove-btn">✕</button>`;
  row.querySelector('.poll-remove-btn').addEventListener('click', () => {
    row.remove();
    renumberOptions();
  });
  pollOptions.appendChild(row);
});

pollSubmitBtn.addEventListener('click', () => {
  const question = pollQuestion.value.trim();
  if (!question) return;
  const options = [];
  pollOptions.querySelectorAll('.poll-option-row input').forEach((input) => {
    const val = input.value.trim();
    if (val) options.push(val);
  });
  if (options.length < 2) return;

  window.electronAPI.sendPollCreate({ question, options });
  pollModal.classList.remove('show');
});

pollEndBtn.addEventListener('click', () => {
  if (activePollId) {
    window.electronAPI.sendPollEnd(activePollId);
  }
});

pollActiveCloseBtn.addEventListener('click', () => {
  pollModal.classList.remove('show');
});

function resetPollForm() {
  pollQuestion.value = '';
  pollOptions.innerHTML =
    '<div class="poll-option-row"><input class="poll-input" placeholder="選択肢 1" /></div>' +
    '<div class="poll-option-row"><input class="poll-input" placeholder="選択肢 2" /></div>';
}

function renumberOptions() {
  pollOptions.querySelectorAll('.poll-option-row input').forEach((input, i) => {
    input.placeholder = `選択肢 ${i + 1}`;
  });
}

window.electronAPI.onPollStarted((data) => {
  activePollId = data.id;
  pollOpenBtn.textContent = '投票受付中';
  pollModal.classList.remove('show');
});

window.electronAPI.onPollEnded(() => {
  activePollId = null;
  pollOpenBtn.textContent = 'アンケート';
  resetPollForm();
});

// ===== カスタムリアクションモーダル =====
customOpenBtn.addEventListener('click', () => {
  customModal.classList.add('show');
});

customCloseBtn.addEventListener('click', () => {
  customModal.classList.remove('show');
});

customModal.addEventListener('click', (e) => {
  if (e.target === customModal) {
    customModal.classList.remove('show');
  }
});

customSetBtn.addEventListener('click', () => {
  const emoji = customEmoji.value.trim();
  const label = customLabel.value.trim();
  if (!emoji) return;

  window.electronAPI.sendCustomReactionSet({ emoji, label: label || emoji });
  customRemoveBtn.classList.remove('hidden');
  customModal.classList.remove('show');
  statusEl.textContent = `カスタムリアクション「${emoji}」を設定しました`;
  statusEl.className = 'status success';
});

customRemoveBtn.addEventListener('click', () => {
  window.electronAPI.sendCustomReactionRemove();
  customEmoji.value = '';
  customLabel.value = '';
  customRemoveBtn.classList.add('hidden');
  customModal.classList.remove('show');
  statusEl.textContent = 'カスタムリアクションを解除しました';
  statusEl.className = 'status success';
});

// ===== Q&A =====
qaOpenBtn.addEventListener('click', () => {
  window.electronAPI.openQAWindow();
});

window.electronAPI.onQACount((count) => {
  if (count > 0) {
    qaBadge.textContent = count;
    qaBadge.style.display = 'inline-block';
  } else {
    qaBadge.style.display = 'none';
  }
});
