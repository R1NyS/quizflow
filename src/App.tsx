import React, { useEffect } from 'react';
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

const AppContent: React.FC = () => {
  const { view, getSetById } = useApp();

  useAndroidBackButton();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void SplashScreen.hide({ fadeOutDuration: 250 });
    }
  }, []);

  const renderMain = () => {
    if (view.name === 'library') {
      return <LibraryView />;
    }

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
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
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