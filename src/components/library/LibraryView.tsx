import React, { useMemo, useState } from 'react';
import {
  Clock,
  Download,
  Edit3,
  FolderOpen,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { StudySet } from '../../types';
import { downloadJsonFile } from '../../utils/storage';
import { formatDurationMs, pluralizeCards } from '../../utils/text';
import { ConfirmModal } from '../ui/ConfirmModal';

function getMasteryPercent(set: StudySet): number {
  if (set.cards.length === 0) return 0;
  const mastered = set.cards.filter((c) => c.mastery === 'mastered').length;
  return Math.round((mastered / set.cards.length) * 100);
}

export const LibraryView: React.FC = () => {
  const { sets, setView, deleteSet, notify } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [setToDelete, setSetToDelete] = useState<StudySet | null>(null);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const set of sets) {
      for (const tag of set.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], 'ru')
    );
  }, [sets]);

  const filteredSets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sets.filter((set) => {
      const matchesTag = !selectedTag || set.tags.includes(selectedTag);
      if (!matchesTag) return false;
      if (!q) return true;
      return (
        set.title.toLowerCase().includes(q) ||
        set.description.toLowerCase().includes(q) ||
        set.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [sets, searchQuery, selectedTag]);

  const handleExportSingleSet = (e: React.MouseEvent, set: StudySet) => {
    e.stopPropagation();
    const safeName = set.title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
    downloadJsonFile(`${safeName || 'study-set'}.json`, set);
    notify(`Набор «${set.title}» экспортирован в JSON`, 'success');
  };

  const handleConfirmDelete = () => {
    if (!setToDelete) return;
    const title = setToDelete.title;
    deleteSet(setToDelete.id);
    setSetToDelete(null);
    notify(`Набор «${title}» удалён`, 'info');
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Библиотека наборов
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Всего наборов: {sets.length} · Все данные хранятся локально в вашем браузере
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или тегам..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Очистить поиск"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedTag === null
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            Все ({sets.length})
          </button>
          {allTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setSelectedTag((prev) => (prev === tag ? null : tag))
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedTag === tag
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Tag className="h-3 w-3" />
              {tag}
              <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {filteredSets.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <FolderOpen className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            {sets.length === 0
              ? 'Пока нет ни одного набора'
              : 'Ничего не найдено'}
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {sets.length === 0
              ? 'Создайте свой первый учебный модуль вручную или вставьте список терминов через массовый импорт.'
              : 'Попробуйте изменить поисковый запрос или сбросить фильтр по тегам.'}
          </p>
          {sets.length === 0 ? (
            <button
              type="button"
              onClick={() => setView({ name: 'editor', setId: null })}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Создать первый набор
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTag(null);
              }}
              className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSets.map((set) => {
            const masteryPercent = getMasteryPercent(set);
            return (
              <article
                key={set.id}
                onClick={() => setView({ name: 'detail', setId: set.id })}
                className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-2 text-lg font-semibold text-slate-900 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                      {set.title}
                    </h2>
                    <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {pluralizeCards(set.cards.length)}
                    </span>
                  </div>

                  {set.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                      {set.description}
                    </p>
                  )}

                  {set.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {set.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Изучено: {masteryPercent}%</span>
                    {set.bestMatchTimeMs !== null && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Clock className="h-3.5 w-3.5" />
                        Рекорд: {formatDurationMs(set.bestMatchTimeMs)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-500"
                      style={{ width: `${masteryPercent}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Открыть модуль →
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setView({ name: 'editor', setId: set.id });
                        }}
                        title="Редактировать набор"
                        aria-label="Редактировать набор"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleExportSingleSet(e, set)}
                        title="Экспортировать набор в JSON"
                        aria-label="Экспортировать набор в JSON"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSetToDelete(set);
                        }}
                        title="Удалить набор"
                        aria-label="Удалить набор"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={setToDelete !== null}
        title="Удалить набор?"
        description={
          setToDelete
            ? `Набор «${setToDelete.title}» (${pluralizeCards(setToDelete.cards.length)}) и весь прогресс изучения будут удалены без возможности восстановления.`
            : ''
        }
        confirmLabel="Удалить"
        onConfirm={handleConfirmDelete}
        onCancel={() => setSetToDelete(null)}
      />
    </main>
  );
};