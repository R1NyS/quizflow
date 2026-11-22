import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Clock,
  LayoutGrid,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Card, StudySet } from '../../types';
import { shuffleArray } from '../../utils/array';
import { formatDurationMs, normalizeAnswer, pluralizeCards } from '../../utils/text';

interface MatchModeProps {
  set: StudySet;
}

type MatchPhase = 'ready' | 'playing' | 'finished';
type TileKind = 'term' | 'definition';

interface MatchTile {
  id: string;
  cardId: string;
  kind: TileKind;
  text: string;
}

const MAX_PAIRS_PER_ROUND = 6;
const PENALTY_MS = 1000;

function getTileTextClass(text: string): string {
  const len = text.trim().length;
  if (len <= 24) return 'text-sm sm:text-base font-semibold';
  if (len <= 70) return 'text-xs sm:text-sm font-medium leading-snug';
  return 'text-xs font-normal leading-snug';
}

function buildRoundTiles(sourceCards: readonly Card[]): MatchTile[] {
  const picked = shuffleArray(sourceCards).slice(0, MAX_PAIRS_PER_ROUND);
  const tiles: MatchTile[] = [];

  for (const card of picked) {
    tiles.push({
      id: `${card.id}__term`,
      cardId: card.id,
      kind: 'term',
      text: card.term,
    });
    tiles.push({
      id: `${card.id}__def`,
      cardId: card.id,
      kind: 'definition',
      text: card.definition,
    });
  }

  return shuffleArray(tiles);
}

export const MatchMode: React.FC<MatchModeProps> = ({ set }) => {
  const { setView, updateMatchRecord, notify } = useApp();

  const starredCards = useMemo(
    () => set.cards.filter((c) => c.starred),
    [set.cards]
  );

  const cardsById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const c of set.cards) map.set(c.id, c);
    return map;
  }, [set.cards]);

  const [onlyStarred, setOnlyStarred] = useState(false);
  const [phase, setPhase] = useState<MatchPhase>('ready');
  const [tiles, setTiles] = useState<MatchTile[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [matchedTileIds, setMatchedTileIds] = useState<Set<string>>(new Set());
  const [flashingMatchIds, setFlashingMatchIds] = useState<Set<string>>(
    new Set()
  );
  const [wrongTileIds, setWrongTileIds] = useState<Set<string>>(new Set());

  const [elapsedMs, setElapsedMs] = useState(0);
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [showPenaltyBadge, setShowPenaltyBadge] = useState(false);
  const [finalTimeMs, setFinalTimeMs] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const startTimeRef = useRef<number>(0);
  const penaltyMsRef = useRef<number>(0);
  const timerIntervalRef = useRef<number | null>(null);
  const activeTimeoutsRef = useRef<number[]>([]);

  const clearScheduledTimers = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    for (const timeoutId of activeTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    activeTimeoutsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, delayMs: number) => {
    const id = window.setTimeout(() => {
      activeTimeoutsRef.current = activeTimeoutsRef.current.filter(
        (t) => t !== id
      );
      fn();
    }, delayMs);
    activeTimeoutsRef.current.push(id);
  }, []);

  useEffect(() => {
    return () => clearScheduledTimers();
  }, [clearScheduledTimers]);

  const activePool = useMemo(
    () => (onlyStarred && starredCards.length > 0 ? starredCards : set.cards),
    [onlyStarred, starredCards, set.cards]
  );

  const pairsInRound = Math.min(MAX_PAIRS_PER_ROUND, activePool.length);

  const startGame = useCallback(
    (poolOverride?: readonly Card[]) => {
      clearScheduledTimers();
      const pool = poolOverride ?? activePool;
      const nextTiles = buildRoundTiles(pool);

      setTiles(nextTiles);
      setSelectedTileId(null);
      setMatchedTileIds(new Set());
      setFlashingMatchIds(new Set());
      setWrongTileIds(new Set());
      setElapsedMs(0);
      setPenaltyCount(0);
      setShowPenaltyBadge(false);
      setFinalTimeMs(null);
      setIsNewRecord(false);

      startTimeRef.current = performance.now();
      penaltyMsRef.current = 0;
      setPhase('playing');

      timerIntervalRef.current = window.setInterval(() => {
        const current =
          performance.now() - startTimeRef.current + penaltyMsRef.current;
        setElapsedMs(Math.max(0, Math.round(current)));
      }, 50);
    },
    [activePool, clearScheduledTimers]
  );

  const isPairMatching = useCallback(
    (first: MatchTile, second: MatchTile): boolean => {
      if (first.kind === second.kind) return false;
      if (first.cardId === second.cardId) return true;

      // Корректно засчитываем совпадение, даже если в наборе есть карточки с одинаковым текстом
      const firstCard = cardsById.get(first.cardId);
      if (!firstCard) return false;

      if (first.kind === 'term') {
        return (
          normalizeAnswer(firstCard.definition) === normalizeAnswer(second.text)
        );
      }
      return normalizeAnswer(firstCard.term) === normalizeAnswer(second.text);
    },
    [cardsById]
  );

  const handleTileClick = (tile: MatchTile) => {
    if (phase !== 'playing') return;
    if (matchedTileIds.has(tile.id) || wrongTileIds.size > 0) return;

    if (selectedTileId === null) {
      setSelectedTileId(tile.id);
      return;
    }

    if (selectedTileId === tile.id) {
      setSelectedTileId(null);
      return;
    }

    const firstTile = tiles.find((t) => t.id === selectedTileId);
    if (!firstTile) {
      setSelectedTileId(tile.id);
      return;
    }

    setSelectedTileId(null);

    if (isPairMatching(firstTile, tile)) {
      const nextMatched = new Set(matchedTileIds);
      nextMatched.add(firstTile.id);
      nextMatched.add(tile.id);
      setMatchedTileIds(nextMatched);

      setFlashingMatchIds((prev) => {
        const next = new Set(prev);
        next.add(firstTile.id);
        next.add(tile.id);
        return next;
      });

      const finishedNow = nextMatched.size === tiles.length;

      if (finishedNow) {
        if (timerIntervalRef.current !== null) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        const computedFinalMs = Math.max(
          100,
          Math.round(
            performance.now() - startTimeRef.current + penaltyMsRef.current
          )
        );
        setElapsedMs(computedFinalMs);
        setFinalTimeMs(computedFinalMs);

        const prevBest = set.bestMatchTimeMs;
        const beatRecord =
          !onlyStarred && (prevBest === null || computedFinalMs < prevBest);
        setIsNewRecord(beatRecord);

        if (!onlyStarred) {
          updateMatchRecord(set.id, computedFinalMs);
          if (beatRecord) {
            notify(
              `Новый рекорд: ${formatDurationMs(computedFinalMs)}!`,
              'success'
            );
          }
        }

        scheduleTimeout(() => {
          setFlashingMatchIds(new Set());
          setPhase('finished');
        }, 360);
      } else {
        scheduleTimeout(() => {
          setFlashingMatchIds((prev) => {
            const next = new Set(prev);
            next.delete(firstTile.id);
            next.delete(tile.id);
            return next;
          });
        }, 300);
      }
    } else {
      penaltyMsRef.current += PENALTY_MS;
      setPenaltyCount((c) => c + 1);
      setElapsedMs(
        Math.round(
          performance.now() - startTimeRef.current + penaltyMsRef.current
        )
      );
      setWrongTileIds(new Set([firstTile.id, tile.id]));
      setShowPenaltyBadge(true);

      scheduleTimeout(() => {
        setWrongTileIds(new Set());
      }, 420);

      scheduleTimeout(() => {
        setShowPenaltyBadge(false);
      }, 700);
    }
  };

  // 1. Стартовый экран
  if (phase === 'ready') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={() => setView({ name: 'detail', setId: set.id })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к набору «{set.title}»
        </button>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
            <LayoutGrid className="h-7 w-7" />
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            Подбор пар на время
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Соединяйте термины с их определениями как можно быстрее. В раунде —{' '}
            <strong>{pluralizeCards(pairsInRound)}</strong> ({pairsInRound * 2}{' '}
            плиток). За каждую ошибку добавляется штраф{' '}
            <strong className="text-rose-600 dark:text-rose-400">+1 сек</strong>.
          </p>

          {set.bestMatchTimeMs !== null && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Trophy className="h-4 w-4" />
              Ваш рекорд: {formatDurationMs(set.bestMatchTimeMs)}
            </div>
          )}

          {starredCards.length > 0 && (
            <label className="mx-auto mt-5 flex max-w-sm cursor-pointer items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-left text-sm font-medium text-slate-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-slate-200">
              <span className="inline-flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                Только избранные ({starredCards.length})
              </span>
              <input
                type="checkbox"
                checked={onlyStarred}
                onChange={(e) => setOnlyStarred(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
            </label>
          )}

          <div className="mt-7">
            <button
              type="button"
              onClick={() => startGame()}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Play className="h-4 w-4 fill-current" />
              Начать игру
            </button>
          </div>
        </section>
      </main>
    );
  }

  // 2. Экран результатов
  if (phase === 'finished') {
    const displayedTime = finalTimeMs ?? elapsedMs;
    const totalPairs = tiles.length / 2;

    return (
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={() => setView({ name: 'detail', setId: set.id })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к набору «{set.title}»
        </button>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
            <Trophy className="h-8 w-8" />
          </div>

          {isNewRecord && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              Новый личный рекорд!
            </div>
          )}

          <div className="mt-3 text-4xl font-extrabold tabular-nums text-slate-900 dark:text-white sm:text-5xl">
            {formatDurationMs(displayedTime)}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Все {totalPairs} пар успешно найдены
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {totalPairs}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Пар собрано
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/40">
              <div className="text-lg font-bold text-rose-700 dark:text-rose-300">
                +{penaltyCount} сек
              </div>
              <div className="text-xs text-rose-700/80 dark:text-rose-300/80">
                Штрафы ({penaltyCount})
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {set.bestMatchTimeMs !== null
                  ? formatDurationMs(set.bestMatchTimeMs)
                  : formatDurationMs(displayedTime)}
              </div>
              <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                Лучшее время
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => startGame()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <RotateCcw className="h-4 w-4" />
              Сыграть ещё раз
            </button>
            <button
              type="button"
              onClick={() => setView({ name: 'detail', setId: set.id })}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              К обзору набора
            </button>
          </div>
        </section>
      </main>
    );
  }

  // 3. Игровое поле
  const clearedPairs = matchedTileIds.size / 2;
  const totalPairs = tiles.length / 2;

  const gridColsClass =
    tiles.length <= 4
      ? 'grid-cols-2'
      : tiles.length <= 6
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            clearScheduledTimers();
            setView({ name: 'detail', setId: set.id });
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к набору
        </button>

        <button
          type="button"
          onClick={() => startGame()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Заново
        </button>
      </div>

      {/* Верхняя панель таймера и прогресса */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2 dark:bg-slate-800">
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {formatDurationMs(elapsedMs)}
            </span>
            {showPenaltyBadge && (
              <span className="absolute -right-2 -top-3 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                +1.0 сек
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Найдено пар:{' '}
            <strong className="text-slate-900 dark:text-white">
              {clearedPairs} / {totalPairs}
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {penaltyCount > 0 && (
            <span className="rounded-lg bg-rose-50 px-2.5 py-1 font-semibold text-rose-600 dark:bg-rose-950/70 dark:text-rose-300">
              Ошибок: {penaltyCount}
            </span>
          )}
          {set.bestMatchTimeMs !== null && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
              <Trophy className="h-3.5 w-3.5" />
              Рекорд: {formatDurationMs(set.bestMatchTimeMs)}
            </span>
          )}
        </div>
      </div>

      {/* Сетка плиток */}
      <div className={`mt-5 grid gap-3 sm:gap-4 ${gridColsClass}`}>
        {tiles.map((tile) => {
          const isFlashingGreen = flashingMatchIds.has(tile.id);
          const isMatchedHidden =
            matchedTileIds.has(tile.id) && !isFlashingGreen;
          const isWrong = wrongTileIds.has(tile.id);
          const isSelected = selectedTileId === tile.id;

          let tileClasses =
            'border-slate-200 bg-white text-slate-900 hover:border-indigo-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:border-indigo-600';

          if (isFlashingGreen) {
            tileClasses =
              'border-emerald-500 bg-emerald-50 text-emerald-900 scale-95 dark:border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-100';
          } else if (isMatchedHidden) {
            tileClasses =
              'pointer-events-none scale-90 border-transparent bg-transparent opacity-0';
          } else if (isWrong) {
            tileClasses =
              'animate-shake border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/70 dark:text-rose-100';
          } else if (isSelected) {
            tileClasses =
              'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/30 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-100';
          }

          return (
            <button
              key={tile.id}
              type="button"
              disabled={isMatchedHidden || isFlashingGreen}
              aria-hidden={isMatchedHidden}
              tabIndex={isMatchedHidden ? -1 : 0}
              onClick={() => handleTileClick(tile)}
              className={`flex h-32 w-full flex-col overflow-hidden rounded-2xl border-2 p-3 text-center shadow-sm transition-all duration-200 sm:h-36 sm:p-4 ${tileClasses}`}
            >
              <div className="flex flex-1 flex-col overflow-y-auto">
                <span
                  className={`my-auto break-words ${getTileTextClass(tile.text)}`}
                >
                  {tile.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
};