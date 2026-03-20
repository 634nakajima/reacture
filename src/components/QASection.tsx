'use client';

import { useState } from 'react';
import type { Question } from '@/types';

export default function QASection({
  questions,
  onPost,
  onVote,
}: {
  questions: Question[];
  onPost: (text: string) => void;
  onVote: (questionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onPost(text.trim());
    setText('');
  };

  const handleVote = (questionId: string) => {
    if (votedIds.has(questionId)) return;
    onVote(questionId);
    setVotedIds((prev) => new Set(prev).add(questionId));
  };

  // いいね数降順、回答済みは下に
  const sorted = [...questions].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return b.votes - a.votes;
  });

  const unresolvedCount = questions.filter((q) => !q.resolved).length;

  return (
    <div className="px-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/15 transition-colors"
      >
        <span className="font-medium">
          Q&A
          {unresolvedCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/80 rounded-full">
              {unresolvedCount}
            </span>
          )}
        </span>
        <span className="text-white/40">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          {/* 質問投稿フォーム */}
          <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-b border-white/10">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="匿名で質問する..."
              maxLength={200}
              className="flex-1 px-3 py-2.5 rounded-lg bg-white/10 border border-white/15 text-white text-sm placeholder-white/40 focus:outline-none focus:border-blue-400/50"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium disabled:opacity-30 active:scale-95 transition-transform"
            >
              投稿
            </button>
          </form>

          {/* 質問一覧 */}
          <div className="max-h-64 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-6">
                まだ質問はありません
              </p>
            ) : (
              sorted.map((q) => (
                <div
                  key={q.id}
                  className={`flex items-start gap-3 px-3 py-3 border-b border-white/5 last:border-0 ${
                    q.resolved ? 'opacity-40' : ''
                  }`}
                >
                  {/* いいねボタン */}
                  <button
                    onClick={() => handleVote(q.id)}
                    disabled={votedIds.has(q.id) || q.resolved}
                    className={`flex items-center gap-1 min-w-[44px] pt-0.5 transition-colors ${
                      votedIds.has(q.id)
                        ? 'text-blue-400'
                        : 'text-white/40 hover:text-blue-400'
                    } disabled:cursor-default`}
                  >
                    <span className="text-base">👍</span>
                    <span className="text-sm font-bold">{q.votes}</span>
                  </button>

                  {/* 質問テキスト */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-relaxed break-words">
                      {q.text}
                    </p>
                    {q.resolved && (
                      <span className="text-xs text-green-400">✓ 回答済み</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
