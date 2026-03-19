'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { getSocket, cleanupSocket } from '@/lib/socket';
import { playSound, preloadSounds, resumeAudioContext } from '@/lib/sounds';
import { pdfToImages } from '@/lib/pdf';
import ReactionOverlay from '@/components/ReactionOverlay';
import CommentFlow from '@/components/CommentFlow';
import PollResults from '@/components/PollResults';
import PollPanel from '@/components/PollPanel';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import CustomReactionSetting from '@/components/CustomReactionSetting';
import { REACTIONS } from '@/types';
import type { ReactionEvent, CommentEvent, Poll, ReactionType, CustomReaction } from '@/types';

type SlideMode = 'upload' | 'embed' | 'none';

export default function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = use(params);
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [comments, setComments] = useState<CommentEvent[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [slides, setSlides] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const volumeRef = useRef(volume);
  const [slideMode, setSlideMode] = useState<SlideMode>('none');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedInput, setEmbedInput] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [customReaction, setCustomReaction] = useState<CustomReaction | null>(null);
  const customReactionRef = useRef<CustomReaction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // volumeRef を常に最新に保つ
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // 効果音プリロード + ユーザー操作でAudioContext有効化
  useEffect(() => {
    const soundUrls = Object.values(REACTIONS).map((r) => r.sound);
    preloadSounds(soundUrls);

    const enableAudio = () => {
      resumeAudioContext();
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
    window.addEventListener('click', enableAudio);
    window.addEventListener('touchstart', enableAudio);
    window.addEventListener('keydown', enableAudio);
    return () => {
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
  }, []);

  // コントロールバー自動非表示（iframe外ではmousemoveで検知）
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  useEffect(() => {
    cleanupSocket(); // 前のリスナーを確実にクリア
    const socket = getSocket();
    socket.connect();

    socket.emit('room:create', { roomId }, (data: { roomId: string }) => {
      setConnected(true);
    });

    socket.on('room:user-count', (data: { count: number }) => {
      setUserCount(data.count);
    });

    socket.on('reaction:new', (reaction: ReactionEvent) => {
      setReactions((prev) => [...prev, reaction]);
      if (volumeRef.current > 0) {
        if (reaction.type === 'custom' && customReactionRef.current?.soundUrl) {
          playSound(customReactionRef.current.soundUrl, volumeRef.current);
        } else {
          const reactionInfo = REACTIONS[reaction.type as ReactionType];
          if (reactionInfo) {
            playSound(reactionInfo.sound, volumeRef.current);
          }
        }
      }
    });

    socket.on('comment:new', (comment: CommentEvent) => {
      setComments((prev) => [...prev, comment]);
    });

    socket.on('custom-reaction:updated', (data: CustomReaction | null) => {
      setCustomReaction(data);
      customReactionRef.current = data;
    });

    socket.on('poll:started', (poll: Poll) => {
      setActivePoll(poll);
    });

    socket.on('poll:updated', (poll: Poll) => {
      setActivePoll(poll);
    });

    socket.on('poll:ended', (poll: Poll) => {
      setActivePoll(poll);
      setTimeout(() => setActivePoll(null), 8000);
    });

    return () => {
      cleanupSocket();
    };
  }, [roomId]);

  const handleCreatePoll = useCallback(
    (question: string, options: string[]) => {
      const socket = getSocket();
      socket.emit('poll:create', { roomId, question, options });
    },
    [roomId]
  );

  const handleSetCustomReaction = useCallback(
    (emoji: string, label: string, soundUrl: string) => {
      const socket = getSocket();
      socket.emit('custom-reaction:set', { roomId, emoji, label, soundUrl });
    },
    [roomId]
  );

  const handleRemoveCustomReaction = useCallback(() => {
    const socket = getSocket();
    socket.emit('custom-reaction:remove', { roomId });
  }, [roomId]);

  const handleEndPoll = useCallback(() => {
    const socket = getSocket();
    socket.emit('poll:end', { roomId });
  }, [roomId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf') {
        // PDFを各ページの画像に変換
        setPdfLoading(true);
        try {
          const pageImages = await pdfToImages(file);
          urls.push(...pageImages);
        } catch (err) {
          console.error('PDF conversion failed:', err);
        }
        setPdfLoading(false);
      } else {
        urls.push(URL.createObjectURL(file));
      }
    }

    if (urls.length > 0) {
      setSlides((prev) => [...prev, ...urls]);
      setSlideMode('upload');
    }
  };

  const changePage = (delta: number) => {
    setCurrentPage((prev) => {
      const next = prev + delta;
      if (next < 0 || next >= slides.length) return prev;
      const socket = getSocket();
      socket.emit('slide:change', { roomId, page: next });
      return next;
    });
  };

  // 外部スライドURLを埋め込み用URLに変換
  const convertToEmbedUrl = (url: string): string => {
    // Google Slides: 公開URLを埋め込みURLに変換
    const gSlidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (gSlidesMatch) {
      return `https://docs.google.com/presentation/d/${gSlidesMatch[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    // Google Slides: 既に /embed 形式ならそのまま
    if (url.includes('docs.google.com/presentation') && url.includes('/embed')) {
      return url;
    }
    // Gamma: /docs/xxx や /public/xxx → /embed/xxx に変換
    const gammaMatch = url.match(/gamma\.app\/(?:docs|public)\/([a-zA-Z0-9_-]+)/);
    if (gammaMatch) {
      return `https://gamma.app/embed/${gammaMatch[1]}`;
    }
    // Gamma: 既に /embed/ ならそのまま
    if (url.includes('gamma.app/embed/')) {
      return url;
    }
    // PowerPoint Online (OneDrive / SharePoint 共有リンク)
    if (url.includes('onedrive.live.com') || url.includes('sharepoint.com') || url.includes('1drv.ms')) {
      // 既に embedview なら そのまま
      if (url.includes('action=embedview')) return url;
      // 共有リンクを埋め込みURLに変換
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}action=embedview`;
    }
    // Canva
    if (url.includes('canva.com')) {
      return url;
    }
    // Speaker Deck
    const speakerDeckMatch = url.match(/speakerdeck\.com\/([^/]+)\/([^/?]+)/);
    if (speakerDeckMatch) {
      return `https://speakerdeck.com/player/${speakerDeckMatch[2]}`;
    }
    // その他: そのまま iframe に入れる
    return url;
  };

  const handleEmbed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!embedInput.trim()) return;
    const converted = convertToEmbedUrl(embedInput.trim());
    setEmbedUrl(converted);
    setSlideMode('embed');
  };

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        changePage(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        changePage(-1);
      } else if (e.key === 'q') {
        setShowQR((prev) => !prev);
      } else if (e.key === 'f') {
        document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length]);

  if (!connected) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-white/60">接続中...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col relative bg-gray-950 overflow-hidden">
      {/* コンテンツエリア */}
      <div className="flex-1 flex items-center justify-center relative">
        {slideMode === 'embed' && embedUrl ? (
          // 外部スライド埋め込み - 画面全体に表示
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
          />
        ) : slideMode === 'upload' && slides.length > 0 ? (
          // アップロードスライド
          <img
            src={slides[currentPage]}
            alt={`スライド ${currentPage + 1}`}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          // 初期画面：モード選択
          <div className="text-center space-y-8 max-w-xl w-full px-6">
            <div>
              <h2 className="text-3xl font-bold text-white/80 mb-2">スライドを表示</h2>
              <p className="text-white/40">表示方法を選んでください</p>
            </div>

            {/* 外部スライド埋め込み */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-left">
              <h3 className="text-lg font-semibold mb-3">🔗 外部スライドを埋め込み</h3>
              <p className="text-sm text-white/40 mb-3">
                Google Slides / Gamma / Canva / Speaker Deck のURLを貼り付け
              </p>
              <form onSubmit={handleEmbed} className="flex gap-2">
                <input
                  type="url"
                  value={embedInput}
                  onChange={(e) => setEmbedInput(e.target.value)}
                  placeholder="https://docs.google.com/presentation/d/..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-400"
                />
                <button
                  type="submit"
                  disabled={!embedInput.trim()}
                  className="px-5 py-3 bg-blue-600 rounded-xl text-white font-medium disabled:opacity-30 hover:bg-blue-500"
                >
                  表示
                </button>
              </form>
            </div>

            {/* 画像アップロード */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-left">
              <h3 className="text-lg font-semibold mb-3">📁 ファイルをアップロード</h3>
              <p className="text-sm text-white/40 mb-3">
                PDF または画像ファイル（PNG/JPG）を選択
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={pdfLoading}
                className="px-5 py-3 bg-white/10 rounded-xl text-white font-medium hover:bg-white/20 disabled:opacity-50"
              >
                {pdfLoading ? 'PDF変換中...' : 'ファイルを選択'}
              </button>
            </div>

            {/* スライドなしモード */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-left">
              <h3 className="text-lg font-semibold mb-3">💬 リアクション・コメントのみ</h3>
              <p className="text-sm text-white/40 mb-3">
                スライドを表示せず、リアクションとコメントだけを使う
              </p>
              <button
                onClick={() => setSlideMode('upload')}
                className="px-5 py-3 bg-white/10 rounded-xl text-white font-medium hover:bg-white/20"
              >
                このまま始める
              </button>
            </div>
          </div>
        )}
      </div>

      {/* リアクション・コメントオーバーレイ（常時表示） */}
      <ReactionOverlay reactions={reactions} />
      <CommentFlow comments={comments} />

      {/* アンケート結果 */}
      {activePoll && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <PollResults poll={activePoll} />
          {activePoll.active && (
            <button
              onClick={handleEndPoll}
              className="mt-3 w-full py-2 bg-red-600/80 text-white rounded-lg text-sm hover:bg-red-500"
            >
              投票を終了
            </button>
          )}
        </div>
      )}

      {/* QRコード */}
      <QRCodeDisplay
        roomId={roomId}
        show={showQR}
        onToggle={() => setShowQR(!showQR)}
      />

      {/* iframe上でもメニューを出せるホバーゾーン（常時表示） */}
      {slideMode === 'embed' && (
        <div
          className="absolute bottom-0 left-0 right-0 h-24 z-30"
          onMouseEnter={() => {
            setShowControls(true);
            if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
          }}
          onMouseLeave={() => {
            controlsTimerRef.current = setTimeout(() => setShowControls(false), 1500);
          }}
        />
      )}

      {/* コントロールバー（マウス操作で表示/自動非表示） */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-500 z-40 ${
          showControls || slideMode === 'none' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors text-lg font-bold"
            >
              ←
            </a>

            {/* スライドモード中のみファイル追加 */}
            {slideMode === 'upload' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
                >
                  📁 追加
                </button>
                {slides.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changePage(-1)}
                      disabled={currentPage === 0}
                      className="px-3 py-2 bg-white/10 text-white rounded-lg disabled:opacity-30"
                    >
                      ◀
                    </button>
                    <span className="text-white/60 text-sm min-w-[60px] text-center">
                      {currentPage + 1} / {slides.length}
                    </span>
                    <button
                      onClick={() => changePage(1)}
                      disabled={currentPage >= slides.length - 1}
                      className="px-3 py-2 bg-white/10 text-white rounded-lg disabled:opacity-30"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 埋め込みモード時: URL変更 */}
            {slideMode === 'embed' && (
              <button
                onClick={() => { setSlideMode('none'); setEmbedUrl(''); }}
                className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
              >
                ✕ 表示を解除
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <CustomReactionSetting
              current={customReaction}
              onSet={handleSetCustomReaction}
              onRemove={handleRemoveCustomReaction}
            />

            {!activePoll && (
              <PollPanel onCreatePoll={handleCreatePoll} />
            )}

            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.5)}
                className="text-sm"
              >
                {volume === 0 ? '🔇' : volume < 0.4 ? '🔈' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 accent-white cursor-pointer"
              />
            </div>

            <button
              onClick={() => setShowQR(!showQR)}
              className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
            >
              QR
            </button>

            <button
              onClick={() => document.documentElement.requestFullscreen?.()}
              className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
            >
              ⛶
            </button>

            <span className="text-white/50 text-sm">👥 {userCount}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
