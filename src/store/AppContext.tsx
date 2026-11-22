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
} from '../utils/storage';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { appViewFromPath } from '../utils/routes';

interface AppState {
  sets: StudySet[];
  theme: ThemeMode;
  profile: UserProfile;
  view: AppView;
  toasts: ToastMessage[];
}

type Action =
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_PROFILE'; payload: UserProfile }
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'CREATE_SET'; payload: StudySet }
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
  | { type: 'REMOVE_TOAST'; payload: string };

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
  }
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
  setView: (view: AppView) => void;
  toggleTheme: () => void;
  saveUserProfile: (profile: UserProfile) => void;
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
        .select('sets')
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
      setHydratedUserId(ownerId);
      setCloudSyncStatus('synced');
      const accountName = typeof authUser.user_metadata.display_name === 'string'
        ? authUser.user_metadata.display_name
        : authUser.email?.split('@')[0] ?? '';
      const nextProfile = { name: accountName, email: authUser.email ?? '' };
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
    const timeoutId = window.setTimeout(() => {
      setCloudSyncStatus('syncing');
      void client.from('user_data').upsert({
        user_id: ownerId,
        sets,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) {
          setCloudSyncStatus('error');
          notify('Не удалось синхронизировать библиотеку с сервером.', 'error');
        } else {
          setCloudSyncStatus('synced');
        }
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [state.sets, authUser?.id, hydratedUserId, notify]);

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
    const cleaned = { name: profile.name.trim(), email: profile.email.trim() };
    if (!saveProfile(cleaned)) {
      notify('Не удалось сохранить профиль в браузере.', 'error');
      return;
    }
    dispatch({ type: 'SET_PROFILE', payload: cleaned });
    notify('Профиль сохранён', 'success');
  }, [notify]);

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
    const emptyProfile = { name: '', email: '' };
    saveProfile(emptyProfile);
    dispatch({ type: 'SET_PROFILE', payload: emptyProfile });
    dispatch({ type: 'REPLACE_SETS', payload: [] });
    setHydratedUserId(null);
    notify('Вы вышли из аккаунта', 'info');
  }, [authUser, hydratedUserId, notify]);

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
      setView,
      toggleTheme,
      saveUserProfile,
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
      setView,
      toggleTheme,
      saveUserProfile,
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
