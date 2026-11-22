import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  Cloud,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { ProfileAvatar } from './ProfileAvatar';

type AuthMode = 'signin' | 'signup';

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const panelClass = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';

export const ProfileView: React.FC = () => {
  const {
    authUser,
    authReady,
    authEnabled,
    cloudSyncStatus,
    profile,
    sets,
    theme,
    studyStats,
    setDailyGoal,
    toggleTheme,
    updateDisplayName,
    updateAccountEmail,
    changePassword,
    uploadAvatar,
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);

  const accountName = typeof authUser?.user_metadata.display_name === 'string'
    ? authUser.user_metadata.display_name
    : profile.name || authUser?.email?.split('@')[0] || '';
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const [displayName, setDisplayName] = useState(accountName);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => setDisplayName(accountName), [accountName]);

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

  const handleNameSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError('');
    setProfileNotice('');
    setSavingName(true);
    const result = await updateDisplayName(displayName);
    setSavingName(false);
    if (result.ok) setProfileNotice('Имя профиля сохранено.');
    else setProfileError(result.error ?? 'Не удалось обновить профиль.');
  };

  const handleEmailSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError('');
    setProfileNotice('');
    setChangingEmail(true);
    const result = await updateAccountEmail(newEmail);
    setChangingEmail(false);
    if (result.ok) {
      setProfileNotice('Проверьте почту: Supabase отправил инструкции для подтверждения нового адреса.');
      setNewEmail('');
    } else setProfileError(result.error ?? 'Не удалось изменить адрес.');
  };

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError('');
    setProfileNotice('');
    if (newPassword !== confirmNewPassword) {
      setProfileError('Новые пароли не совпадают.');
      return;
    }
    setChangingPassword(true);
    const result = await changePassword(newPassword);
    setChangingPassword(false);
    if (result.ok) {
      setProfileNotice('Пароль изменён. Используйте его при следующем входе.');
      setNewPassword('');
      setConfirmNewPassword('');
    } else setProfileError(result.error ?? 'Не удалось изменить пароль.');
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProfileError('');
    setProfileNotice('');
    setUploadingAvatar(true);
    const result = await uploadAvatar(file);
    setUploadingAvatar(false);
    if (result.ok) setProfileNotice('Аватар обновлён.');
    else setProfileError(result.error ?? 'Не удалось загрузить изображение.');
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <button type="button" onClick={() => setView({ name: 'library' })} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> К библиотеке
      </button>
      <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-7 text-white sm:px-8">
          <div className="flex items-center gap-4">
            <ProfileAvatar name={accountName} path={profile.avatarPath} className="h-16 w-16 border-2 border-white/50 text-xl" />
            <div>
              <h1 className="text-2xl font-bold">Настройки профиля</h1>
              <p className="mt-1 text-sm text-indigo-100">Аккаунт, безопасность и предпочтения QuizFlow</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8">
          {!authReady ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Проверяем сессию…</div>
          ) : authUser ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{authUser.email}</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <Cloud className="h-3.5 w-3.5" />
                    {cloudSyncStatus === 'syncing' ? 'Синхронизация…' : cloudSyncStatus === 'error' ? 'Ошибка синхронизации' : cloudSyncStatus === 'synced' ? 'Библиотека синхронизирована' : 'Локальная библиотека'}
                  </div>
                </div>
                <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <LogOut className="h-4 w-4" /> Выйти
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <section className={panelClass}>
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><UserRound className="h-4 w-4 text-indigo-500" />Личные данные</div>
                  <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleAvatarChange(event)} className="hidden" />
                  <div className="mt-4 flex items-center gap-3">
                    <ProfileAvatar name={accountName} path={profile.avatarPath} className="h-14 w-14 text-lg" />
                    <button type="button" disabled={uploadingAvatar} onClick={() => avatarInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                      {uploadingAvatar ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {uploadingAvatar ? 'Загружаем…' : 'Загрузить аватар'}
                    </button>
                  </div>
                  <form onSubmit={(event) => void handleNameSave(event)} className="mt-4">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Отображаемое имя
                      <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={60} className={inputClass} placeholder="Ваше имя" />
                    </label>
                    <button type="submit" disabled={savingName || displayName.trim() === accountName} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {savingName && <LoaderCircle className="h-4 w-4 animate-spin" />}Сохранить имя
                    </button>
                  </form>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">JPG, PNG или WebP, до 5 МБ. Аватар доступен только после входа в аккаунт.</p>
                </section>

                <section className={panelClass}>
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Sun className="h-4 w-4 text-indigo-500" />Внешний вид</div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Выберите тему для сайта и Android-приложения.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggleTheme()} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${theme === 'light' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}><Sun className="h-4 w-4" />Светлая</button>
                    <button type="button" aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && toggleTheme()} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${theme === 'dark' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}><Moon className="h-4 w-4" />Тёмная</button>
                  </div>
                  <div className="mt-6 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><BookOpen className="h-4 w-4 text-indigo-500" />Цель занятий</div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Карточек для повторения в день: {studyStats.dailyGoal}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{[10, 20, 30, 50].map((goal) => <button key={goal} type="button" aria-pressed={studyStats.dailyGoal === goal} onClick={() => setDailyGoal(goal)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${studyStats.dailyGoal === goal ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>{goal}</button>)}</div>
                </section>

                <section className={panelClass}>
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Mail className="h-4 w-4 text-indigo-500" />Электронная почта</div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Сейчас: {authUser.email}</p>
                  <form onSubmit={(event) => void handleEmailSave(event)} className="mt-4">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Новый адрес
                      <input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required autoComplete="email" className={inputClass} placeholder="name@example.com" />
                    </label>
                    <button type="submit" disabled={changingEmail || !newEmail.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                      {changingEmail && <LoaderCircle className="h-4 w-4 animate-spin" />}Изменить адрес
                    </button>
                  </form>
                </section>

                <section className={panelClass}>
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><KeyRound className="h-4 w-4 text-indigo-500" />Безопасность</div>
                  <form onSubmit={(event) => void handlePasswordSave(event)} className="mt-4 space-y-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Новый пароль
                      <span className="relative block"><input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} autoComplete="new-password" className={`${inputClass} pr-11`} placeholder="Не менее 8 символов" /><button type="button" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? 'Скрыть новый пароль' : 'Показать новый пароль'} className="absolute inset-y-1.5 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-indigo-600">{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
                    </label>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Повторите новый пароль
                      <span className="relative block"><input type={showConfirmNewPassword ? 'text' : 'password'} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} required minLength={8} autoComplete="new-password" className={`${inputClass} pr-11`} placeholder="Повторите пароль" /><button type="button" onClick={() => setShowConfirmNewPassword((value) => !value)} aria-label={showConfirmNewPassword ? 'Скрыть повтор пароля' : 'Показать повтор пароля'} className="absolute inset-y-1.5 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-indigo-600">{showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
                    </label>
                    <button type="submit" disabled={changingPassword || !newPassword || !confirmNewPassword} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {changingPassword && <LoaderCircle className="h-4 w-4 animate-spin" />}Сменить пароль
                    </button>
                  </form>
                </section>
              </div>

              {(profileNotice || profileError) && <p role={profileError ? 'alert' : 'status'} className={`mt-4 flex items-center gap-2 text-sm ${profileError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{profileError ? <LockKeyhole className="h-4 w-4" /> : <Check className="h-4 w-4" />}{profileError || profileNotice}</p>}
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 dark:bg-indigo-950/40"><BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" /><div><div className="text-xl font-bold text-slate-900 dark:text-white">{sets.length}</div><div className="text-xs text-slate-500 dark:text-slate-400">наборов в библиотеке</div></div></div>
            </>
          ) : !authEnabled ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" />Серверная авторизация ещё не подключена</div>
              <p className="mt-2">Создайте проект Supabase, выполните SQL из <code>supabase/migrations</code> и задайте в Vercel переменные <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. После этого пересоберите сайт и APK.</p>
            </div>
          ) : (
            <div className="max-w-lg">
              <div className="mb-5 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button type="button" onClick={() => { setMode('signin'); setErrorMessage(''); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Войти</button>
                <button type="button" onClick={() => { setMode('signup'); setErrorMessage(''); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Создать аккаунт</button>
              </div>
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                {mode === 'signup' && <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Имя<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} autoComplete="name" placeholder="Как к вам обращаться" className={inputClass} /></label>}
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Электронная почта<span className="relative block"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={120} autoComplete="email" placeholder="name@example.com" className={`${inputClass} mt-1.5 pl-10`} /></span></label>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Пароль<span className="relative block"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className={`${inputClass} pr-11`} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} className="absolute inset-y-1.5 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-indigo-600">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
                {mode === 'signup' && <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Повторите пароль<span className="relative block"><input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" className={`${inputClass} pr-11`} /><button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Скрыть повтор пароля' : 'Показать повтор пароля'} className="absolute inset-y-1.5 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-indigo-600">{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>}
                {errorMessage && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>}
                {confirmationSent && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Аккаунт создан. Подтвердите электронную почту по ссылке из письма, затем войдите.</p>}
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{mode === 'signin' ? 'Войти в аккаунт' : 'Создать аккаунт'}</button>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};
