import { Server } from 'socket.io';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';

const httpServer = createServer((req, res) => {
  // Renderのヘルスチェック用
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim())
  : ['http://localhost:3000'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

interface PollOption {
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  active: boolean;
  voters: Set<string>;
}

interface CustomReaction {
  emoji: string;
  label: string;
  soundUrl: string; // クライアント側のblob URLまたはパス
}

interface Question {
  id: string;
  text: string;
  votes: number;
  resolved: boolean;
  createdAt: number;
  voters: Set<string>;
}

interface Room {
  id: string;
  hostSocketId: string;
  currentPage: number;
  activePoll: Poll | null;
  customReaction: CustomReaction | null;
  questions: Question[];
}

const rooms = new Map<string, Room>();

function generateRoomId(): string {
  // 4桁の英数字（入力しやすい）
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ホストを除いた参加者数を返す
function getParticipantCount(roomId: string): number {
  const total = io.sockets.adapter.rooms.get(roomId)?.size || 0;
  const room = rooms.get(roomId);
  if (!room) return total;
  // ホストがルームにいれば1人引く
  const hostInRoom = io.sockets.adapter.rooms.get(roomId)?.has(room.hostSocketId) ?? false;
  return hostInRoom ? total - 1 : total;
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ルーム作成（IDなし → 新規ID生成、ID指定 → そのIDで作成/再接続）
  socket.on('room:create', (arg1: unknown, arg2?: unknown) => {
    let requestedId: string | undefined;
    let callback: (data: { roomId: string }) => void;

    if (typeof arg1 === 'function') {
      callback = arg1 as (data: { roomId: string }) => void;
    } else if (typeof arg1 === 'object' && arg1 !== null) {
      requestedId = (arg1 as { roomId?: string }).roomId;
      callback = arg2 as (data: { roomId: string }) => void;
    } else {
      return;
    }

    // 指定IDのルームが既に存在する場合はホストとして再接続
    if (requestedId && rooms.has(requestedId)) {
      const room = rooms.get(requestedId)!;
      room.hostSocketId = socket.id;
      socket.join(requestedId);
      callback({ roomId: requestedId });
      console.log(`Host reconnected to room: ${requestedId}`);
      return;
    }

    const roomId = requestedId || generateRoomId();

    const room: Room = {
      id: roomId,
      hostSocketId: socket.id,
      currentPage: 0,
      activePoll: null,
      customReaction: null,
      questions: [],
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    callback({ roomId });
    console.log(`Room created: ${roomId}`);
  });

  // ルーム参加
  socket.on('room:join', (data: { roomId: string }, callback: (data: { success: boolean; error?: string; userCount?: number }) => void) => {
    const roomId = data.roomId.toUpperCase();
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, error: 'ルームが見つかりません' });
      return;
    }

    socket.join(roomId);
    const userCount = getParticipantCount(roomId);
    io.to(roomId).emit('room:user-count', { count: userCount });
    callback({ success: true, userCount });

    // 現在のスライドページ、アクティブなアンケート、カスタムリアクションを送信
    socket.emit('slide:changed', { page: room.currentPage });
    if (room.activePoll) {
      const { voters, ...pollData } = room.activePoll;
      socket.emit('poll:started', pollData);
    }
    if (room.customReaction) {
      socket.emit('custom-reaction:updated', room.customReaction);
    }

    // 既存の質問一覧を送信（voters除外）
    if (room.questions.length > 0) {
      const questionsForClient = room.questions.map(({ voters, ...q }) => q);
      socket.emit('qa:list', questionsForClient);
    }

    console.log(`User joined room ${roomId} (${userCount} users)`);
  });

  // リアクション
  socket.on('reaction', (data: { roomId: string; type: string; emoji: string }) => {
    const reaction = {
      id: uuidv4(),
      type: data.type,
      emoji: data.emoji,
    };
    io.to(data.roomId).emit('reaction:new', reaction);
  });

  // コメント
  socket.on('comment', (data: { roomId: string; text: string }) => {
    if (!data.text.trim()) return;
    const comment = {
      id: uuidv4(),
      text: data.text.trim().slice(0, 100), // 最大100文字
    };
    io.to(data.roomId).emit('comment:new', comment);
  });

  // スライドページ変更（ホストのみ）
  socket.on('slide:change', (data: { roomId: string; page: number }) => {
    const room = rooms.get(data.roomId);
    if (room && room.hostSocketId === socket.id) {
      room.currentPage = data.page;
      socket.to(data.roomId).emit('slide:changed', { page: data.page });
    }
  });

  // アンケート作成（ホストのみ）
  socket.on('poll:create', (data: { roomId: string; question: string; options: string[] }) => {
    const room = rooms.get(data.roomId);
    if (room && room.hostSocketId === socket.id) {
      const poll: Poll = {
        id: uuidv4(),
        question: data.question,
        options: data.options.map((text) => ({ text, votes: 0 })),
        active: true,
        voters: new Set(),
      };
      room.activePoll = poll;
      const { voters, ...pollData } = poll;
      io.to(data.roomId).emit('poll:started', pollData);
    }
  });

  // アンケート投票
  socket.on('poll:vote', (data: { roomId: string; pollId: string; optionIndex: number }) => {
    const room = rooms.get(data.roomId);
    if (!room?.activePoll || room.activePoll.id !== data.pollId) return;
    if (room.activePoll.voters.has(socket.id)) return; // 二重投票防止
    if (data.optionIndex < 0 || data.optionIndex >= room.activePoll.options.length) return;

    room.activePoll.voters.add(socket.id);
    room.activePoll.options[data.optionIndex].votes++;

    const { voters, ...pollData } = room.activePoll;
    io.to(data.roomId).emit('poll:updated', pollData);
  });

  // アンケート終了（ホストのみ）
  socket.on('poll:end', (data: { roomId: string }) => {
    const room = rooms.get(data.roomId);
    if (room && room.hostSocketId === socket.id && room.activePoll) {
      room.activePoll.active = false;
      const { voters, ...pollData } = room.activePoll;
      io.to(data.roomId).emit('poll:ended', pollData);
      room.activePoll = null;
    }
  });

  // カスタムリアクション設定（ホストのみ）
  socket.on('custom-reaction:set', (data: { roomId: string; emoji: string; label: string; soundUrl: string }) => {
    const room = rooms.get(data.roomId);
    if (room && room.hostSocketId === socket.id) {
      room.customReaction = {
        emoji: data.emoji,
        label: data.label,
        soundUrl: data.soundUrl,
      };
      io.to(data.roomId).emit('custom-reaction:updated', room.customReaction);
    }
  });

  // Q&A: 質問投稿
  socket.on('qa:post', (data: { roomId: string; text: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) return;
    const text = data.text.trim().slice(0, 200);
    if (!text) return;

    // 1ルームあたり100件上限
    if (room.questions.length >= 100) {
      // 古い回答済み質問から削除
      const resolvedIdx = room.questions.findIndex((q) => q.resolved);
      if (resolvedIdx !== -1) {
        room.questions.splice(resolvedIdx, 1);
      } else {
        return; // 全部未回答なら追加不可
      }
    }

    const question: Question = {
      id: uuidv4(),
      text,
      votes: 0,
      resolved: false,
      createdAt: Date.now(),
      voters: new Set(),
    };
    room.questions.push(question);

    const { voters, ...questionData } = question;
    io.to(data.roomId).emit('qa:new', questionData);
  });

  // Q&A: いいね
  socket.on('qa:vote', (data: { roomId: string; questionId: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) return;
    const question = room.questions.find((q) => q.id === data.questionId);
    if (!question) return;
    if (question.voters.has(socket.id)) return; // 二重いいね防止

    question.voters.add(socket.id);
    question.votes++;

    io.to(data.roomId).emit('qa:updated', { questionId: question.id, votes: question.votes });
  });

  // Q&A: 回答済みマーク（ホストのみ）
  socket.on('qa:resolve', (data: { roomId: string; questionId: string }) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    const question = room.questions.find((q) => q.id === data.questionId);
    if (!question) return;

    question.resolved = !question.resolved; // トグル
    io.to(data.roomId).emit('qa:resolved', { questionId: question.id, resolved: question.resolved });
  });

  // Q&A: 質問削除（ホストのみ）
  socket.on('qa:delete', (data: { roomId: string; questionId: string }) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    const idx = room.questions.findIndex((q) => q.id === data.questionId);
    if (idx === -1) return;

    room.questions.splice(idx, 1);
    io.to(data.roomId).emit('qa:deleted', { questionId: data.questionId });
  });

  // ルームを明示的に閉じる（ホストのみ）
  socket.on('room:close', (data: { roomId: string }) => {
    const room = rooms.get(data.roomId);
    if (room && room.hostSocketId === socket.id) {
      io.to(data.roomId).emit('room:closed');
      rooms.delete(data.roomId);
      socket.leave(data.roomId);
      console.log(`Room ${data.roomId} explicitly closed by host`);
    }
  });

  // カスタムリアクション削除（ホストのみ）
  socket.on('custom-reaction:remove', (data: { roomId: string }) => {
    const room = rooms.get(data.roomId);
    if (room && room.hostSocketId === socket.id) {
      room.customReaction = null;
      io.to(data.roomId).emit('custom-reaction:updated', null);
    }
  });

  // 切断
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // ホストが切断した場合、ルームを削除
    for (const [roomId, room] of rooms.entries()) {
      if (room.hostSocketId === socket.id) {
        io.to(roomId).emit('room:closed');
        rooms.delete(roomId);
        console.log(`Room ${roomId} closed (host disconnected)`);
      }
    }

    // 各ルームのユーザー数を更新
    for (const [roomId] of rooms.entries()) {
      const userCount = getParticipantCount(roomId);
      io.to(roomId).emit('room:user-count', { count: userCount });
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Reacture Socket.IO server running on 0.0.0.0:${PORT}`);
});
