import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Header } from './components/layout/Header';
import { LibraryView } from './components/library/LibraryView';
import { SetDetailView } from './components/library/SetDetailView';
import { SetEditorView } from './components/editor/SetEditorView';
import { FlashcardsMode } from './components/modes/FlashcardsMode';
import { LearnMode } from './components/modes/LearnMode';
import { TestMode } from './components/modes/TestMode';
import { MatchMode } from './components/modes/MatchMode';
import { ToastContainer } from './components/ui/ToastContainer';
import { AppProvider, useApp } from './store/AppContext';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';
import { ProfileView } from './components/profile/ProfileView';
import { SharedSetView } from './components/share/SharedSetView';
import { readSharedSetFromUrl } from './utils/storage';
import { StudySet } from './types';
import { appViewFromPath, pathForAppView } from './utils/routes';

const AppContent: React.FC = () => {
  const { view, getSetById, setView } = useApp();
  const [sharedSet, setSharedSet] = useState<StudySet | null>(() => readSharedSetFromUrl());

  useAndroidBackButton();

  useEffect(() => {
    const handlePopState = () => setView(appViewFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setView]);

  useEffect(() => {
    const nextPath = pathForAppView(view);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ quizflowRoute: true }, '', nextPath);
    }

    const setTitle = view.name === 'library'
      ? 'Библиотека'
      : view.name === 'profile'
        ? 'Профиль'
        : view.name === 'editor'
          ? view.setId ? 'Редактирование набора' : 'Новый набор'
          : view.name === 'detail'
            ? getSetById(view.setId)?.title ?? 'Набор'
            : `${view.mode === 'flashcards' ? 'Карточки' : view.mode === 'learn' ? 'Учить' : view.mode === 'test' ? 'Тест' : 'Сопоставление'} — ${getSetById(view.setId)?.title ?? 'Набор'}`;
    document.title = `${setTitle} — QuizFlow`;
  }, [view, getSetById]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void SplashScreen.hide({ fadeOutDuration: 250 });
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => setSharedSet(readSharedSetFromUrl());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderMain = () => {
    if (sharedSet) return <SharedSetView set={sharedSet} onClose={() => setSharedSet(null)} />;
    if (view.name === 'library') {
      return <LibraryView />;
    }

    if (view.name === 'profile') return <ProfileView />;

    if (view.name === 'editor') {
      const existing = view.setId ? getSetById(view.setId) : undefined;
      return (
        <SetEditorView
          key={existing?.id ?? 'new-set'}
          existingSet={existing}
        />
      );
    }

    const activeSet = getSetById(view.setId);
    if (!activeSet) {
      return <LibraryView />;
    }

    if (view.name === 'detail') {
      return <SetDetailView set={activeSet} />;
    }

    switch (view.mode) {
      case 'flashcards':
        return <FlashcardsMode key={activeSet.id} set={activeSet} />;
      case 'learn':
        return <LearnMode key={activeSet.id} set={activeSet} />;
      case 'test':
        return <TestMode key={activeSet.id} set={activeSet} />;
      case 'match':
        return <MatchMode key={activeSet.id} set={activeSet} />;
    }
  };

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-clip bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />
      {renderMain()}
      <ToastContainer />
    </div>
  );
};

export const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;
