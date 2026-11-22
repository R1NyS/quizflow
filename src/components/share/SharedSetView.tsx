import React from 'react';
import { ArrowLeft, BookOpen, CopyPlus, Layers } from 'lucide-react';
import { StudySet } from '../../types';
import { useApp } from '../../store/AppContext';
import { pluralizeCards } from '../../utils/text';

export const SharedSetView: React.FC<{ set: StudySet; onClose: () => void }> = ({ set, onClose }) => {
  const { importSets, setView, notify } = useApp();
  const handleSave = () => {
    importSets([set]);
    setView({ name: 'detail', setId: set.id });
    onClose();
    notify('Набор добавлен в вашу библиотеку', 'success');
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <button type="button" onClick={() => { onClose(); setView({ name: 'library' }); }} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> В свою библиотеку
      </button>
      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><BookOpen className="h-6 w-6" /></div>
        <p className="mt-5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">Вам поделились учебным набором</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{set.title}</h1>
        {set.description && <p className="mt-2 text-slate-600 dark:text-slate-300">{set.description}</p>}
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Layers className="h-4 w-4" />{pluralizeCards(set.cards.length)}</div>
        <div className="mt-6 max-h-72 space-y-2 overflow-auto">
          {set.cards.slice(0, 8).map((card) => <div key={card.id} className="grid gap-1 rounded-xl border border-slate-100 p-3 sm:grid-cols-2 dark:border-slate-800"><span className="font-medium text-slate-900 dark:text-white">{card.term}</span><span className="text-sm text-slate-600 dark:text-slate-400">{card.definition}</span></div>)}
          {set.cards.length > 8 && <p className="py-2 text-center text-xs text-slate-400">И ещё карточек: {set.cards.length - 8}</p>}
        </div>
        <button type="button" onClick={handleSave} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto"><CopyPlus className="h-4 w-4" />Добавить копию в библиотеку</button>
        <p className="mt-3 text-xs text-slate-400">Это отдельная копия: ваши изменения не затронут исходный набор.</p>
      </section>
    </main>
  );
};
