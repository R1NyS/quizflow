import { Capacitor } from '@capacitor/core';
import { QueueStrategy, TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechSettings } from '../types';

export interface SpeechVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
}

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  rate: 1,
  volume: 1,
  voiceURI: '',
};

export async function getSpeechVoices(): Promise<SpeechVoiceOption[]> {
  if (Capacitor.isNativePlatform()) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const { voices } = await TextToSpeech.getSupportedVoices();
        return voices.map(({ voiceURI, name, lang }) => ({ voiceURI, name, lang }));
      } catch {
        if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    return [];
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const synthesis = window.speechSynthesis;
  const currentVoices = synthesis.getVoices();
  if (currentVoices.length) return currentVoices.map(({ voiceURI, name, lang }) => ({ voiceURI, name, lang }));

  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timeoutId);
      synthesis.removeEventListener('voiceschanged', finish);
      resolve(synthesis.getVoices().map(({ voiceURI, name, lang }) => ({ voiceURI, name, lang })));
    };
    const timeoutId = window.setTimeout(finish, 1500);
    synthesis.addEventListener('voiceschanged', finish, { once: true });
  });
}

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
    (Capacitor.isNativePlatform() || (
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    ))
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
  if (Capacitor.isNativePlatform()) {
    void TextToSpeech.stop().catch(() => undefined);
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
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
  onEnd?: () => void,
  settings: SpeechSettings = DEFAULT_SPEECH_SETTINGS
): Promise<boolean> {
  if (!text.trim()) {
    onEnd?.();
    return Promise.resolve(false);
  }

  const lang = langOption === 'auto' ? detectSpeechLanguage(text) : langOption;

  if (Capacitor.isNativePlatform()) {
    onStart?.();
    const speakNatively = async (attempt = 0): Promise<boolean> => {
      try {
        const { voices } = settings.voiceURI
          ? await TextToSpeech.getSupportedVoices()
          : { voices: [] };
        const voice = settings.voiceURI
          ? voices.findIndex((candidate) => candidate.voiceURI === settings.voiceURI)
          : -1;
        await TextToSpeech.speak({
          text,
          lang,
          rate: settings.rate,
          pitch: 1,
          volume: settings.volume,
          voice: voice >= 0 ? voice : -1,
          queueStrategy: QueueStrategy.Flush,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt < 3 && /not yet initialized/i.test(message)) {
          await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
          return speakNatively(attempt + 1);
        }
        return false;
      }
    };

    return speakNatively()
      .finally(() => onEnd?.());
  }

  stopSpeech();

  if (!isSpeechSupported()) {
    onEnd?.();
    return Promise.resolve(false);
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = settings.rate;
    utterance.volume = settings.volume;
    if (settings.voiceURI) {
      utterance.voice = window.speechSynthesis.getVoices()
        .find((voice) => voice.voiceURI === settings.voiceURI) ?? null;
    }

    if (onStart) utterance.onstart = onStart;
    return new Promise((resolve) => {
      utterance.onend = () => {
        onEnd?.();
        resolve(true);
      };
      utterance.onerror = () => {
        onEnd?.();
        resolve(false);
      };
      window.speechSynthesis.speak(utterance);
    });
  } catch {
    onEnd?.();
    return Promise.resolve(false);
  }
}
