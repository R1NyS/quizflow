import { Card, StudySet } from '../types';

function createSeedCard(id: string, term: string, definition: string): Card {
  return {
    id,
    term,
    definition,
    starred: false,
    mastery: 'new',
    correctStreak: 0,
    lastReviewedAt: null,
  };
}

export function createSeedSets(): StudySet[] {
  const now = Date.now();

  return [
    {
      id: 'seed-english-b2-phrasal',
      title: 'Английский B2: Фразовые глаголы',
      description:
        'Ключевые фразовые глаголы уровня Upper-Intermediate для повседневного и делового общения.',
      tags: ['Английский', 'B2', 'Глаголы'],
      createdAt: now - 1000 * 60 * 60 * 24,
      updatedAt: now - 1000 * 60 * 60 * 24,
      bestMatchTimeMs: null,
      cards: [
        createSeedCard('en-1', 'bring up', 'поднять тему в разговоре; воспитывать'),
        createSeedCard('en-2', 'carry out', 'выполнять, проводить (исследование, план)'),
        createSeedCard('en-3', 'come across', 'случайно наткнуться, встретить'),
        createSeedCard('en-4', 'figure out', 'разобраться, понять, вычислить'),
        createSeedCard('en-5', 'get over', 'пережить, оправиться после трудности или болезни'),
        createSeedCard('en-6', 'look forward to', 'ждать с нетерпением'),
        createSeedCard('en-7', 'put off', 'откладывать на потом'),
        createSeedCard('en-8', 'run out of', 'исчерпать запас чего-либо'),
        createSeedCard('en-9', 'turn down', 'отклонить предложение; убавить громкость'),
        createSeedCard('en-10', 'work out', 'решить задачу; тренироваться; сложиться удачно'),
      ],
    },
    {
      id: 'seed-js-basics',
      title: 'Основы JavaScript',
      description:
        'Базовые концепции языка: замыкания, event loop, типы данных и асинхронность.',
      tags: ['JavaScript', 'Frontend', 'IT'],
      createdAt: now - 1000 * 60 * 60 * 12,
      updatedAt: now - 1000 * 60 * 60 * 12,
      bestMatchTimeMs: null,
      cards: [
        createSeedCard(
          'js-1',
          'Closure (Замыкание)',
          'Способность функции запоминать и обращаться к своему лексическому окружению даже после завершения внешней функции'
        ),
        createSeedCard(
          'js-2',
          'Event Loop',
          'Механизм координации стека вызовов, очереди микрозадач и макрозадач для неблокирующей работы JS'
        ),
        createSeedCard(
          'js-3',
          'Hoisting (Всплытие)',
          'Поведение движка, при котором объявления функций и var обрабатываются до выполнения кода'
        ),
        createSeedCard(
          'js-4',
          'Promise',
          'Объект, представляющий результат асинхронной операции в одном из состояний: pending, fulfilled или rejected'
        ),
        createSeedCard(
          'js-5',
          'Строгое равенство (===)',
          'Сравнение значений и их типов без неявного приведения типов'
        ),
        createSeedCard(
          'js-6',
          'Деструктуризация',
          'Синтаксис для извлечения значений из массивов или свойств из объектов в отдельные переменные'
        ),
        createSeedCard(
          'js-7',
          'Debounce',
          'Техника откладывания вызова функции до тех пор, пока не пройдёт заданная пауза после последнего события'
        ),
        createSeedCard(
          'js-8',
          'Прототипное наследование',
          'Механизм, при котором объекты наследуют свойства и методы от других объектов через цепочку [[Prototype]]'
        ),
      ],
    },
  ];
}