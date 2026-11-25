import { after, before, describe, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) throw new Error('Local Firestore emulator required.');
const projectId = 'demo-profu-de-mate';
let testEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await testEnvironment.cleanup();
});

describe('Firestore rules', () => {
  test('blochează citirea și scrierea după începerea ștergerii sau transferului', async () => {
    for (const state of ['deleting', 'deleted', 'merging']) {
      const uid = `fenced-${state}`;
      await testEnvironment.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), `_accountLifecycle/${uid}`), { state });
        await setDoc(doc(context.firestore(), `users/${uid}/lessons/lesson`), { isFavorite: true });
      });
      const database = testEnvironment.authenticatedContext(uid).firestore();
      await assertFails(getDoc(doc(database, `users/${uid}/lessons/lesson`)));
      await assertFails(setDoc(doc(database, `users/${uid}`), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(database, `users/${uid}/lessons/lesson`), { isFavorite: false, expiresAt: Timestamp.fromMillis(Date.now() + 1000), updatedAt: serverTimestamp() }));
      await assertFails(setDoc(doc(database, `_accountLifecycle/${uid}`), { state: 'active' }));
    }
  });
  test('refuză orice acces neautentificat', async () => {
    const database = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, 'users/alice')));
    await assertFails(setDoc(doc(database, 'users/alice'), {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  test('permite utilizatorului să-și creeze propriul profil minimal', async () => {
    const database = testEnvironment.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(database, 'users/alice'), {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      displayName: 'Ana',
      grade: 8,
      onboardingCompleted: true,
    }));
  });

  test('refuză citirea profilului altui utilizator', async () => {
    const database = testEnvironment.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(database, 'users/alice')));
  });

  test('ține configurația și evidența internă complet inaccesibile clienților', async () => {
    const database = testEnvironment.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(database, '_runtimeConfig/ai')));
    await assertFails(setDoc(doc(database, '_runtimeConfig/ai'), { enabled: false }));
    await assertFails(getDoc(doc(database, '_aiUsage/alice_2026-08-24')));
    await assertFails(getDoc(doc(database, '_analysisRequests/alice_request')));
    await assertFails(getDoc(doc(database, '_commercialUsers/alice')));
    await assertFails(getDoc(doc(database, '_commercialUsage/alice_2026-08-25')));
    await assertFails(getDoc(doc(database, '_commercialEntitlements/alice')));
    await assertFails(getDoc(doc(database, '_commercialReservations/alice_request')));
    await assertFails(getDoc(doc(database, '_commercialEvents/event-1')));
    await assertFails(getDoc(doc(database, '_accountMergeTickets/ticket-1')));
    await assertFails(getDoc(doc(database, '_pendingRevenueCatDeletions/alice')));
  });

  test('refuză crearea unei soluții direct din aplicație', async () => {
    const database = testEnvironment.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(database, 'users/alice/lessons/fake-solution'), {
      answer: '42',
      createdAt: serverTimestamp(),
    }));
  });

  test('permite doar preferințele sigure pe o lecție creată de backend', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice/lessons/lesson-1'), {
        answer: 'x = 4',
        mode: 'solve',
        isFavorite: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const alice = testEnvironment.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, 'users/alice/lessons/lesson-1'), {
      isFavorite: true,
      expiresAt: Timestamp.fromMillis(Date.now() + 400 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(alice, 'users/alice/lessons/lesson-1'), {
      expiresAt: Timestamp.fromMillis(Date.now() + 500 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(alice, 'users/alice/lessons/lesson-1'), {
      answer: 'x = 999',
      updatedAt: serverTimestamp(),
    }));
  });

  test('permite expirarea apropiată a unei lecții nesalvate, dar nu o dată arbitrară', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice/lessons/lesson-2'), {
        mode: 'solve',
        isFavorite: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const alice = testEnvironment.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, 'users/alice/lessons/lesson-2'), {
      isFavorite: false,
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(alice, 'users/alice/lessons/lesson-2'), {
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp(),
    }));
  });

  test('feedbackul poate fi scris numai de backendul de încredere', async () => {
    const alice = testEnvironment.authenticatedContext('alice').firestore();
    const feedback = doc(alice, 'feedback/report-1');
    await assertFails(setDoc(feedback, {
      userId: 'alice',
      lessonId: 'lesson-1',
      category: 'wrong_answer',
      message: 'Ultimul pas este greșit.',
      createdAt: serverTimestamp(),
      appVersion: '1.0.0',
    }));
    await assertFails(getDoc(feedback));
  });

  test('progresul de studiu permite doar documentul summary al proprietarului cu câmpuri valide', async () => {
    const alice = testEnvironment.authenticatedContext('alice').firestore();
    const bob = testEnvironment.authenticatedContext('bob').firestore();
    const aliceSummary = doc(alice, 'users/alice/studyProgress/summary');

    await assertSucceeds(setDoc(aliceSummary, {
      track: 'bac_m1',
      hasChosenTrack: true,
      favoriteFormulaIds: ['alg-ecuatie-gr2'],
      exploredFormulaIds: ['alg-ecuatie-gr2', 'ana-derivate-reguli'],
      masteredQuestionIds: ['prac-alg-gr2-1'],
      wrongQuestionIds: [],
      streakDays: 3,
      lastPracticeDateKey: '2026-11-24',
      sessionsCompleted: 2,
      totalAnswered: 10,
      totalCorrect: 8,
      updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(getDoc(aliceSummary));

    // Alt utilizator nu poate citi sau scrie progresul lui Alice.
    await assertFails(getDoc(doc(bob, 'users/alice/studyProgress/summary')));
    await assertFails(setDoc(doc(bob, 'users/alice/studyProgress/summary'), {
      track: 'en',
      hasChosenTrack: true,
      favoriteFormulaIds: [],
      exploredFormulaIds: [],
      masteredQuestionIds: [],
      wrongQuestionIds: [],
      streakDays: 0,
      lastPracticeDateKey: null,
      sessionsCompleted: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      updatedAt: serverTimestamp(),
    }));

    // Documente arbitrare, track invalid sau câmpuri neautorizate sunt respinse.
    await assertFails(setDoc(doc(alice, 'users/alice/studyProgress/other'), {
      track: 'en',
      hasChosenTrack: true,
      favoriteFormulaIds: [],
      exploredFormulaIds: [],
      masteredQuestionIds: [],
      wrongQuestionIds: [],
      streakDays: 0,
      lastPracticeDateKey: null,
      sessionsCompleted: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(aliceSummary, {
      track: 'invalid_track',
      hasChosenTrack: true,
      favoriteFormulaIds: [],
      exploredFormulaIds: [],
      masteredQuestionIds: [],
      wrongQuestionIds: [],
      streakDays: 0,
      lastPracticeDateKey: null,
      sessionsCompleted: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(aliceSummary, {
      track: 'en',
      hasChosenTrack: true,
      favoriteFormulaIds: [],
      exploredFormulaIds: [],
      masteredQuestionIds: [],
      wrongQuestionIds: [],
      streakDays: 0,
      lastPracticeDateKey: null,
      sessionsCompleted: 0,
      totalAnswered: 5,
      totalCorrect: 9,
      updatedAt: serverTimestamp(),
    }));

    // Istoricul simulărilor EN/BAC este acceptat cu înregistrări valide (inclusiv note cu zecimale și scope parțial cu grade null).
    const validExamRecord = {
      id: 'exam-1795270926952',
      variantId: 'bac-m1-2026-1',
      examId: 'bac_m1',
      scope: 'full',
      completedAt: '2026-11-25T08:30:00.000Z',
      awardedPoints: 94,
      maxPoints: 100,
      grade: 9.4,
      elapsedSeconds: 5400,
      subjectPoints: { s1: 30, s2: 28, s3: 26 },
    };
    await assertSucceeds(setDoc(aliceSummary, {
      track: 'bac_m1',
      hasChosenTrack: true,
      favoriteFormulaIds: ['alg-ecuatie-gr2'],
      exploredFormulaIds: ['alg-ecuatie-gr2'],
      masteredQuestionIds: [],
      wrongQuestionIds: [],
      streakDays: 1,
      lastPracticeDateKey: '2026-11-25',
      sessionsCompleted: 1,
      totalAnswered: 5,
      totalCorrect: 5,
      examRecords: [
        { ...validExamRecord, pauseCount: 0 },
        { ...validExamRecord, id: 'exam-partial', scope: 's2', awardedPoints: 25, maxPoints: 30, grade: null, pauseCount: 2 },
      ],
      updatedAt: serverTimestamp(),
    }));

    // Înregistrări invalide sau peste limita de 24 sunt respinse.
    await assertFails(setDoc(aliceSummary, {
      track: 'bac_m1',
      hasChosenTrack: true,
      favoriteFormulaIds: [],
      exploredFormulaIds: [],
      masteredQuestionIds: [],
      wrongQuestionIds: [],
      streakDays: 0,
      lastPracticeDateKey: null,
      sessionsCompleted: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      examRecords: [{ ...validExamRecord, pauseCount: -1 }],
      updatedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(aliceSummary, {
      track: 'bac_m1',
      hasChosenTrack: true,
      favoriteFormulaIds: [],
      exploredFormulaIds: [],
      masteredQuestionIds: [],
      wrongQuestionIds: [],
      streakDays: 0,
      lastPracticeDateKey: null,
      sessionsCompleted: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      examRecords: [{ ...validExamRecord, examId: 'invalid_exam' }],
      updatedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(aliceSummary, {
      track: 'bac_m1',
      hasChosenTrack: true,
      favoriteFormulaIds: [],
      exploredFormulaIds: [],
      masteredQuestionIds: [],
      wrongQuestionIds: [],
      streakDays: 0,
      lastPracticeDateKey: null,
      sessionsCompleted: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      examRecords: Array.from({ length: 25 }, (_, i) => ({ ...validExamRecord, id: `exam-${i}` })),
      updatedAt: serverTimestamp(),
    }));
  });
});
