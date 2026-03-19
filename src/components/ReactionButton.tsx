'use client';

import { useState } from 'react';
import { REACTIONS, type ReactionType, type CustomReaction } from '@/types';

export default function ReactionButton({
  onReaction,
  customReaction,
}: {
  onReaction: (type: ReactionType | 'custom') => void;
  customReaction?: CustomReaction | null;
}) {
  const [cooldown, setCooldown] = useState<Record<string, boolean>>({});

  const handleClick = (type: ReactionType | 'custom') => {
    if (cooldown[type]) return;
    onReaction(type);
    setCooldown((prev) => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setCooldown((prev) => ({ ...prev, [type]: false }));
    }, 300);
  };

  return (
    <div className="grid grid-cols-3 gap-3 px-4">
      {(Object.entries(REACTIONS) as [ReactionType, typeof REACTIONS[ReactionType]][]).map(
        ([type, { emoji, label }]) => (
          <button
            key={type}
            onClick={() => handleClick(type)}
            disabled={cooldown[type]}
            className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 active:scale-90 transition-transform disabled:opacity-50 hover:bg-white/20"
          >
            <span className="text-5xl">{emoji}</span>
            <span className="text-sm text-white/70">{label}</span>
          </button>
        )
      )}
      {customReaction && (
        <button
          onClick={() => handleClick('custom')}
          disabled={cooldown['custom']}
          className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl bg-yellow-600/20 backdrop-blur-sm border border-yellow-500/30 active:scale-90 transition-transform disabled:opacity-50 hover:bg-yellow-600/30"
        >
          <span className="text-5xl">{customReaction.emoji}</span>
          <span className="text-sm text-yellow-300/80">{customReaction.label}</span>
        </button>
      )}
    </div>
  );
}
