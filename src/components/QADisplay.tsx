'use client';

import type { Question } from '@/types';

export default function QADisplay({
  questions,
  onResolve,
  onDelete,
  onClose,
}: {
  questions: Question[];
  onResolve: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  onClose: () => void;
}) {
  // 未回答をいいね数降順、回答済みは下に
  const sorted = [...questions].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return b.votes - a.votes;
  });

  const unresolvedCount = questions.filter((q) => !q.resolved).length;
  const totalCount = questions.length;

  return (
    <div className="bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 w-[700px] max-h-[80vh] flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">Q&A</span>
          <span className="text-white/50 text-lg">
            {unresolvedCount > 0 && (
              <span className="text-blue-400 font-bold">{unresolvedCount}件</span>
            )}
            {unresolvedCount > 0 && totalCount > unresolvedCount && (
              <span className="text-white/30 ml-1">/ {totalCount}件</span>
            )}
            {unresolvedCount === 0 && totalCount > 0 && (
              <span className="text-white/30">{totalCount}件（すべて回答済み）</span>
            )}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full text-white text-xl flex items-center justify-center transition-colors"
        >
          ✕
        </button>
      </div>

      {/* 質問リスト */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sorted.length === 0 ? (
          <div className="text-center text-white/30 py-16">
            <p className="text-4xl mb-4">💬</p>
            <p className="text-xl">まだ質問はありません</p>
            <p className="text-sm mt-2">学生がQ&Aから質問を投稿するとここに表示されます</p>
          </div>
        ) : (
          sorted.map((q) => (
            <div
              key={q.id}
              className={`flex items-start gap-4 px-4 py-4 mx-2 my-1 rounded-xl transition-all ${
                q.resolved
                  ? 'bg-white/3 opacity-50'
                  : 'bg-white/5 hover:bg-white/8'
              }`}
            >
              {/* いいね数 */}
              <div className="flex items-center gap-1.5 min-w-[60px] pt-1">
                <span className="text-2xl">👍</span>
                <span className="text-white font-bold text-2xl">{q.votes}</span>
              </div>

              {/* 質問テキスト */}
              <div className="flex-1 min-w-0 pt-1">
                <p className={`text-xl leading-relaxed break-words ${
                  q.resolved ? 'text-white/50 line-through' : 'text-white'
                }`}>
                  {q.text}
                </p>
              </div>

              {/* アクションボタン */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onResolve(q.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    q.resolved
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-white/10 text-white/60 hover:bg-green-500/20 hover:text-green-400'
                  }`}
                >
                  {q.resolved ? '✓ 済' : '回答済み'}
                </button>
                <button
                  onClick={() => onDelete(q.id)}
                  className="px-2 py-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5l-1-1h-5l-1 1H5v2h14V4h-3.5z"/></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
