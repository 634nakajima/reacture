'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { getSocket, cleanupSocket } from '@/lib/socket';
import ReactionButton from '@/components/ReactionButton';
import CommentInput from '@/components/CommentInput';
import PollVote from '@/components/PollVote';
import QASection from '@/components/QASection';
import type { ReactionType, Poll, CustomReaction, Question } from '@/types';
import { REACTIONS } from '@/types';

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = use(params);
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [customReaction, setCustomReaction] = useState<CustomReaction | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    cleanupSocket();
    const socket = getSocket();
    socket.connect();

    socket.emit(
      'room:join',
      { roomId },
      (data: { success: boolean; error?: string; userCount?: number }) => {
        if (data.success) {
          setConnected(true);
          setUserCount(data.userCount || 0);
        } else {
          setError(data.error || '接続エラー');
        }
      }
    );

    socket.on('room:user-count', (data: { count: number }) => {
      setUserCount(data.count);
    });

    socket.on('poll:started', (poll: Poll) => {
      setActivePoll(poll);
    });

    socket.on('poll:ended', () => {
      setActivePoll(null);
    });

    socket.on('custom-reaction:updated', (data: CustomReaction | null) => {
      setCustomReaction(data);
    });

    // Q&A
    socket.on('qa:list', (list: Question[]) => {
      setQuestions(list);
    });

    socket.on('qa:new', (question: Question) => {
      setQuestions((prev) => [...prev, question]);
    });

    socket.on('qa:updated', (data: { questionId: string; votes: number }) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === data.questionId ? { ...q, votes: data.votes } : q))
      );
    });

    socket.on('qa:resolved', (data: { questionId: string; resolved: boolean }) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === data.questionId ? { ...q, resolved: data.resolved } : q))
      );
    });

    socket.on('qa:deleted', (data: { questionId: string }) => {
      setQuestions((prev) => prev.filter((q) => q.id !== data.questionId));
    });

    socket.on('room:closed', () => {
      setError('ルームが閉じられました');
      setConnected(false);
    });

    return () => {
      cleanupSocket();
    };
  }, [roomId]);

  const handleReaction = useCallback(
    (type: ReactionType | 'custom') => {
      const socket = getSocket();
      if (type === 'custom' && customReaction) {
        socket.emit('reaction', { roomId, type: 'custom', emoji: customReaction.emoji });
      } else {
        const reaction = REACTIONS[type as ReactionType];
        if (reaction) {
          socket.emit('reaction', { roomId, type, emoji: reaction.emoji });
        }
      }
    },
    [roomId, customReaction]
  );

  const handleComment = useCallback(
    (text: string) => {
      const socket = getSocket();
      socket.emit('comment', { roomId, text });
    },
    [roomId]
  );

  const handleVote = useCallback(
    (pollId: string, optionIndex: number) => {
      const socket = getSocket();
      socket.emit('poll:vote', { roomId, pollId, optionIndex });
    },
    [roomId]
  );

  const handleQAPost = useCallback(
    (text: string) => {
      const socket = getSocket();
      socket.emit('qa:post', { roomId, text });
    },
    [roomId]
  );

  const handleQAVote = useCallback(
    (questionId: string) => {
      const socket = getSocket();
      socket.emit('qa:vote', { roomId, questionId });
    },
    [roomId]
  );

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <a href="/" className="text-blue-400 underline">
            トップに戻る
          </a>
        </div>
      </main>
    );
  }

  if (!connected) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-white/60">接続中...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors"><img src="/logo.png" alt="トップに戻る" className="w-8 h-8" /></a>
          <div>
            <span className="text-base text-white/50">ルーム</span>
            <span className="ml-2 text-lg font-mono font-bold tracking-wider">{roomId}</span>
          </div>
        </div>
        <div className="text-base text-white/50">
          👥 {userCount}人
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col gap-4 pb-6">
        {/* 中央エリア */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <img src="/logo.png" alt="Reacture" className="w-16 h-16 mb-2" />
          <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Reacture
          </p>
          <p className="mt-3 text-white/30 text-base leading-relaxed">
            リアクションやコメントを送って<br />授業を盛り上げよう
          </p>
        </div>

        {/* Q&A */}
        <QASection questions={questions} onPost={handleQAPost} onVote={handleQAVote} />

        {/* アンケート */}
        {activePoll && activePoll.active && (
          <div className="px-4">
            <PollVote poll={activePoll} onVote={handleVote} />
          </div>
        )}

        {/* リアクションボタン */}
        <ReactionButton onReaction={handleReaction} customReaction={customReaction} />

        {/* コメント入力 */}
        <CommentInput onSubmit={handleComment} />
      </div>
    </main>
  );
}
