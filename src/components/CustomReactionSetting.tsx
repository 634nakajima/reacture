'use client';

import { useState, useRef } from 'react';
import type { CustomReaction } from '@/types';

const EMOJI_PRESETS = ['🎉', '🔥', '💯', '⭐', '🙌', '💪', '🤔', '😂', '👀', '🫡', '✅', '❌'];

export default function CustomReactionSetting({
  current,
  onSet,
  onRemove,
}: {
  current: CustomReaction | null;
  onSet: (emoji: string, label: string, soundUrl: string) => void;
  onRemove: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [emoji, setEmoji] = useState(current?.emoji || '🎉');
  const [label, setLabel] = useState(current?.label || '');
  const [soundFile, setSoundFile] = useState<File | null>(null);
  const [soundUrl, setSoundUrl] = useState(current?.soundUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSoundFile(file);
    setSoundUrl(URL.createObjectURL(file));
  };

  const handleSubmit = () => {
    if (!emoji || !label.trim()) return;
    onSet(emoji, label.trim(), soundUrl);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2">
        {current ? (
          <>
            <span className="px-3 py-2 bg-yellow-600/50 text-white rounded-lg text-sm">
              {current.emoji} {current.label}
            </span>
            <button
              onClick={() => setIsOpen(true)}
              className="px-2 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
            >
              編集
            </button>
            <button
              onClick={onRemove}
              className="px-2 py-2 bg-white/10 text-white/50 rounded-lg text-sm hover:bg-red-600/50"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className="px-3 py-2 bg-yellow-600/80 text-white rounded-lg text-sm hover:bg-yellow-500"
          >
            ＋ カスタム
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setIsOpen(false)}>
      <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">カスタムリアクション</h3>

        {/* 絵文字選択 */}
        <div className="mb-4">
          <label className="text-sm text-white/50 mb-2 block">絵文字</label>
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_PRESETS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`text-2xl p-2 rounded-lg transition-colors ${
                  emoji === e ? 'bg-yellow-600/50 ring-2 ring-yellow-400' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="または直接入力"
            maxLength={2}
            className="mt-2 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-center text-xl focus:outline-none"
          />
        </div>

        {/* ラベル */}
        <div className="mb-4">
          <label className="text-sm text-white/50 mb-2 block">ラベル</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例: 正解！"
            maxLength={10}
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none"
          />
        </div>

        {/* 効果音 */}
        <div className="mb-5">
          <label className="text-sm text-white/50 mb-2 block">効果音（任意）</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
          >
            {soundFile ? soundFile.name : soundUrl ? '変更' : '音声ファイルを選択'}
          </button>
          {soundUrl && (
            <span className="ml-2 text-green-400 text-sm">設定済み</span>
          )}
        </div>

        {/* ボタン */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-white/50 text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!emoji || !label.trim()}
            className="px-5 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium disabled:opacity-30"
          >
            設定
          </button>
        </div>
      </div>
    </div>
  );
}
