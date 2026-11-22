export type SpeechLangOption =
  | 'auto'
  | 'ru-RU'
  | 'en-US'
  | 'es-ES'
  | 'de-DE'
  | 'fr-FR';

export const SPEECH_LANG_LABELS: Record<SpeechLangOption, string> = {
  auto: 'Автоопределение',
  'ru-RU': 'Русский',
  'en-US': 'English',
  'es-ES': 'Español',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
};

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function detectSpeechLanguage(text: string): string {
  const cyrillicMatches = text.match(/[а-яёА-ЯЁ]/g)?.length ?? 0;
  const latinMatches = text.match(/[a-zA-Z]/g)?.length ?? 0;

  if (cyrillicMatches > latinMatches) {
    return 'ru-RU';
  }

  if (/[ñÑ¿¡]/.test(text)) {
    return 'es-ES';
  }

  if (/[ßäöüÄÖÜ]/.test(text)) {
    return 'de-DE';
  }

  return 'en-US';
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Игнорируем возможные ограничения браузера при сбросе очереди озвучки
  }
}

export function speakText(
  text: string,
  langOption: SpeechLangOption,
  onStart?: () => void,
  onEnd?: () => void
): void {
  if (!isSpeechSupported() || !text.trim()) return;

  stopSpeech();

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang =
      langOption === 'auto' ? detectSpeechLanguage(text) : langOption;
    utterance.rate = 0.96;

    if (onStart) utterance.onstart = onStart;
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch {
    onEnd?.();
  }
}