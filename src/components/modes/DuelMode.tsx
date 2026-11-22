import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ArrowLeft, Check, Copy, LoaderCircle, Swords, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppContext';
import { Card, StudySet } from '../../types';
import { normalizeAnswer } from '../../utils/text';

type DuelMessage = { kind: 'request' } | { kind: 'setup'; title: string; cards: Card[]; hostName: string } | { kind: 'score'; playerId: string; name: string; score: number } | { kind: 'next'; index: number };

export const DuelMode: React.FC<{ roomCode: string; set?: StudySet }> = ({ roomCode, set }) => {
  const { authUser, profile, setView, notify } = useApp();
  const playerId = useMemo(() => crypto.randomUUID(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [cards, setCards] = useState<Card[]>(set?.cards ?? []);
  const [title, setTitle] = useState(set?.title ?? 'Дуэль QuizFlow');
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentName, setOpponentName] = useState('Соперник');
  const [opponentHere, setOpponentHere] = useState(false);
  const [copied, setCopied] = useState(false);
  const card = cards[index];
  const isHost = Boolean(set);
  const myName = profile.name || authUser?.email?.split('@')[0] || 'Игрок';

  useEffect(() => {
    if (!supabase || !roomCode) return;
    const channel = supabase.channel(`quizflow-duel-${roomCode}`, { config: { broadcast: { self: false }, presence: { key: playerId } } });
    channelRef.current = channel;
    channel.on('broadcast', { event: 'duel' }, ({ payload }: { payload: DuelMessage & { playerId?: string } }) => {
      if (payload.playerId === playerId) return;
      if (payload.kind === 'request' && set) void channel.send({ type: 'broadcast', event: 'duel', payload: { kind: 'setup', title: set.title, cards: set.cards, hostName: myName, playerId } });
      if (payload.kind === 'setup') {
        setTitle(payload.title); setCards(payload.cards); setOpponentName(payload.hostName);
      }
      if (payload.kind === 'score' && payload.playerId !== playerId) {
        setOpponentScore(payload.score); setOpponentName(payload.name);
      }
      if (payload.kind === 'next') {
        setIndex(payload.index); setAnswer(''); setSubmitted(false);
      }
    });
    channel.on('presence', { event: 'sync' }, () => {
      const others = Object.entries(channel.presenceState()).filter(([key]) => key !== playerId);
      setOpponentHere(others.length > 0);
    });
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      setConnected(true);
      void channel.track({ name: myName });
      if (set) void channel.send({ type: 'broadcast', event: 'duel', payload: { kind: 'setup', title: set.title, cards: set.cards, hostName: myName, playerId } });
      else void channel.send({ type: 'broadcast', event: 'duel', payload: { kind: 'request', playerId } });
    });
    return () => { channelRef.current = null; void supabase?.removeChannel(channel); };
  }, [roomCode, playerId, set?.id, authUser?.id]);

  const start = () => {
    if (!set) return;
    const shuffled = [...set.cards].sort(() => Math.random() - 0.5);
    setCards(shuffled); setIndex(0); setScore(0); setOpponentScore(0); setAnswer(''); setSubmitted(false);
    setTitle(set.title);
    void channelRef.current?.send({ type: 'broadcast', event: 'duel', payload: { kind: 'setup', title: set.title, cards: shuffled, hostName: myName, playerId } });
  };
  const submit = () => {
    if (!card || submitted || !answer.trim()) return;
    const correct = normalizeAnswer(answer) === normalizeAnswer(card.definition);
    const nextScore = score + (correct ? 1 : 0);
    setScore(nextScore); setSubmitted(true);
    void channelRef.current?.send({ type: 'broadcast', event: 'duel', payload: { kind: 'score', playerId, name: myName, score: nextScore } });
  };
  const next = () => {
    const nextIndex = index + 1;
    setIndex(nextIndex); setAnswer(''); setSubmitted(false);
    void channelRef.current?.send({ type: 'broadcast', event: 'duel', payload: { kind: 'next', index: nextIndex, playerId } });
  };
  const share = async () => {
    const url = `${window.location.origin}/duel/${encodeURIComponent(roomCode)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { notify(url, 'info'); }
  };

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><button type="button" onClick={() => setView(set ? { name: 'detail', setId: set.id } : { name: 'library' })} className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" />{set ? 'К набору' : 'В библиотеку'}</button><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Живая дуэль</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{title}</h1></div><div className="flex gap-2"><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">Вы {score}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{opponentName} {opponentScore}</span></div></div><section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">{connected ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : <LoaderCircle className="h-4 w-4 animate-spin" />}{connected ? opponentHere ? 'Соперник подключён' : 'Ждём соперника по ссылке' : supabase ? 'Подключаемся…' : 'Настройте Supabase Realtime для дуэлей'}</div><button type="button" onClick={() => void share()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Ссылка скопирована' : 'Скопировать приглашение'}</button></div>{!card ? <div className="py-12 text-center"><Swords className="mx-auto h-10 w-10 text-violet-500"/><h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{isHost ? 'Готовы к поединку?' : cards.length ? 'Раунд завершён' : 'Ждём набор от создателя'}</h2><p className="mt-2 text-slate-500 dark:text-slate-400">Комната: {roomCode.slice(0, 8)}</p>{isHost && <button type="button" onClick={start} disabled={!connected || !opponentHere || !cards.length} className="mt-5 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-50">Начать дуэль</button>}{!isHost && cards.length > 0 && <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">Ваш счёт: {score} · соперник: {opponentScore}</div>}</div> : <><div className="mt-7 text-sm text-slate-500 dark:text-slate-400">Карточка {index + 1} из {cards.length}</div><div className="mt-2 rounded-2xl bg-slate-50 p-6 text-2xl font-semibold text-slate-900 dark:bg-slate-950 dark:text-white">{card.term}</div><label className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Ваш ответ<input value={answer} disabled={submitted} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-normal dark:border-slate-700 dark:bg-slate-950" placeholder="Введите определение" /></label>{submitted && <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">{normalizeAnswer(answer) === normalizeAnswer(card.definition) ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-rose-500" />}{card.definition}<span className="ml-auto">Счёт соперника: {opponentScore}</span></div>}<div className="mt-4 flex justify-end">{!submitted ? <button type="button" onClick={submit} disabled={!answer.trim()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Ответить</button> : index + 1 < cards.length ? <button type="button" onClick={next} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white">Следующая карточка</button> : <button type="button" onClick={start} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white">Повторить дуэль</button>}</div></>}</section></main>;
};
