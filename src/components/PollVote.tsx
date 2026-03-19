'use client';

import { useState } from 'react';
import type { Poll } from '@/types';

export default function PollVote({
  poll,
  onVote,
}: {
  poll: Poll;
  onVote: (pollId: string, optionIndex: number) => void;
}) {
  const [voted, setVoted] = useState(false);

  const handleVote = (index: number) => {
    if (voted) return;
    onVote(poll.id, index);
    setVoted(true);
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
      <h3 className="text-white font-bold mb-3">📊 {poll.question}</h3>
      {voted ? (
        <p className="text-white/60 text-center py-4">投票しました ✓</p>
      ) : (
        <div className="space-y-2">
          {poll.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleVote(i)}
              className="w-full text-left px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-98 transition-all border border-white/10"
            >
              {opt.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
