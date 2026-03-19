'use client';

import { useState, useEffect, useRef } from 'react';
import type { ReactionEvent } from '@/types';

interface FloatingReaction extends ReactionEvent {
  x: number;
  createdAt: number;
  floatId: string;
}

let floatCounter = 0;

export default function ReactionOverlay({
  reactions,
}: {
  reactions: ReactionEvent[];
}) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    const prevLen = prevLengthRef.current;
    const newItems = reactions.slice(prevLen);
    prevLengthRef.current = reactions.length;

    if (newItems.length === 0) return;

    const newFloating = newItems.map((r) => ({
      ...r,
      x: 10 + Math.random() * 80,
      createdAt: Date.now(),
      floatId: `float-${++floatCounter}`,
    }));

    setFloating((prev) => [...prev.slice(-50), ...newFloating]);
  }, [reactions]);

  // 3秒後にアニメーション終了したものを削除
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setFloating((prev) => prev.filter((r) => now - r.createdAt < 3000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {floating.map((r) => (
        <span
          key={r.floatId}
          className="absolute text-4xl md:text-5xl animate-float-up"
          style={{
            left: `${r.x}%`,
            bottom: '-10%',
          }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
