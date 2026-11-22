import { useEffect, useRef } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useApp } from '../store/AppContext';

const EXIT_DOUBLE_PRESS_WINDOW_MS = 2000;

export function useAndroidBackButton(): void {
  const { view, setView, notify } = useApp();

  // Храним актуальные значения в ref, чтобы не переподписывать нативный слушатель при каждом переходе
  const viewRef = useRef(view);
  const setViewRef = useRef(setView);
  const notifyRef = useRef(notify);
  const lastBackPressRef = useRef<number>(0);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    setViewRef.current = setView;
  }, [setView]);

  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isDisposed = false;
    let listenerHandle: PluginListenerHandle | null = null;

    const registerListener = async () => {
      const handle = await CapApp.addListener('backButton', () => {
        // 1. Если открыто модальное окно — закрываем его через уже подключённый обработчик Escape
        const openDialog = document.querySelector('[role="dialog"]');
        if (openDialog) {
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          );
          return;
        }

        const currentView = viewRef.current;

        // 2. Возврат по иерархии экранов QuizFlow
        if (currentView.name === 'mode') {
          setViewRef.current({ name: 'detail', setId: currentView.setId });
          return;
        }

        if (currentView.name === 'editor') {
          setViewRef.current(
            currentView.setId
              ? { name: 'detail', setId: currentView.setId }
              : { name: 'library' }
          );
          return;
        }

        if (currentView.name === 'detail') {
          setViewRef.current({ name: 'library' });
          return;
        }

        if (currentView.name === 'profile') {
          setViewRef.current({ name: 'library' });
          return;
        }

        // 3. Главный экран: выход по двойному нажатию «Назад»
        const now = Date.now();
        if (now - lastBackPressRef.current < EXIT_DOUBLE_PRESS_WINDOW_MS) {
          void CapApp.exitApp();
        } else {
          lastBackPressRef.current = now;
          notifyRef.current('Нажмите «Назад» ещё раз для выхода', 'info');
        }
      });

      if (isDisposed) {
        await handle.remove();
      } else {
        listenerHandle = handle;
      }
    };

    void registerListener();

    return () => {
      isDisposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, []);
}
