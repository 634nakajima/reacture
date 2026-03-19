'use client';

import type { Poll } from '@/types';

const BAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-pink-500',
  'bg-purple-500',
  'bg-cyan-500',
];

export default function PollResults({ poll }: { poll: Poll }) {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <div className="bg-black/60 backdrop-blur-md rounded-2xl p-14 w-full border border-white/10">
      <h3 className="text-white text-3xl font-bold mb-24">{poll.question}</h3>
      <div className="space-y-5">
        {poll.options.map((opt, i) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          return (
            <div key={i}>
              <div className="flex justify-between text-white text-xl mb-2">
                <span>{opt.text}</span>
                <span>
                  {pct}% ({opt.votes})
                </span>
              </div>
              <div className="h-12 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-white/50 text-lg mt-6 text-right">
        合計 {totalVotes}票
      </p>
    </div>
  );
}
