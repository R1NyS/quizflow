import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  HelpCircle,
  Keyboard,
  RotateCcw,
  Star,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Card, MasteryStatus, StudySet } from '../../types';
import { shuffleArray } from '../../utils/array';
import { normalizeAnswer, pluralizeCards } from '../../utils/text';

interface LearnModeProps {
  set: StudySet;
}

type QuestionStage = 'mc' | 'written';
type PromptSide = 'term' | 'definition';

interface CardLearnState {
  cardId: string;
  stage: QuestionStage | 'done';
  status: MasteryStatus;
  mistakes: number;
}

interface ActiveQuestion {
  cardId: string;
  stage: QuestionStage;
  options: string[];
}

interface AnswerFeedback {
  stage: QuestionStage;
  isCorrect: boolean;
  userAnswer: string;
  expectedAnswer: string;
  wasSkipped: boolean;
}

function getPromptText(card: Card, promptSide: PromptSide): string {
  return promptSide === 'term' ? card.term : card.definition;
}

function getExpectedAnswer(card: Card, promptSide: PromptSide): string {
  return promptSide === 'term' ? card.definition : card.term;
}

function buildOptionsForCard(
  targetCard: Card,
  allCards: readonly Card[],
  promptSide: PromptSide
): string[] {
  const correctAnswer = getExpectedAnswer(targetCard, promptSide);
  const normalizedCorrect = normalizeAnswer(correctAnswer);

  const seenNormalized = new Set<string>([normalizedCorrect]);
  const distractors: string[] = [];

  for (const candidate of shuffleArray(allCards)) {
    if (candidate.id === targetCard.id) continue;
    const answerText = getExpectedAnswer(candidate, promptSide);
    const norm = normalizeAnswer(answerText);
    if (!norm || seenNormalized.has(norm)) continue;
    seenNormalized.add(norm);
    distractors.push(answerText);
    if (distractors.length === 3) break;
  }

  return shuffleArray([correctAnswer, ...distractors]);
}

function buildQuestion(
  cardId: string,
  desiredStage: QuestionStage,
  allCards: readonly Card[],
  promptSide: PromptSide
): ActiveQuestion | null {
  const card = allCards.find((c) => c.id === cardId);
  if (!card) return null;

  if (desiredStage === 'mc') {
    const options = buildOptionsForCard(card, allCards, promptSide);
    // Если уникальных вариантов меньше 2 (например, 1 карточка в наборе),
    // автоматически переключаем на письменный ввод
    if (options.length < 2) {
      return { cardId, stage: 'written', options: [] };
    }
    return { cardId, stage: 'mc', options };
  }

  return { cardId, stage: 'written', options: [] };
}

function createInitialSession(
  sourceCards: readonly Card[],
  allSetCards: readonly Card[],
  promptSide: PromptSide
): {
  queue: string[];
  states: Record<string, CardLearnState>;
  question: ActiveQuestion | null;
} {
  const shuffled = shuffleArray(sourceCards);
  const queue = shuffled.map((c) => c.id);
  const states: Record<string, CardLearnState> = {};

  for (const card of shuffled) {
    const testOptions = buildOptionsForCard(card, allSetCards, promptSide);
    const initialStage: QuestionStage =
      testOptions.length >= 2 ? 'mc' : 'written';
    states[card.id] = {
      cardId: card.id,
      stage: initialStage,
      status: 'new',
      mistakes: 0,
    };
  }

  const firstId = queue[0];
  const firstQuestion = firstId
    ? buildQuestion(
        firstId,
        states[firstId].stage === 'done' ? 'written' : states[firstId].stage,
        allSetCards,
        promptSide
      )
    : null;

  return { queue, states, question: firstQuestion };
}

export const LearnMode: React.FC<LearnModeProps> = ({ set }) => {
  const { setView, updateCardProgress, toggleCardStar, notify } = useApp();

  const [promptSide, setPromptSide] = useState<PromptSide>('term');
  const [onlyStarred, setOnlyStarred] = useState(false);

  const initial = useMemo(
    () => createInitialSession(set.cards, set.cards, 'term'),
    [set.cards]
  );

  const [queue, setQueue] = useState<string[]>(initial.queue);
  const [cardStates, setCardStates] = useState<Record<string, CardLearnState>>(
    initial.states
  );
  const [currentQuestion, setCurrentQuestion] = useState<ActiveQuestion | null>(
    initial.question
  );
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [writtenInput, setWrittenInput] = useState('');
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [totalMistakes, setTotalMistakes] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const cardsById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const c of set.cards) map.set(c.id, c);
    return map;
  }, [set.cards]);

  const starredCards = useMemo(
    () => set.cards.filter((c) => c.starred),
    [set.cards]
  );

  const startSession = useCallback(
    (sourceCards: readonly Card[], nextPromptSide: PromptSide) => {
      const next = createInitialSession(sourceCards, set.cards, nextPromptSide);
      setQueue(next.queue);
      setCardStates(next.states);
      setCurrentQuestion(next.question);
      setFeedback(null);
      setWrittenInput('');
      setTotalAttempts(0);
      setTotalMistakes(0);
    },
    [set.cards]
  );

  const currentCard = currentQuestion
    ? cardsById.get(currentQuestion.cardId)
    : undefined;

  const isFinished = queue.length === 0 || !currentQuestion || !currentCard;

  // Автофокус поля ввода на письменном этапе
  useEffect(() => {
    if (
      !isFinished &&
      currentQuestion?.stage === 'written' &&
      feedback === null
    ) {
      inputRef.current?.focus();
    }
  }, [isFinished, currentQuestion, feedback]);

  // Статистика прогресса в реальном времени
  const progressStats = useMemo(() => {
    const entries = Object.values(cardStates);
    let newCount = 0;
    let learningCount = 0;
    let masteredCount = 0;

    for (const entry of entries) {
      if (entry.status === 'mastered') masteredCount += 1;
      else if (entry.status === 'learning') learningCount += 1;
      else newCount += 1;
    }

    return {
      total: entries.length,
      newCount,
      learningCount,
      masteredCount,
    };
  }, [cardStates]);

  const handleSelectMcOption = useCallback(
    (selectedOption: string) => {
      if (!currentQuestion || !currentCard || feedback !== null) return;

      const expectedAnswer = getExpectedAnswer(currentCard, promptSide);
      const isCorrect =
        normalizeAnswer(selectedOption) === normalizeAnswer(expectedAnswer);

      setTotalAttempts((n) => n + 1);

      if (isCorrect) {
        setCardStates((prev) => ({
          ...prev,
          [currentCard.id]: {
            ...prev[currentCard.id],
            stage: 'written',
            status: 'learning',
          },
        }));
        updateCardProgress(set.id, currentCard.id, 'learning', 1);
      } else {
        setTotalMistakes((n) => n + 1);
        setCardStates((prev) => ({
          ...prev,
          [currentCard.id]: {
            ...prev[currentCard.id],
            stage: 'mc',
            status: 'learning',
            mistakes: prev[currentCard.id].mistakes + 1,
          },
        }));
        updateCardProgress(set.id, currentCard.id, 'learning', 0);
      }

      setFeedback({
        stage: 'mc',
        isCorrect,
        userAnswer: selectedOption,
        expectedAnswer,
        wasSkipped: false,
      });
    },
    [currentQuestion, currentCard, feedback, promptSide, set.id, updateCardProgress]
  );

  const handleSubmitWritten = useCallback(
    (e?: React.FormEvent, skipAsUnknown = false) => {
      e?.preventDefault();
      if (!currentQuestion || !currentCard || feedback !== null) return;

      const trimmed = writtenInput.trim();
      if (!skipAsUnknown && !trimmed) return;

      const expectedAnswer = getExpectedAnswer(currentCard, promptSide);
      const isCorrect =
        !skipAsUnknown &&
        normalizeAnswer(trimmed) === normalizeAnswer(expectedAnswer);

      setTotalAttempts((n) => n + 1);

      if (isCorrect) {
        setCardStates((prev) => ({
          ...prev,
          [currentCard.id]: {
            ...prev[currentCard.id],
            stage: 'done',
            status: 'mastered',
          },
        }));
        updateCardProgress(set.id, currentCard.id, 'mastered', 2);
      } else {
        setTotalMistakes((n) => n + 1);
        setCardStates((prev) => ({
          ...prev,
          [currentCard.id]: {
            ...prev[currentCard.id],
            stage: 'written',
            status: 'learning',
            mistakes: prev[currentCard.id].mistakes + 1,
          },
        }));
        updateCardProgress(set.id, currentCard.id, 'learning', 0);
      }

      setFeedback({
        stage: 'written',
        isCorrect,
        userAnswer: skipAsUnknown ? '' : trimmed,
        expectedAnswer,
        wasSkipped: skipAsUnknown,
      });
    },
    [
      currentQuestion,
      currentCard,
      feedback,
      writtenInput,
      promptSide,
      set.id,
      updateCardProgress,
    ]
  );

  const handleSkipMc = () => {
    if (!currentQuestion || !currentCard || feedback !== null) return;
    const expectedAnswer = getExpectedAnswer(currentCard, promptSide);
    setTotalAttempts((n) => n + 1);
    setTotalMistakes((n) => n + 1);
    setCardStates((prev) => ({
      ...prev,
      [currentCard.id]: {
        ...prev[currentCard.id],
        stage: 'mc',
        status: 'learning',
        mistakes: prev[currentCard.id].mistakes + 1,
      },
    }));
    updateCardProgress(set.id, currentCard.id, 'learning', 0);
    setFeedback({
      stage: 'mc',
      isCorrect: false,
      userAnswer: '',
      expectedAnswer,
      wasSkipped: true,
    });
  };

  const advanceQueue = useCallback(
    (reinsertCurrent: boolean, updatedStates: Record<string, CardLearnState>) => {
      const [currentId, ...rest] = queue;
      if (!currentId) return;

      const nextQueue = [...rest];
      if (reinsertCurrent) {
        // Возвращаем карточку позже в этом же раунде (через 2–3 вопроса)
        const insertAt = Math.min(3, nextQueue.length);
        nextQueue.splice(insertAt, 0, currentId);
      }

      setQueue(nextQueue);
      setFeedback(null);
      setWrittenInput('');

      const nextId = nextQueue[0];
      if (!nextId) {
        setCurrentQuestion(null);
        return;
      }

      const nextState = updatedStates[nextId];
      const desiredStage: QuestionStage =
        nextState && nextState.stage === 'written' ? 'written' : 'mc';

      setCurrentQuestion(
        buildQuestion(nextId, desiredStage, set.cards, promptSide)
      );
    },
    [queue, set.cards, promptSide]
  );

  const handleNext = useCallback(() => {
    if (!feedback || !currentCard) return;
    const isMasteredNow = feedback.stage === 'written' && feedback.isCorrect;
    advanceQueue(!isMasteredNow, cardStates);
  }, [feedback, currentCard, advanceQueue, cardStates]);

  const handleOverrideCorrect = () => {
    if (!feedback || !currentCard || feedback.stage !== 'written') return;

    const currentState = cardStates[currentCard.id];
    const nextStates: Record<string, CardLearnState> = {
      ...cardStates,
      [currentCard.id]: {
        ...currentState,
        stage: 'done',
        status: 'mastered',
        mistakes: Math.max(0, currentState.mistakes - 1),
      },
    };

    setCardStates(nextStates);
    setTotalMistakes((n) => Math.max(0, n - 1));
    updateCardProgress(set.id, currentCard.id, 'mastered', 2);
    notify('Ответ засчитан как верный', 'success');
    advanceQueue(false, nextStates);
  };

  // Горячие клавиши: 1–4 для теста, Enter для перехода к следующему вопросу
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || !currentQuestion) return;

      if (feedback !== null) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (currentQuestion.stage === 'mc') {
        const digit = Number(e.key);
        if (
          Number.isInteger(digit) &&
          digit >= 1 &&
          digit <= currentQuestion.options.length
        ) {
          e.preventDefault();
          handleSelectMcOption(currentQuestion.options[digit - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFinished, currentQuestion, feedback, handleNext, handleSelectMcOption]);

  const handleTogglePromptSide = () => {
    const nextSide: PromptSide = promptSide === 'term' ? 'definition' : 'term';
    setPromptSide(nextSide);
    const source = onlyStarred && starredCards.length > 0 ? starredCards : set.cards;
    startSession(source, nextSide);
  };

  const handleToggleOnlyStarred = () => {
    if (!onlyStarred && starredCards.length === 0) {
      notify('Сначала отметьте сложные карточки звёздочкой', 'info');
      return;
    }
    const nextOnlyStarred = !onlyStarred;
    setOnlyStarred(nextOnlyStarred);
    startSession(nextOnlyStarred ? starredCards : set.cards, promptSide);
  };

  // Экран завершения заучивания
  if (isFinished) {
    const accuracy =
      totalAttempts > 0
        ? Math.round(((totalAttempts - totalMistakes) / totalAttempts) * 100)
        : 100;

    const difficultCards = Object.values(cardStates)
      .filter((s) => s.mistakes > 0)
      .sort((a, b) => b.mistakes - a.mistakes)
      .map((s) => ({
        card: cardsById.get(s.cardId),
        mistakes: s.mistakes,
      }))
      .filter(
        (item): item is { card: Card; mistakes: number } =>
          item.card !== undefined
      );

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
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Trophy className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              Все термины освоены!
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Вы успешно прошли оба этапа (тест и письменный ввод) для{' '}
              {pluralizeCards(progressStats.total)}.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {progressStats.masteredCount}
              </div>
              <div className="mt-0.5 text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">
                Освоено
              </div>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-center dark:border-indigo-900/60 dark:bg-indigo-950/40">
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                {accuracy}%
              </div>
              <div className="mt-0.5 text-xs font-medium text-indigo-700/80 dark:text-indigo-300/80">
                Точность
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center dark:border-amber-900/60 dark:bg-amber-950/40">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                {totalMistakes}
              </div>
              <div className="mt-0.5 text-xs font-medium text-amber-700/80 dark:text-amber-300/80">
                Ошибок
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {difficultCards.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  startSession(
                    difficultCards.map((d) => d.card),
                    promptSide
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <RotateCcw className="h-4 w-4" />
                Повторить термины с ошибками ({difficultCards.length})
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                startSession(
                  onlyStarred && starredCards.length > 0
                    ? starredCards
                    : set.cards,
                  promptSide
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Начать заново
            </button>
            <button
              type="button"
              onClick={() => setView({ name: 'detail', setId: set.id })}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              К обзору набора
            </button>
          </div>

          {difficultCards.length > 0 && (
            <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Термины, на которых были ошибки:
              </h2>
              <div className="mt-3 space-y-2">
                {difficultCards.map(({ card, mistakes }) => (
                  <div
                    key={card.id}
                    className="grid grid-cols-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_1.4fr_auto]"
                  >
                    <div className="break-words font-medium text-slate-900 dark:text-white">
                      {card.term}
                    </div>
                    <div className="break-words text-slate-600 dark:text-slate-300">
                      {card.definition}
                    </div>
                    <span className="justify-self-start rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 sm:justify-self-end">
                      Ошибок: {mistakes}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  const promptText = getPromptText(currentCard, promptSide);
  const promptLabel = promptSide === 'term' ? 'Термин' : 'Определение';
  const answerLabel = promptSide === 'term' ? 'определение' : 'термин';

  const masteredPct =
    progressStats.total > 0
      ? (progressStats.masteredCount / progressStats.total) * 100
      : 0;
  const learningPct =
    progressStats.total > 0
      ? (progressStats.learningCount / progressStats.total) * 100
      : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setView({ name: 'detail', setId: set.id })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к набору
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleOnlyStarred}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              onlyStarred
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 ${onlyStarred ? 'fill-current' : ''}`}
            />
            Избранные ({starredCards.length})
          </button>

          <button
            type="button"
            onClick={handleTogglePromptSide}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {promptSide === 'term'
              ? 'Вопрос: термин'
              : 'Вопрос: определение'}
          </button>
        </div>
      </div>

      {/* Индикатор прогресса в реальном времени */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span className="text-slate-500 dark:text-slate-400">
            Новые:{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {progressStats.newCount}
            </strong>
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            В процессе: <strong>{progressStats.learningCount}</strong>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">
            Освоено:{' '}
            <strong>
              {progressStats.masteredCount} / {progressStats.total}
            </strong>
          </span>
        </div>

        <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${masteredPct}%` }}
          />
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{ width: `${learningPct}%` }}
          />
        </div>
      </section>

      {/* Карточка вопроса */}
      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {promptLabel}
            </span>
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                currentQuestion.stage === 'mc'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                  : 'bg-violet-50 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300'
              }`}
            >
              {currentQuestion.stage === 'mc'
                ? 'Этап 1: Выбор ответа'
                : 'Этап 2: Письменный ввод'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => toggleCardStar(set.id, currentCard.id)}
            aria-label={
              currentCard.starred
                ? 'Убрать из избранного'
                : 'Отметить как сложное'
            }
            className={`rounded-xl p-2 transition ${
              currentCard.starred
                ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-800'
            }`}
          >
            <Star
              className={`h-5 w-5 ${currentCard.starred ? 'fill-current' : ''}`}
            />
          </button>
        </div>

        <div className="mt-5 max-h-52 overflow-y-auto break-words text-xl font-bold leading-snug text-slate-900 dark:text-white sm:text-2xl">
          {promptText}
        </div>

        {/* Этап 1: Выбор варианта ответа */}
        {currentQuestion.stage === 'mc' && (
          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Выберите правильное {answerLabel}:</span>
              {feedback === null && (
                <button
                  type="button"
                  onClick={handleSkipMc}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Не знаю
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentQuestion.options.map((option, idx) => {
                const isExpected =
                  feedback !== null &&
                  normalizeAnswer(option) ===
                    normalizeAnswer(feedback.expectedAnswer);
                const isSelected =
                  feedback !== null &&
                  !feedback.wasSkipped &&
                  feedback.userAnswer === option;

                let stateClasses =
                  'border-slate-200 bg-slate-50/70 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40';

                if (feedback !== null) {
                  if (isExpected) {
                    stateClasses =
                      'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-100';
                  } else if (isSelected && !feedback.isCorrect) {
                    stateClasses =
                      'border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-100';
                  } else {
                    stateClasses =
                      'border-slate-200 bg-slate-50/40 text-slate-400 opacity-60 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500';
                  }
                }

                return (
                  <button
                    key={`${idx}-${option.slice(0, 20)}`}
                    type="button"
                    disabled={feedback !== null}
                    onClick={() => handleSelectMcOption(option)}
                    className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left text-sm font-medium transition ${stateClasses}`}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-current/20 text-xs font-bold opacity-75">
                      {idx + 1}
                    </span>
                    <span className="break-words leading-relaxed">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Этап 2: Письменный ввод */}
        {currentQuestion.stage === 'written' && (
          <form
            onSubmit={(e) => handleSubmitWritten(e, false)}
            className="mt-7 space-y-4"
          >
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <label htmlFor="learn-written-input">
                  Введите {answerLabel}:
                </label>
                {feedback === null && (
                  <button
                    type="button"
                    onClick={() => handleSubmitWritten(undefined, true)}
                    className="inline-flex items-center gap-1 font-medium text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Не знаю
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <input
                  ref={inputRef}
                  id="learn-written-input"
                  type="text"
                  autoComplete="off"
                  disabled={feedback !== null}
                  value={writtenInput}
                  onChange={(e) => setWrittenInput(e.target.value)}
                  placeholder="Напечатайте ответ..."
                  className="flex-1 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
                />
                {feedback === null && (
                  <button
                    type="submit"
                    disabled={!writtenInput.trim()}
                    className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Проверить
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* Блок обратной связи после ответа */}
        {feedback !== null && (
          <div
            className={`mt-6 rounded-2xl border p-4 ${
              feedback.isCorrect
                ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/70 dark:bg-emerald-950/40'
                : 'border-rose-200 bg-rose-50/80 dark:border-rose-900/70 dark:bg-rose-950/40'
            }`}
          >
            <div className="flex items-start gap-3">
              {feedback.isCorrect ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              )}

              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <div
                  className={`font-semibold ${
                    feedback.isCorrect
                      ? 'text-emerald-800 dark:text-emerald-200'
                      : 'text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {feedback.isCorrect
                    ? feedback.stage === 'mc'
                      ? 'Верно! Дальше закрепим письменно.'
                      : 'Отлично! Термин освоен.'
                    : feedback.wasSkipped
                      ? 'Запомните правильный ответ — карточка вернётся позже.'
                      : 'Не совсем верно — карточка вернётся позже в этом раунде.'}
                </div>

                {!feedback.isCorrect && (
                  <div className="space-y-1">
                    {!feedback.wasSkipped && feedback.userAnswer && (
                      <div className="break-words text-xs text-rose-700/90 dark:text-rose-300">
                        Ваш ответ:{' '}
                        <span className="line-through">
                          {feedback.userAnswer}
                        </span>
                      </div>
                    )}
                    <div className="break-words text-sm text-slate-900 dark:text-white">
                      Правильный ответ:{' '}
                      <strong className="text-emerald-700 dark:text-emerald-300">
                        {feedback.expectedAnswer}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {feedback.stage === 'written' && !feedback.isCorrect ? (
                <button
                  type="button"
                  onClick={handleOverrideCorrect}
                  className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                >
                  Переопределить: я ответил верно
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Далее
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="mt-5 hidden flex-wrap items-center justify-center gap-4 text-xs text-slate-400 sm:flex">
        <span className="inline-flex items-center gap-1">
          <Keyboard className="h-3.5 w-3.5" />
          Горячие клавиши:
        </span>
        {currentQuestion.stage === 'mc' && (
          <span>
            <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-700">
              1–{currentQuestion.options.length}
            </kbd>{' '}
            выбрать ответ
          </span>
        )}
        <span>
          <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-700">
            Enter
          </kbd>{' '}
          проверить / далее
        </span>
      </div>
    </main>
  );
};