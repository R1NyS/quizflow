import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { User } from '@supabase/supabase-js';
import {
  AppView,
  Card,
  MasteryStatus,
  StorageSchemaV1,
  StudySet,
  StudyStats,
  ThemeMode,
  ToastMessage,
  ToastType,
  UserProfile,
} from '../types';
import {
  CURRENT_SCHEMA_VERSION,
  generateId,
  loadStorageState,
  saveStorageState,
  loadProfile,
  saveProfile,
  sanitizeStudySet,
  loadStudyStats,
  saveStudyStats,
} from '../utils/storage';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { appViewFromPath } from '../utils/routes';

interface AppState {
  sets: StudySet[];
  theme: ThemeMode;
  profile: UserProfile;
  view: AppView;
  toasts: ToastMessage[];
  studyStats: StudyStats;
}

type Action =
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_PROFILE'; payload: UserProfile }
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'CREATE_SET'; payload: StudySet }
  | { type: 'UPSERT_SET'; payload: StudySet }
  | { type: 'UPDATE_SET'; payload: StudySet }
  | { type: 'DELETE_SET'; payload: string }
  | { type: 'IMPORT_SETS'; payload: StudySet[] }
  | { type: 'REPLACE_SETS'; payload: StudySet[] }
  | { type: 'TOGGLE_CARD_STAR'; payload: { setId: string; cardId: string } }
  | {
      type: 'UPDATE_CARD_PROGRESS';
      payload: {
        setId: string;
        cardId: string;
        mastery: MasteryStatus;
        correctStreak: number;
      };
    }
  | { type: 'UPDATE_MATCH_RECORD'; payload: { setId: string; timeMs: number } }
  | { type: 'RESET_SET_PROGRESS'; payload: string }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'SET_STUDY_STATS'; payload: StudyStats }
  | { type: 'REVIEW_CARD'; payload: { setId: string; cardId: string; quality: 'again' | 'hard' | 'good' | 'easy'; at: number } };

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_PROFILE':
      return { ...state, profile: action.payload };
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'CREATE_SET':
      return { ...state, sets: [action.payload, ...state.sets] };
    case 'UPSERT_SET': {
      const exists = state.sets.some((set) => set.id === action.payload.id);
      return { ...state, sets: exists
        ? state.sets.map((set) => set.id === action.payload.id ? action.payload : set)
        : [action.payload, ...state.sets] };
    }
    case 'UPDATE_SET':
      return {
        ...state,
        sets: state.sets.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case 'DELETE_SET': {
      const nextSets = state.sets.filter((s) => s.id !== action.payload);
      const isViewingDeleted =
        (state.view.name === 'detail' ||
          state.view.name === 'editor' ||
          state.view.name === 'mode') &&
        state.view.setId === action.payload;
      return {
        ...state,
        sets: nextSets,
        view: isViewingDeleted ? { name: 'library' } : state.view,
      };
    }
    case 'IMPORT_SETS':
      return { ...state, sets: [...action.payload, ...state.sets] };
    case 'REPLACE_SETS':
      return { ...state, sets: action.payload };
    case 'TOGGLE_CARD_STAR':
      return {
        ...state,
        sets: state.sets.map((set) => {
          if (set.id !== action.payload.setId) return set;
          return {
            ...set,
            updatedAt: Date.now(),
            cards: set.cards.map((card) =>
              card.id === action.payload.cardId
                ? { ...card, starred: !card.starred }
                : card
            ),
          };
        }),
      };
    case 'UPDATE_CARD_PROGRESS':
      return {
        ...state,
        sets: state.sets.map((set) => {
          if (set.id !== action.payload.setId) return set;
          return {
            ...set,
            updatedAt: Date.now(),
            cards: set.cards.map((card) =>
              card.id === action.payload.cardId
                ? {
                    ...card,
                    mastery: action.payload.mastery,
                    correctStreak: action.payload.correctStreak,
                    lastReviewedAt: Date.now(),
                  }
                : card
            ),
          };
        }),
      };
    case 'UPDATE_MATCH_RECORD':
      return {
        ...state,
        sets: state.sets.map((set) => {
          if (set.id !== action.payload.setId) return set;
          const current = set.bestMatchTimeMs;
          if (current !== null && current <= action.payload.timeMs) {
            return set;
          }
          return { ...set, bestMatchTimeMs: action.payload.timeMs, updatedAt: Date.now() };
        }),
      };
    case 'RESET_SET_PROGRESS':
      return {
        ...state,
        sets: state.sets.map((set) => {
          if (set.id !== action.payload) return set;
          return {
            ...set,
            updatedAt: Date.now(),
            cards: set.cards.map((card) => ({
              ...card,
              mastery: 'new',
              correctStreak: 0,
              lastReviewedAt: null,
            nextReviewAt: null,
            reviewIntervalDays: 0,
            reviewCount: 0,
            })),
          };
        }),
      };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };
    case 'SET_STUDY_STATS':
      return { ...state, studyStats: action.payload };
    case 'REVIEW_CARD': {
      const { setId, cardId, quality, at } = action.payload;
      const previous = state.sets.find((set) => set.id === setId)?.cards.find((card) => card.id === cardId);
      if (!previous) return state;
      const previousInterval = previous.reviewIntervalDays ?? 0;
      const intervalDays = quality === 'again'
        ? 0
        : quality === 'hard'
          ? Math.max(1, previousInterval * 1.2)
          : quality === 'good'
            ? previousInterval < 1 ? 1 : previousInterval < 3 ? 3 : previousInterval * 2.2
            : previousInterval < 1 ? 4 : previousInterval * 3;
      const nextReviewAt = at + (quality === 'again' ? 10 * 60 * 1000 : intervalDays * 24 * 60 * 60 * 1000);
      const reviewCount = (previous.reviewCount ?? 0) + 1;
      const mastery: MasteryStatus = quality === 'again' ? 'learning' : quality === 'easy' || reviewCount >= 3 ? 'mastered' : 'learning';
      const sets = state.sets.map((set) => set.id !== setId ? set : {
        ...set,
        updatedAt: at,
        cards: set.cards.map((card) => card.id !== cardId ? card : {
          ...card,
          mastery,
          correctStreak: quality === 'again' ? 0 : card.correctStreak + 1,
          lastReviewedAt: at,
          nextReviewAt,
          reviewIntervalDays: intervalDays,
          reviewCount,
        }),
      });
      const day = localDayKey(new Date(at));
      const studyStats = {
        ...state.studyStats,
        dailyHistory: { ...state.studyStats.dailyHistory, [day]: (state.studyStats.dailyHistory[day] ?? 0) + 1 },
      };
      return { ...state, sets, studyStats };
    }
  }
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mergeStudyStats(local: StudyStats, cloud: Partial<StudyStats> | null | undefined): StudyStats {
  if (!cloud || typeof cloud.dailyGoal !== 'number' || !cloud.dailyHistory || typeof cloud.dailyHistory !== 'object') return local;
  const dailyHistory = { ...local.dailyHistory };
  for (const [day, count] of Object.entries(cloud.dailyHistory)) {
    if (typeof count === 'number' && Number.isFinite(count)) dailyHistory[day] = Math.max(dailyHistory[day] ?? 0, count);
  }
  return { dailyGoal: Math.min(200, Math.max(5, Math.floor(cloud.dailyGoal))), dailyHistory };
}

interface SaveSetInput {
  id?: string;
  title: string;
  description: string;
  tags: string[];
  cards: Card[];
}

interface AppContextValue {
  sets: StudySet[];
  theme: ThemeMode;
  profile: UserProfile;
  authUser: User | null;
  authReady: boolean;
  authEnabled: boolean;
  cloudSyncStatus: 'local' | 'syncing' | 'synced' | 'error';
  view: AppView;
  toasts: ToastMessage[];
  studyStats: StudyStats;
  setView: (view: AppView) => void;
  toggleTheme: () => void;
  saveUserProfile: (profile: UserProfile) => void;
  updateDisplayName: (name: string) => Promise<{ ok: boolean; error?: string }>;
  updateAccountEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ ok: boolean; confirmationRequired?: boolean; error?: string }>;
  signOut: () => Promise<void>;
  saveSet: (input: SaveSetInput) => StudySet;
  deleteSet: (setId: string) => void;
  importSets: (sets: StudySet[]) => void;
  toggleCardStar: (setId: string, cardId: string) => void;
  updateCardProgress: (
    setId: string,
    cardId: string,
    mastery: MasteryStatus,
    correctStreak: number
  ) => void;
  updateMatchRecord: (setId: string, timeMs: number) => void;
  resetSetProgress: (setId: string) => void;
  reviewCard: (setId: string, cardId: string, quality: 'again' | 'hard' | 'good' | 'easy') => void;
  setDailyGoal: (goal: number) => void;
  adoptSharedSet: (set: StudySet, fromRemote?: boolean) => void;
  notify: (text: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
  getSetById: (setId: string) => StudySet | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

function mergeStudySets(localSets: StudySet[], cloudSets: StudySet[]): StudySet[] {
  const merged = new Map(cloudSets.map((set) => [set.id, set]));
  for (const set of localSets) {
    const cloudVersion = merged.get(set.id);
    if (!cloudVersion || set.updatedAt > cloudVersion.updatedAt) {
      merged.set(set.id, set);
    }
  }
  return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

function createInitialState(): AppState {
  const persisted = loadStorageState();
  return {
    sets: persisted.sets,
    theme: persisted.theme,
    profile: loadProfile(),
    view: appViewFromPath(window.location.pathname),
    toasts: [],
    studyStats: loadStudyStats(),
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
  const [authUser, setAuthUser] = React.useState<User | null>(null);
  const [authReady, setAuthReady] = React.useState(!supabaseConfigured);
  const [hydratedUserId, setHydratedUserId] = React.useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = React.useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const setsRef = useRef(state.sets);
  const sharedSyncRef = useRef(new Map<string, number>());
  const notify = useCallback(
    (text: string, type: ToastType = 'info') => {
      const id = generateId('toast');
      dispatch({ type: 'ADD_TOAST', payload: { id, type, text } });
      window.setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', payload: id });
      }, 3600);
    },
    []
  );

  useEffect(() => {
    setsRef.current = state.sets;
  }, [state.sets]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) notify('Не удалось проверить сессию аккаунта.', 'error');
      setAuthUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [notify]);

  useEffect(() => {
    const client = supabase;
    if (!client || !authUser) {
      setHydratedUserId(null);
      setCloudSyncStatus('local');
      return;
    }
    let active = true;
    const ownerId = authUser.id;
    setHydratedUserId(null);
    setCloudSyncStatus('syncing');
    void (async () => {
      const { data, error } = await client
        .from('user_data')
        .select('sets, study_stats')
        .eq('user_id', ownerId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setCloudSyncStatus('error');
        notify('Вход выполнен, но не удалось загрузить облачную библиотеку. Проверьте миграцию базы данных.', 'error');
        return;
      }
      const cloudSets = Array.isArray(data?.sets)
        ? data.sets.map((item: unknown) => sanitizeStudySet(item, false)).filter((item): item is StudySet => item !== null)
        : [];
      const mergedSets = mergeStudySets(setsRef.current, cloudSets);
      dispatch({ type: 'REPLACE_SETS', payload: mergedSets });
      const mergedStats = mergeStudyStats(state.studyStats, data?.study_stats as Partial<StudyStats> | null);
      dispatch({ type: 'SET_STUDY_STATS', payload: mergedStats });
      saveStudyStats(mergedStats);
      setHydratedUserId(ownerId);
      setCloudSyncStatus('synced');
      const accountName = typeof authUser.user_metadata.display_name === 'string'
        ? authUser.user_metadata.display_name
        : authUser.email?.split('@')[0] ?? '';
      const avatarPath = typeof authUser.user_metadata.avatar_path === 'string' ? authUser.user_metadata.avatar_path : null;
      const nextProfile = { name: accountName, email: authUser.email ?? '', avatarPath };
      saveProfile(nextProfile);
      dispatch({ type: 'SET_PROFILE', payload: nextProfile });
    })();
    return () => { active = false; };
  }, [authUser?.id, notify]);

  useEffect(() => {
    const client = supabase;
    if (!client || !authUser || hydratedUserId !== authUser.id) return;
    const ownerId = authUser.id;
    const sets = state.sets;
    const studyStats = state.studyStats;
    const timeoutId = window.setTimeout(() => {
      setCloudSyncStatus('syncing');
      void client.from('user_data').upsert({
        user_id: ownerId,
        sets,
        study_stats: studyStats,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) {
          setCloudSyncStatus('error');
          notify('Не удалось синхронизировать библиотеку с сервером.', 'error');
        } else {
          setCloudSyncStatus('synced');
        }
      });
      for (const set of sets.filter((item) => item.collaborationId && item.collaborationRole !== 'viewer')) {
        const sharedId = set.collaborationId!;
        const lastSyncedAt = sharedSyncRef.current.get(sharedId) ?? 0;
        if (set.updatedAt <= lastSyncedAt) continue;
        sharedSyncRef.current.set(sharedId, set.updatedAt);
        void client.from('shared_sets').update({ title: set.title, payload: set, updated_at: new Date().toISOString() }).eq('id', sharedId).then(({ error }) => {
          if (error) notify('Не удалось синхронизировать совместный набор.', 'error');
        });
      }
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [state.sets, state.studyStats, authUser?.id, hydratedUserId, notify]);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  useEffect(() => {
    const payload: StorageSchemaV1 = {
      version: CURRENT_SCHEMA_VERSION,
      theme: state.theme,
      sets: state.sets,
    };
    const ok = saveStorageState(payload);
    if (!ok) {
      notify(
        'Не удалось сохранить данные в localStorage. Проверьте свободное место в браузере.',
        'error'
      );
    }
  }, [state.sets, state.theme, notify]);

  useEffect(() => {
    if (!saveStudyStats(state.studyStats)) {
      notify('Не удалось сохранить статистику занятий в браузере.', 'error');
    }
  }, [state.studyStats, notify]);

  const setView = useCallback((view: AppView) => {
    dispatch({ type: 'SET_VIEW', payload: view });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleTheme = useCallback(() => {
    dispatch({
      type: 'SET_THEME',
      payload: state.theme === 'dark' ? 'light' : 'dark',
    });
  }, [state.theme]);

  const saveUserProfile = useCallback((profile: UserProfile) => {
    const cleaned = { ...profile, name: profile.name.trim(), email: profile.email.trim() };
    if (!saveProfile(cleaned)) {
      notify('Не удалось сохранить профиль в браузере.', 'error');
      return;
    }
    dispatch({ type: 'SET_PROFILE', payload: cleaned });
    notify('Профиль сохранён', 'success');
  }, [notify]);

  const updateDisplayName = useCallback(async (name: string) => {
    if (!supabase || !authUser) return { ok: false, error: 'Сначала войдите в аккаунт.' };
    const cleanedName = name.trim();
    if (!cleanedName) return { ok: false, error: 'Введите имя профиля.' };
    const { data, error } = await supabase.auth.updateUser({
      data: { ...authUser.user_metadata, display_name: cleanedName },
    });
    if (error) return { ok: false, error: error.message };
    const nextProfile = { ...state.profile, name: cleanedName, email: data.user.email ?? state.profile.email };
    setAuthUser(data.user);
    if (saveProfile(nextProfile)) dispatch({ type: 'SET_PROFILE', payload: nextProfile });
    notify('Имя профиля обновлено', 'success');
    return { ok: true };
  }, [authUser, notify, state.profile]);

  const updateAccountEmail = useCallback(async (email: string) => {
    if (!supabase || !authUser) return { ok: false, error: 'Сначала войдите в аккаунт.' };
    const nextEmail = email.trim();
    if (!nextEmail || nextEmail.toLowerCase() === (authUser.email ?? '').toLowerCase()) {
      return { ok: false, error: 'Введите новый адрес электронной почты.' };
    }
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    if (error) return { ok: false, error: error.message };
    notify('Отправили письма для подтверждения нового адреса', 'success');
    return { ok: true };
  }, [authUser, notify]);

  const changePassword = useCallback(async (password: string) => {
    if (!supabase || !authUser) return { ok: false, error: 'Сначала войдите в аккаунт.' };
    if (password.length < 8) return { ok: false, error: 'Пароль должен содержать не менее 8 символов.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: error.message };
    notify('Пароль успешно изменён', 'success');
    return { ok: true };
  }, [authUser, notify]);

  const uploadAvatar = useCallback(async (file: File) => {
    if (!supabase || !authUser) return { ok: false, error: 'Сначала войдите в аккаунт.' };
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) return { ok: false, error: 'Выберите изображение JPG, PNG или WebP.' };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'Размер изображения должен быть не больше 5 МБ.' };
    const path = `${authUser.id}/avatar`;
    const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, file, {
      cacheControl: '3600', contentType: file.type, upsert: true,
    });
    if (uploadError) return { ok: false, error: uploadError.message };
    const { data, error } = await supabase.auth.updateUser({
      data: { ...authUser.user_metadata, avatar_path: path },
    });
    if (error) return { ok: false, error: error.message };
    const nextProfile = { ...state.profile, name: state.profile.name || data.user.user_metadata.display_name || '', email: data.user.email ?? state.profile.email, avatarPath: path };
    setAuthUser(data.user);
    if (saveProfile(nextProfile)) dispatch({ type: 'SET_PROFILE', payload: nextProfile });
    notify('Аватар обновлён', 'success');
    return { ok: true };
  }, [authUser, notify, state.profile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { ok: false, error: 'Серверная авторизация не настроена.' };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: error.message };
    notify('Вы вошли в аккаунт', 'success');
    return { ok: true };
  }, [notify]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) return { ok: false, error: 'Серверная авторизация не настроена.' };
    if (authUser) return { ok: false, error: 'Сначала выйдите из текущего аккаунта.' };
    const redirectTo = import.meta.env.VITE_PUBLIC_APP_URL?.trim() || window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) return { ok: false, error: error.message };
    if (data.session?.user) {
      setAuthUser(data.session.user);
      notify('Аккаунт создан', 'success');
      return { ok: true };
    }
    notify('Аккаунт создан. Подтвердите адрес по ссылке из письма.', 'success');
    return { ok: true, confirmationRequired: true };
  }, [authUser, notify]);

  const signOut = useCallback(async () => {
    if (!supabase || !authUser) return;
    if (hydratedUserId !== authUser.id) {
      notify('Подождите завершения загрузки облачной библиотеки перед выходом.', 'error');
      return;
    }
    const { error: saveError } = await supabase.from('user_data').upsert({
      user_id: authUser.id,
      sets: setsRef.current,
      study_stats: state.studyStats,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (saveError) {
      notify('Сначала дождитесь синхронизации библиотеки с сервером.', 'error');
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      notify('Не удалось выйти из аккаунта.', 'error');
      return;
    }
    const emptyProfile = { name: '', email: '', avatarPath: null };
    saveProfile(emptyProfile);
    dispatch({ type: 'SET_PROFILE', payload: emptyProfile });
    dispatch({ type: 'REPLACE_SETS', payload: [] });
    setHydratedUserId(null);
    notify('Вы вышли из аккаунта', 'info');
  }, [authUser, hydratedUserId, notify, state.studyStats]);

  const saveSet = useCallback(
    (input: SaveSetInput): StudySet => {
      const now = Date.now();
      const existing = input.id
        ? state.sets.find((s) => s.id === input.id)
        : undefined;

      if (existing) {
        const updated: StudySet = {
          ...existing,
          title: input.title.trim(),
          description: input.description.trim(),
          tags: input.tags,
          cards: input.cards,
          updatedAt: now,
        };
        dispatch({ type: 'UPDATE_SET', payload: updated });
        return updated;
      }

      const created: StudySet = {
        id: generateId('set'),
        title: input.title.trim(),
        description: input.description.trim(),
        tags: input.tags,
        cards: input.cards,
        createdAt: now,
        updatedAt: now,
        bestMatchTimeMs: null,
      };
      dispatch({ type: 'CREATE_SET', payload: created });
      return created;
    },
    [state.sets]
  );

  const deleteSet = useCallback((setId: string) => {
    dispatch({ type: 'DELETE_SET', payload: setId });
  }, []);

  const importSets = useCallback((sets: StudySet[]) => {
    dispatch({ type: 'IMPORT_SETS', payload: sets });
  }, []);

  const toggleCardStar = useCallback((setId: string, cardId: string) => {
    dispatch({ type: 'TOGGLE_CARD_STAR', payload: { setId, cardId } });
  }, []);

  const updateCardProgress = useCallback(
    (
      setId: string,
      cardId: string,
      mastery: MasteryStatus,
      correctStreak: number
    ) => {
      dispatch({
        type: 'UPDATE_CARD_PROGRESS',
        payload: { setId, cardId, mastery, correctStreak },
      });
    },
    []
  );

  const updateMatchRecord = useCallback((setId: string, timeMs: number) => {
    dispatch({ type: 'UPDATE_MATCH_RECORD', payload: { setId, timeMs } });
  }, []);

  const resetSetProgress = useCallback((setId: string) => {
    dispatch({ type: 'RESET_SET_PROGRESS', payload: setId });
  }, []);

  const reviewCard = useCallback((setId: string, cardId: string, quality: 'again' | 'hard' | 'good' | 'easy') => {
    dispatch({ type: 'REVIEW_CARD', payload: { setId, cardId, quality, at: Date.now() } });
  }, []);

  const setDailyGoal = useCallback((goal: number) => {
    dispatch({ type: 'SET_STUDY_STATS', payload: { ...state.studyStats, dailyGoal: Math.min(200, Math.max(5, Math.floor(goal))) } });
  }, [state.studyStats]);

  const adoptSharedSet = useCallback((set: StudySet, fromRemote = false) => {
    if (fromRemote && set.collaborationId) sharedSyncRef.current.set(set.collaborationId, set.updatedAt);
    dispatch({ type: 'UPSERT_SET', payload: set });
  }, []);

  const getSetById = useCallback(
    (setId: string) => state.sets.find((s) => s.id === setId),
    [state.sets]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      sets: state.sets,
      theme: state.theme,
      profile: state.profile,
      authUser,
      authReady,
      authEnabled: supabaseConfigured,
      cloudSyncStatus,
      view: state.view,
      toasts: state.toasts,
      studyStats: state.studyStats,
      setView,
      toggleTheme,
      saveUserProfile,
      updateDisplayName,
      updateAccountEmail,
      changePassword,
      uploadAvatar,
      signIn,
      signUp,
      signOut,
      saveSet,
      deleteSet,
      importSets,
      toggleCardStar,
      updateCardProgress,
      updateMatchRecord,
      resetSetProgress,
      reviewCard,
      setDailyGoal,
      adoptSharedSet,
      notify,
      dismissToast,
      getSetById,
    }),
    [
      state.sets,
      state.theme,
      state.profile,
      authUser,
      authReady,
      cloudSyncStatus,
      state.view,
      state.toasts,
      state.studyStats,
      setView,
      toggleTheme,
      saveUserProfile,
      updateDisplayName,
      updateAccountEmail,
      changePassword,
      uploadAvatar,
      signIn,
      signUp,
      signOut,
      saveSet,
      deleteSet,
      importSets,
      toggleCardStar,
      updateCardProgress,
      updateMatchRecord,
      resetSetProgress,
      reviewCard,
      setDailyGoal,
      adoptSharedSet,
      notify,
      dismissToast,
      getSetById,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp должен использоваться внутри AppProvider');
  }
  return ctx;
}
