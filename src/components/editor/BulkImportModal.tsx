import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import {
  CardDelimiterOption,
  ParsedCardPreview,
  TermDelimiterOption,
} from '../../types';
import {
  parseBulkImportText,
  pluralizeCards,
  resolveCardDelimiter,
  resolveTermDelimiter,
} from '../../utils/text';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (cards: ParsedCardPreview[]) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [rawText, setRawText] = useState('');
  const [termOpt, setTermOpt] = useState<TermDelimiterOption>('tab');
  const [customTermDelim, setCustomTermDelim] = useState(':');
  const [cardOpt, setCardOpt] = useState<CardDelimiterOption>('newline');
  const [customCardDelim, setCustomCardDelim] = useState('\n\n');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const previewCards = useMemo(() => {
    const tDelim = resolveTermDelimiter(termOpt, customTermDelim);
    const cDelim = resolveCardDelimiter(cardOpt, customCardDelim);
    return parseBulkImportText(rawText, tDelim, cDelim);
  }, [rawText, termOpt, customTermDelim, cardOpt, customCardDelim]);

  const validCardsCount = useMemo(
    () =>
      previewCards.filter((c) => c.term.trim() && c.definition.trim()).length,
    [previewCards]
  );

  if (!isOpen) return null;

  const handleConfirmImport = () => {
    if (previewCards.length === 0) return;
    onImport(previewCards);
    setRawText('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2
              id="bulk-import-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Массовый импорт карточек
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно импорта"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div>
            <label
              htmlFor="bulk-textarea"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Вставьте список из Excel, Google Таблиц, Word или Блокнота
            </label>
            <textarea
              id="bulk-textarea"
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Пример:\nТермин 1\tОпределение 1\nТермин 2\tОпределение 2`}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <fieldset className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Между термином и определением
              </legend>
              <div className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="term-delim"
                    checked={termOpt === 'tab'}
                    onChange={() => setTermOpt('tab')}
                    className="accent-indigo-600"
                  />
                  Табуляция (из Excel / Таблиц)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="term-delim"
                    checked={termOpt === 'dash'}
                    onChange={() => setTermOpt('dash')}
                    className="accent-indigo-600"
                  />
                  Дефис / тире (« - »)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="term-delim"
                    checked={termOpt === 'comma'}
                    onChange={() => setTermOpt('comma')}
                    className="accent-indigo-600"
                  />
                  Запятая (,)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="term-delim"
                    checked={termOpt === 'custom'}
                    onChange={() => setTermOpt('custom')}
                    className="accent-indigo-600"
                  />
                  <span>Свой:</span>
                  <input
                    type="text"
                    value={customTermDelim}
                    onFocus={() => setTermOpt('custom')}
                    onChange={(e) => setCustomTermDelim(e.target.value)}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Между карточками
              </legend>
              <div className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="card-delim"
                    checked={cardOpt === 'newline'}
                    onChange={() => setCardOpt('newline')}
                    className="accent-indigo-600"
                  />
                  Новая строка
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="card-delim"
                    checked={cardOpt === 'semicolon'}
                    onChange={() => setCardOpt('semicolon')}
                    className="accent-indigo-600"
                  />
                  Точка с запятой (;)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="card-delim"
                    checked={cardOpt === 'custom'}
                    onChange={() => setCardOpt('custom')}
                    className="accent-indigo-600"
                  />
                  <span>Свой:</span>
                  <input
                    type="text"
                    value={customCardDelim}
                    onFocus={() => setCardOpt('custom')}
                    onChange={(e) => setCustomCardDelim(e.target.value)}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Предпросмотр ({pluralizeCards(previewCards.length)})
              </h3>
              {previewCards.length > validCardsCount && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  У некоторых строк не найдено определение — вы сможете дописать его в редакторе
                </span>
              )}
            </div>

            {previewCards.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
                Здесь появятся распознанные карточки
              </div>
            ) : (
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                {previewCards.map((item, idx) => (
                  <div
                    key={`${idx}-${item.term.slice(0, 12)}`}
                    className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2"
                  >
                    <div className="break-words font-medium text-slate-900 dark:text-white">
                      <span className="mr-2 text-xs text-slate-400">
                        {idx + 1}.
                      </span>
                      {item.term || (
                        <span className="italic text-rose-500">Пусто</span>
                      )}
                    </div>
                    <div className="break-words text-slate-600 dark:text-slate-300">
                      {item.definition || (
                        <span className="italic text-amber-500">
                          Нет определения
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={previewCards.length === 0}
            onClick={handleConfirmImport}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Импортировать ({previewCards.length})
          </button>
        </div>
      </div>
    </div>
  );
};