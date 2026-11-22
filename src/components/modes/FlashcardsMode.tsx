import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  RotateCcw,
  Shuffle,
  Star,
  Trophy,
  Undo2,
  Volume2,
  X,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Card, StudySet } from '../../types';
import { shuffleArray } from '../../utils/array';
import {
  isSpeechSupported,
  SPEECH_LANG_LABELS,
  SpeechLangOption,
  speakText,
  stopSpeech,
} from '../../utils/speech';
import { pluralizeCards } from '../../utils/text';

interface FlashcardsModeProps {
  set: StudySet;
}

type SortDecision = 'known' | 'learning';

interface SortHistoryEntry {
  cardId: string;
  decision: SortDecision;
}

const SWIPE_THRESHOLD_PX = 85;

function getAdaptiveTextClass(text: string): string {
  const len = text.trim().length;
  if (len <= 28) return 'text-2xl sm:text-4xl font-bold';
  if (len <= 80) return 'text-xl sm:text-2xl font-semibold';
  if (len <= 180) return 'text-lg sm:text-xl font-medium';
  return 'text-base sm:text-lg font-normal leading-relaxed';
}

export const FlashcardsMode: React.FC<FlashcardsModeProps> = ({ set }) => {
  const { setView, toggleCardStar, updateCardProgress, notify } = useApp();

  const speechAvailable = useMemo(() => isSpeechSupported(), []);

  const [sortingMode, setSortingMode] = useState(true);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [startWithDefinition, setStartWithDefinition] = useState(false);
  const [speechLang, setSpeechLang] = useState<SpeechLangOption>('auto');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [deckIds, setDeckIds] = useState<string[]>(() =>
    set.cards.map((c) => c.id)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);

  const [knownIds, setKnownIds] = useState<string[]>([]);
  const [learningIds, setLearningIds] = useState<string[]>([]);
  const [sortHistory, setSortHistory] = useState<SortHistoryEntry[]>([]);
  const [isRoundFinished, setIsRoundFinished] = useState(false);

  // Состояние свайпа
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const didDragMoveRef = useRef(false);

  const cardsById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const card of set.cards) {
      map.set(card.id, card);
    }
    return map;
  }, [set.cards]);

  const starredCards = useMemo(
    () => set.cards.filter((c) => c.starred),
    [set.cards]
  );

  const activeDeck = useMemo(
    () =>
      deckIds
        .map((id) => cardsById.get(id))
        .filter((card): card is Card => card !== undefined),
    [deckIds, cardsById]
  );

  const currentCard: Card | undefined = activeDeck[currentIndex];

  const startNewRound = useCallback(
    (sourceIds: string[], shuffleFlag: boolean) => {
      stopSpeech();
      setIsSpeaking(false);
      const ordered = shuffleFlag ? shuffleArray(sourceIds) : [...sourceIds];
      setDeckIds(ordered);
      setCurrentIndex(0);
      setIsFlipped(false);
      setKnownIds([]);
      setLearningIds([]);
      setSortHistory([]);
      setIsRoundFinished(false);
      setRoundNumber((n) => n + 1);
    },
    []
  );

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  useEffect(() => {
    stopSpeech();
    setIsSpeaking(false);
  }, [currentIndex, isRoundFinished]);

  // Если включён фильтр «Только избранные» и все звёздочки сняты
  useEffect(() => {
    if (onlyStarred && starredCards.length === 0) {
      setOnlyStarred(false);
      startNewRound(
        set.cards.map((c) => c.id),
        isShuffled
      );
      notify('Нет отмеченных карточек — показан весь набор', 'info');
    }
  }, [onlyStarred, starredCards.length, set.cards, isShuffled, startNewRound, notify]);

  const handleToggleOnlyStarred = () => {
    if (!onlyStarred && starredCards.length === 0) {
      notify('Сначала отметьте сложные карточки звёздочкой', 'info');
      return;
    }
    const nextOnlyStarred = !onlyStarred;
    setOnlyStarred(nextOnlyStarred);
    const sourceIds = nextOnlyStarred
      ? starredCards.map((c) => c.id)
      : set.cards.map((c) => c.id);
    startNewRound(sourceIds, isShuffled);
  };

  const handleToggleShuffle = () => {
    const nextShuffled = !isShuffled;
    setIsShuffled(nextShuffled);
    const sourceIds = onlyStarred
      ? starredCards.map((c) => c.id)
      : set.cards.map((c) => c.id);
    startNewRound(sourceIds, nextShuffled);
    notify(
      nextShuffled ? 'Карточки перемешаны' : 'Восстановлен исходный порядок',
      'info'
    );
  };

  const handleSwitchMode = (nextSorting: boolean) => {
    if (sortingMode === nextSorting) return;
    setSortingMode(nextSorting);
    const sourceIds = onlyStarred
      ? starredCards.map((c) => c.id)
      : set.cards.map((c) => c.id);
    startNewRound(sourceIds, isShuffled);
  };

  const handleFlip = useCallback(() => {
    if (!currentCard || isRoundFinished) return;
    setIsFlipped((prev) => !prev);
  }, [currentCard, isRoundFinished]);

  const handleNavigate = useCallback(
    (delta: -1 | 1) => {
      if (activeDeck.length === 0) return;
      const nextIndex = currentIndex + delta;
      if (nextIndex < 0 || nextIndex >= activeDeck.length) return;
      setCurrentIndex(nextIndex);
      setIsFlipped(false);
    },
    [activeDeck.length, currentIndex]
  );

  const handleSortDecision = useCallback(
    (decision: SortDecision) => {
      if (!currentCard || isRoundFinished) return;

      if (decision === 'known') {
        setKnownIds((prev) => [...prev, currentCard.id]);
        updateCardProgress(
          set.id,
          currentCard.id,
          'mastered',
          Math.max(2, currentCard.correctStreak + 1)
        );
      } else {
        setLearningIds((prev) => [...prev, currentCard.id]);
        updateCardProgress(set.id, currentCard.id, 'learning', 0);
      }

      setSortHistory((prev) => [
        ...prev,
        { cardId: currentCard.id, decision },
      ]);

      if (currentIndex + 1 >= activeDeck.length) {
        setIsRoundFinished(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      }
    },
    [
      currentCard,
      isRoundFinished,
      currentIndex,
      activeDeck.length,
      set.id,
      updateCardProgress,
    ]
  );

  const handleUndoSort = useCallback(() => {
    if (sortHistory.length === 0) return;
    const last = sortHistory[sortHistory.length - 1];
    setSortHistory((prev) => prev.slice(0, -1));

    if (last.decision === 'known') {
      setKnownIds((prev) => prev.slice(0, -1));
    } else {
      setLearningIds((prev) => prev.slice(0, -1));
    }

    if (isRoundFinished) {
      setIsRoundFinished(false);
      setCurrentIndex(Math.max(0, activeDeck.length - 1));
    } else {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    }
    setIsFlipped(false);
  }, [sortHistory, isRoundFinished, activeDeck.length]);

  const frontText = currentCard
    ? startWithDefinition
      ? currentCard.definition
      : currentCard.term
    : '';
  const backText = currentCard
    ? startWithDefinition
      ? currentCard.term
      : currentCard.definition
    : '';

  const frontLabel = startWithDefinition ? 'Определение' : 'Термин';
  const backLabel = startWithDefinition ? 'Термин' : 'Определение';

  const handleSpeakCurrentSide = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!speechAvailable || !currentCard) return;
      const textToRead = isFlipped ? backText : frontText;
      speakText(
        textToRead,
        speechLang,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );
    },
    [speechAvailable, currentCard, isFlipped, backText, frontText, speechLang]
  );

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (isRoundFinished) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (sortingMode) {
          handleSortDecision('learning');
        } else {
          handleNavigate(-1);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (sortingMode) {
          handleSortDecision('known');
        } else {
          handleNavigate(1);
        }
      } else if (sortingMode && e.key === '1') {
        e.preventDefault();
        handleSortDecision('learning');
      } else if (sortingMode && e.key === '2') {
        e.preventDefault();
        handleSortDecision('known');
      } else if (sortingMode && (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я')) {
        e.preventDefault();
        handleUndoSort();
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') {
        e.preventDefault();
        handleSpeakCurrentSide();
      } else if (
        (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') &&
        currentCard
      ) {
        e.preventDefault();
        toggleCardStar(set.id, currentCard.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isRoundFinished,
    sortingMode,
    handleFlip,
    handleSortDecision,
    handleNavigate,
    handleUndoSort,
    handleSpeakCurrentSide,
    currentCard,
    set.id,
    toggleCardStar,
  ]);

  // Обработка свайпов (мышь + touch через Pointer Events)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select')) return;
    pointerStartXRef.current = e.clientX;
    pointerStartYRef.current = e.clientY;
    didDragMoveRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartXRef.current === null || pointerStartYRef.current === null) {
      return;
    }
    const dx = e.clientX - pointerStartXRef.current;
    const dy = e.clientY - pointerStartYRef.current;

    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      didDragMoveRef.current = true;
      setDragOffsetX(dx);
    }
  };

  const finishPointerInteraction = () => {
    if (pointerStartXRef.current === null) return;
    const finalOffset = dragOffsetX;
    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
    setIsDragging(false);
    setDragOffsetX(0);

    if (Math.abs(finalOffset) >= SWIPE_THRESHOLD_PX) {
      if (sortingMode) {
        handleSortDecision(finalOffset > 0 ? 'known' : 'learning');
      } else {
        handleNavigate(finalOffset < 0 ? 1 : -1);
      }
    }
  };

  const handleCardClick = () => {
    if (didDragMoveRef.current) {
      didDragMoveRef.current = false;
      return;
    }
    handleFlip();
  };

  const swipeHint: 'known' | 'learning' | null =
    sortingMode && Math.abs(dragOffsetX) > 35
      ? dragOffsetX > 0
        ? 'known'
        : 'learning'
      : null;

  const progressPercent =
    activeDeck.length > 0
      ? Math.round(
          ((sortingMode ? sortHistory.length : currentIndex + 1) /
            activeDeck.length) *
            100
        )
      : 0;

  // Экран итогов сортировки
  if (isRoundFinished) {
    const total = knownIds.length + learningIds.length;
    const percentKnown = total > 0 ? Math.round((knownIds.length / total) * 100) : 0;
    const unlearnedCards = learningIds
      .map((id) => cardsById.get(id))
      .filter((c): c is Card => c !== undefined);

    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => setView({ name: 'detail', setId: set.id })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к набору «{set.title}»
        </button>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Trophy className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              {learningIds.length === 0
                ? 'Отличный результат! Все карточки пройдены'
                : 'Раунд завершён'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Вы знаете {knownIds.length} из {total} карточек ({percentKnown}%)
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {knownIds.length}
              </div>
              <div className="mt-0.5 text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">
                Знаю
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center dark:border-amber-900/60 dark:bg-amber-950/40">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                {learningIds.length}
              </div>
              <div className="mt-0.5 text-xs font-medium text-amber-700/80 dark:text-amber-300/80">
                Ещё учу
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {learningIds.length > 0 && (
              <button
                type="button"
                onClick={() => startNewRound(learningIds, isShuffled)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <RotateCcw className="h-4 w-4" />
                Повторить только невыученные ({learningIds.length})
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                startNewRound(
                  onlyStarred
                    ? starredCards.map((c) => c.id)
                    : set.cards.map((c) => c.id),
                  isShuffled
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Пройти весь набор заново
            </button>
            <button
              type="button"
              onClick={() => setView({ name: 'detail', setId: set.id })}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              К обзору набора
            </button>
          </div>

          {unlearnedCards.length > 0 && (
            <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Осталось подучить ({pluralizeCards(unlearnedCards.length)}):
              </h2>
              <div className="mt-3 space-y-2">
                {unlearnedCards.map((card) => (
                  <div
                    key={card.id}
                    className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2"
                  >
                    <div className="break-words font-medium text-slate-900 dark:text-white">
                      {card.term}
                    </div>
                    <div className="break-words text-slate-600 dark:text-slate-300">
                      {card.definition}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setView({ name: 'detail', setId: set.id })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к набору
        </button>

        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => handleSwitchMode(true)}
            className={`rounded-lg px-3 py-1.5 transition ${
              sortingMode
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Сортировка
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode(false)}
            className={`rounded-lg px-3 py-1.5 transition ${
              !sortingMode
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Просмотр
          </button>
        </div>
      </div>

      {/* Панель настроек */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-slate-900 dark:text-white">
            {set.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Карточка {Math.min(currentIndex + 1, activeDeck.length)} из{' '}
            {activeDeck.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleShuffle}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              isShuffled
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Shuffle className="h-3.5 w-3.5" />
            Перемешать
          </button>

          <button
            type="button"
            onClick={handleToggleOnlyStarred}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              onlyStarred
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 ${onlyStarred ? 'fill-current' : ''}`}
            />
            Избранные ({starredCards.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setStartWithDefinition((prev) => !prev);
              setIsFlipped(false);
            }}
            title="Поменять лицевую сторону карточки"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {startWithDefinition ? 'Сначала определение' : 'Сначала термин'}
          </button>

          {speechAvailable && (
            <select
              aria-label="Язык озвучивания"
              value={speechLang}
              onChange={(e) =>
                setSpeechLang(e.target.value as SpeechLangOption)
              }
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {(Object.keys(SPEECH_LANG_LABELS) as SpeechLangOption[]).map(
                (lang) => (
                  <option key={lang} value={lang}>
                    Озвучка: {SPEECH_LANG_LABELS[lang]}
                  </option>
                )
              )}
            </select>
          )}
        </div>
      </div>

      {/* Индикатор прогресса */}
      <div className="mt-5">
        {sortingMode && (
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
              Ещё учу: {learningIds.length}
            </span>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
              Знаю: {knownIds.length}
            </span>
          </div>
        )}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3D-карточка */}
      {currentCard && (
        <div className="mt-6 select-none">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerInteraction}
            onPointerCancel={finishPointerInteraction}
            onClick={handleCardClick}
            style={{
              transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX * 0.03}deg)`,
              transition: isDragging ? 'none' : 'transform 200ms ease-out',
            }}
            className="perspective-1000 relative mx-auto h-[340px] w-full max-w-2xl cursor-pointer touch-pan-y sm:h-[400px]"
          >
            {/* Плашка подсказки при свайпе */}
            {swipeHint && (
              <div
                className={`pointer-events-none absolute top-4 z-20 rounded-xl px-3.5 py-1.5 text-sm font-bold shadow-md ${
                  swipeHint === 'known'
                    ? 'left-4 bg-emerald-600 text-white'
                    : 'right-4 bg-amber-500 text-white'
                }`}
              >
                {swipeHint === 'known' ? 'Знаю ✓' : 'Ещё учу ✕'}
              </div>
            )}

            <div
              key={`${currentCard.id}-${roundNumber}`}
              className={`preserve-3d relative h-full w-full duration-500 ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Лицевая сторона */}
              <div
                className={`backface-hidden absolute inset-0 flex flex-col rounded-3xl border bg-white p-5 shadow-lg transition-colors dark:bg-slate-900 sm:p-7 ${
                  swipeHint === 'known'
                    ? 'border-emerald-400 ring-2 ring-emerald-500/30'
                    : swipeHint === 'learning'
                      ? 'border-amber-400 ring-2 ring-amber-500/30'
                      : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {frontLabel}
                  </span>

                  <div className="flex items-center gap-1">
                    {speechAvailable && (
                      <button
                        type="button"
                        onClick={handleSpeakCurrentSide}
                        aria-label="Озвучить текст"
                        title="Озвучить (S)"
                        className={`rounded-xl p-2 transition ${
                          isSpeaking && !isFlipped
                            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Volume2 className="h-5 w-5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardStar(set.id, currentCard.id);
                      }}
                      aria-label={
                        currentCard.starred
                          ? 'Убрать из избранного'
                          : 'Добавить в избранное'
                      }
                      title="Избранное / Сложное (F)"
                      className={`rounded-xl p-2 transition ${
                        currentCard.starred
                          ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Star
                        className={`h-5 w-5 ${
                          currentCard.starred ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-1 flex-col overflow-y-auto px-2 py-2">
                  <div
                    className={`my-auto break-words text-center text-slate-900 dark:text-white ${getAdaptiveTextClass(
                      frontText
                    )}`}
                  >
                    {frontText}
                  </div>
                </div>

                <div className="mt-2 shrink-0 text-center text-xs text-slate-400">
                  Нажмите на карточку или клавишу Пробел, чтобы перевернуть
                </div>
              </div>

              {/* Обратная сторона */}
              <div
                className={`backface-hidden rotate-y-180 absolute inset-0 flex flex-col rounded-3xl border bg-indigo-50/40 p-5 shadow-lg transition-colors dark:bg-slate-900 sm:p-7 ${
                  swipeHint === 'known'
                    ? 'border-emerald-400 ring-2 ring-emerald-500/30'
                    : swipeHint === 'learning'
                      ? 'border-amber-400 ring-2 ring-amber-500/30'
                      : 'border-indigo-200 dark:border-indigo-900/70'
                }`}
              >
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {backLabel}
                  </span>

                  <div className="flex items-center gap-1">
                    {speechAvailable && (
                      <button
                        type="button"
                        onClick={handleSpeakCurrentSide}
                        aria-label="Озвучить текст"
                        title="Озвучить (S)"
                        className={`rounded-xl p-2 transition ${
                          isSpeaking && isFlipped
                            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                            : 'text-slate-400 hover:bg-white/80 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Volume2 className="h-5 w-5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardStar(set.id, currentCard.id);
                      }}
                      aria-label={
                        currentCard.starred
                          ? 'Убрать из избранного'
                          : 'Добавить в избранное'
                      }
                      title="Избранное / Сложное (F)"
                      className={`rounded-xl p-2 transition ${
                        currentCard.starred
                          ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                          : 'text-slate-400 hover:bg-white/80 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Star
                        className={`h-5 w-5 ${
                          currentCard.starred ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-1 flex-col overflow-y-auto px-2 py-2">
                  <div
                    className={`my-auto break-words text-center text-slate-900 dark:text-white ${getAdaptiveTextClass(
                      backText
                    )}`}
                  >
                    {backText}
                  </div>
                </div>

                <div className="mt-2 shrink-0 text-center text-xs text-slate-400">
                  {sortingMode
                    ? 'Свайпните влево/вправо или выберите кнопку ниже'
                    : 'Нажмите Пробел, чтобы вернуться к лицевой стороне'}
                </div>
              </div>
            </div>
          </div>

          {/* Кнопки управления */}
          <div className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-3">
            {sortingMode ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSortDecision('learning')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-amber-200 bg-white px-4 py-3.5 text-sm font-semibold text-amber-700 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 dark:border-amber-900/70 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950/50"
                >
                  <X className="h-5 w-5" />
                  <span>Ещё учу</span>
                  <kbd className="hidden rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-mono dark:bg-amber-950 sm:inline">
                    ←
                  </kbd>
                </button>

                <button
                  type="button"
                  disabled={sortHistory.length === 0}
                  onClick={handleUndoSort}
                  title="Отменить последнее действие (Z)"
                  aria-label="Отменить последнее действие"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Undo2 className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSortDecision('known')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-white px-4 py-3.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-900/70 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                >
                  <Check className="h-5 w-5" />
                  <span>Знаю</span>
                  <kbd className="hidden rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-mono dark:bg-emerald-950 sm:inline">
                    →
                  </kbd>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => handleNavigate(-1)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Назад
                </button>

                <span className="min-w-[80px] text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {currentIndex + 1} / {activeDeck.length}
                </span>

                <button
                  type="button"
                  disabled={currentIndex >= activeDeck.length - 1}
                  onClick={() => handleNavigate(1)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Далее
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Подсказка горячих клавиш */}
          <div className="mx-auto mt-6 hidden max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-400 sm:flex">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="h-3.5 w-3.5" />
              Горячие клавиши:
            </span>
            <span>
              <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-700">
                Пробел
              </kbd>{' '}
              перевернуть
            </span>
            <span>
              <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-700">
                ←
              </kbd>{' '}
              /{' '}
              <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-700">
                →
              </kbd>{' '}
              {sortingMode ? 'ещё учу / знаю' : 'навигация'}
            </span>
            {sortingMode && (
              <span>
                <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-700">
                  Z
                </kbd>{' '}
                отмена
              </span>
            )}
            {speechAvailable && (
              <span>
                <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-700">
                  S
                </kbd>{' '}
                озвучить
              </span>
            )}
            <span>
              <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-700">
                F
              </kbd>{' '}
              избранное
            </span>
          </div>
        </div>
      )}
    </main>
  );
};