import React, { useRef } from 'react';
import { BookOpen, Download, Moon, Plus, Sun, Upload, UserRound } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import {
  CURRENT_SCHEMA_VERSION,
  downloadJsonFile,
  parseImportedJson,
} from '../../utils/storage';

export const Header: React.FC = () => {
  const { sets, theme, profile, toggleTheme, setView, importSets, notify } = useApp();
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
    <header className="safe-area-top sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-2 py-2 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-3">
        <button
          type="button"
          onClick={() => setView({ name: 'library' })}
          className="flex items-center gap-2.5 rounded-xl py-1 text-left transition hover:opacity-85"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm sm:h-9 sm:w-9">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
              QuizFlow
            </span>
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Карточки и тренажёр памяти
            </span>
          </div>
        </button>

        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1 sm:gap-2">
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
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 p-0 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-auto sm:w-auto sm:px-3 sm:py-2"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden md:inline">Импорт JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportAll}
            disabled={sets.length === 0}
            title="Экспортировать всю базу в JSON"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 p-0 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-auto sm:w-auto sm:px-3 sm:py-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Бэкап</span>
          </button>

          <button
            type="button"
            onClick={() => setView({ name: 'editor', setId: null })}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 p-0 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Создать набор</span>
          </button>

          <button
            type="button"
            onClick={() => setView({ name: 'profile' })}
            title="Личный профиль"
            aria-label="Открыть личный профиль"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {profile.name ? <span className="text-sm font-semibold">{profile.name.charAt(0).toUpperCase()}</span> : <UserRound className="h-4 w-4" />}
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
