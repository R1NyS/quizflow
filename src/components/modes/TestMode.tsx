import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Card, StudySet } from '../../types';
import { shuffleArray } from '../../utils/array';
import { generateId } from '../../utils/storage';
import { normalizeAnswer, pluralizeCards } from '../../utils/text';

interface TestModeProps {
  set: StudySet;
}

type TestPhase = 'setup' | 'taking' | 'results';
type QuestionType = 'written' | 'mc' | 'tf';
type PromptSideOption = 'term' | 'definition' | 'mixed';
type ResolvedSide = 'term' | 'definition';
type ResultFilter = 'all' | 'wrong' | 'correct';

interface BaseTestQuestion {
  id: string;
  cardId: string;
  promptSide: ResolvedSide;
  promptText: string;
  expectedAnswer: string;
}

interface WrittenQuestion extends BaseTestQuestion {
  type: 'written';
}

interface MultipleChoiceQuestion extends BaseTestQuestion {
  type: 'mc';
  options: string[];
}

interface TrueFalseQuestion extends BaseTestQuestion {
  type: 'tf';
  shownAnswer: string;
  isStatementTrue: boolean;
}

type TestQuestion =
  | WrittenQuestion
  | MultipleChoiceQuestion
  | TrueFalseQuestion;

type UserAnswer = string | boolean | undefined;

interface EvaluatedQuestion {
  question: TestQuestion;
  userAnswer: UserAnswer;
  isAnswered: boolean;
  isCorrect: boolean;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  written: 'Письменный',
  mc: 'Выбор ответа',
  tf: 'Верно / Неверно',
};

function getPromptText(card: Card, side: ResolvedSide): string {
  return side === 'term' ? card.term : card.definition;
}

function getAnswerText(card: Card, side: ResolvedSide): string {
  return side === 'term' ? card.definition : card.term;
}

function collectDistractors(
  targetCard: Card,
  allCards: readonly Card[],
  side: ResolvedSide,
  maxCount: number
): string[] {
  const normalizedExpected = normalizeAnswer(getAnswerText(targetCard, side));
  const seen = new Set<string>([normalizedExpected]);
  const distractors: string[] = [];

  for (const candidate of shuffleArray(allCards)) {
    if (candidate.id === targetCard.id) continue;
    const text = getAnswerText(candidate, side);
    const norm = normalizeAnswer(text);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    distractors.push(text);
    if (distractors.length >= maxCount) break;
  }

  return distractors;
}

function generateTestQuestions(
  sourceCards: readonly Card[],
  allSetCards: readonly Card[],
  count: number,
  enabledTypes: readonly QuestionType[],
  promptSideOption: PromptSideOption
): TestQuestion[] {
  const safeCount = Math.max(1, Math.min(count, sourceCards.length));
  const pickedCards = shuffleArray(sourceCards).slice(0, safeCount);
  const activeTypes: readonly QuestionType[] =
    enabledTypes.length > 0 ? enabledTypes : ['written'];

  // Равномерно распределяем выбранные типы вопросов и перемешиваем их порядок
  const assignedTypes = shuffleArray(
    pickedCards.map((_, idx) => activeTypes[idx % activeTypes.length])
  );

  return pickedCards.map((card, idx): TestQuestion => {
    const promptSide: ResolvedSide =
      promptSideOption === 'mixed'
        ? Math.random() < 0.5
          ? 'term'
          : 'definition'
        : promptSideOption;

    const promptText = getPromptText(card, promptSide);
    const expectedAnswer = getAnswerText(card, promptSide);
    const desiredType = assignedTypes[idx];

    const base: BaseTestQuestion = {
      id: generateId('q'),
      cardId: card.id,
      promptSide,
      promptText,
      expectedAnswer,
    };

    if (desiredType === 'mc') {
      const distractors = collectDistractors(card, allSetCards, promptSide, 3);
      // Если в наборе только 1 уникальный вариант, переключаемся на письменный ввод
      if (distractors.length === 0) {
        return { ...base, type: 'written' };
      }
      return {
        ...base,
        type: 'mc',
        options: shuffleArray([expectedAnswer, ...distractors]),
      };
    }

    if (desiredType === 'tf') {
      const distractors = collectDistractors(card, allSetCards, promptSide, 1);
      const shouldBeTrue = distractors.length === 0 || Math.random() < 0.5;
      return {
        ...base,
        type: 'tf',
        shownAnswer: shouldBeTrue ? expectedAnswer : distractors[0],
        isStatementTrue: shouldBeTrue,
      };
    }

    return { ...base, type: 'written' };
  });
}

function isQuestionAnswered(question: TestQuestion, answer: UserAnswer): boolean {
  if (question.type === 'written') {
    return typeof answer === 'string' && answer.trim().length > 0;
  }
  if (question.type === 'mc') {
    return typeof answer === 'string' && answer.length > 0;
  }
  return typeof answer === 'boolean';
}

function evaluateQuestion(
  question: TestQuestion,
  userAnswer: UserAnswer
): EvaluatedQuestion {
  const answered = isQuestionAnswered(question, userAnswer);
  let isCorrect = false;

  if (answered) {
    if (question.type === 'written' && typeof userAnswer === 'string') {
      isCorrect =
        normalizeAnswer(userAnswer) ===
        normalizeAnswer(question.expectedAnswer);
    } else if (question.type === 'mc' && typeof userAnswer === 'string') {
      isCorrect =
        normalizeAnswer(userAnswer) ===
        normalizeAnswer(question.expectedAnswer);
    } else if (question.type === 'tf' && typeof userAnswer === 'boolean') {
      isCorrect = userAnswer === question.isStatementTrue;
    }
  }

  return {
    question,
    userAnswer,
    isAnswered: answered,
    isCorrect,
  };
}

export const TestMode: React.FC<TestModeProps> = ({ set }) => {
  const { setView, notify } = useApp();

  const starredCards = useMemo(
    () => set.cards.filter((c) => c.starred),
    [set.cards]
  );

  const hasMultipleCards = set.cards.length >= 2;

  const [phase, setPhase] = useState<TestPhase>('setup');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [questionCount, setQuestionCount] = useState<number>(() =>
    Math.min(10, set.cards.length)
  );
  const [includeWritten, setIncludeWritten] = useState(true);
  const [includeMc, setIncludeMc] = useState(hasMultipleCards);
  const [includeTf, setIncludeTf] = useState(hasMultipleCards);
  const [promptSide, setPromptSide] = useState<PromptSideOption>('term');

  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');

  const activePool = useMemo(
    () => (onlyStarred && starredCards.length > 0 ? starredCards : set.cards),
    [onlyStarred, starredCards, set.cards]
  );

  const clampedQuestionCount = Math.max(
    1,
    Math.min(questionCount, activePool.length)
  );

  const enabledTypes = useMemo<QuestionType[]>(() => {
    const list: QuestionType[] = [];
    if (includeWritten) list.push('written');
    if (includeMc && hasMultipleCards) list.push('mc');
    if (includeTf) list.push('tf');
    return list;
  }, [includeWritten, includeMc, includeTf, hasMultipleCards]);

  const startTestWithCards = (
    cardsToTest: readonly Card[],
    count: number
  ) => {
    if (enabledTypes.length === 0) {
      notify('Выберите хотя бы один тип вопросов', 'error');
      return;
    }
    const generated = generateTestQuestions(
      cardsToTest,
      set.cards,
      count,
      enabledTypes,
      promptSide
    );
    setQuestions(generated);
    setAnswers({});
    setResultFilter('all');
    setPhase('taking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleOnlyStarred = (next: boolean) => {
    setOnlyStarred(next);
    const nextMax = next ? starredCards.length : set.cards.length;
    setQuestionCount((prev) => Math.max(1, Math.min(prev, nextMax)));
  };

  const handleAnswerChange = (questionId: string, value: UserAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitTest = (e: React.FormEvent) => {
    e.preventDefault();
    setPhase('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const answeredCount = useMemo(
    () =>
      questions.filter((q) => isQuestionAnswered(q, answers[q.id])).length,
    [questions, answers]
  );

  const evaluatedResults = useMemo(
    () => questions.map((q) => evaluateQuestion(q, answers[q.id])),
    [questions, answers]
  );

  const scoreSummary = useMemo(() => {
    const total = evaluatedResults.length;
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    for (const item of evaluatedResults) {
      if (item.isCorrect) correct += 1;
      else if (!item.isAnswered) unanswered += 1;
      else wrong += 1;
    }

    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, wrong, unanswered, percent };
  }, [evaluatedResults]);

  // 1. Экран настройки теста
  if (phase === 'setup') {
    const presetCounts = Array.from(
      new Set([5, 10, 20, activePool.length].filter((n) => n <= activePool.length && n > 0))
    ).sort((a, b) => a - b);

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

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/70 dark:text-sky-400">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                Настройка теста
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {set.title} · {pluralizeCards(set.cards.length)}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {/* Фильтр по избранным */}
            {starredCards.length > 0 && (
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span>
                    Только отмеченные карточки ({starredCards.length})
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={onlyStarred}
                  onChange={(e) => handleToggleOnlyStarred(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-indigo-600"
                />
              </div>
            )}

            {/* Количество вопросов */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="test-count-range"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Количество вопросов
                </label>
                <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                  {clampedQuestionCount} из {activePool.length}
                </span>
              </div>

              {activePool.length > 1 && (
                <input
                  id="test-count-range"
                  type="range"
                  min={1}
                  max={activePool.length}
                  value={clampedQuestionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="mt-3 w-full cursor-pointer accent-indigo-600"
                />
              )}

              {presetCounts.length > 1 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {presetCounts.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuestionCount(preset)}
                      className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        clampedQuestionCount === preset
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset === activePool.length ? `Все (${preset})` : preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Типы вопросов */}
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Типы вопросов
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <label
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-2xl border p-3.5 text-sm font-medium transition ${
                    includeWritten
                      ? 'border-indigo-400 bg-indigo-50/70 text-indigo-900 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-100'
                      : 'border-slate-200 bg-slate-50/60 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  <span>Письменный</span>
                  <input
                    type="checkbox"
                    checked={includeWritten}
                    onChange={(e) => setIncludeWritten(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </label>

                <label
                  className={`flex items-center justify-between gap-2 rounded-2xl border p-3.5 text-sm font-medium transition ${
                    !hasMultipleCards
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
                      : includeMc
                        ? 'cursor-pointer border-indigo-400 bg-indigo-50/70 text-indigo-900 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-100'
                        : 'cursor-pointer border-slate-200 bg-slate-50/60 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  <span>Выбор ответа</span>
                  <input
                    type="checkbox"
                    disabled={!hasMultipleCards}
                    checked={includeMc && hasMultipleCards}
                    onChange={(e) => setIncludeMc(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-2xl border p-3.5 text-sm font-medium transition ${
                    includeTf
                      ? 'border-indigo-400 bg-indigo-50/70 text-indigo-900 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-100'
                      : 'border-slate-200 bg-slate-50/60 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  <span>Верно / Неверно</span>
                  <input
                    type="checkbox"
                    checked={includeTf}
                    onChange={(e) => setIncludeTf(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </label>
              </div>
              {!hasMultipleCards && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  В наборе только 1 карточка, поэтому «Выбор ответа» недоступен.
                </p>
              )}
              {enabledTypes.length === 0 && (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                  Отметьте хотя бы один тип вопросов, чтобы начать тест.
                </p>
              )}
            </div>

            {/* Сторона вопроса */}
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Что показывать в вопросе
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    { id: 'term', label: 'Термин' },
                    { id: 'definition', label: 'Определение' },
                    { id: 'mixed', label: 'Вперемешку' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPromptSide(item.id)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      promptSide === item.id
                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={enabledTypes.length === 0}
            onClick={() =>
              startTestWithCards(activePool, clampedQuestionCount)
            }
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ClipboardCheck className="h-5 w-5" />
            Начать тест ({clampedQuestionCount})
          </button>
        </section>
      </main>
    );
  }

  // 2. Прохождение теста
  if (phase === 'taking') {
    const unansweredCount = questions.length - answeredCount;
    const progressPercent =
      questions.length > 0
        ? Math.round((answeredCount / questions.length) * 100)
        : 0;

    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            К настройкам теста
          </button>

          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Отвечено: {answeredCount} из {questions.length}
          </span>
        </div>

        {/* Закреплённая полоса прогресса */}
        <div className="sticky top-[61px] z-20 mt-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
              Тест: {set.title}
            </span>
            <span className="shrink-0 font-bold text-indigo-600 dark:text-indigo-400">
              {progressPercent}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmitTest} className="mt-5 space-y-4">
          {questions.map((question, index) => {
            const currentAnswer = answers[question.id];
            const promptLabel =
              question.promptSide === 'term' ? 'Термин' : 'Определение';
            const targetLabel =
              question.promptSide === 'term' ? 'определение' : 'термин';

            return (
              <article
                key={question.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Вопрос {index + 1} / {questions.length}
                    </span>
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                      {QUESTION_TYPE_LABELS[question.type]}
                    </span>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {promptLabel}
                  </span>
                </div>

                <div className="mt-4 max-h-48 overflow-y-auto break-words text-lg font-semibold leading-snug text-slate-900 dark:text-white sm:text-xl">
                  {question.promptText}
                </div>

                {/* Тип: Письменный */}
                {question.type === 'written' && (
                  <div className="mt-5">
                    <label
                      htmlFor={`q-input-${question.id}`}
                      className="block text-xs font-medium text-slate-500 dark:text-slate-400"
                    >
                      Введите {targetLabel}:
                    </label>
                    <input
                      id={`q-input-${question.id}`}
                      type="text"
                      autoComplete="off"
                      value={
                        typeof currentAnswer === 'string' ? currentAnswer : ''
                      }
                      onChange={(e) =>
                        handleAnswerChange(question.id, e.target.value)
                      }
                      placeholder="Ваш ответ..."
                      className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
                    />
                  </div>
                )}

                {/* Тип: Выбор ответа */}
                {question.type === 'mc' && (
                  <div className="mt-5">
                    <div className="mb-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Выберите правильное {targetLabel}:
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {question.options.map((option, optIdx) => {
                        const selected = currentAnswer === option;
                        return (
                          <button
                            key={`${question.id}-opt-${optIdx}`}
                            type="button"
                            onClick={() =>
                              handleAnswerChange(question.id, option)
                            }
                            className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left text-sm font-medium transition ${
                              selected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-100'
                                : 'border-slate-200 bg-slate-50/70 text-slate-800 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-700'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                                selected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 text-slate-400 dark:border-slate-600'
                              }`}
                            >
                              {optIdx + 1}
                            </span>
                            <span className="break-words leading-relaxed">
                              {option}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Тип: Верно / Неверно */}
                {question.type === 'tf' && (
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Предложенное {targetLabel}
                      </div>
                      <div className="mt-1 break-words text-base font-medium text-slate-800 dark:text-slate-200">
                        {question.shownAnswer}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleAnswerChange(question.id, true)}
                        className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${
                          currentAnswer === true
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-700'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                        Верно
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAnswerChange(question.id, false)}
                        className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${
                          currentAnswer === false
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-700'
                        }`}
                      >
                        <X className="h-4 w-4" />
                        Неверно
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {unansweredCount > 0 && (
              <p className="mb-3 text-center text-xs text-amber-600 dark:text-amber-400">
                Остались без ответа: {unansweredCount}. Вы всё равно можете
                завершить проверку — пропущенные вопросы засчитаются как ошибки.
              </p>
            )}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <ClipboardCheck className="h-5 w-5" />
              Проверить тест
            </button>
          </div>
        </form>
      </main>
    );
  }

  // 3. Экран результатов и подробного разбора
  const wrongCards = evaluatedResults
    .filter((r) => !r.isCorrect)
    .map((r) => set.cards.find((c) => c.id === r.question.cardId))
    .filter((c): c is Card => c !== undefined);

  const filteredResults = evaluatedResults.filter((item) => {
    if (resultFilter === 'correct') return item.isCorrect;
    if (resultFilter === 'wrong') return !item.isCorrect;
    return true;
  });

  const scoreAccentClass =
    scoreSummary.percent >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : scoreSummary.percent >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <button
        type="button"
        onClick={() => setView({ name: 'detail', setId: set.id })}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Назад к набору «{set.title}»
      </button>

      {/* Карточка итогового балла */}
      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <Trophy className="h-7 w-7" />
          </div>
          <div className={`mt-3 text-4xl font-extrabold sm:text-5xl ${scoreAccentClass}`}>
            {scoreSummary.percent}%
          </div>
          <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            {scoreSummary.percent === 100
              ? 'Безупречно! Ни одной ошибки'
              : scoreSummary.percent >= 80
                ? 'Отличный результат!'
                : scoreSummary.percent >= 50
                  ? 'Неплохо, но есть что закрепить'
                  : 'Стоит повторить материал'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Верных ответов: {scoreSummary.correct} из {scoreSummary.total}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/40">
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {scoreSummary.correct}
            </div>
            <div className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">
              Верно
            </div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-center dark:border-rose-900/60 dark:bg-rose-950/40">
            <div className="text-xl font-bold text-rose-700 dark:text-rose-300">
              {scoreSummary.wrong}
            </div>
            <div className="text-xs font-medium text-rose-700/80 dark:text-rose-300/80">
              Ошибок
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xl font-bold text-slate-700 dark:text-slate-200">
              {scoreSummary.unanswered}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Пропущено
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {wrongCards.length > 0 && (
            <button
              type="button"
              onClick={() => startTestWithCards(wrongCards, wrongCards.length)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <RotateCcw className="h-4 w-4" />
              Тест по ошибкам ({wrongCards.length})
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              startTestWithCards(activePool, clampedQuestionCount)
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Новый тест
          </button>
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Настройки
          </button>
        </div>
      </section>

      {/* Подробный разбор каждого вопроса */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Разбор ответов
          </h2>

          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setResultFilter('all')}
              className={`rounded-lg px-3 py-1 transition ${
                resultFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Все ({scoreSummary.total})
            </button>
            <button
              type="button"
              onClick={() => setResultFilter('wrong')}
              className={`rounded-lg px-3 py-1 transition ${
                resultFilter === 'wrong'
                  ? 'bg-white text-rose-600 shadow-sm dark:bg-slate-800 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Ошибки ({scoreSummary.wrong + scoreSummary.unanswered})
            </button>
            <button
              type="button"
              onClick={() => setResultFilter('correct')}
              className={`rounded-lg px-3 py-1 transition ${
                resultFilter === 'correct'
                  ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-800 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Верные ({scoreSummary.correct})
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3.5">
          {filteredResults.map((item) => {
            const { question, userAnswer, isAnswered, isCorrect } = item;
            const originalIndex =
              questions.findIndex((q) => q.id === question.id) + 1;

            return (
              <article
                key={question.id}
                className={`rounded-3xl border-2 bg-white p-5 dark:bg-slate-900 ${
                  isCorrect
                    ? 'border-emerald-200 dark:border-emerald-900/70'
                    : 'border-rose-200 dark:border-rose-900/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    )}
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Вопрос {originalIndex}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {QUESTION_TYPE_LABELS[question.type]}
                    </span>
                  </div>

                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                      isCorrect
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                        : isAnswered
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {isCorrect
                      ? 'Верно'
                      : isAnswered
                        ? 'Ошибка'
                        : 'Нет ответа'}
                  </span>
                </div>

                <div className="mt-3 break-words text-base font-semibold text-slate-900 dark:text-white">
                  {question.promptText}
                </div>

                {/* Разбор: Письменный */}
                {question.type === 'written' && (
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div
                      className={`rounded-xl px-3.5 py-2.5 ${
                        isCorrect
                          ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100'
                          : 'bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100'
                      }`}
                    >
                      <span className="text-xs font-semibold opacity-75">
                        Ваш ответ:{' '}
                      </span>
                      <span className="break-words font-medium">
                        {isAnswered && typeof userAnswer === 'string'
                          ? userAnswer
                          : 'Не указан'}
                      </span>
                    </div>

                    {!isCorrect && (
                      <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
                        <span className="text-xs font-semibold opacity-75">
                          Правильный ответ:{' '}
                        </span>
                        <span className="break-words font-semibold">
                          {question.expectedAnswer}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Разбор: Выбор ответа */}
                {question.type === 'mc' && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {question.options.map((option, idx) => {
                      const isRightOpt =
                        normalizeAnswer(option) ===
                        normalizeAnswer(question.expectedAnswer);
                      const isPickedOpt = userAnswer === option;

                      let optClass =
                        'border-slate-200 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400';

                      if (isRightOpt) {
                        optClass =
                          'border-emerald-400 bg-emerald-50 text-emerald-900 font-semibold dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-100';
                      } else if (isPickedOpt && !isRightOpt) {
                        optClass =
                          'border-rose-400 bg-rose-50 text-rose-900 font-medium dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-100';
                      }

                      return (
                        <div
                          key={`${question.id}-res-${idx}`}
                          className={`flex items-start justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${optClass}`}
                        >
                          <span className="break-words">{option}</span>
                          {isRightOpt && (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {isPickedOpt && !isRightOpt && (
                            <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Разбор: Верно / Неверно */}
                {question.type === 'tf' && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      <span className="text-xs font-semibold text-slate-400">
                        В вопросе было показано:{' '}
                      </span>
                      <span className="break-words font-medium">
                        {question.shownAnswer}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Ваш выбор:{' '}
                        <strong
                          className={
                            isCorrect
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-rose-700 dark:text-rose-300'
                          }
                        >
                          {typeof userAnswer === 'boolean'
                            ? userAnswer
                              ? 'Верно'
                              : 'Неверно'
                            : 'Нет ответа'}
                        </strong>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Правильно:{' '}
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          {question.isStatementTrue ? 'Верно' : 'Неверно'}
                        </strong>
                      </span>
                    </div>

                    {!question.isStatementTrue && (
                      <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
                        <span className="text-xs font-semibold opacity-75">
                          Настоящий правильный ответ:{' '}
                        </span>
                        <span className="break-words font-semibold">
                          {question.expectedAnswer}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {filteredResults.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
              В этой категории вопросов нет
            </div>
          )}
        </div>
      </section>
    </main>
  );
};