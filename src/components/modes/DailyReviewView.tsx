import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock3, Flame, RotateCcw, Sparkles } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { getDueCards, getStudyStreak, getTodayReviewCount } from '../../utils/study';

export const DailyReviewView: React.FC = () => {
  const { sets, studyStats, setDailyGoal, reviewCard, setView } = useApp();
  const initialQueue = useMemo(() => getDueCards(sets), []);
  const [queue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const todayCount = getTodayReviewCount(studyStats);
  const streak = getStudyStreak(studyStats);
  const current = queue[index];

  const rate = (quality: 'again' | 'hard' | 'good' | 'easy') => {
    if (!current) return;
    reviewCard(current.setId, current.card.id, quality);
    setRevealed(false);
    setIndex((value) => value + 1);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <button type="button" onClick={() => setView({ name: 'library' })} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> К библиотеке
      </button>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Ежедневная практика</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Повторить сегодня</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"><Flame className="h-4 w-4" />{streak} дн.</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Check className="h-4 w-4" />{todayCount}/{studyStats.dailyGoal}</span>
        </div>
      </div>

      {current ? (
        <>
          <div className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{current.setTitle}</span><span>{index + 1} из {queue.length}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${((index + 1) / queue.length) * 100}%` }} /></div>
          <section className="mt-5 min-h-72 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Термин</div>
            <div className="mt-5 whitespace-pre-wrap break-words text-2xl font-semibold text-slate-900 dark:text-white">{current.card.term}</div>
            {revealed ? <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800"><div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Определение</div><div className="mt-3 whitespace-pre-wrap break-words text-lg text-slate-700 dark:text-slate-200">{current.card.definition}</div></div> : <button type="button" onClick={() => setRevealed(true)} className="mt-10 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">Показать ответ</button>}
          </section>
          {revealed && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => rate('again')} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"><RotateCcw className="mx-auto mb-1 h-4 w-4" />Не помню · 10 мин</button>
            <button type="button" onClick={() => rate('hard')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">Сложно · 1 день</button>
            <button type="button" onClick={() => rate('good')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Знаю</button>
            <button type="button" onClick={() => rate('easy')} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"><Sparkles className="mx-auto mb-1 h-4 w-4" />Легко</button>
          </div>}
        </>
      ) : (
        <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50 p-7 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">На сегодня всё!</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Повторено сегодня: {todayCount} из цели {studyStats.dailyGoal}. Серия: {streak} дн.</p>
          <button type="button" onClick={() => setView({ name: 'library' })} className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700">Вернуться в библиотеку</button>
        </section>
      )}

      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Clock3 className="h-4 w-4 text-indigo-500" />Цель на день: {studyStats.dailyGoal} карточек</div>
        <div className="flex gap-2">
          {[10, 20, 30, 50].map((goal) => <button key={goal} type="button" aria-pressed={studyStats.dailyGoal === goal} onClick={() => setDailyGoal(goal)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${studyStats.dailyGoal === goal ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>{goal}</button>)}
        </div>
      </section>
    </main>
  );
};
