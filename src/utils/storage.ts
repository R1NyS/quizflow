import { createSeedSets } from '../data/seedSets';
import { Card, MasteryStatus, StorageSchemaV1, StudySet, StudyStats, ThemeMode, UserProfile } from '../types';

export const STORAGE_KEY = 'quizflow_storage_v1';
export const CURRENT_SCHEMA_VERSION = 1 as const;
export const PROFILE_STORAGE_KEY = 'quizflow_profile_v1';
export const STUDY_STATS_STORAGE_KEY = 'quizflow_study_stats_v1';

export function loadStudyStats(): StudyStats {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STUDY_STATS_STORAGE_KEY) ?? 'null');
    if (isRecord(parsed)) {
      const history = isRecord(parsed.dailyHistory)
        ? Object.fromEntries(Object.entries(parsed.dailyHistory).filter((entry): entry is [string, number] => /^\d{4}-\d{2}-\d{2}$/.test(entry[0]) && typeof entry[1] === 'number' && Number.isFinite(entry[1])).map(([day, count]) => [day, Math.max(0, Math.floor(count))]))
        : {};
      return {
        dailyGoal: typeof parsed.dailyGoal === 'number' ? Math.min(200, Math.max(5, Math.floor(parsed.dailyGoal))) : 20,
        dailyHistory: history,
      };
    }
  } catch {
    // Start with a safe default if the browser storage is empty or corrupt.
  }
  return { dailyGoal: 20, dailyHistory: {} };
}

export function saveStudyStats(stats: StudyStats): boolean {
  try {
    window.localStorage.setItem(STUDY_STATS_STORAGE_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

export function loadProfile(): UserProfile {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? 'null');
    if (isRecord(parsed)) {
      return {
        name: typeof parsed.name === 'string' ? parsed.name : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
        avatarPath: typeof parsed.avatarPath === 'string' ? parsed.avatarPath : null,
      };
    }
  } catch {
    // Ignore an invalid local profile and show the setup form.
  }
  return { name: '', email: '', avatarPath: null };
}

export function saveProfile(profile: UserProfile): boolean {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createShareUrl(set: StudySet): string {
  const shareable = {
    title: set.title,
    description: set.description,
    tags: set.tags,
    cards: set.cards.map(({ term, definition }) => ({ term, definition })),
  };
  const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  const isNativeApp = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
  const url = new URL(isNativeApp ? (publicAppUrl || window.location.href) : window.location.href);
  url.hash = `share=${encodeBase64Url(JSON.stringify(shareable))}`;
  return url.toString();
}

export function readSharedSetFromUrl(): StudySet | null {
  const match = window.location.hash.match(/^#share=([\w-]+)$/);
  if (!match) return null;
  try {
    return sanitizeStudySet(JSON.parse(decodeBase64Url(match[1])), true);
  } catch {
    return null;
  }
}

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMasteryStatus(value: unknown): value is MasteryStatus {
  return value === 'new' || value === 'learning' || value === 'mastered';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function sanitizeCard(raw: unknown): Card | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.term !== 'string' || typeof raw.definition !== 'string') {
    return null;
  }

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : generateId('card'),
    term: raw.term,
    definition: raw.definition,
    starred: typeof raw.starred === 'boolean' ? raw.starred : false,
    mastery: isMasteryStatus(raw.mastery) ? raw.mastery : 'new',
    correctStreak:
      typeof raw.correctStreak === 'number' && Number.isFinite(raw.correctStreak)
        ? Math.max(0, Math.floor(raw.correctStreak))
        : 0,
    lastReviewedAt:
      typeof raw.lastReviewedAt === 'number' && Number.isFinite(raw.lastReviewedAt)
        ? raw.lastReviewedAt
        : null,
    nextReviewAt:
      typeof raw.nextReviewAt === 'number' && Number.isFinite(raw.nextReviewAt)
        ? raw.nextReviewAt
        : null,
    reviewIntervalDays:
      typeof raw.reviewIntervalDays === 'number' && Number.isFinite(raw.reviewIntervalDays)
        ? Math.max(0, raw.reviewIntervalDays)
        : 0,
    reviewCount:
      typeof raw.reviewCount === 'number' && Number.isFinite(raw.reviewCount)
        ? Math.max(0, Math.floor(raw.reviewCount))
        : 0,
  };
}

export function sanitizeStudySet(raw: unknown, regenerateIds = false): StudySet | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null;
  if (!Array.isArray(raw.cards)) return null;

  const sanitizedCards: Card[] = [];
  for (const item of raw.cards) {
    const card = sanitizeCard(item);
    if (card && card.term.trim() && card.definition.trim()) {
      sanitizedCards.push(
        regenerateIds ? { ...card, id: generateId('card') } : card
      );
    }
  }

  if (sanitizedCards.length === 0) return null;

  const now = Date.now();
  const rawTags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return {
    id:
      !regenerateIds && typeof raw.id === 'string' && raw.id.trim()
        ? raw.id
        : generateId('set'),
    title: raw.title.trim(),
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    tags: Array.from(new Set(rawTags)),
    cards: sanitizedCards,
    createdAt:
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : now,
    updatedAt:
      typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : now,
    bestMatchTimeMs:
      typeof raw.bestMatchTimeMs === 'number' && raw.bestMatchTimeMs > 0
        ? raw.bestMatchTimeMs
        : null,
    ...(typeof raw.collaborationId === 'string' ? { collaborationId: raw.collaborationId } : {}),
    ...(typeof raw.collaborationCode === 'string' ? { collaborationCode: raw.collaborationCode } : {}),
    ...(raw.collaborationRole === 'owner' || raw.collaborationRole === 'editor' || raw.collaborationRole === 'viewer' ? { collaborationRole: raw.collaborationRole } : {}),
  };
}

function getDefaultTheme(): ThemeMode {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

export function loadStorageState(): StorageSchemaV1 {
  const fallback: StorageSchemaV1 = {
    version: CURRENT_SCHEMA_VERSION,
    theme: getDefaultTheme(),
    sets: createSeedSets(),
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveStorageState(fallback);
      return fallback;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return fallback;
    }

    const theme: ThemeMode = isThemeMode(parsed.theme)
      ? parsed.theme
      : getDefaultTheme();

    if (parsed.version === 1 && Array.isArray(parsed.sets)) {
      const sets = parsed.sets
        .map((item) => sanitizeStudySet(item, false))
        .filter((item): item is StudySet => item !== null);

      return {
        version: CURRENT_SCHEMA_VERSION,
        theme,
        sets,
      };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function saveStorageState(state: StorageSchemaV1): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export interface JsonImportResult {
  kind: 'database' | 'single-set';
  sets: StudySet[];
}

export function parseImportedJson(rawJson: string): JsonImportResult | null {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!isRecord(parsed)) return null;

    if (Array.isArray(parsed.sets)) {
      const sets = parsed.sets
        .map((item) => sanitizeStudySet(item, true))
        .filter((item): item is StudySet => item !== null);
      if (sets.length === 0) return null;
      return { kind: 'database', sets };
    }

    const singleSet = sanitizeStudySet(parsed, true);
    if (singleSet) {
      return { kind: 'single-set', sets: [singleSet] };
    }

    return null;
  } catch {
    return null;
  }
}

export function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
