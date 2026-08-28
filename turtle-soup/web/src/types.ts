// 前后端共享类型(与 server/rooms.js 的 publicRoom 对应)

export type RoomStatus = "waiting" | "playing" | "revealed";

export interface Player {
  sid: string;
  name: string;
  online: boolean;
  joinedAt: number;
}

export type Answer = "yes" | "no" | "irrelevant";

export interface Question {
  id: number;
  playerId: string;
  playerName: string;
  text: string;
  answer: Answer | null;
  hint: string | null;
  time: number;
}

export interface Guess {
  id: number;
  playerId: string;
  playerName: string;
  text: string;
  correct: boolean | null;
  time: number;
}

export interface Hint {
  id: number;
  text: string;
  time: number;
}

export interface Soup {
  id: number | null;
  title?: string;
  surface: string;
  /** 仅揭晓后可见 */
  truth?: string;
  /** 分类/难度标签(可选) */
  category?: string;
  difficulty?: string;
}

export interface Room {
  code: string;
  hostId: string;
  hostName: string;
  status: RoomStatus;
  round: number;
  players: Player[];
  soup: Soup | null;
  questions: Question[];
  guesses: Guess[];
  hints: Hint[];
  currentQuestionerId: string | null;
  createdAt: number;
  maxPlayers?: number;
}

/** 服务端 ack 回调负载 */
export interface AckRes {
  ok?: boolean;
  error?: string;
  room?: Room;
  message?: string;
}

/** 在线房间公开列表项(/api/rooms) */
export interface RoomListItem {
  code: string;
  hostName: string;
  status: RoomStatus;
  round: number;
  playerCount: number;
  onlineCount: number;
  hasPassword: boolean;
  soupTitle: string | null;
  createdAt: number;
  maxPlayers?: number;
}
