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
import QADisplay from '@/components/QADisplay';
import { REACTIONS } from '@/types';
import type { ReactionEvent, CommentEvent, Poll, ReactionType, CustomReaction, Question } from '@/types';

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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQA, setShowQA] = useState(false);
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

    // ページ離脱時にルームを明示的に閉じる
    const handleBeforeUnload = () => {
      socket.emit('room:close', { roomId });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket.emit('room:close', { roomId });
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

  const handleResolveQuestion = useCallback(
    (questionId: string) => {
      const socket = getSocket();
      socket.emit('qa:resolve', { roomId, questionId });
    },
    [roomId]
  );

  const handleDeleteQuestion = useCallback(
    (questionId: string) => {
      const socket = getSocket();
      socket.emit('qa:delete', { roomId, questionId });
    },
    [roomId]
  );

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
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><svg className="w-5 h-5 text-white/70" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>外部スライドを埋め込み</h3>
              <p className="text-sm text-white/40 mb-3">
                Google Slides / Gamma / PowerPoint のURLを貼り付け
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
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><svg className="w-5 h-5 text-white/70" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>ファイルをアップロード</h3>
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

          </div>
        )}
      </div>

      {/* リアクション・コメントオーバーレイ（常時表示） */}
      <ReactionOverlay reactions={reactions} />
      <CommentFlow comments={comments} />

      {/* アンケート */}
      {activePoll && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          {activePoll.active ? (
            <div className="bg-black/60 backdrop-blur-md rounded-2xl p-14 w-[800px] border border-white/10 text-center">
              <h3 className="text-white text-3xl font-bold mb-20">{activePoll.question}</h3>
              <div className="space-y-4 mb-8">
                {activePoll.options.map((opt, i) => (
                  <div key={i} className="px-6 py-4 bg-white/10 rounded-xl text-white text-xl">
                    {opt.text}
                  </div>
                ))}
              </div>
              <p className="text-white/50 text-xl mb-8 animate-pulse">📊 投票受付中...</p>
              <button
                onClick={handleEndPoll}
                className="px-10 py-4 bg-red-600/80 text-white rounded-lg text-lg hover:bg-red-500"
              >
                回答を終了して結果を表示
              </button>
            </div>
          ) : (
            <div className="w-[800px] relative">
              <button
                onClick={() => setActivePoll(null)}
                className="absolute -top-3 -right-3 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full text-white text-xl flex items-center justify-center z-10"
              >
                ✕
              </button>
              <PollResults poll={activePoll} />
            </div>
          )}
        </div>
      )}

      {/* Q&A */}
      {showQA && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <QADisplay
            questions={questions}
            onResolve={handleResolveQuestion}
            onDelete={handleDeleteQuestion}
            onClose={() => setShowQA(false)}
          />
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
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
            >
              <img src="/logo.png" alt="トップに戻る" className="w-7 h-7" />
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
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.5)}
                className="flex items-center justify-center w-5 h-5 text-white/80 hover:text-white"
              >
                {volume === 0 ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63z"/><path d="M2.1 2.1L.69 3.51l4.8 4.8L5 9H1v6h4l5 5v-6.59l4.45 4.45c-.7.54-1.51.96-2.45 1.18v2.06c1.52-.32 2.89-1.02 4.01-2.01l2.48 2.48 1.41-1.41L2.1 2.1z"/></svg>
                ) : volume < 0.4 ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                )}
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

            <CustomReactionSetting
              current={customReaction}
              onSet={handleSetCustomReaction}
              onRemove={handleRemoveCustomReaction}
            />

            {!activePoll && (
              <PollPanel onCreatePoll={handleCreatePoll} />
            )}

            <button
              onClick={() => setShowQA(!showQA)}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-white/20 bg-transparent text-white/70 hover:bg-white/5 hover:border-white/30 hover:text-white transition-all relative"
            >
              Q&A
              {questions.filter((q) => !q.resolved).length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold rounded-full px-1">
                  {questions.filter((q) => !q.resolved).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowQR(!showQR)}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-white/20 bg-transparent text-white/70 hover:bg-white/5 hover:border-white/30 hover:text-white transition-all"
            >
              QR
            </button>

            <button
              onClick={() => document.documentElement.requestFullscreen?.()}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-white/20 bg-transparent text-white/70 hover:bg-white/5 hover:border-white/30 hover:text-white transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            </button>

            <span className="text-white/50 text-sm">👥 {userCount}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
