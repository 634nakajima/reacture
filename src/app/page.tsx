'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  // スマホ判定 + ページ離脱時にソケットを切断
  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent;
      const mobile = /iPhone|iPad|iPod|Android/i.test(ua) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const createRoom = () => {
    setCreating(true);
    const socket = getSocket();
    socketRef.current = socket;
    socket.connect();
    socket.emit('room:create', (data: { roomId: string }) => {
      router.push(`/screen/${data.roomId}`);
    });
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || joining) return;
    setError('');
    setJoining(true);

    const code = roomCode.trim().toUpperCase();
    const socket = getSocket();
    socketRef.current = socket;
    socket.connect();

    // タイムアウト
    const timeout = setTimeout(() => {
      setError('サーバーに接続できません');
      setJoining(false);
      socket.disconnect();
    }, 5000);

    socket.emit(
      'room:join',
      { roomId: code },
      (data: { success: boolean; error?: string }) => {
        clearTimeout(timeout);
        if (data.success) {
          socket.disconnect();
          router.push(`/room/${code}`);
        } else {
          setError(data.error || 'ルームに参加できませんでした');
          setJoining(false);
          socket.disconnect();
        }
      }
    );
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* ロゴ */}
        <div>
          <img src="/logo.png" alt="Reacture" className="w-20 h-20 mx-auto mb-3" />
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Reacture
          </h1>
          <p className="mt-2 text-white/60">
            授業をもっとインタラクティブに
          </p>
        </div>

        {/* 先生：ルーム作成（PCのみ表示） */}
        {!isMobile && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4">発表する</h2>
            <button
              onClick={createRoom}
              disabled={creating}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white font-bold text-lg hover:from-blue-500 hover:to-purple-500 active:scale-95 transition-all disabled:opacity-50"
            >
              {creating ? '作成中...' : 'ルームを作成'}
            </button>
          </div>
        )}

        {/* 学生：ルーム参加 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold mb-4">{isMobile ? 'ルームに参加' : '参加する'}</h2>
          <form onSubmit={joinRoom} className="space-y-3">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
                setError('');
              }}
              placeholder="ルームコード"
              className="w-full px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={roomCode.length === 0 || joining}
              className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors disabled:opacity-30"
            >
              {joining ? '接続中...' : '参加'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
