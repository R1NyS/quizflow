import type { Card, StudySet, StudyStats } from '../types';

export interface DueCard {
  setId: string;
  setTitle: string;
  card: Card;
}

export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getDueCards(sets: StudySet[], now = Date.now()): DueCard[] {
  return sets.flatMap((set) => set.cards
    .filter((card) => card.nextReviewAt == null || card.nextReviewAt <= now)
    .map((card) => ({ setId: set.id, setTitle: set.title, card })))
    .sort((a, b) => (a.card.nextReviewAt ?? 0) - (b.card.nextReviewAt ?? 0));
}

export function getTodayReviewCount(stats: StudyStats, now = new Date()): number {
  return stats.dailyHistory[localDayKey(now)] ?? 0;
}

export function getStudyStreak(stats: StudyStats, now = new Date()): number {
  let day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if ((stats.dailyHistory[localDayKey(day)] ?? 0) === 0) day.setDate(day.getDate() - 1);
  let streak = 0;
  while ((stats.dailyHistory[localDayKey(day)] ?? 0) > 0) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

export function mergeDailyStats(left: StudyStats, right: StudyStats): StudyStats {
  const dailyHistory = { ...left.dailyHistory };
  for (const [day, count] of Object.entries(right.dailyHistory)) {
    dailyHistory[day] = Math.max(dailyHistory[day] ?? 0, count);
  }
  return { dailyGoal: right.dailyGoal || left.dailyGoal, dailyHistory };
}
