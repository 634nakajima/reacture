'use client';

import { useState } from 'react';

export default function CommentInput({
  onSubmit,
}: {
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 px-4">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="コメントを入力..."
        maxLength={100}
        className="flex-1 px-4 py-4 text-lg rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/50"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="px-6 py-4 text-lg rounded-full bg-blue-500 text-white font-medium disabled:opacity-30 active:scale-95 transition-transform"
      >
        送信
      </button>
    </form>
  );
}
