export type MasteryStatus = 'new' | 'learning' | 'mastered';

export interface Card {
  id: string;
  term: string;
  definition: string;
  starred: boolean;
  mastery: MasteryStatus;
  correctStreak: number;
  lastReviewedAt: number | null;
  nextReviewAt?: number | null;
  reviewIntervalDays?: number;
  reviewCount?: number;
}

export interface StudySet {
  id: string;
  title: string;
  description: string;
  tags: string[];
  cards: Card[];
  createdAt: number;
  updatedAt: number;
  bestMatchTimeMs: number | null;
  collaborationId?: string;
  collaborationCode?: string;
  collaborationRole?: 'owner' | 'editor' | 'viewer';
}

export type ThemeMode = 'light' | 'dark';

export interface UserProfile {
  name: string;
  email: string;
}

export interface StorageSchemaV1 {
  version: 1;
  theme: ThemeMode;
  sets: StudySet[];
}

export interface StudyStats {
  dailyGoal: number;
  dailyHistory: Record<string, number>;
}

export type StudyModeId = 'flashcards' | 'learn' | 'test' | 'match' | 'audio';

export type AppView =
  | { name: 'library' }
  | { name: 'detail'; setId: string }
  | { name: 'editor'; setId: string | null }
  | { name: 'profile' }
  | { name: 'daily-review' }
  | { name: 'duel'; setId?: string; roomCode?: string }
  | { name: 'collaboration'; inviteCode: string }
  | { name: 'mode'; mode: StudyModeId; setId: string };

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
}

export interface DraftCard {
  id: string;
  term: string;
  definition: string;
  starred: boolean;
  mastery: MasteryStatus;
  correctStreak: number;
  lastReviewedAt: number | null;
}

export interface ParsedCardPreview {
  term: string;
  definition: string;
}

export type TermDelimiterOption = 'tab' | 'dash' | 'comma' | 'custom';
export type CardDelimiterOption = 'newline' | 'semicolon' | 'custom';
