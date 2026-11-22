import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Headphones, RotateCcw, Volume2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { StudySet } from '../../types';
import { detectSpeechLanguage, speakText, stopSpeech } from '../../utils/speech';
import { normalizeAnswer } from '../../utils/text';

export const AudioMode: React.FC<{ set: StudySet }> = ({ set }) => {
  const { setView, reviewCard, notify, speechSettings } = useApp();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState<boolean | null>(null);
  const card = set.cards[index];

  useEffect(() => () => stopSpeech(), []);

  const play = () => {
    if (!card) return;
    void speakText(card.term, 'auto', undefined, undefined, speechSettings).then((spoken) => {
      if (!spoken) notify('Не удалось озвучить слово. Проверьте, установлен ли на телефоне голосовой движок.','error');
    });
  };

  const checkAnswer = () => {
    if (!card || !answer.trim()) return;
    const correct = normalizeAnswer(answer) === normalizeAnswer(card.definition);
    setChecked(correct);
    reviewCard(set.id, card.id, correct ? 'good' : 'again');
    if (!correct) notify('Послушайте ещё раз и попробуйте запомнить ответ.', 'info');
  };

  const next = () => {
    setIndex((value) => value + 1);
    setAnswer('');
    setChecked(null);
  };

  if (!card) return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <button type="button" onClick={() => setView({ name: 'detail', setId: set.id })} className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" />К набору</button>
      <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 dark:border-emerald-900 dark:bg-emerald-950/30"><Headphones className="h-8 w-8 text-emerald-600" /><h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">Аудиотренировка завершена</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Вы прослушали все карточки набора «{set.title}».</p><button type="button" onClick={() => { setIndex(0); setAnswer(''); setChecked(null); }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white"><RotateCcw className="h-4 w-4" />Пройти ещё раз</button></section>
    </main>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <button type="button" onClick={() => setView({ name: 'detail', setId: set.id })} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"><ArrowLeft className="h-4 w-4" />К набору</button>
      <div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Аудиотренировка · {set.title}</p><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Слушай и вспоминай</h1></div><span className="text-sm text-slate-500 dark:text-slate-400">{index + 1}/{set.cards.length}</span></div>
      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-9">
        <button type="button" onClick={play} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 transition hover:scale-105 hover:bg-emerald-700" aria-label="Прослушать термин"><Volume2 className="h-10 w-10" /></button>
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">Нажмите, чтобы услышать термин ({detectSpeechLanguage(card.term)})</p>
        <label className="mt-7 block text-sm font-semibold text-slate-700 dark:text-slate-200">Что означает услышанное слово?
          <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={checked !== null} rows={3} placeholder="Введите определение…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-base font-normal text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        {checked !== null && <div className={`mt-4 rounded-xl p-4 ${checked ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'}`}><b>{checked ? 'Верно!' : 'Пока не получилось'}</b><div className="mt-1">{card.definition}</div></div>}
        <div className="mt-5 flex justify-end gap-2">
          {checked === null ? <button type="button" onClick={checkAnswer} disabled={!answer.trim()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Проверить</button> : <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white">Следующее <ArrowRight className="h-4 w-4" /></button>}
        </div>
      </section>
    </main>
  );
};
