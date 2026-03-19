'use client';

import { useState, useEffect, useRef } from 'react';
import type { CommentEvent } from '@/types';

interface FlowingComment extends CommentEvent {
  y: number;
  createdAt: number;
  speed: number;
  flowId: string;
}

let flowCounter = 0;

export default function CommentFlow({
  comments,
}: {
  comments: CommentEvent[];
}) {
  const [flowing, setFlowing] = useState<FlowingComment[]>([]);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    const prevLen = prevLengthRef.current;
    const newItems = comments.slice(prevLen);
    prevLengthRef.current = comments.length;

    if (newItems.length === 0) return;

    const newFlowing = newItems.map((c) => ({
      ...c,
      y: 5 + Math.random() * 70,
      createdAt: Date.now(),
      speed: 5 + Math.random() * 3,
      flowId: `flow-${++flowCounter}`,
    }));

    setFlowing((prev) => [...prev.slice(-30), ...newFlowing]);
  }, [comments]);

  // 古いコメントを削除
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setFlowing((prev) => prev.filter((c) => now - c.createdAt < 15000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-30">
      {flowing.map((c) => (
        <div
          key={c.flowId}
          className="absolute whitespace-nowrap text-white text-2xl md:text-3xl font-bold animate-flow-left"
          style={{
            top: `${c.y}%`,
            left: '100%',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)',
            animationDuration: `${c.speed}s`,
          }}
        >
          {c.text}
        </div>
      ))}
    </div>
  );
}
