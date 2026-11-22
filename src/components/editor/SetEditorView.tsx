import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronLeft,
  FileSpreadsheet,
  GripVertical,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { DraftCard, ParsedCardPreview, StudySet } from '../../types';
import { generateId } from '../../utils/storage';
import { BulkImportModal } from './BulkImportModal';

interface SetEditorViewProps {
  existingSet?: StudySet;
}

function createEmptyDraftCard(): DraftCard {
  return {
    id: generateId('card'),
    term: '',
    definition: '',
    starred: false,
    mastery: 'new',
    correctStreak: 0,
    lastReviewedAt: null,
  };
}

export const SetEditorView: React.FC<SetEditorViewProps> = ({ existingSet }) => {
  const { saveSet, setView, notify } = useApp();

  const [title, setTitle] = useState(existingSet?.title ?? '');
  const [description, setDescription] = useState(existingSet?.description ?? '');
  const [tags, setTags] = useState<string[]>(existingSet?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [cards, setCards] = useState<DraftCard[]>(() =>
    existingSet && existingSet.cards.length > 0
      ? existingSet.cards.map((c) => ({ ...c }))
      : [createEmptyDraftCard(), createEmptyDraftCard()]
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const [invalidCardIds, setInvalidCardIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleAddTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (!cleaned) return;
    if (!tags.includes(cleaned)) {
      setTags((prev) => [...prev, cleaned]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleCardChange = (
    cardId: string,
    field: 'term' | 'definition',
    value: string
  ) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, [field]: value } : c))
    );
    if (invalidCardIds.has(cardId)) {
      setInvalidCardIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const handleAddCard = () => {
    setCards((prev) => [...prev, createEmptyDraftCard()]);
  };

  const handleRemoveCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const handleMoveCard = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= cards.length || fromIndex === toIndex) return;
    setCards((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleSwapSides = () => {
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        term: c.definition,
        definition: c.term,
      }))
    );
    notify('Термины и определения поменяны местами', 'info');
  };

  const handleBulkImport = (imported: ParsedCardPreview[]) => {
    const newCards: DraftCard[] = imported.map((item) => ({
      ...createEmptyDraftCard(),
      term: item.term,
      definition: item.definition,
    }));

    setCards((prev) => {
      const nonEmptyExisting = prev.filter(
        (c) => c.term.trim() !== '' || c.definition.trim() !== ''
      );
      return [...nonEmptyExisting, ...newCards];
    });
    notify(`Добавлено карточек: ${newCards.length}`, 'success');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError('Укажите название набора.');
      notify('Заполните название набора', 'error');
      return;
    }

    if (cards.length === 0) {
      setValidationError('Добавьте хотя бы одну карточку.');
      notify('Набор не может быть пустым', 'error');
      return;
    }

    const badIds = new Set<string>();
    for (const card of cards) {
      if (!card.term.trim() || !card.definition.trim()) {
        badIds.add(card.id);
      }
    }

    if (badIds.size > 0) {
      setInvalidCardIds(badIds);
      setValidationError(
        `Заполните оба поля (термин и определение) во всех карточках или удалите пустые. Незаполненных карточек: ${badIds.size}.`
      );
      notify('Есть незаполненные карточки', 'error');
      return;
    }

    const preparedCards = cards.map((c) => ({
      ...c,
      term: c.term.trim(),
      definition: c.definition.trim(),
    }));

    const saved = saveSet({
      id: existingSet?.id,
      title,
      description,
      tags,
      cards: preparedCards,
    });

    notify(
      existingSet ? 'Изменения сохранены' : `Набор «${saved.title}» создан`,
      'success'
    );
    setView({ name: 'detail', setId: saved.id });
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() =>
          setView(
            existingSet
              ? { name: 'detail', setId: existingSet.id }
              : { name: 'library' }
          )
        }
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        {existingSet ? 'Назад к набору' : 'Назад в библиотеку'}
      </button>

      <form onSubmit={handleSave} className="mt-4 space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {existingSet ? 'Редактирование набора' : 'Новый учебный набор'}
          </h1>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Save className="h-4 w-4" />
            Сохранить набор
          </button>
        </div>

        {validationError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label
              htmlFor="set-title"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Название набора <span className="text-rose-500">*</span>
            </label>
            <input
              id="set-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Например: Немецкий A2 — Глаголы с управлением"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="set-desc"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Описание
            </label>
            <textarea
              id="set-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание темы или цели изучения..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="set-tags"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Теги / папки
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Удалить тег ${tag}`}
                    className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  id="set-tags"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Добавить тег (Enter)..."
                  className="w-44 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Карточки ({cards.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-950"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Массовый импорт
              </button>
              <button
                type="button"
                onClick={handleSwapSides}
                disabled={cards.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Поменять местами термины и определения
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {cards.map((card, index) => {
              const isInvalid = invalidCardIds.has(card.id);
              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => setDraggedIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedIndex !== null) {
                      handleMoveCard(draggedIndex, index);
                    }
                    setDraggedIndex(null);
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition dark:bg-slate-900 ${
                    isInvalid
                      ? 'border-rose-400 ring-2 ring-rose-500/20 dark:border-rose-600'
                      : draggedIndex === index
                        ? 'border-indigo-400 opacity-60'
                        : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <GripVertical className="h-4 w-4 cursor-grab active:cursor-grabbing" />
                      <span>Карточка #{index + 1}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveCard(index, index - 1)}
                        aria-label="Переместить вверх"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === cards.length - 1}
                        onClick={() => handleMoveCard(index, index + 1)}
                        aria-label="Переместить вниз"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(card.id)}
                        aria-label="Удалить карточку"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Термин
                      </label>
                      <textarea
                        rows={2}
                        value={card.term}
                        onChange={(e) =>
                          handleCardChange(card.id, 'term', e.target.value)
                        }
                        placeholder="Введите термин..."
                        className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Определение
                      </label>
                      <textarea
                        rows={2}
                        value={card.definition}
                        onChange={(e) =>
                          handleCardChange(card.id, 'definition', e.target.value)
                        }
                        placeholder="Введите определение или перевод..."
                        className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddCard}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 py-4 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
          >
            <Plus className="h-4 w-4" />
            Добавить карточку
          </button>
        </section>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Save className="h-4 w-4" />
            Сохранить набор
          </button>
        </div>
      </form>

      <BulkImportModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImport={handleBulkImport}
      />
    </main>
  );
};