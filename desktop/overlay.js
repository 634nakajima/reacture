const reactionsContainer = document.getElementById('reactions');
const commentsContainer = document.getElementById('comments');

// ===== リアクション定義 =====
const REACTIONS = {
  clap: { emoji: '👏', sound: 'clap.mp3' },
  smile: { emoji: '😄', sound: 'laugh.mp3' },
  heart: { emoji: '❤️', sound: 'chime.mp3' },
  wow: { emoji: '😮', sound: 'wow.mp3' },
  question: { emoji: '❓', sound: 'question.mp3' },
  thumbsup: { emoji: '👍', sound: 'pop.mp3' },
};

// ===== 音声システム =====
const audioCache = new Map();
let audioContext = null;
let volume = 0.5;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

async function loadSound(filePath) {
  const cached = audioCache.get(filePath);
  if (cached) return cached;

  try {
    const data = window.electronAPI.readFileBuffer(filePath);
    if (!data) return null;
    const arrayBuffer = new Uint8Array(data).buffer;
    const ctx = getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioCache.set(filePath, audioBuffer);
    return audioBuffer;
  } catch (e) {
    console.warn('Failed to load sound:', filePath, e);
    return null;
  }
}

const lastPlayedAt = new Map();
const THROTTLE_MS = 100;

async function playSound(filePath) {
  if (volume === 0) return; // ミュート時は再生しない

  const now = Date.now();
  const last = lastPlayedAt.get(filePath) || 0;
  if (now - last < THROTTLE_MS) return;
  lastPlayedAt.set(filePath, now);

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const buffer = await loadSound(filePath);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    source.buffer = buffer;
    source.playbackRate.value = 0.95 + Math.random() * 0.1;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
  } catch (e) {
    console.warn('Failed to play sound:', e);
  }
}

function preloadAllSounds() {
  for (const key of Object.keys(REACTIONS)) {
    const filePath = window.electronAPI.getSoundPath(REACTIONS[key].sound);
    loadSound(filePath);
  }
}

// ===== リアクション表示 =====
let reactionCount = 0;

function showReaction(emoji) {
  if (reactionCount >= 50) return;

  const el = document.createElement('span');
  el.textContent = emoji;
  el.className = 'floating-reaction';
  el.style.left = (10 + Math.random() * 80) + '%';
  reactionsContainer.appendChild(el);
  reactionCount++;

  setTimeout(() => {
    el.remove();
    reactionCount--;
  }, 3000);
}

// ===== コメント表示 =====
let commentCount = 0;

function showComment(text) {
  if (commentCount >= 30) return;

  const el = document.createElement('div');
  el.textContent = text;
  el.className = 'flowing-comment';
  el.style.top = (5 + Math.random() * 70) + '%';
  const speed = 5 + Math.random() * 3;
  el.style.animationDuration = speed + 's';
  commentsContainer.appendChild(el);
  commentCount++;

  setTimeout(() => {
    el.remove();
    commentCount--;
  }, (speed + 2) * 1000);
}

// ===== メインプロセスからのイベントを受け取る =====
window.electronAPI.onReaction((reaction) => {
  showReaction(reaction.emoji);

  const reactionDef = REACTIONS[reaction.type];
  if (reactionDef) {
    const filePath = window.electronAPI.getSoundPath(reactionDef.sound);
    playSound(filePath);
  }
});

window.electronAPI.onComment((comment) => {
  showComment(comment.text);
});

window.electronAPI.onRoomClosed(() => {
  // メインプロセスが処理するので特に何もしない
});

// ボリューム変更を受け取る
window.electronAPI.onVolumeChange((vol) => {
  volume = vol;
});

// 起動時にプリロード
preloadAllSounds();
