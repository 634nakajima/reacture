'use client';

const audioCache = new Map<string, AudioBuffer>();
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

async function loadSound(url: string): Promise<AudioBuffer> {
  const cached = audioCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  audioCache.set(url, audioBuffer);
  return audioBuffer;
}

// Throttle: 同じ音は最低100msの間隔を空ける
const lastPlayedAt = new Map<string, number>();
const THROTTLE_MS = 100;

export async function playSound(url: string, volume: number = 0.5): Promise<void> {
  const now = Date.now();
  const last = lastPlayedAt.get(url) || 0;
  if (now - last < THROTTLE_MS) return;
  lastPlayedAt.set(url, now);

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const buffer = await loadSound(url);
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    source.buffer = buffer;
    // ピッチをランダムに ±5% 変化させる
    source.playbackRate.value = 0.95 + Math.random() * 0.1;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
  } catch (e) {
    console.warn('Failed to play sound:', e);
  }
}

// 効果音をプリロード
export async function preloadSounds(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map((url) => loadSound(url)));
}

// ユーザー操作時に呼んでAudioContextを有効化
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}
