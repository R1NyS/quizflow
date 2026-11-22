import type { AppView, StudyModeId } from '../types';

const studyModes = new Set<StudyModeId>([
  'flashcards',
  'learn',
  'test',
  'match',
  'audio',
]);

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function appViewFromPath(pathname: string): AppView {
  const parts = pathname.split('/').filter(Boolean).map(decodeSegment);
  if (parts.some((part) => part === null)) return { name: 'library' };
  const segments = parts as string[];

  if (segments.length === 0 || segments[0] === 'library') {
    return { name: 'library' };
  }
  if (segments.length === 1 && segments[0] === 'profile') {
    return { name: 'profile' };
  }
  if (segments.length === 1 && segments[0] === 'review') return { name: 'daily-review' };
  if (segments.length === 2 && segments[0] === 'duel') return { name: 'duel', roomCode: segments[1] };
  if (segments.length === 2 && segments[0] === 'collab') return { name: 'collaboration', inviteCode: segments[1] };
  if (segments.length === 2 && segments[0] === 'sets' && segments[1] === 'new') {
    return { name: 'editor', setId: null };
  }
  if (segments[0] !== 'sets' || !segments[1]) {
    return { name: 'library' };
  }

  const setId = segments[1];
  if (segments.length === 2) return { name: 'detail', setId };
  if (segments.length === 3 && segments[2] === 'edit') {
    return { name: 'editor', setId };
  }
  if (
    segments.length === 4 &&
    segments[2] === 'study' &&
    studyModes.has(segments[3] as StudyModeId)
  ) {
    return { name: 'mode', setId, mode: segments[3] as StudyModeId };
  }

  return { name: 'library' };
}

export function pathForAppView(view: AppView): string {
  switch (view.name) {
    case 'library':
      return '/';
    case 'profile':
      return '/profile';
    case 'daily-review':
      return '/review';
    case 'duel':
      return `/duel/${encodeURIComponent(view.roomCode ?? 'new')}`;
    case 'collaboration':
      return `/collab/${encodeURIComponent(view.inviteCode)}`;
    case 'editor':
      return view.setId
        ? `/sets/${encodeURIComponent(view.setId)}/edit`
        : '/sets/new';
    case 'detail':
      return `/sets/${encodeURIComponent(view.setId)}`;
    case 'mode':
      return `/sets/${encodeURIComponent(view.setId)}/study/${view.mode}`;
  }
}
