import React, { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, UsersRound } from 'lucide-react';
import { SetDetailView } from '../library/SetDetailView';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';
import { sanitizeStudySet } from '../../utils/storage';
import { StudySet } from '../../types';

interface JoinedSet {
  shared_set_id: string;
  title: string;
  payload: unknown;
  role: 'owner' | 'editor' | 'viewer';
}

export const CollaborativeSetView: React.FC<{ inviteCode: string }> = ({ inviteCode }) => {
  const { authUser, authReady, setView, adoptSharedSet, sets } = useApp();
  const [shared, setShared] = useState<StudySet | null>(null);
  const [message, setMessage] = useState('Подключаемся к совместному набору…');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!authUser || !supabase) {
      setLoading(false);
      setMessage('Чтобы открыть приглашение, войдите в аккаунт QuizFlow.');
      return;
    }
    let active = true;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    void (async () => {
      const { data, error } = await supabase!.rpc('join_shared_set', { p_invite_code: inviteCode });
      if (!active) return;
      if (error) {
        setMessage(error.message.includes('function') ? 'Сначала примените миграцию совместных наборов в Supabase.' : error.message);
        setLoading(false);
        return;
      }
      const result = data as JoinedSet;
      const parsed = sanitizeStudySet(result.payload, false);
      if (!parsed) {
        setMessage('Содержимое приглашения повреждено. Попросите владельца отправить новую ссылку.');
        setLoading(false);
        return;
      }
      const next: StudySet = {
        ...parsed,
        title: result.title,
        collaborationId: result.shared_set_id,
        collaborationCode: inviteCode,
        collaborationRole: result.role,
      };
      setShared(next);
      adoptSharedSet(next, true);
      setLoading(false);
      channel = supabase!.channel(`shared-set-${result.shared_set_id}`).on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shared_sets', filter: `id=eq.${result.shared_set_id}` },
        (event) => {
          const remote = event.new as { payload?: unknown; title?: string };
          const updated = sanitizeStudySet(remote.payload, false);
          if (!updated) return;
          const synchronized = { ...updated, title: remote.title ?? updated.title, collaborationId: result.shared_set_id, collaborationCode: inviteCode, collaborationRole: result.role } as StudySet;
          setShared(synchronized);
          adoptSharedSet(synchronized, true);
        }
      ).subscribe();
    })();
    return () => {
      active = false;
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [authReady, authUser?.id, inviteCode, adoptSharedSet]);

  const localShared = shared ? sets.find((item) => item.collaborationId === shared.collaborationId) ?? shared : null;
  if (localShared) return <><div className="mx-auto mt-4 flex max-w-5xl items-center gap-2 px-4 text-sm text-indigo-600 dark:text-indigo-300"><UsersRound className="h-4 w-4" />Совместный набор · {localShared.collaborationRole === 'viewer' ? 'только просмотр' : localShared.collaborationRole === 'owner' ? 'владелец' : 'редактор'}</div><SetDetailView set={localShared} readOnly={localShared.collaborationRole === 'viewer'} /></>;

  return <main className="mx-auto max-w-2xl px-4 py-10"><button type="button" onClick={() => setView({ name: 'library' })} className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" />К библиотеке</button><section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">{loading ? <LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" /> : <UsersRound className="h-7 w-7 text-indigo-600" />}<h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{loading ? 'Загрузка приглашения' : 'Не удалось открыть набор'}</h1><p className="mt-2 text-slate-600 dark:text-slate-300">{message}</p>{!loading && !authUser && <button type="button" onClick={() => setView({ name: 'profile' })} className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white">Войти в аккаунт</button>}</section></main>;
};
