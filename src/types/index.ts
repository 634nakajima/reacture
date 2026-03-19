export type ReactionType = 'clap' | 'smile' | 'heart' | 'wow' | 'question' | 'thumbsup';

export const REACTIONS: Record<ReactionType, { emoji: string; label: string; sound: string }> = {
  clap: { emoji: '👏', label: '拍手', sound: '/sounds/clap.mp3' },
  smile: { emoji: '😄', label: '笑顔', sound: '/sounds/laugh.mp3' },
  heart: { emoji: '❤️', label: 'いいね', sound: '/sounds/chime.mp3' },
  wow: { emoji: '😮', label: 'おお！', sound: '/sounds/wow.mp3' },
  question: { emoji: '❓', label: '質問', sound: '/sounds/question.mp3' },
  thumbsup: { emoji: '👍', label: 'OK', sound: '/sounds/pop.mp3' },
};

export interface CustomReaction {
  emoji: string;
  label: string;
  soundUrl: string;
}

export interface ReactionEvent {
  id: string;
  type: ReactionType | string;
  emoji: string;
}

export interface CommentEvent {
  id: string;
  text: string;
}

export interface PollOption {
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  active: boolean;
}

export interface RoomState {
  roomId: string;
  userCount: number;
  currentPage: number;
  activePoll: Poll | null;
}
