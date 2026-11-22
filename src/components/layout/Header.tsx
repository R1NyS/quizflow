import React, { useRef } from 'react';
import { BookOpen, Download, Moon, Plus, Sun, Upload } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import {
  CURRENT_SCHEMA_VERSION,
  downloadJsonFile,
  parseImportedJson,
} from '../../utils/storage';

export const Header: React.FC = () => {
  const { sets, theme, toggleTheme, setView, importSets, notify } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportAll = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadJsonFile(`quizflow-backup-${dateStamp}.json`, {
      version: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      sets,
    });
    notify(`Экспортировано наборов: ${sets.length}`, 'success');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        notify('Не удалось прочитать файл', 'error');
        return;
      }
      const parsed = parseImportedJson(reader.result);
      if (!parsed) {
        notify(
          'Неверный формат JSON. Ожидается файл экспорта QuizFlow (набор или база).',
          'error'
        );
        return;
      }
      importSets(parsed.sets);
      notify(
        parsed.sets.length === 1
          ? `Набор «${parsed.sets[0].title}» успешно импортирован`
          : `Импортировано наборов: ${parsed.sets.length}`,
        'success'
      );
      setView({ name: 'library' });
    };
    reader.onerror = () => {
      notify('Ошибка чтения файла', 'error');
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setView({ name: 'library' })}
          className="flex items-center gap-2.5 rounded-xl py-1 text-left transition hover:opacity-85"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-base font-bold tracking-tight text-slate-900 dark:text-white">
              QuizFlow
            </span>
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Карточки и тренажёр памяти
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Импорт набора или резервной копии из JSON"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden md:inline">Импорт JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportAll}
            disabled={sets.length === 0}
            title="Экспортировать всю базу в JSON"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Бэкап</span>
          </button>

          <button
            type="button"
            onClick={() => setView({ name: 'editor', setId: null })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Создать набор</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Переключить на светлую тему'
                : 'Переключить на тёмную тему'
            }
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};