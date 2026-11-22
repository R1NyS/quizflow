import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import {
  AppView,
  Card,
  MasteryStatus,
  StorageSchemaV1,
  StudySet,
  ThemeMode,
  ToastMessage,
  ToastType,
} from '../types';
import {
  CURRENT_SCHEMA_VERSION,
  generateId,
  loadStorageState,
  saveStorageState,
} from '../utils/storage';

interface AppState {
  sets: StudySet[];
  theme: ThemeMode;
  view: AppView;
  toasts: ToastMessage[];
}

type Action =
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'CREATE_SET'; payload: StudySet }
  | { type: 'UPDATE_SET'; payload: StudySet }
  | { type: 'DELETE_SET'; payload: string }
  | { type: 'IMPORT_SETS'; payload: StudySet[] }
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
    case 'TOGGLE_CARD_STAR':
      return {
        ...state,
        sets: state.sets.map((set) => {
          if (set.id !== action.payload.setId) return set;
          return {
            ...set,
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
          return { ...set, bestMatchTimeMs: action.payload.timeMs };
        }),
      };
    case 'RESET_SET_PROGRESS':
      return {
        ...state,
        sets: state.sets.map((set) => {
          if (set.id !== action.payload) return set;
          return {
            ...set,
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
  view: AppView;
  toasts: ToastMessage[];
  setView: (view: AppView) => void;
  toggleTheme: () => void;
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

function createInitialState(): AppState {
  const persisted = loadStorageState();
  return {
    sets: persisted.sets,
    theme: persisted.theme,
    view: { name: 'library' },
    toasts: [],
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

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
      view: state.view,
      toasts: state.toasts,
      setView,
      toggleTheme,
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
      state.view,
      state.toasts,
      setView,
      toggleTheme,
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