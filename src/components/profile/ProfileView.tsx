import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Cloud, LoaderCircle, LockKeyhole, LogOut, Mail, UserRound } from 'lucide-react';
import { useApp } from '../../store/AppContext';

type AuthMode = 'signin' | 'signup';

export const ProfileView: React.FC = () => {
  const {
    authUser,
    authReady,
    authEnabled,
    cloudSyncStatus,
    profile,
    sets,
    setView,
    signIn,
    signUp,
    signOut,
  } = useApp();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setConfirmationSent(false);
    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMessage('Пароли не совпадают.');
      return;
    }
    setSubmitting(true);
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(name, email, password);
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error ?? 'Не удалось выполнить запрос.');
      return;
    }
    if ('confirmationRequired' in result && result.confirmationRequired) setConfirmationSent(true);
  };

  const accountName = typeof authUser?.user_metadata.display_name === 'string'
    ? authUser.user_metadata.display_name
    : profile.name || authUser?.email?.split('@')[0] || '';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <button type="button" onClick={() => setView({ name: 'library' })} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> К библиотеке
      </button>
      <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-8 text-white sm:px-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold ring-1 ring-white/20">
            {accountName.charAt(0).toUpperCase() || <UserRound className="h-6 w-6" />}
          </div>
          <h1 className="mt-4 text-2xl font-bold">Личный аккаунт</h1>
          <p className="mt-1 text-sm text-indigo-100">Вход на сайте и в Android-приложении</p>
        </div>

        <div className="grid gap-8 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
          <div>
            {!authReady ? (
              <div className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Проверяем сессию…</div>
            ) : authUser ? (
              <div>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{accountName}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{authUser.email}</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <Cloud className="h-3.5 w-3.5" />
                  {cloudSyncStatus === 'syncing' ? 'Синхронизация…' : cloudSyncStatus === 'error' ? 'Ошибка синхронизации' : cloudSyncStatus === 'synced' ? 'Библиотека синхронизирована' : 'Локальная библиотека'}
                </div>
                <button type="button" onClick={() => void signOut()} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <LogOut className="h-4 w-4" /> Выйти
                </button>
              </div>
            ) : !authEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" />Серверная авторизация ещё не подключена</div>
                <p className="mt-2">Создайте проект Supabase, выполните SQL из <code>supabase/migrations</code> и задайте в Vercel переменные <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. После этого пересоберите сайт и APK.</p>
              </div>
            ) : (
              <>
                <div className="mb-5 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button type="button" onClick={() => { setMode('signin'); setErrorMessage(''); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Войти</button>
                  <button type="button" onClick={() => { setMode('signup'); setErrorMessage(''); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Создать аккаунт</button>
                </div>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                  {mode === 'signup' && (
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Имя
                      <span className="relative mt-1.5 block">
                        <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} autoComplete="name" placeholder="Как к вам обращаться" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                      </span>
                    </label>
                  )}
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Электронная почта
                    <span className="relative mt-1.5 block">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={120} autoComplete="email" placeholder="name@example.com" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    </span>
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Пароль
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                  </label>
                  {mode === 'signup' && (
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Повторите пароль
                      <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    </label>
                  )}
                  {errorMessage && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>}
                  {confirmationSent && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Аккаунт создан. Подтвердите электронную почту по ссылке из письма, затем войдите.</p>}
                  <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
                    {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {mode === 'signin' ? 'Войти в аккаунт' : 'Создать аккаунт'}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 sm:min-w-44 sm:flex-col sm:justify-center dark:bg-indigo-950/40">
            <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <div className="sm:text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{sets.length}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">наборов в библиотеке</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
