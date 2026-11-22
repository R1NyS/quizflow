import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  Brain,
  ChevronLeft,
  ClipboardCheck,
  Download,
  Edit3,
  Headphones,
  Layers,
  LayoutGrid,
  RotateCcw,
  Share2,
  Swords,
  Star,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { StudyModeId, StudySet } from '../../types';
import { createShareUrl, downloadJsonFile } from '../../utils/storage';
import { supabase } from '../../lib/supabase';
import { formatDurationMs, pluralizeCards } from '../../utils/text';
import { ConfirmModal } from '../ui/ConfirmModal';

interface SetDetailViewProps {
  set: StudySet;
  readOnly?: boolean;
}

const STUDY_MODES: Array<{
  id: StudyModeId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    id: 'flashcards',
    title: 'Карточки',
    subtitle: '3D-переворот, озвучка, сортировка',
    icon: Layers,
    accent: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/70',
  },
  {
    id: 'learn',
    title: 'Заучивание',
    subtitle: 'Адаптивный цикл: тест → ввод',
    icon: Brain,
    accent: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/70',
  },
  {
    id: 'test',
    title: 'Тест',
    subtitle: 'Настраиваемая проверка знаний',
    icon: ClipboardCheck,
    accent: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/70',
  },
  {
    id: 'match',
    title: 'Подбор',
    subtitle: 'Игра на время с рекордами',
    icon: LayoutGrid,
    accent: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/70',
  },
  {
    id: 'audio',
    title: 'Аудиотренировка',
    subtitle: 'Слушай произношение и вспоминай ответ',
    icon: Headphones,
    accent: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/70',
  },
];

export const SetDetailView: React.FC<SetDetailViewProps> = ({ set, readOnly = false }) => {
  const { setView, toggleCardStar, deleteSet, resetSetProgress, notify, authUser, adoptSharedSet } =
    useApp();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [onlyStarredFilter, setOnlyStarredFilter] = useState(false);

  const masteredCount = set.cards.filter((c) => c.mastery === 'mastered').length;
  const learningCount = set.cards.filter((c) => c.mastery === 'learning').length;
  const starredCount = set.cards.filter((c) => c.starred).length;

  const visibleCards = onlyStarredFilter
    ? set.cards.filter((c) => c.starred)
    : set.cards;

  const handleExport = () => {
    const safeName = set.title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
    downloadJsonFile(`${safeName || 'study-set'}.json`, set);
    notify(`Набор «${set.title}» сохранён в JSON`, 'success');
  };

  const handleShare = async (sharedSet: StudySet, label: string) => {
    try {
      const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
      if (Capacitor.isNativePlatform() && !publicAppUrl) {
        notify('Укажите VITE_PUBLIC_APP_URL — адрес сайта, который будет открываться по ссылке из APK.', 'error');
        return;
      }
      const url = createShareUrl(sharedSet);
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: sharedSet.title,
          text: `Набор QuizFlow: ${sharedSet.title}`,
          url,
          dialogTitle: `Поделиться: ${label}`,
        });
      } else if (navigator.share) {
        await navigator.share({ title: sharedSet.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        notify(`Ссылка на ${label} скопирована`, 'success');
      }
    } catch {
      notify('Не удалось открыть меню отправки. Попробуйте скопировать ссылку из браузера.', 'error');
    }
  };

  const handleCollaborate = async () => {
    if (!supabase || !authUser) {
      notify('Для совместного редактирования войдите в аккаунт QuizFlow.', 'error');
      setView({ name: 'profile' });
      return;
    }
    if (set.collaborationId && set.collaborationCode) {
      const url = `${window.location.origin}/collab/${encodeURIComponent(set.collaborationCode)}`;
      try { await navigator.clipboard.writeText(url); notify('Ссылка для совместной работы скопирована', 'success'); }
      catch { notify(url, 'info'); }
      return;
    }
    const code = crypto.randomUUID().replaceAll('-', '');
    const { data, error } = await supabase.from('shared_sets').insert({
      invite_code: code, owner_id: authUser.id, title: set.title,
      payload: set, allow_edit: true,
    }).select('id').single();
    if (error || !data) {
      notify('Не удалось создать совместную ссылку. Проверьте, что миграция совместных наборов применена в Supabase.', 'error');
      return;
    }
    const sharedSet = { ...set, collaborationId: data.id, collaborationCode: code, collaborationRole: 'owner' as const };
    adoptSharedSet(sharedSet, true);
    const url = `${window.location.origin}/collab/${encodeURIComponent(code)}`;
    try { await navigator.clipboard.writeText(url); notify('Ссылка для совместного редактирования скопирована', 'success'); }
    catch { notify(url, 'info'); }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => setView({ name: 'library' })}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Назад в библиотеку
      </button>

      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            {set.title}
          </h1>
          {set.description && (
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              {set.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {pluralizeCards(set.cards.length)}
            </span>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
              Освоено: {masteredCount}
            </span>
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
              В процессе: {learningCount}
            </span>
            {set.bestMatchTimeMs !== null && (
              <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-medium text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
                Рекорд «Подбор»: {formatDurationMs(set.bestMatchTimeMs)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && <button type="button" onClick={() => void handleCollaborate()} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-900 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
            <UsersRound className="h-4 w-4" /> {set.collaborationId ? 'Скопировать приглашение' : 'Совместная работа'}
          </button>}
          {!readOnly && <button type="button" onClick={() => setView({ name: 'duel', setId: set.id, roomCode: crypto.randomUUID().replaceAll('-', '').slice(0, 12) })} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3.5 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-900 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-950/40"><Swords className="h-4 w-4" /> Дуэль</button>}
          {!readOnly && <button
            type="button"
            onClick={() => void handleShare(set, 'набор')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Share2 className="h-4 w-4" /> Поделиться
          </button>}
          {!readOnly && <button
            type="button"
            onClick={() => setView({ name: 'editor', setId: set.id })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit3 className="h-4 w-4" />
            Редактировать
          </button>}
          {!readOnly && <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            JSON
          </button>}
          {!readOnly && <button
            type="button"
            onClick={() => {
              resetSetProgress(set.id);
              notify('Прогресс изучения сброшен', 'info');
            }}
            title="Сбросить прогресс изучения"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
          </button>}
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            title="Удалить набор"
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STUDY_MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() =>
                setView({ name: 'mode', mode: mode.id, setId: set.id })
              }
              className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-600"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${mode.accent}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {mode.title}
                </div>
                <div className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
                  {mode.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="mt-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Термины в наборе ({set.cards.length})
          </h2>
          {starredCount > 0 && (
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-medium dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setOnlyStarredFilter(false)}
                className={`rounded-lg px-3 py-1 transition ${
                  !onlyStarredFilter
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Все ({set.cards.length})
              </button>
              <button
                type="button"
                onClick={() => setOnlyStarredFilter(true)}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 transition ${
                  onlyStarredFilter
                    ? 'bg-white text-amber-600 shadow-sm dark:bg-slate-800 dark:text-amber-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Star className="h-3.5 w-3.5 fill-current" />
                Сложные ({starredCount})
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2.5">
          {visibleCards.map((card) => (
            <div
              key={card.id}
              className="grid grid-cols-1 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_1.4fr_auto]"
            >
              <div className="break-words font-medium text-slate-900 dark:text-white">
                {card.term}
              </div>
              <div className="break-words border-t border-slate-100 pt-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                {card.definition}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const oneCardSet: StudySet = {
                      ...set,
                      title: `${card.term} — ${set.title}`,
                      description: `Карточка из набора «${set.title}»`,
                      cards: [card],
                    };
                    void handleShare(oneCardSet, 'карточку');
                  }}
                  aria-label={`Поделиться карточкой ${card.term}`}
                  title="Поделиться карточкой"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    card.mastery === 'mastered'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                      : card.mastery === 'learning'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {card.mastery === 'mastered'
                    ? 'Освоено'
                    : card.mastery === 'learning'
                      ? 'В процессе'
                      : 'Новая'}
                </span>
                <button
                  type="button"
                  onClick={() => !readOnly && toggleCardStar(set.id, card.id)}
                  disabled={readOnly}
                  aria-label={
                    card.starred
                      ? 'Убрать из избранного'
                      : 'Отметить как сложное'
                  }
                  className={`rounded-lg p-1.5 transition ${
                    card.starred
                      ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <Star
                    className={`h-4 w-4 ${card.starred ? 'fill-current' : ''}`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!readOnly && <ConfirmModal
        isOpen={confirmDeleteOpen}
        title="Удалить набор?"
        description={`Набор «${set.title}» будет удалён без возможности восстановления.`}
        confirmLabel="Удалить"
        onConfirm={() => {
          deleteSet(set.id);
          notify(`Набор «${set.title}» удалён`, 'info');
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />}
    </main>
  );
};
